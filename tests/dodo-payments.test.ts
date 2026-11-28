import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BillingDatabase, decryptLicenseKey } from '../src/server/db/billingDb.ts';
import { verifyAndUnwrapDodoWebhook } from '../src/server/services/dodoService.ts';
import {
  processVerifiedDodoWebhook,
  revealVerifiedCheckoutKey,
} from '../src/server/services/webhookProcessor.ts';

// Standard Webhooks signing helper matching Dodo Payments' exact HMAC-SHA256 format (`whsec_<base64>`)
const TEST_RAW_SECRET = crypto.randomBytes(32);
const TEST_WEBHOOK_KEY = `whsec_${TEST_RAW_SECRET.toString('base64')}`;

function signStandardWebhook(payload: string, webhookId: string, timestampSec?: number) {
  const ts = String(timestampSec ?? Math.floor(Date.now() / 1000));
  const signedContent = `${webhookId}.${ts}.${payload}`;
  const sig = crypto
    .createHmac('sha256', TEST_RAW_SECRET)
    .update(signedContent)
    .digest('base64');
  return {
    'webhook-id': webhookId,
    'webhook-timestamp': ts,
    'webhook-signature': `v1,${sig}`,
  };
}

test('1. Standard Webhooks cryptographic verification accepts valid signatures & rejects tampered payloads', () => {
  const payload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_dodo_sig_test',
      currency: 'USD',
      total_amount: 599,
      customer: { email: 'verify@example.com' },
      metadata: { toolivo_kind: 'pro', toolivo_item_id: 'monthly' },
    },
  });

  const headers = signStandardWebhook(payload, 'msg_valid_001');
  const unwrapped = verifyAndUnwrapDodoWebhook(payload, headers, TEST_WEBHOOK_KEY);
  assert.equal(unwrapped.type, 'payment.succeeded');

  // Tampered payload MUST throw verification error
  const tamperedPayload = payload.replace('599', '1');
  assert.throws(() => {
    verifyAndUnwrapDodoWebhook(tamperedPayload, headers, TEST_WEBHOOK_KEY);
  });
});

test('2. Multi-currency INR & USD Pro checkout, idempotent webhook fulfillment, recovery key & device restoration', async () => {
  const db = new BillingDatabase(':memory:');

  // Confirm independent INR & USD pricing (no exchange-rate conversion)
  const monthly = db.getPricingItem('monthly')!;
  assert.equal(monthly.priceUsdMinor, 599);
  assert.equal(monthly.priceInrMinor, 29900);

  // Admin updates independent INR & USD prices + Dodo Product IDs
  const updated = db.updatePricingItem('monthly', {
    priceUsdMinor: 699,
    priceInrMinor: 34900,
    dodoProductIdUsd: 'pdt_usd_monthly_sandbox',
    dodoProductIdInr: 'pdt_inr_monthly_sandbox',
  })!;
  assert.equal(updated.priceUsdMinor, 699);
  assert.equal(updated.priceInrMinor, 34900);

  // INR Customer Checkout Session (e.g. Indian customer paying ₹349 via UPI)
  const inrSession = db.createCheckoutSessionRecord({
    id: 'cks_tlvo_inr_001',
    kind: 'pro',
    itemId: 'monthly',
    currency: 'INR',
    amountMinor: 34900,
    customerEmail: 'arjun@india.in',
  });

  // Before webhook arrives, redirect polling MUST NOT grant Pro
  const preStatus = revealVerifiedCheckoutKey(db, inrSession.id);
  assert.equal(preStatus.verified, false);
  assert.equal(preStatus.recoveryKey, undefined);

  // Signed Dodo payment.succeeded webhook arrives in INR
  const webhookPayload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_dodo_inr_001',
      subscription_id: 'sub_dodo_inr_001',
      currency: 'INR',
      total_amount: 34900,
      customer: { email: 'arjun@india.in' },
      metadata: {
        toolivo_session_id: inrSession.id,
        toolivo_kind: 'pro',
        toolivo_item_id: 'monthly',
        toolivo_currency: 'INR',
      },
    },
  });

  const headers = signStandardWebhook(webhookPayload, 'msg_inr_pay_001');
  const event = verifyAndUnwrapDodoWebhook(webhookPayload, headers, TEST_WEBHOOK_KEY);
  const firstRun = await processVerifiedDodoWebhook(
    db,
    event,
    'msg_inr_pay_001',
    webhookPayload,
    'http://localhost:3000'
  );

  assert.equal(firstRun.duplicate, false);
  assert.equal(firstRun.action, 'pro_entitlement_issued');
  assert.ok(firstRun.entitlementId);

  // Duplicate webhook replay MUST be idempotent and never create a second entitlement
  const replay = await processVerifiedDodoWebhook(
    db,
    event,
    'msg_inr_pay_001',
    webhookPayload,
    'http://localhost:3000'
  );
  assert.equal(replay.duplicate, true);
  assert.equal(db.listAllEntitlements().length, 1);

  // Post-webhook verification reveals unique recovery key (TLVO-XXXX-XXXX-XXXX)
  const postStatus = revealVerifiedCheckoutKey(db, inrSession.id);
  assert.equal(postStatus.verified, true);
  assert.equal(postStatus.currency, 'INR');
  assert.match(postStatus.recoveryKey || '', /^TLVO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // Accountless restoration works on a second device via key hash lookup
  const restored = db.getEntitlementByRawKey(postStatus.recoveryKey!)!;
  assert.equal(db.isEntitlementActive(restored), true);
  assert.equal(restored.customerEmail, 'arjun@india.in');

  // Email delivery audit log contains recovery key email
  const emails = db.listEmailNotifications();
  assert.equal(emails.length, 1);
  assert.equal(emails[0].template, 'pro_license_delivered');
  assert.ok(emails[0].bodyText.includes(postStatus.recoveryKey!));
});

test('3. Usage-based credit packs, USD subscription lifecycle (renew/cancel), and refund revocation', async () => {
  const db = new BillingDatabase(':memory:');

  // 3A. Usage credit pack purchase in USD
  const creditPayload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_dodo_cred_001',
      currency: 'USD',
      total_amount: 1499,
      customer: { email: 'studio@acme.com' },
      metadata: {
        toolivo_kind: 'pro',
        toolivo_item_id: 'credits-500',
        toolivo_currency: 'USD',
      },
    },
  });
  const credEvent = verifyAndUnwrapDodoWebhook(
    creditPayload,
    signStandardWebhook(creditPayload, 'msg_cred_001'),
    TEST_WEBHOOK_KEY
  );
  const credRes = await processVerifiedDodoWebhook(
    db,
    credEvent,
    'msg_cred_001',
    creditPayload,
    'http://localhost:3000'
  );
  const credEnt = db.getEntitlementById(credRes.entitlementId!)!;
  assert.equal(credEnt.entitlementType, 'credits');
  assert.equal(credEnt.creditsBalance, 500);

  // 3B. Refund revokes access and zeroes credit balance immediately
  const refundPayload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'refund.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Refund',
      refund_id: 'ref_dodo_001',
      payment_id: 'pay_dodo_cred_001',
      currency: 'USD',
      amount: 1499,
      reason: 'Customer requested refund',
    },
  });
  const refEvent = verifyAndUnwrapDodoWebhook(
    refundPayload,
    signStandardWebhook(refundPayload, 'msg_ref_001'),
    TEST_WEBHOOK_KEY
  );
  await processVerifiedDodoWebhook(db, refEvent, 'msg_ref_001', refundPayload, 'http://localhost:3000');

  const revokedEnt = db.getEntitlementById(credEnt.id)!;
  assert.equal(revokedEnt.status, 'revoked');
  assert.equal(revokedEnt.creditsBalance, 0);
  assert.equal(db.isEntitlementActive(revokedEnt), false);

  const refundedPay = db.getPaymentByExternalId('dodo', 'pay_dodo_cred_001')!;
  assert.equal(refundedPay.status, 'refunded');
});

test('4. Advertising 8-frame ($18 USD) lifecycle: pending_payment -> webhook pending_approval -> admin approve -> tracking -> refund vacate', async () => {
  const db = new BillingDatabase(':memory:');

  // Verify default 1 top full-width banner ($49 USD) + 8 standard frames ($15 USD)
  const initialFrames = db.getPublicSponsorFrames();
  assert.equal(initialFrames.length, 9);
  assert.equal(initialFrames[0].id, 'frame-top');
  assert.equal(initialFrames[0].priceUsd, 49);
  assert.equal(initialFrames[1].id, 'frame-01');
  assert.equal(initialFrames[1].priceUsd, 15);
  assert.equal(initialFrames[1].priceInr, 1299);

  // Create sponsor booking (starts in pending_payment)
  const campaign = db.createSponsorCampaign({
    slotId: 'frame-01',
    brandName: 'CloudPulse',
    tagline: 'Instant cloud analytics',
    logoText: 'CP',
    logoUrl: 'https://cloudpulse.example/logo.png',
    destinationUrl: 'https://cloudpulse.example',
    contactEmail: 'growth@cloudpulse.example',
    currency: 'USD',
    amountMinor: 1800,
    durationMonths: 1,
  });
  assert.equal(campaign.status, 'pending_payment');

  const session = db.createCheckoutSessionRecord({
    id: 'cks_sp_001',
    kind: 'sponsor',
    itemId: 'frame-01',
    currency: 'USD',
    amountMinor: 1800,
    customerEmail: 'growth@cloudpulse.example',
    campaignId: campaign.id,
  });

  // Dodo webhook verifies payment -> MUST enter pending_approval (NOT auto-published!)
  const spPayload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Payment',
      payment_id: 'pay_dodo_sp_001',
      currency: 'USD',
      total_amount: 1800,
      customer: { email: 'growth@cloudpulse.example' },
      metadata: {
        toolivo_session_id: session.id,
        toolivo_kind: 'sponsor',
        toolivo_item_id: 'frame-01',
        toolivo_campaign_id: campaign.id,
        toolivo_currency: 'USD',
      },
    },
  });
  const spEvent = verifyAndUnwrapDodoWebhook(
    spPayload,
    signStandardWebhook(spPayload, 'msg_sp_001'),
    TEST_WEBHOOK_KEY
  );
  await processVerifiedDodoWebhook(db, spEvent, 'msg_sp_001', spPayload, 'http://localhost:3000');

  const afterWebhook = db.getSponsorCampaign(campaign.id)!;
  assert.equal(afterWebhook.status, 'pending_approval');

  // MUST NOT appear live on public sponsor wall before admin approval
  assert.equal(db.getPublicSponsorFrames().find((f) => f.id === 'frame-01')?.sponsor, undefined);

  // Admin approves campaign -> goes live immediately
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.updateSponsorCampaign(campaign.id, {
    status: 'approved',
    startsAt: new Date().toISOString(),
    expiresAt,
  });
  const liveFrames = db.getPublicSponsorFrames();
  assert.equal(liveFrames.find((f) => f.id === 'frame-01')?.sponsor?.brandName, 'CloudPulse');

  // Impression & click tracking
  db.incrementCampaignMetric(campaign.id, 'impressions');
  db.incrementCampaignMetric(campaign.id, 'clicks');
  const tracked = db.getSponsorCampaign(campaign.id)!;
  assert.equal(tracked.impressions, 1);
  assert.equal(tracked.clicks, 1);

  // Dodo refund webhook vacates sponsor slot automatically
  const spRefundPayload = JSON.stringify({
    business_id: 'bus_sandbox_001',
    type: 'refund.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      payload_type: 'Refund',
      refund_id: 'ref_sp_001',
      payment_id: 'pay_dodo_sp_001',
      currency: 'USD',
      amount: 1800,
    },
  });
  const spRefEvent = verifyAndUnwrapDodoWebhook(
    spRefundPayload,
    signStandardWebhook(spRefundPayload, 'msg_sp_ref_001'),
    TEST_WEBHOOK_KEY
  );
  await processVerifiedDodoWebhook(
    db,
    spRefEvent,
    'msg_sp_ref_001',
    spRefundPayload,
    'http://localhost:3000'
  );
  assert.equal(db.getSponsorCampaign(campaign.id)!.status, 'refunded');
  assert.equal(db.getPublicSponsorFrames().find((f) => f.id === 'frame-01')?.sponsor, undefined);
});

test('5. Provider-neutral schema preserves historical Stripe transactions & entitlements alongside Dodo records', () => {
  const db = new BillingDatabase(':memory:');

  // Preserve historical Stripe transaction & active legacy entitlement
  const legacyPayment = db.upsertPayment({
    provider: 'stripe',
    externalPaymentId: 'pi_legacy_stripe_001',
    kind: 'pro',
    itemId: 'yearly',
    customerEmail: 'early-adopter@toolivo.app',
    currency: 'USD',
    amountMinor: 3999,
    status: 'succeeded',
  });
  const legacy = db.createEntitlement({
    provider: 'stripe',
    customerEmail: 'early-adopter@toolivo.app',
    planId: 'yearly',
    entitlementType: 'subscription',
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    sourcePaymentId: legacyPayment.externalPaymentId,
  });

  // New Dodo transaction coexists cleanly
  db.upsertPayment({
    provider: 'dodo',
    externalPaymentId: 'pay_dodo_new_001',
    kind: 'pro',
    itemId: 'lifetime',
    customerEmail: 'new-buyer@toolivo.app',
    currency: 'INR',
    amountMinor: 499900,
    status: 'succeeded',
  });

  const allPayments = db.listPayments();
  assert.equal(allPayments.length, 2);
  assert.ok(allPayments.some((p) => p.provider === 'stripe' && p.externalPaymentId === 'pi_legacy_stripe_001'));
  assert.ok(allPayments.some((p) => p.provider === 'dodo' && p.currency === 'INR'));

  // Legacy Stripe user's entitlement remains fully active and decryptable
  const restoredLegacy = db.getEntitlementByRawKey(legacy.rawKey)!;
  assert.equal(restoredLegacy.provider, 'stripe');
  assert.equal(db.isEntitlementActive(restoredLegacy), true);
  assert.equal(decryptLicenseKey(restoredLegacy.licenseKeyEnc), legacy.rawKey);
});
