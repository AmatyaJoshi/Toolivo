import crypto from 'node:crypto';
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks/webhooks';
import {
  decryptLicenseKey,
  type BillingDatabase,
  type SupportedCurrency,
} from '../db/billingDb.ts';
import { sendTransactionalEmail } from './emailService.ts';
import { OWNER_SPONSOR_EMAIL } from '../../data/sponsors.ts';

export interface WebhookProcessResult {
  duplicate: boolean;
  eventType: string;
  webhookId: string;
  action: string;
  entitlementId?: string | null;
  campaignId?: string | null;
  paymentId?: string | null;
}

function normalizeCurrency(raw?: string | null): SupportedCurrency {
  const code = String(raw || 'USD').toUpperCase();
  if (
    code === 'INR' ||
    code === 'USD' ||
    code === 'EUR' ||
    code === 'GBP' ||
    code === 'CAD' ||
    code === 'AUD' ||
    code === 'SGD'
  ) {
    return code;
  }
  return 'USD';
}

function addDaysIso(days: number, fromIso?: string | null): string {
  const base = fromIso ? new Date(fromIso).getTime() : Date.now();
  const startMs = Number.isFinite(base) && base > Date.now() ? base : Date.now();
  return new Date(startMs + days * 24 * 60 * 60 * 1000).toISOString();
}

function addMonthsIso(months: number, fromIso?: string | null): string {
  const base = fromIso && new Date(fromIso).getTime() > Date.now() ? new Date(fromIso) : new Date();
  const next = new Date(base.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString();
}

function formatMoneyLabel(amountMinor: number, currency: SupportedCurrency): string {
  const value = (amountMinor / 100).toFixed(currency === 'INR' ? 0 : 2);
  if (currency === 'INR') return `₹${Number(value).toLocaleString('en-IN')} INR`;
  if (currency === 'EUR') return `€${value} EUR`;
  if (currency === 'GBP') return `£${value} GBP`;
  return `$${value} ${currency}`;
}

/**
 * Processes a verified Dodo Payments webhook event idempotently.
 * Every payment entitlement activation, subscription renewal/cancellation, refund revocation,
 * and sponsor approval-queue transition happens strictly here—never on frontend return URLs.
 */
export async function processVerifiedDodoWebhook(
  db: BillingDatabase,
  event: UnwrapWebhookEvent,
  webhookId: string,
  rawBody: string,
  appUrl: string
): Promise<WebhookProcessResult> {
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  // Idempotency guard: if this Standard Webhooks ID was already processed, acknowledge immediately
  if (db.hasProcessedWebhook(webhookId)) {
    return {
      duplicate: true,
      eventType: event.type,
      webhookId,
      action: 'idempotent_skip',
    };
  }

  const eventType = event.type;
  const data = ((event as unknown as { data?: Record<string, unknown> }).data) || {};
  const metadata = (data.metadata as Record<string, string> | undefined) || {};
  const customerObj = (data.customer as { email?: string; name?: string } | undefined) || {};
  const customerEmail = (
    customerObj.email ||
    metadata.customer_email ||
    ''
  )
    .trim()
    .toLowerCase();

  const checkoutSessionRef =
    metadata.toolivo_session_id || (data.checkout_session_id as string | undefined) || null;
  const sessionRec = checkoutSessionRef ? db.getCheckoutSession(checkoutSessionRef) : null;

  const kind: 'pro' | 'sponsor' =
    metadata.toolivo_kind === 'sponsor' || sessionRec?.kind === 'sponsor' ? 'sponsor' : 'pro';
  const itemId = metadata.toolivo_item_id || sessionRec?.itemId || 'monthly';
  const currency = normalizeCurrency(
    (data.currency as string | undefined) || metadata.toolivo_currency || sessionRec?.currency
  );
  const amountMinor = Number(
    data.total_amount ?? data.amount ?? sessionRec?.amountMinor ?? 0
  );

  try {
    let action = 'acknowledged';
    let entitlementId: string | null = null;
    let campaignId: string | null = metadata.toolivo_campaign_id || sessionRec?.campaignId || null;
    let paymentId: string | null = null;

    if (eventType === 'payment.succeeded') {
      const externalPaymentId = String(data.payment_id || `dodo_pay_${webhookId}`);
      const externalSubId = data.subscription_id ? String(data.subscription_id) : null;

      const payment = db.upsertPayment({
        provider: 'dodo',
        externalPaymentId,
        externalSessionId: sessionRec?.externalSessionId || (data.checkout_session_id as string) || null,
        externalSubscriptionId: externalSubId,
        kind,
        itemId,
        customerEmail: customerEmail || sessionRec?.customerEmail || 'unknown@toolivo.app',
        currency,
        amountMinor,
        status: 'succeeded',
        metadata: { ...metadata, webhookId, eventType },
      });
      paymentId = payment.id;

      if (kind === 'pro') {
        const pricing = db.getPricingItem(itemId);
        const entitlementType = pricing?.kind && pricing.kind !== 'sponsor' ? pricing.kind : 'subscription';
        const expiresAt =
          entitlementType === 'pass'
            ? addDaysIso(pricing?.durationDays ?? 7)
            : entitlementType === 'subscription'
              ? addDaysIso(pricing?.billingInterval === 'year' ? 365 : 31)
              : null;

        // Check if this payment is a subscription renewal for an existing entitlement
        const existingSubEnt = externalSubId ? db.getEntitlementBySubscriptionId(externalSubId) : null;
        if (existingSubEnt) {
          const extended = db.updateEntitlement(existingSubEnt.id, {
            status: 'active',
            expiresAt: expiresAt
              ? addDaysIso(
                  pricing?.billingInterval === 'year' ? 365 : 31,
                  existingSubEnt.expiresAt
                )
              : existingSubEnt.expiresAt,
          });
          entitlementId = extended?.id ?? existingSubEnt.id;
          action = 'pro_subscription_payment_extended';
        } else {
          // Accountless Pro entitlement issuance (idempotent by sourcePaymentId)
          const { entitlement, rawKey } = db.createEntitlement({
            provider: 'dodo',
            customerEmail: payment.customerEmail,
            linkedFirebaseUid: sessionRec?.linkedFirebaseUid ?? metadata.firebase_uid ?? null,
            planId: itemId,
            entitlementType,
            creditsGranted: pricing?.creditsGranted ?? 0,
            expiresAt,
            sourcePaymentId: externalPaymentId,
            sourceSubscriptionId: externalSubId,
          });
          entitlementId = entitlement.id;
          action = 'pro_entitlement_issued';

          if (sessionRec) {
            db.updateCheckoutSession(sessionRec.id, {
              status: 'completed',
              entitlementId: entitlement.id,
            });
          }

          await sendTransactionalEmail(db, {
            to: payment.customerEmail,
            template: 'pro_license_delivered',
            subject: `Your Toolivo Pro Recovery Key (${pricing?.name || itemId})`,
            bodyText: [
              `Thank you for supporting Toolivo! Your payment (${formatMoneyLabel(amountMinor, currency)}) was verified by Dodo Payments.`,
              '',
              `Plan: ${pricing?.name || itemId}`,
              `Recovery / Licence Key: ${rawKey}`,
              entitlement.creditsTotal > 0 ? `Credits Added: ${entitlement.creditsTotal}` : '',
              entitlement.expiresAt ? `Valid Until: ${entitlement.expiresAt}` : 'Validity: Permanent / Non-Expiring',
              '',
              `Restore Pro on any browser or device: ${appUrl}/pro?restore=${encodeURIComponent(rawKey)}`,
              'Keep this key safe — no password or account is required.',
            ]
              .filter(Boolean)
              .join('\n'),
          });
        }
      } else if (kind === 'sponsor') {
        // Sponsor booking payment verified -> place into PENDING ADMIN APPROVAL (never auto-publish!)
        const targetCampaignId = campaignId || sessionRec?.campaignId;
        if (targetCampaignId) {
          const existingCampaign = db.getSponsorCampaign(targetCampaignId);
          if (existingCampaign) {
            const nextStatus =
              existingCampaign.status === 'approved' ? 'approved' : 'pending_approval';
            const nextExpires =
              existingCampaign.status === 'approved'
                ? addMonthsIso(existingCampaign.durationMonths, existingCampaign.expiresAt)
                : existingCampaign.expiresAt;

            db.updateSponsorCampaign(existingCampaign.id, {
              status: nextStatus,
              externalPaymentId,
              externalSubscriptionId: externalSubId,
              expiresAt: nextExpires,
            });
            campaignId = existingCampaign.id;
            action =
              nextStatus === 'approved'
                ? 'sponsor_renewal_extended'
                : 'sponsor_queued_pending_approval';

            if (sessionRec) {
              db.updateCheckoutSession(sessionRec.id, {
                status: 'completed',
                campaignId: existingCampaign.id,
              });
            }

            await sendTransactionalEmail(db, {
              to: existingCampaign.contactEmail,
              template: 'sponsor_payment_received',
              subject: `Payment Verified — Toolivo Sponsor Slot ${existingCampaign.slotId.replace('frame-', '#')} Pending Review`,
              bodyText: [
                `We verified your Dodo Payments transaction (${formatMoneyLabel(amountMinor, currency)}) for ${existingCampaign.brandName}.`,
                `Slot: ${existingCampaign.slotId}`,
                `Campaign ID: ${existingCampaign.id}`,
                `Status: Pending Admin Approval (your placement goes live immediately after editorial review).`,
              ].join('\n'),
            });

            await sendTransactionalEmail(db, {
              to: OWNER_SPONSOR_EMAIL,
              template: 'admin_sponsor_alert',
              subject: `[Toolivo Admin] Paid Sponsor Campaign Awaiting Approval: ${existingCampaign.brandName}`,
              bodyText: [
                `New paid sponsor booking verified via Dodo Payments webhook:`,
                `Brand: ${existingCampaign.brandName} — ${existingCampaign.tagline}`,
                `Slot: ${existingCampaign.slotId}`,
                `Amount: ${formatMoneyLabel(amountMinor, currency)} (${existingCampaign.durationMonths} mo)`,
                `URL: ${existingCampaign.destinationUrl}`,
                `Review & approve at: ${appUrl}/admin`,
              ].join('\n'),
            });
          }
        }
      }
    } else if (eventType === 'payment.failed' || eventType === 'payment.cancelled') {
      const externalPaymentId = String(data.payment_id || `dodo_fail_${webhookId}`);
      const payment = db.upsertPayment({
        provider: 'dodo',
        externalPaymentId,
        externalSessionId: sessionRec?.externalSessionId || null,
        kind,
        itemId,
        customerEmail: customerEmail || sessionRec?.customerEmail || 'unknown@toolivo.app',
        currency,
        amountMinor,
        status: eventType === 'payment.cancelled' ? 'cancelled' : 'failed',
        metadata: { ...metadata, webhookId, eventType },
      });
      paymentId = payment.id;
      if (sessionRec) {
        db.updateCheckoutSession(sessionRec.id, {
          status: eventType === 'payment.cancelled' ? 'cancelled' : 'failed',
        });
      }
      action = eventType === 'payment.cancelled' ? 'payment_cancelled' : 'payment_failed';
    } else if (eventType === 'subscription.active' || eventType === 'subscription.renewed') {
      const externalSubId = String(data.subscription_id || `dodo_sub_${webhookId}`);
      const pricing = db.getPricingItem(itemId);
      const interval: 'month' | 'year' =
        pricing?.billingInterval === 'year' ||
        String(data.payment_frequency_interval || '').toLowerCase() === 'year'
          ? 'year'
          : 'month';
      const nextBilling =
        (data.next_billing_date as string | undefined) ||
        addDaysIso(interval === 'year' ? 365 : 31);

      let ent = db.getEntitlementBySubscriptionId(externalSubId);
      if (kind === 'pro') {
        if (!ent && sessionRec?.entitlementId) {
          ent = db.getEntitlementById(sessionRec.entitlementId);
          if (ent) {
            ent = db.updateEntitlement(ent.id, {
              sourceSubscriptionId: externalSubId,
              status: 'active',
              expiresAt: nextBilling,
            });
          }
        }
        if (!ent) {
          const created = db.createEntitlement({
            provider: 'dodo',
            customerEmail: customerEmail || sessionRec?.customerEmail || 'unknown@toolivo.app',
            linkedFirebaseUid: sessionRec?.linkedFirebaseUid ?? metadata.firebase_uid ?? null,
            planId: itemId,
            entitlementType: 'subscription',
            expiresAt: nextBilling,
            sourceSubscriptionId: externalSubId,
          });
          ent = created.entitlement;
          if (sessionRec) {
            db.updateCheckoutSession(sessionRec.id, {
              status: 'completed',
              entitlementId: ent.id,
            });
          }
          await sendTransactionalEmail(db, {
            to: ent.customerEmail,
            template: 'pro_license_delivered',
            subject: `Your Toolivo Pro Subscription is Active`,
            bodyText: [
              `Your Toolivo Pro subscription (${pricing?.name || itemId}) is now active.`,
              `Recovery / Licence Key: ${created.rawKey}`,
              `Current Period End: ${nextBilling}`,
              `Restore on any device: ${appUrl}/pro?restore=${encodeURIComponent(created.rawKey)}`,
            ].join('\n'),
          });
        } else {
          ent = db.updateEntitlement(ent.id, {
            status: 'active',
            expiresAt: nextBilling,
          });
        }
        entitlementId = ent?.id ?? null;
      }

      db.upsertSubscription({
        provider: 'dodo',
        externalSubscriptionId: externalSubId,
        customerEmail: customerEmail || sessionRec?.customerEmail || ent?.customerEmail || 'unknown@toolivo.app',
        itemId,
        kind,
        currency,
        amountMinor,
        billingInterval: interval,
        status: 'active',
        cancelAtPeriodEnd: Boolean(data.cancel_at_next_billing_date),
        currentPeriodStart: (data.previous_billing_date as string | undefined) || new Date().toISOString(),
        currentPeriodEnd: nextBilling,
        entitlementId,
        campaignId,
      });

      action = eventType === 'subscription.renewed' ? 'subscription_renewed' : 'subscription_activated';
    } else if (
      eventType === 'subscription.cancelled' ||
      eventType === 'subscription.expired' ||
      eventType === 'subscription.on_hold' ||
      eventType === 'subscription.past_due' ||
      eventType === 'subscription.paused' ||
      eventType === 'subscription.failed'
    ) {
      const externalSubId = String(data.subscription_id || '');
      const statusMap: Record<string, 'cancelled' | 'expired' | 'on_hold' | 'past_due' | 'paused' | 'failed'> = {
        'subscription.cancelled': 'cancelled',
        'subscription.expired': 'expired',
        'subscription.on_hold': 'on_hold',
        'subscription.past_due': 'past_due',
        'subscription.paused': 'paused',
        'subscription.failed': 'failed',
      };
      const mappedStatus = statusMap[eventType] || 'cancelled';

      if (externalSubId) {
        const existingSub = db.getSubscriptionByExternalId('dodo', externalSubId);
        db.upsertSubscription({
          provider: 'dodo',
          externalSubscriptionId: externalSubId,
          customerEmail: customerEmail || existingSub?.customerEmail || 'unknown@toolivo.app',
          itemId: existingSub?.itemId || itemId,
          kind: existingSub?.kind || kind,
          currency: existingSub?.currency || currency,
          amountMinor: existingSub?.amountMinor || amountMinor,
          billingInterval: existingSub?.billingInterval || 'month',
          status: mappedStatus,
          cancelAtPeriodEnd: mappedStatus === 'cancelled',
          currentPeriodEnd: (data.next_billing_date as string | undefined) || existingSub?.currentPeriodEnd || null,
          entitlementId: existingSub?.entitlementId || null,
          campaignId: existingSub?.campaignId || null,
        });

        const ent = db.getEntitlementBySubscriptionId(externalSubId);
        if (ent) {
          entitlementId = ent.id;
          if (mappedStatus === 'expired' || mappedStatus === 'failed') {
            db.updateEntitlement(ent.id, { status: 'expired' });
          } else if (mappedStatus === 'on_hold' || mappedStatus === 'past_due' || mappedStatus === 'paused') {
            db.updateEntitlement(ent.id, { status: 'suspended' });
          } else if (mappedStatus === 'cancelled') {
            // Keep active only until currentPeriodEnd if in the future; otherwise expire immediately
            const endMs = ent.expiresAt ? new Date(ent.expiresAt).getTime() : 0;
            if (!endMs || endMs <= Date.now()) {
              db.updateEntitlement(ent.id, { status: 'expired' });
            }
          }
        }
      }
      action = `subscription_${mappedStatus}`;
    } else if (
      eventType === 'refund.succeeded' ||
      eventType === 'entitlement_grant.revoked' ||
      eventType === 'dispute.lost'
    ) {
      const externalPaymentId = String(data.payment_id || '');
      const externalRefundId = data.refund_id ? String(data.refund_id) : null;
      const refundedAmount = Number(data.amount ?? amountMinor ?? 0);
      const reason = String(data.reason || eventType);

      if (externalPaymentId) {
        const existingPay = db.getPaymentByExternalId('dodo', externalPaymentId);
        if (existingPay) {
          const isFullRefund = refundedAmount === 0 || refundedAmount >= existingPay.amountMinor;
          const updatedPay = db.upsertPayment({
            provider: 'dodo',
            externalPaymentId,
            kind: existingPay.kind,
            itemId: existingPay.itemId,
            customerEmail: existingPay.customerEmail,
            currency: existingPay.currency,
            amountMinor: existingPay.amountMinor,
            status:
              eventType === 'dispute.lost'
                ? 'disputed'
                : isFullRefund
                  ? 'refunded'
                  : 'partially_refunded',
            refundedAmountMinor: isFullRefund ? existingPay.amountMinor : refundedAmount,
            refundReason: reason,
            externalRefundId,
          });
          paymentId = updatedPay.id;
        }

        // Revoke Pro entitlement tied to refunded payment
        const ent = db.getEntitlementBySourcePaymentId(externalPaymentId);
        if (ent) {
          db.updateEntitlement(ent.id, {
            status: 'revoked',
            creditsBalance: 0,
          });
          entitlementId = ent.id;
        }

        // Revoke & vacate Sponsor campaign tied to refunded payment
        const campaign = db.getSponsorCampaignByExternalPayment(externalPaymentId);
        if (campaign) {
          db.updateSponsorCampaign(campaign.id, {
            status: 'refunded',
            adminNotes: `Refunded via Dodo Payments (${externalRefundId || eventType})`,
          });
          campaignId = campaign.id;
          await sendTransactionalEmail(db, {
            to: campaign.contactEmail,
            template: 'sponsor_refunded',
            subject: `Refund Processed — Toolivo Sponsor Campaign (${campaign.brandName})`,
            bodyText: `Your Dodo Payments refund has been completed for campaign ${campaign.id}. The sponsor placement has been vacated.`,
          });
        }
      }
      action = 'refund_revoked_access';
    }

    db.recordWebhookEvent({
      webhookId,
      provider: 'dodo',
      eventType,
      status: 'processed',
      payloadHash,
    });

    return {
      duplicate: false,
      eventType,
      webhookId,
      action,
      entitlementId,
      campaignId,
      paymentId,
    };
  } catch (err) {
    db.recordWebhookEvent({
      webhookId,
      provider: 'dodo',
      eventType,
      status: 'failed',
      payloadHash,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export function revealVerifiedCheckoutKey(db: BillingDatabase, sessionId: string): {
  sessionStatus: string;
  verified: boolean;
  kind?: 'pro' | 'sponsor';
  currency?: SupportedCurrency;
  amountMinor?: number;
  planId?: string;
  recoveryKey?: string;
  entitlement?: {
    id: string;
    planId: string;
    entitlementType: string;
    status: string;
    creditsBalance: number;
    expiresAt: string | null;
    customerEmail: string;
  };
  campaign?: {
    id: string;
    slotId: string;
    brandName: string;
    status: string;
  };
} {
  const session = db.getCheckoutSession(sessionId);
  if (!session) {
    return { sessionStatus: 'not_found', verified: false };
  }

  if (session.kind === 'pro' && session.status === 'completed' && session.entitlementId) {
    const ent = db.getEntitlementById(session.entitlementId);
    if (ent && db.isEntitlementActive(ent)) {
      const rawKey = decryptLicenseKey(ent.licenseKeyEnc) || undefined;
      return {
        sessionStatus: 'completed',
        verified: true,
        kind: 'pro',
        currency: session.currency,
        amountMinor: session.amountMinor,
        planId: session.itemId,
        recoveryKey: rawKey,
        entitlement: {
          id: ent.id,
          planId: ent.planId,
          entitlementType: ent.entitlementType,
          status: ent.status,
          creditsBalance: ent.creditsBalance,
          expiresAt: ent.expiresAt,
          customerEmail: ent.customerEmail,
        },
      };
    }
  }

  if (session.kind === 'sponsor' && session.campaignId) {
    const cmp = db.getSponsorCampaign(session.campaignId);
    return {
      sessionStatus: session.status,
      verified: session.status === 'completed',
      kind: 'sponsor',
      currency: session.currency,
      amountMinor: session.amountMinor,
      campaign: cmp
        ? {
            id: cmp.id,
            slotId: cmp.slotId,
            brandName: cmp.brandName,
            status: cmp.status,
          }
        : undefined,
    };
  }

  return {
    sessionStatus: session.status,
    verified: false,
    kind: session.kind,
    currency: session.currency,
    amountMinor: session.amountMinor,
    planId: session.itemId,
  };
}
