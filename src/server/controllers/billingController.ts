import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  decryptLicenseKey,
  getBillingDb,
  type SupportedCurrency,
} from '../db/billingDb.ts';
import {
  DODO_SUPPORTED_LOCAL_CURRENCIES,
  cancelDodoSubscription,
  createDodoCheckoutSession,
  createDodoCustomerPortalSession,
  createDodoProduct,
  createDodoRefund,
  getDodoEnvironment,
  getItemMinorAmount,
  isDodoConfigured,
  isDodoWebhookConfigured,
  listDodoProducts,
  resolveProDodoProductId,
  resolveSponsorDodoProductId,
  retrieveDodoCheckoutStatus,
  retrieveDodoPayment,
  verifyAndUnwrapDodoWebhook,
} from '../services/dodoService.ts';
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks/webhooks';
import {
  processVerifiedDodoWebhook,
  revealVerifiedCheckoutKey,
} from '../services/webhookProcessor.ts';
import {
  getAdminAuthMode,
  issueAdminSessionToken,
  verifyAdminPassword,
} from '../services/adminAuth.ts';
import { sendTransactionalEmail } from '../services/emailService.ts';
import { appendReferralParam } from '../../data/sponsors.ts';
import { getSafeAppUrl } from './apiController.ts';

const currencySchema = z.enum(['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD']);

const proCheckoutSchema = z.object({
  planId: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(254),
  customerName: z.string().trim().max(120).optional(),
  currency: currencySchema.default('USD'),
  linkedFirebaseUid: z.string().trim().max(128).optional(),
});

const sponsorCheckoutSchema = z.object({
  frameId: z.string().regex(/^(frame-top|frame-0[1-8])$/),
  brandName: z.string().trim().min(1).max(32),
  tagline: z.string().trim().min(1).max(60),
  logoText: z.string().trim().min(1).max(4).optional(),
  logoUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://'), 'Logo URL must start with https://')
    .optional()
    .or(z.literal('')),
  destinationUrl: z
    .string()
    .trim()
    .url()
    .refine((u) => u.startsWith('https://'), 'Destination URL must start with https://'),
  contactEmail: z.string().trim().email().max(254),
  currency: currencySchema.default('USD'),
  durationMonths: z.number().int().min(1).max(12).default(1),
});

const validateKeySchema = z.object({
  licenseKey: z.string().trim().min(8).max(64),
  deviceId: z.string().trim().max(128).optional(),
});

const recoverEmailSchema = z.object({
  email: z.string().trim().email().max(254),
});

const syncAccountSchema = z.object({
  firebaseUid: z.string().trim().min(4).max(128),
  email: z.string().trim().email().max(254),
  licenseKey: z.string().trim().max(64).optional(),
});

const consumeCreditSchema = z.object({
  licenseKey: z.string().trim().min(8).max(64),
  amount: z.number().int().min(1).max(50).default(1),
});

const adminPricingUpdateSchema = z.object({
  priceUsdMinor: z.number().int().min(50).max(5000000).optional(),
  priceInrMinor: z.number().int().min(1000).max(50000000).optional(),
  active: z.boolean().optional(),
  dodoProductIdUsd: z.string().trim().max(128).optional(),
  dodoProductIdInr: z.string().trim().max(128).optional(),
  dodoProductIdDefault: z.string().trim().max(128).optional(),
});

const adminSlotUpdateSchema = z.object({
  priceUsdMinor: z.number().int().min(100).max(5000000).optional(),
  priceInrMinor: z.number().int().min(1000).max(50000000).optional(),
  dodoProductIdUsd: z.string().trim().max(128).optional(),
  dodoProductIdInr: z.string().trim().max(128).optional(),
});

const adminCampaignActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'expire', 'refund']),
  notes: z.string().trim().max(500).optional(),
});

const adminPassSchema = z.object({
  password: z.string().min(6).max(128),
});

function formatPublicEntitlement(db: ReturnType<typeof getBillingDb>, ent: NonNullable<ReturnType<typeof db.getEntitlementById>>) {
  const pricing = db.getPricingItem(ent.planId);
  return {
    id: ent.id,
    provider: ent.provider,
    planId: ent.planId,
    planName: pricing?.name || ent.planId,
    entitlementType: ent.entitlementType,
    status: ent.status,
    active: db.isEntitlementActive(ent),
    creditsBalance: ent.creditsBalance,
    creditsTotal: ent.creditsTotal,
    expiresAt: ent.expiresAt,
    licenseKeyPreview: ent.licenseKeyPreview,
    customerEmail: ent.customerEmail,
    linkedFirebaseUid: ent.linkedFirebaseUid,
    deviceCount: ent.devices.length,
    createdAt: ent.createdAt,
  };
}

export const BillingController = {
  // ---- Public Multi-Currency Pro Catalog ----
  getProPlans(_req: Request, res: Response) {
    const db = getBillingDb();
    const items = db.listPricingItems(false);
    return res.json({
      provider: 'dodo',
      environment: getDodoEnvironment(),
      dodoConfigured: isDodoConfigured(),
      webhookConfigured: isDodoWebhookConfigured(),
      supportedCurrencies: DODO_SUPPORTED_LOCAL_CURRENCIES,
      plans: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        targetAudience: item.targetAudience,
        subLabel: item.subLabel,
        priceUsd: Number((item.priceUsdMinor / 100).toFixed(2)),
        priceInr: Number((item.priceInrMinor / 100).toFixed(2)),
        priceUsdMinor: item.priceUsdMinor,
        priceInrMinor: item.priceInrMinor,
        billingInterval: item.billingInterval,
        durationDays: item.durationDays,
        creditsGranted: item.creditsGranted,
        featured: item.featured,
        highlights: item.highlights,
        hasDodoProductUsd: Boolean(item.dodoProductIdUsd || item.dodoProductIdDefault),
        hasDodoProductInr: Boolean(item.dodoProductIdInr || item.dodoProductIdDefault),
      })),
    });
  },

  // ---- Accountless Pro / Pass / Lifetime / Credit Pack Checkout via Dodo Payments ----
  async createProCheckout(req: Request, res: Response) {
    const parsed = proCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Please enter a valid email address, plan, and supported currency.',
      });
    }

    const db = getBillingDb();
    const item = db.getPricingItem(parsed.data.planId);
    if (!item || !item.active) {
      return res.status(404).json({ error: 'Selected plan or credit pack is unavailable.' });
    }

    const currency = parsed.data.currency as SupportedCurrency;
    const amountMinor = getItemMinorAmount(item, currency);
    const productId = resolveProDodoProductId(item, currency);

    const internalSessionId = `cks_tlvo_${crypto.randomBytes(10).toString('hex')}`;
    const baseUrl = getSafeAppUrl(req);

    db.createCheckoutSessionRecord({
      id: internalSessionId,
      kind: 'pro',
      itemId: item.id,
      currency,
      amountMinor,
      customerEmail: parsed.data.email,
      customerName: parsed.data.customerName || null,
      linkedFirebaseUid: parsed.data.linkedFirebaseUid || null,
      metadata: {
        planName: item.name,
        entitlementKind: item.kind,
      },
    });

    if (!isDodoConfigured()) {
      return res.status(503).json({
        configured: false,
        sessionId: internalSessionId,
        error:
          'Dodo Payments Checkout activates automatically once DODO_PAYMENTS_API_KEY and Dodo Product IDs are configured on the server.',
      });
    }

    if (!productId) {
      return res.status(503).json({
        configured: false,
        sessionId: internalSessionId,
        error: `No Dodo Product ID is mapped for "${item.name}" (${currency}). Set the Dodo Product ID in /admin -> Pricing & Dodo Products.`,
      });
    }

    try {
      const dodoSession = await createDodoCheckoutSession({
        productId,
        quantity: 1,
        currency,
        customerEmail: parsed.data.email,
        customerName: parsed.data.customerName,
        returnUrl: `${baseUrl}/pro?checkout=return&session_id=${encodeURIComponent(internalSessionId)}`,
        cancelUrl: `${baseUrl}/pro?checkout=cancelled&session_id=${encodeURIComponent(internalSessionId)}`,
        metadata: {
          toolivo_session_id: internalSessionId,
          toolivo_kind: 'pro',
          toolivo_item_id: item.id,
          toolivo_currency: currency,
          customer_email: parsed.data.email.toLowerCase(),
          ...(parsed.data.linkedFirebaseUid ? { firebase_uid: parsed.data.linkedFirebaseUid } : {}),
        },
      });

      db.updateCheckoutSession(internalSessionId, {
        externalSessionId: dodoSession.sessionId,
      });

      return res.json({
        configured: true,
        provider: 'dodo',
        environment: getDodoEnvironment(),
        sessionId: internalSessionId,
        dodoSessionId: dodoSession.sessionId,
        url: dodoSession.checkoutUrl,
      });
    } catch (err) {
      console.error('Dodo Payments Pro checkout creation failed:', err);
      return res.status(502).json({
        error: 'Could not initialize Dodo Payments Checkout. Please verify your Dodo API key, environment, and Product ID.',
      });
    }
  },

  // ---- Public Sponsor Frames + Live Dodo Sponsor Checkout ----
  getSponsors(_req: Request, res: Response) {
    const db = getBillingDb();
    return res.json({
      provider: 'dodo',
      environment: getDodoEnvironment(),
      dodoConfigured: isDodoConfigured(),
      supportedCurrencies: DODO_SUPPORTED_LOCAL_CURRENCIES,
      frames: db.getPublicSponsorFrames(),
    });
  },

  async createSponsorCheckout(req: Request, res: Response) {
    const parsed = sponsorCheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error:
          'Please enter a valid brand name, tagline, https:// destination URL, optional https:// logo URL, and email.',
      });
    }

    const db = getBillingDb();
    const slot = db.getSponsorSlot(parsed.data.frameId);
    if (!slot || slot.status === 'occupied') {
      return res.status(409).json({ error: 'Selected sponsor frame is currently occupied.' });
    }

    const currency = parsed.data.currency as SupportedCurrency;
    const unitMinor = currency === 'INR' ? slot.priceInrMinor : slot.priceUsdMinor;
    const totalMinor = unitMinor * parsed.data.durationMonths;
    const logoText = (
      parsed.data.logoText || parsed.data.brandName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'SP'
    ).toUpperCase();

    const campaign = db.createSponsorCampaign({
      slotId: slot.slotId,
      brandName: parsed.data.brandName,
      tagline: parsed.data.tagline,
      logoText,
      logoUrl: parsed.data.logoUrl ? parsed.data.logoUrl : null,
      destinationUrl: parsed.data.destinationUrl,
      contactEmail: parsed.data.contactEmail,
      currency,
      amountMinor: totalMinor,
      durationMonths: parsed.data.durationMonths,
    });

    const internalSessionId = `cks_sp_${crypto.randomBytes(10).toString('hex')}`;
    const baseUrl = getSafeAppUrl(req);

    db.createCheckoutSessionRecord({
      id: internalSessionId,
      kind: 'sponsor',
      itemId: slot.slotId,
      currency,
      amountMinor: totalMinor,
      customerEmail: parsed.data.contactEmail,
      customerName: parsed.data.brandName,
      campaignId: campaign.id,
      metadata: {
        slotNumber: slot.slotNumber,
        durationMonths: parsed.data.durationMonths,
      },
    });

    if (!isDodoConfigured()) {
      return res.status(503).json({
        configured: false,
        sessionId: internalSessionId,
        campaignId: campaign.id,
        error:
          'Dodo Payments Checkout activates once DODO_PAYMENTS_API_KEY and Sponsor Product IDs are configured on the server.',
      });
    }

    const productId = resolveSponsorDodoProductId(slot, currency);
    if (!productId) {
      return res.status(503).json({
        configured: false,
        sessionId: internalSessionId,
        campaignId: campaign.id,
        error: `No Dodo Product ID is mapped for Sponsor Frame ${slot.slotNumber} (${currency}). Configure it in /admin -> Pricing & Dodo Products.`,
      });
    }

    try {
      const dodoSession = await createDodoCheckoutSession({
        productId,
        quantity: parsed.data.durationMonths,
        currency,
        customerEmail: parsed.data.contactEmail,
        customerName: parsed.data.brandName,
        returnUrl: `${baseUrl}/advertise?checkout=return&session_id=${encodeURIComponent(internalSessionId)}`,
        cancelUrl: `${baseUrl}/advertise?checkout=cancelled&session_id=${encodeURIComponent(internalSessionId)}`,
        metadata: {
          toolivo_session_id: internalSessionId,
          toolivo_kind: 'sponsor',
          toolivo_item_id: slot.slotId,
          toolivo_campaign_id: campaign.id,
          toolivo_currency: currency,
          customer_email: parsed.data.contactEmail.toLowerCase(),
        },
      });

      db.updateCheckoutSession(internalSessionId, {
        externalSessionId: dodoSession.sessionId,
      });

      return res.json({
        configured: true,
        provider: 'dodo',
        environment: getDodoEnvironment(),
        sessionId: internalSessionId,
        campaignId: campaign.id,
        dodoSessionId: dodoSession.sessionId,
        url: dodoSession.checkoutUrl,
      });
    } catch (err) {
      console.error('Dodo Payments Sponsor checkout creation failed:', err);
      return res.status(502).json({
        error: 'Could not start Dodo Payments Checkout for this sponsor slot.',
      });
    }
  },

  // ---- Sponsor Impression & Click Tracking ----
  trackSponsorImpression(req: Request, res: Response) {
    const campaignId = String(req.params.campaignId || '').trim();
    if (!/^cmp_[a-f0-9]{20}$/.test(campaignId)) {
      return res.status(400).json({ error: 'Invalid campaign ID.' });
    }
    const db = getBillingDb();
    db.incrementCampaignMetric(campaignId, 'impressions');
    return res.status(204).end();
  },

  trackSponsorClick(req: Request, res: Response) {
    const campaignId = String(req.params.campaignId || '').trim();
    const db = getBillingDb();
    const campaign = db.getSponsorCampaign(campaignId);
    if (!campaign || campaign.status !== 'approved') {
      return res.redirect(302, '/advertise');
    }
    db.incrementCampaignMetric(campaignId, 'clicks');
    const safeDestination = campaign.destinationUrl.startsWith('https://')
      ? appendReferralParam(campaign.destinationUrl)
      : '/advertise';
    return res.redirect(302, safeDestination);
  },

  // ---- Webhook-Verified + Server-to-Server Dodo API Checkout Status Polling (Never Trusts Redirect URL!) ----
  async getCheckoutStatus(req: Request, res: Response) {
    const sessionId = String(req.params.sessionId || '').trim();
    if (!sessionId || sessionId.length > 128) {
      return res.status(400).json({ error: 'Invalid checkout session ID.' });
    }
    const db = getBillingDb();
    let result = revealVerifiedCheckoutKey(db, sessionId);
    if (result.sessionStatus === 'not_found') {
      return res.status(404).json({ error: 'Checkout session not found.' });
    }

    // If still pending webhook delivery and Dodo API is configured, perform authenticated server-to-server
    // verification directly against Dodo Payments API (never trusting browser query parameters)
    if (!result.verified && result.sessionStatus === 'created' && isDodoConfigured()) {
      const sessionRec = db.getCheckoutSession(sessionId);
      if (sessionRec?.externalSessionId) {
        try {
          const dodoStatus = await retrieveDodoCheckoutStatus(sessionRec.externalSessionId);
          if (dodoStatus.payment_status === 'succeeded' && dodoStatus.payment_id) {
            const payment = await retrieveDodoPayment(dodoStatus.payment_id);
            if (payment.status === 'succeeded') {
              const syntheticEvent = {
                business_id: payment.business_id,
                type: 'payment.succeeded',
                timestamp: payment.created_at || new Date().toISOString(),
                data: {
                  payload_type: 'Payment',
                  payment_id: payment.payment_id,
                  checkout_session_id: payment.checkout_session_id || sessionRec.externalSessionId,
                  subscription_id: payment.subscription_id || undefined,
                  currency: payment.currency,
                  total_amount: payment.total_amount,
                  customer: {
                    email: payment.customer?.email || sessionRec.customerEmail,
                    name: payment.customer?.name || sessionRec.customerName || undefined,
                  },
                  metadata: {
                    ...(payment.metadata || {}),
                    toolivo_session_id: sessionRec.id,
                    toolivo_kind: sessionRec.kind,
                    toolivo_item_id: sessionRec.itemId,
                    toolivo_currency: sessionRec.currency,
                    ...(sessionRec.campaignId ? { toolivo_campaign_id: sessionRec.campaignId } : {}),
                  },
                },
              } as unknown as UnwrapWebhookEvent;

              await processVerifiedDodoWebhook(
                db,
                syntheticEvent,
                `dodo_api_${payment.payment_id}`,
                JSON.stringify(syntheticEvent),
                getSafeAppUrl(req)
              );
              result = revealVerifiedCheckoutKey(db, sessionId);
            }
          } else if (dodoStatus.payment_status === 'failed' || dodoStatus.payment_status === 'cancelled') {
            db.updateCheckoutSession(sessionRec.id, {
              status: dodoStatus.payment_status,
            });
            result = revealVerifiedCheckoutKey(db, sessionId);
          }
        } catch (err) {
          console.error('Dodo server-to-server session verification check skipped:', err instanceof Error ? err.message : err);
        }
      }
    }

    return res.json(result);
  },

  // ---- Official Dodo Payments Customer Portal (Invoices, Subscriptions & Payment Methods) ----
  async createCustomerPortal(req: Request, res: Response) {
    const parsed = validateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'A valid active Toolivo Pro recovery key is required.' });
    }
    if (!isDodoConfigured()) {
      return res.status(503).json({
        error: 'Dodo Payments API key is not configured on the server.',
      });
    }

    const db = getBillingDb();
    const ent = db.getEntitlementByRawKey(parsed.data.licenseKey);
    if (!ent || !db.isEntitlementActive(ent)) {
      return res.status(403).json({ error: 'No active Toolivo Pro licence found for this key.' });
    }
    if (ent.provider !== 'dodo') {
      return res.status(400).json({
        error: 'This legacy licence was issued prior to Dodo Payments migration. Contact support for billing changes.',
      });
    }

    try {
      const portal = await createDodoCustomerPortalSession(
        ent.customerEmail,
        `${getSafeAppUrl(req)}/pro`
      );
      if (!portal?.link) {
        return res.status(404).json({
          error: 'No Dodo Payments customer profile found for this email yet.',
        });
      }
      return res.json({ url: portal.link });
    } catch (err) {
      console.error('Dodo Customer Portal creation failed:', err);
      return res.status(502).json({
        error: 'Unable to open Dodo Payments Customer Portal right now.',
      });
    }
  },

  // ---- Signed Dodo Payments Webhook Endpoint (Raw Body Verified via Standard Webhooks) ----
  async handleDodoWebhook(req: Request, res: Response) {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : '';

    const webhookId = String(req.headers['webhook-id'] || '').trim();
    const webhookSignature = String(req.headers['webhook-signature'] || '').trim();
    const webhookTimestamp = String(req.headers['webhook-timestamp'] || '').trim();

    if (!rawBody || !webhookId || !webhookSignature || !webhookTimestamp) {
      return res.status(400).json({
        error: 'Missing required Standard Webhooks headers (webhook-id, webhook-signature, webhook-timestamp) or body.',
      });
    }

    let event;
    try {
      event = verifyAndUnwrapDodoWebhook(rawBody, {
        'webhook-id': webhookId,
        'webhook-signature': webhookSignature,
        'webhook-timestamp': webhookTimestamp,
      });
    } catch (err) {
      console.error('Dodo webhook signature verification failed:', err instanceof Error ? err.message : err);
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    try {
      const db = getBillingDb();
      const result = await processVerifiedDodoWebhook(
        db,
        event,
        webhookId,
        rawBody,
        getSafeAppUrl(req)
      );
      return res.status(200).json({ received: true, ...result });
    } catch (err) {
      console.error('Dodo webhook processing error:', err);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  },

  // ---- Accountless Licence Key Validation, Device Activation & Restoration ----
  validateEntitlement(req: Request, res: Response) {
    const parsed = validateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid Toolivo recovery key (e.g. TLVO-XXXX-XXXX-XXXX).' });
    }

    const db = getBillingDb();
    const ent = db.getEntitlementByRawKey(parsed.data.licenseKey);
    if (!ent) {
      return res.status(404).json({ valid: false, error: 'Recovery key not found.' });
    }

    if (!db.isEntitlementActive(ent)) {
      return res.status(403).json({
        valid: false,
        status: ent.status,
        error: `This licence is currently ${ent.status}. Renew or purchase a new pass to reactivate Pro.`,
      });
    }

    if (parsed.data.deviceId) {
      const devices = new Set(ent.devices);
      if (devices.size < 10) {
        devices.add(parsed.data.deviceId);
        db.updateEntitlement(ent.id, { devices: Array.from(devices) });
      }
    }

    const refreshed = db.getEntitlementById(ent.id)!;
    return res.json({
      valid: true,
      entitlement: formatPublicEntitlement(db, refreshed),
    });
  },

  async recoverByEmail(req: Request, res: Response) {
    const parsed = recoverEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const db = getBillingDb();
    const matching = db
      .listEntitlementsByEmail(parsed.data.email)
      .filter((e) => db.isEntitlementActive(e));

    if (matching.length > 0) {
      const appUrl = getSafeAppUrl(req);
      const lines = matching.map((ent) => {
        const rawKey = decryptLicenseKey(ent.licenseKeyEnc) || ent.licenseKeyPreview;
        return `- Plan: ${ent.planId} | Key: ${rawKey} | Restore: ${appUrl}/pro?restore=${encodeURIComponent(rawKey)}`;
      });

      await sendTransactionalEmail(db, {
        to: parsed.data.email,
        template: 'license_recovery',
        subject: 'Your Toolivo Pro Recovery Key(s)',
        bodyText: [
          'Here are your active Toolivo Pro recovery keys:',
          '',
          ...lines,
          '',
          'Paste any key on the Toolivo Pro page to restore access on this device.',
        ].join('\n'),
      });
    }

    // Privacy-preserving constant response to prevent email enumeration
    return res.json({
      sent: true,
      message:
        'If an active Toolivo Pro purchase exists for that email address, your recovery key has been emailed to you.',
    });
  },

  // ---- Optional Registered Account Sync (Links Accountless Key <-> Firebase Auth User) ----
  syncAccountEntitlement(req: Request, res: Response) {
    const parsed = syncAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid account UID and email are required to sync entitlements.' });
    }

    const db = getBillingDb();
    const { firebaseUid, email, licenseKey } = parsed.data;

    // 1. If a key was provided, link it to this Firebase account
    if (licenseKey) {
      const ent = db.getEntitlementByRawKey(licenseKey);
      if (ent && db.isEntitlementActive(ent)) {
        db.updateEntitlement(ent.id, { linkedFirebaseUid: firebaseUid });
      }
    }

    // 2. Link any active entitlements matching the verified email to this UID
    const byEmail = db.listEntitlementsByEmail(email);
    for (const ent of byEmail) {
      if (db.isEntitlementActive(ent) && !ent.linkedFirebaseUid) {
        db.updateEntitlement(ent.id, { linkedFirebaseUid: firebaseUid });
      }
    }

    // 3. Return all active entitlements linked to this account
    const synced = db
      .listEntitlementsByUid(firebaseUid)
      .filter((e) => db.isEntitlementActive(e));

    return res.json({
      synced: true,
      entitlements: synced.map((e) => formatPublicEntitlement(db, e)),
    });
  },

  consumeCredits(req: Request, res: Response) {
    const parsed = consumeCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid credit deduction request.' });
    }
    const db = getBillingDb();
    const ent = db.getEntitlementByRawKey(parsed.data.licenseKey);
    if (!ent || !db.isEntitlementActive(ent)) {
      return res.status(403).json({ error: 'No active entitlement found.' });
    }
    if (ent.entitlementType !== 'credits') {
      return res.json({ unlimited: true, creditsBalance: ent.creditsBalance });
    }
    if (ent.creditsBalance < parsed.data.amount) {
      return res.status(402).json({ error: 'Insufficient credit balance.' });
    }
    const updated = db.updateEntitlement(ent.id, {
      creditsBalance: ent.creditsBalance - parsed.data.amount,
    })!;
    return res.json({
      unlimited: false,
      creditsBalance: updated.creditsBalance,
      entitlement: formatPublicEntitlement(db, updated),
    });
  },

  // ---- Admin Auth Endpoints ----
  getAdminAuthStatus(_req: Request, res: Response) {
    const { mode } = getAdminAuthMode();
    return res.json({ mode });
  },

  claimAdminPassword(req: Request, res: Response) {
    const { mode } = getAdminAuthMode();
    if (mode !== 'unclaimed_setup') {
      return res.status(403).json({ error: 'Admin password has already been configured.' });
    }
    const parsed = adminPassSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const db = getBillingDb();
    const claimed = db.claimAdminCredential(parsed.data.password);
    if (!claimed) {
      return res.status(409).json({ error: 'Admin password was already claimed.' });
    }
    const session = issueAdminSessionToken();
    return res.json({ claimed: true, ...session });
  },

  loginAdmin(req: Request, res: Response) {
    const parsed = adminPassSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter your admin password.' });
    }
    if (!verifyAdminPassword(parsed.data.password)) {
      return res.status(401).json({ error: 'Invalid admin password.' });
    }
    const session = issueAdminSessionToken();
    return res.json({ authenticated: true, ...session });
  },

  // ---- Protected Admin Dashboard Endpoints ----
  getAdminOverview(_req: Request, res: Response) {
    const db = getBillingDb();
    const payments = db.listPayments(100);
    const subscriptions = db.listSubscriptions(100);
    const entitlements = db.listAllEntitlements(100).map((e) => formatPublicEntitlement(db, e));
    const campaigns = db.listSponsorCampaigns();
    const slots = db.listSponsorSlots();
    const pricing = db.listPricingItems(true);
    const webhooks = db.listWebhookEvents(30);
    const emails = db.listEmailNotifications(25);

    return res.json({
      provider: 'dodo',
      environment: getDodoEnvironment(),
      dodoConfigured: isDodoConfigured(),
      webhookConfigured: isDodoWebhookConfigured(),
      pricing,
      slots,
      campaigns,
      payments,
      subscriptions,
      entitlements,
      webhooks,
      emails,
    });
  },

  async listAdminDodoProducts(_req: Request, res: Response) {
    if (!isDodoConfigured()) {
      return res.status(503).json({
        error: 'DODO_PAYMENTS_API_KEY is not configured on the server.',
      });
    }
    try {
      const products = await listDodoProducts();
      return res.json({
        environment: getDodoEnvironment(),
        count: products.length,
        products,
      });
    } catch (err) {
      console.error('Failed to list Dodo products:', err);
      return res.status(502).json({
        error: 'Could not fetch products from Dodo Payments API. Verify your DODO_PAYMENTS_API_KEY and environment.',
      });
    }
  },

  async syncAdminDodoProducts(_req: Request, res: Response) {
    if (!isDodoConfigured()) {
      return res.status(503).json({
        error: 'DODO_PAYMENTS_API_KEY is not configured on the server.',
      });
    }

    const db = getBillingDb();
    const created: Array<{ target: string; currency: 'USD' | 'INR'; productId: string }> = [];

    try {
      // 1. Provision missing USD & INR Dodo products for Pro plans, passes, lifetime & credit packs
      const pricingItems = db.listPricingItems(true);
      for (const item of pricingItems) {
        let usdId = item.dodoProductIdUsd;
        let inrId = item.dodoProductIdInr;

        if (!usdId) {
          const p = await createDodoProduct({
            name: `Toolivo ${item.name} (USD)`,
            description: item.subLabel,
            currency: 'USD',
            priceMinor: item.priceUsdMinor,
            recurringInterval: item.kind === 'subscription' ? item.billingInterval : null,
            metadata: { toolivo_item_id: item.id, toolivo_kind: 'pro', currency: 'USD' },
          });
          usdId = p.productId;
          created.push({ target: item.id, currency: 'USD', productId: usdId });
        }

        if (!inrId) {
          const p = await createDodoProduct({
            name: `Toolivo ${item.name} (INR)`,
            description: item.subLabel,
            currency: 'INR',
            priceMinor: item.priceInrMinor,
            recurringInterval: item.kind === 'subscription' ? item.billingInterval : null,
            metadata: { toolivo_item_id: item.id, toolivo_kind: 'pro', currency: 'INR' },
          });
          inrId = p.productId;
          created.push({ target: item.id, currency: 'INR', productId: inrId });
        }

        if (usdId !== item.dodoProductIdUsd || inrId !== item.dodoProductIdInr) {
          db.updatePricingItem(item.id, {
            dodoProductIdUsd: usdId,
            dodoProductIdInr: inrId,
            dodoProductIdDefault: item.dodoProductIdDefault || usdId,
          });
        }
      }

      // 2. Provision shared Dodo sponsor products (1 for full-width banner, 1 for standard 8 frames) per currency
      const slots = db.listSponsorSlots();
      const bannerSlot = slots.find((s) => s.slotId === 'frame-top');
      const standardSlots = slots.filter((s) => s.slotId !== 'frame-top');

      if (bannerSlot) {
        let usdId = bannerSlot.dodoProductIdUsd;
        let inrId = bannerSlot.dodoProductIdInr;
        if (!usdId) {
          const p = await createDodoProduct({
            name: 'Toolivo Full-Width Top Sponsor Banner (USD)',
            description: 'Exclusive top full-width sponsor banner across Toolivo homepage & tools',
            currency: 'USD',
            priceMinor: bannerSlot.priceUsdMinor,
            recurringInterval: null,
            metadata: { toolivo_kind: 'sponsor', slot_tier: 'banner', currency: 'USD' },
          });
          usdId = p.productId;
          created.push({ target: 'frame-top', currency: 'USD', productId: usdId });
        }
        if (!inrId) {
          const p = await createDodoProduct({
            name: 'Toolivo Full-Width Top Sponsor Banner (INR)',
            description: 'Exclusive top full-width sponsor banner across Toolivo homepage & tools',
            currency: 'INR',
            priceMinor: bannerSlot.priceInrMinor,
            recurringInterval: null,
            metadata: { toolivo_kind: 'sponsor', slot_tier: 'banner', currency: 'INR' },
          });
          inrId = p.productId;
          created.push({ target: 'frame-top', currency: 'INR', productId: inrId });
        }
        if (usdId !== bannerSlot.dodoProductIdUsd || inrId !== bannerSlot.dodoProductIdInr) {
          db.updateSponsorSlotPricing(bannerSlot.slotId, {
            dodoProductIdUsd: usdId,
            dodoProductIdInr: inrId,
          });
        }
      }

      const existingStdUsd = standardSlots.find((s) => s.dodoProductIdUsd)?.dodoProductIdUsd || '';
      const existingStdInr = standardSlots.find((s) => s.dodoProductIdInr)?.dodoProductIdInr || '';
      let stdUsdId = existingStdUsd;
      let stdInrId = existingStdInr;

      if (!stdUsdId && standardSlots[0]) {
        const p = await createDodoProduct({
          name: 'Toolivo Sponsor Frame — 1 Month (USD)',
          description: 'Curated sponsor frame across Toolivo homepage & all 43 utilities',
          currency: 'USD',
          priceMinor: standardSlots[0].priceUsdMinor,
          recurringInterval: null,
          metadata: { toolivo_kind: 'sponsor', slot_tier: 'standard', currency: 'USD' },
        });
        stdUsdId = p.productId;
        created.push({ target: 'frames-01-08', currency: 'USD', productId: stdUsdId });
      }
      if (!stdInrId && standardSlots[0]) {
        const p = await createDodoProduct({
          name: 'Toolivo Sponsor Frame — 1 Month (INR)',
          description: 'Curated sponsor frame across Toolivo homepage & all 43 utilities',
          currency: 'INR',
          priceMinor: standardSlots[0].priceInrMinor,
          recurringInterval: null,
          metadata: { toolivo_kind: 'sponsor', slot_tier: 'standard', currency: 'INR' },
        });
        stdInrId = p.productId;
        created.push({ target: 'frames-01-08', currency: 'INR', productId: stdInrId });
      }

      for (const slot of standardSlots) {
        if (!slot.dodoProductIdUsd || !slot.dodoProductIdInr) {
          db.updateSponsorSlotPricing(slot.slotId, {
            dodoProductIdUsd: slot.dodoProductIdUsd || stdUsdId,
            dodoProductIdInr: slot.dodoProductIdInr || stdInrId,
          });
        }
      }

      return res.json({
        synced: true,
        environment: getDodoEnvironment(),
        createdCount: created.length,
        created,
      });
    } catch (err) {
      console.error('Failed to auto-sync Dodo products:', err);
      return res.status(502).json({
        error: 'Failed to create products in Dodo Payments. Verify API key permissions and environment.',
      });
    }
  },

  updateAdminPricingItem(req: Request, res: Response) {
    const itemId = String(req.params.itemId || '').trim();
    const parsed = adminPricingUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid pricing update payload.' });
    }
    const db = getBillingDb();
    const updated = db.updatePricingItem(itemId, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'Pricing item not found.' });
    }
    return res.json({ item: updated });
  },

  updateAdminSponsorSlot(req: Request, res: Response) {
    const slotId = String(req.params.slotId || '').trim();
    const parsed = adminSlotUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid sponsor slot pricing payload.' });
    }
    const db = getBillingDb();
    const updated = db.updateSponsorSlotPricing(slotId, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: 'Sponsor slot not found.' });
    }
    return res.json({ slot: updated });
  },

  async manageAdminCampaign(req: Request, res: Response) {
    const campaignId = String(req.params.campaignId || '').trim();
    const parsed = adminCampaignActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid campaign action.' });
    }

    const db = getBillingDb();
    const campaign = db.getSponsorCampaign(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Sponsor campaign not found.' });
    }

    const { action, notes } = parsed.data;
    if (action === 'approve') {
      if (campaign.status !== 'pending_approval' && campaign.status !== 'rejected') {
        return res.status(409).json({
          error: `Only payment-verified campaigns can be approved (current status: ${campaign.status}).`,
        });
      }
      const startsAt = new Date().toISOString();
      const exp = new Date();
      exp.setUTCMonth(exp.getUTCMonth() + campaign.durationMonths);
      const updated = db.updateSponsorCampaign(campaign.id, {
        status: 'approved',
        startsAt,
        expiresAt: exp.toISOString(),
        adminNotes: notes || 'Approved by Toolivo admin',
      });
      await sendTransactionalEmail(db, {
        to: campaign.contactEmail,
        template: 'sponsor_approved',
        subject: `Live Now — Your Toolivo Sponsor Placement (${campaign.brandName})`,
        bodyText: `Great news! Your sponsor placement on ${campaign.slotId} is now live until ${exp.toISOString()}.`,
      });
      return res.json({ campaign: updated });
    }

    if (action === 'reject') {
      const updated = db.updateSponsorCampaign(campaign.id, {
        status: 'rejected',
        adminNotes: notes || 'Rejected during editorial review',
      });
      await sendTransactionalEmail(db, {
        to: campaign.contactEmail,
        template: 'sponsor_rejected',
        subject: `Editorial Review Update — Toolivo Sponsor Booking (${campaign.brandName})`,
        bodyText: `Your sponsor submission was not approved (${notes || 'did not meet editorial guidelines'}). A full refund can be issued via Dodo Payments.`,
      });
      return res.json({ campaign: updated });
    }

    if (action === 'expire') {
      const updated = db.updateSponsorCampaign(campaign.id, {
        status: 'expired',
        expiresAt: new Date().toISOString(),
        adminNotes: notes || 'Marked expired by admin',
      });
      return res.json({ campaign: updated });
    }

    // Refund action: initiate Dodo refund when configured & payment exists, then vacate slot
    if (campaign.externalPaymentId && isDodoConfigured() && campaign.provider === 'dodo') {
      try {
        await createDodoRefund(campaign.externalPaymentId, notes || 'Sponsor campaign refund');
      } catch (err) {
        console.error('Dodo refund API call failed:', err);
        return res.status(502).json({
          error: 'Dodo Payments refund request failed. Verify payment ID in Dodo Dashboard.',
        });
      }
    }

    const updated = db.updateSponsorCampaign(campaign.id, {
      status: 'refunded',
      adminNotes: notes || 'Refunded by admin',
    });
    if (campaign.externalPaymentId) {
      const pay = db.getPaymentByExternalId(campaign.provider, campaign.externalPaymentId);
      if (pay) {
        db.upsertPayment({
          provider: pay.provider,
          externalPaymentId: pay.externalPaymentId,
          kind: pay.kind,
          itemId: pay.itemId,
          customerEmail: pay.customerEmail,
          currency: pay.currency,
          amountMinor: pay.amountMinor,
          status: 'refunded',
          refundedAmountMinor: pay.amountMinor,
          refundReason: notes || 'Admin refund',
        });
      }
    }
    await sendTransactionalEmail(db, {
      to: campaign.contactEmail,
      template: 'sponsor_refunded',
      subject: `Refund Initiated — Toolivo Sponsor Campaign (${campaign.brandName})`,
      bodyText: `A refund has been initiated for campaign ${campaign.id}. Slot ${campaign.slotId} has been released.`,
    });
    return res.json({ campaign: updated });
  },

  async adminRefundPayment(req: Request, res: Response) {
    const paymentId = String(req.params.paymentId || '').trim();
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 200) : 'Admin initiated refund';
    const db = getBillingDb();
    const pay = db.getPaymentById(paymentId);
    if (!pay) {
      return res.status(404).json({ error: 'Payment record not found.' });
    }
    if (pay.provider === 'dodo' && isDodoConfigured()) {
      try {
        await createDodoRefund(pay.externalPaymentId, reason);
      } catch (err) {
        console.error('Dodo refund failed:', err);
        return res.status(502).json({ error: 'Dodo Payments refund call failed.' });
      }
    }
    const updated = db.upsertPayment({
      provider: pay.provider,
      externalPaymentId: pay.externalPaymentId,
      kind: pay.kind,
      itemId: pay.itemId,
      customerEmail: pay.customerEmail,
      currency: pay.currency,
      amountMinor: pay.amountMinor,
      status: 'refunded',
      refundedAmountMinor: pay.amountMinor,
      refundReason: reason,
    });
    const ent = db.getEntitlementBySourcePaymentId(pay.externalPaymentId);
    if (ent) {
      db.updateEntitlement(ent.id, { status: 'revoked', creditsBalance: 0 });
    }
    return res.json({ payment: updated });
  },

  async adminCancelSubscription(req: Request, res: Response) {
    const externalSubId = String(req.params.subscriptionId || '').trim();
    const db = getBillingDb();
    const sub = db.getSubscriptionByExternalId('dodo', externalSubId);
    if (!sub) {
      return res.status(404).json({ error: 'Dodo subscription not found.' });
    }
    if (isDodoConfigured()) {
      try {
        await cancelDodoSubscription(externalSubId);
      } catch (err) {
        console.error('Dodo subscription cancellation failed:', err);
        return res.status(502).json({ error: 'Dodo Payments subscription cancel call failed.' });
      }
    }
    const updated = db.upsertSubscription({
      provider: 'dodo',
      externalSubscriptionId: externalSubId,
      customerEmail: sub.customerEmail,
      itemId: sub.itemId,
      kind: sub.kind,
      currency: sub.currency,
      amountMinor: sub.amountMinor,
      billingInterval: sub.billingInterval,
      status: 'cancelled',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
    return res.json({ subscription: updated });
  },
};
