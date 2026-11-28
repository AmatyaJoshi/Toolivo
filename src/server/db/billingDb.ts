import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type PaymentProvider = 'dodo' | 'stripe';
export type SupportedCurrency = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'SGD';
export type PricingKind = 'pass' | 'subscription' | 'one_time' | 'credits' | 'sponsor';
export type BillingInterval = 'month' | 'year' | null;

export interface PricingItemRecord {
  id: string;
  kind: PricingKind;
  name: string;
  targetAudience: string;
  subLabel: string;
  priceUsdMinor: number; // cents (e.g., 599 = $5.99)
  priceInrMinor: number; // paise (e.g., 29900 = ₹299.00)
  billingInterval: BillingInterval;
  durationDays: number | null;
  creditsGranted: number;
  featured: boolean;
  active: boolean;
  dodoProductIdUsd: string;
  dodoProductIdInr: string;
  dodoProductIdDefault: string;
  highlights: string[];
  updatedAt: string;
}

export interface CheckoutSessionRecord {
  id: string;
  provider: PaymentProvider;
  externalSessionId: string | null;
  kind: 'pro' | 'sponsor';
  itemId: string;
  currency: SupportedCurrency;
  amountMinor: number;
  customerEmail: string;
  customerName: string | null;
  linkedFirebaseUid: string | null;
  campaignId: string | null;
  entitlementId: string | null;
  status: 'created' | 'completed' | 'failed' | 'cancelled' | 'expired';
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  provider: PaymentProvider;
  externalPaymentId: string;
  externalSessionId: string | null;
  externalSubscriptionId: string | null;
  kind: 'pro' | 'sponsor';
  itemId: string;
  customerEmail: string;
  currency: SupportedCurrency;
  amountMinor: number;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'disputed';
  refundedAmountMinor: number;
  refundReason: string | null;
  externalRefundId: string | null;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  provider: PaymentProvider;
  externalSubscriptionId: string;
  customerEmail: string;
  itemId: string;
  kind: 'pro' | 'sponsor';
  currency: SupportedCurrency;
  amountMinor: number;
  billingInterval: 'month' | 'year';
  status: 'pending' | 'active' | 'past_due' | 'on_hold' | 'paused' | 'cancelled' | 'expired' | 'failed';
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  entitlementId: string | null;
  campaignId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementRecord {
  id: string;
  provider: PaymentProvider;
  licenseKeyHash: string;
  licenseKeyPreview: string;
  licenseKeyEnc: string;
  customerEmail: string;
  linkedFirebaseUid: string | null;
  planId: string;
  entitlementType: 'pass' | 'subscription' | 'one_time' | 'credits';
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  creditsBalance: number;
  creditsTotal: number;
  expiresAt: string | null;
  sourcePaymentId: string | null;
  sourceSubscriptionId: string | null;
  devices: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SponsorSlotRecord {
  slotId: string;
  slotNumber: string;
  tier: 'banner' | 'starter' | 'growth' | 'featured';
  priceUsdMinor: number;
  priceInrMinor: number;
  dodoProductIdUsd: string;
  dodoProductIdInr: string;
  status: 'available' | 'occupied';
  activeCampaignId: string | null;
  updatedAt: string;
}

export interface SponsorCampaignRecord {
  id: string;
  slotId: string;
  provider: PaymentProvider;
  externalPaymentId: string | null;
  externalSubscriptionId: string | null;
  brandName: string;
  tagline: string;
  logoText: string;
  logoUrl: string | null;
  destinationUrl: string;
  contactEmail: string;
  currency: SupportedCurrency;
  amountMinor: number;
  durationMonths: number;
  status: 'pending_payment' | 'pending_approval' | 'approved' | 'rejected' | 'expired' | 'refunded';
  impressions: number;
  clicks: number;
  startsAt: string | null;
  expiresAt: string | null;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailNotificationRecord {
  id: string;
  recipientEmail: string;
  template: string;
  subject: string;
  bodyText: string;
  deliveryStatus: 'sent' | 'logged_sandbox' | 'failed';
  providerMessageId: string | null;
  createdAt: string;
}

export interface WebhookEventRecord {
  webhookId: string;
  provider: PaymentProvider;
  eventType: string;
  status: 'processed' | 'ignored' | 'failed';
  payloadHash: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

const KEY_ENCRYPTION_SECRET = crypto
  .createHash('sha256')
  .update(
    process.env.DODO_PAYMENTS_WEBHOOK_KEY ||
      process.env.DODO_PAYMENTS_API_KEY ||
      process.env.ADMIN_PASSCODE ||
      'toolivo-local-license-cipher-v1'
  )
  .digest();

export function hashLicenseKey(rawKey: string): string {
  const normalized = rawKey.trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function encryptLicenseKey(rawKey: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY_ENCRYPTION_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`;
}

export function decryptLicenseKey(ciphertext: string): string | null {
  try {
    const [ivHex, tagHex, dataHex] = ciphertext.split('.');
    if (!ivHex || !tagHex || !dataHex) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      KEY_ENCRYPTION_SECRET,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function generateRecoveryKey(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => {
    const bytes = crypto.randomBytes(4);
    let out = '';
    for (let i = 0; i < 4; i += 1) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  };
  return `TLVO-${segment()}-${segment()}-${segment()}`;
}

export function maskLicenseKey(rawKey: string): string {
  const parts = rawKey.split('-');
  if (parts.length !== 4) return 'TLVO-••••-••••-••••';
  return `${parts[0]}-${parts[1]}-••••-${parts[3]}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

const DEFAULT_PRICING_SEED: Omit<PricingItemRecord, 'updatedAt'>[] = [
  {
    id: 'pass-7d',
    kind: 'pass',
    name: '7-Day Pass',
    targetAudience: 'For one-off projects',
    subLabel: 'Single non-recurring payment · Nothing to cancel',
    priceUsdMinor: 299,
    priceInrMinor: 14900,
    billingInterval: null,
    durationDays: 7,
    creditsGranted: 0,
    featured: false,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_PASS_7D_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_PASS_7D_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_PASS_7D_USD?.trim() || '',
    highlights: [
      'Full 7-day Pro access across all 43 tools',
      'Sponsor-free focused workspace',
      'Unlimited multi-file PDF & media batches',
      'Instant recovery key · Zero auto-renewal',
    ],
  },
  {
    id: 'monthly',
    kind: 'subscription',
    name: 'Monthly Pro',
    targetAudience: 'For regular creators & teams',
    subLabel: 'Flexible monthly plan · Cancel anytime',
    priceUsdMinor: 599,
    priceInrMinor: 29900,
    billingInterval: 'month',
    durationDays: 30,
    creditsGranted: 0,
    featured: false,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_PRO_MONTHLY_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_PRO_MONTHLY_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_PRO_MONTHLY_USD?.trim() || '',
    highlights: [
      'Everything in 7-Day Pass, continuously active',
      'Zero sponsor frames on Home & all tool pages',
      'High-DPI export presets & priority batch queue',
      'Merchant of Record tax/GST invoice included',
    ],
  },
  {
    id: 'yearly',
    kind: 'subscription',
    name: 'Yearly Pro',
    targetAudience: 'For daily power workflows',
    subLabel: 'Best value · Save over 40% vs monthly',
    priceUsdMinor: 3999,
    priceInrMinor: 249900,
    billingInterval: 'year',
    durationDays: 365,
    creditsGranted: 0,
    featured: true,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_PRO_YEARLY_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_PRO_YEARLY_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_PRO_YEARLY_USD?.trim() || '',
    highlights: [
      'Lowest effective monthly rate — save 44%',
      'Ad-free & sponsor-free workspace all year',
      'Commercial use license + tax-compliant invoice',
      'Cross-device recovery key + optional account sync',
    ],
  },
  {
    id: 'lifetime',
    kind: 'one_time',
    name: 'Lifetime Pro',
    targetAudience: 'One-time permanent license',
    subLabel: 'Pay once · Permanent Pro access forever',
    priceUsdMinor: 7900,
    priceInrMinor: 499900,
    billingInterval: null,
    durationDays: null,
    creditsGranted: 0,
    featured: false,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_PRO_LIFETIME_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_PRO_LIFETIME_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_PRO_LIFETIME_USD?.trim() || '',
    highlights: [
      'Single one-time purchase — never billed again',
      'Permanent sponsor-free workspace across devices',
      'All future browser utilities & batch presets included',
      'Commercial invoice + lifetime recovery key',
    ],
  },
  {
    id: 'credits-100',
    kind: 'credits',
    name: '100 Pro Credits',
    targetAudience: 'Pay-as-you-go heavy batches',
    subLabel: 'One-time top-up · Credits never expire',
    priceUsdMinor: 499,
    priceInrMinor: 24900,
    billingInterval: null,
    durationDays: null,
    creditsGranted: 100,
    featured: false,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_CREDITS_100_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_CREDITS_100_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_CREDITS_100_USD?.trim() || '',
    highlights: [
      '100 usage-based credits for high-volume batch exports',
      'Never expires — stacks onto your existing recovery key',
      'Unlocks sponsor-free sessions while credits remain',
      'Instant Dodo Payments delivery',
    ],
  },
  {
    id: 'credits-500',
    kind: 'credits',
    name: '500 Pro Credits',
    targetAudience: 'Teams & high-volume studios',
    subLabel: 'Bulk credit pack · 40% lower per-credit cost',
    priceUsdMinor: 1499,
    priceInrMinor: 79900,
    billingInterval: null,
    durationDays: null,
    creditsGranted: 500,
    featured: true,
    active: true,
    dodoProductIdUsd: process.env.DODO_PRODUCT_CREDITS_500_USD?.trim() || '',
    dodoProductIdInr: process.env.DODO_PRODUCT_CREDITS_500_INR?.trim() || '',
    dodoProductIdDefault: process.env.DODO_PRODUCT_CREDITS_500_USD?.trim() || '',
    highlights: [
      '500 non-expiring credits for bulk document & media pipelines',
      'Shareable recovery key across up to 5 workstations',
      'Commercial tax/GST receipt from Dodo Payments MoR',
      'Sponsor-free workspace included',
    ],
  },
];

const DEFAULT_SPONSOR_SLOTS: {
  slotId: string;
  slotNumber: string;
  tier: 'banner' | 'starter' | 'growth' | 'featured';
  priceUsdMinor: number;
  priceInrMinor: number;
  envUsd: string;
  envInr: string;
}[] = [
  { slotId: 'frame-top', slotNumber: 'TOP', tier: 'banner', priceUsdMinor: 4900, priceInrMinor: 349900, envUsd: 'DODO_PRODUCT_SPONSOR_BANNER_USD', envInr: 'DODO_PRODUCT_SPONSOR_BANNER_INR' },
  { slotId: 'frame-01', slotNumber: '01', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-02', slotNumber: '02', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-03', slotNumber: '03', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-04', slotNumber: '04', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-05', slotNumber: '05', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-06', slotNumber: '06', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-07', slotNumber: '07', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
  { slotId: 'frame-08', slotNumber: '08', tier: 'featured', priceUsdMinor: 1500, priceInrMinor: 129900, envUsd: 'DODO_PRODUCT_SPONSOR_TIER1_USD', envInr: 'DODO_PRODUCT_SPONSOR_TIER1_INR' },
];

export class BillingDatabase {
  public readonly db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath ||
      process.env.BILLING_DB_PATH?.trim() ||
      path.resolve(process.cwd(), 'data', 'toolivo-billing.sqlite');

    if (resolvedPath !== ':memory:') {
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.seedDefaults();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pricing_items (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        target_audience TEXT NOT NULL,
        sub_label TEXT NOT NULL,
        price_usd_minor INTEGER NOT NULL,
        price_inr_minor INTEGER NOT NULL,
        billing_interval TEXT,
        duration_days INTEGER,
        credits_granted INTEGER NOT NULL DEFAULT 0,
        featured INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        dodo_product_id_usd TEXT NOT NULL DEFAULT '',
        dodo_product_id_inr TEXT NOT NULL DEFAULT '',
        dodo_product_id_default TEXT NOT NULL DEFAULT '',
        highlights_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS checkout_sessions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'dodo',
        external_session_id TEXT,
        kind TEXT NOT NULL,
        item_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        customer_email TEXT NOT NULL,
        customer_name TEXT,
        linked_firebase_uid TEXT,
        campaign_id TEXT,
        entitlement_id TEXT,
        status TEXT NOT NULL DEFAULT 'created',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_checkout_external ON checkout_sessions(external_session_id);
      CREATE INDEX IF NOT EXISTS idx_checkout_email ON checkout_sessions(customer_email);

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'dodo',
        external_payment_id TEXT NOT NULL,
        external_session_id TEXT,
        external_subscription_id TEXT,
        kind TEXT NOT NULL,
        item_id TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        status TEXT NOT NULL,
        refunded_amount_minor INTEGER NOT NULL DEFAULT 0,
        refund_reason TEXT,
        external_refund_id TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider, external_payment_id)
      );

      CREATE INDEX IF NOT EXISTS idx_payments_email ON payments(customer_email);
      CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider);

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'dodo',
        external_subscription_id TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        item_id TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'pro',
        currency TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        billing_interval TEXT NOT NULL,
        status TEXT NOT NULL,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        current_period_start TEXT,
        current_period_end TEXT,
        entitlement_id TEXT,
        campaign_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider, external_subscription_id)
      );

      CREATE TABLE IF NOT EXISTS entitlements (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'dodo',
        license_key_hash TEXT NOT NULL UNIQUE,
        license_key_preview TEXT NOT NULL,
        license_key_enc TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        linked_firebase_uid TEXT,
        plan_id TEXT NOT NULL,
        entitlement_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        credits_balance INTEGER NOT NULL DEFAULT 0,
        credits_total INTEGER NOT NULL DEFAULT 0,
        expires_at TEXT,
        source_payment_id TEXT UNIQUE,
        source_subscription_id TEXT,
        devices_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_entitlements_email ON entitlements(customer_email);
      CREATE INDEX IF NOT EXISTS idx_entitlements_uid ON entitlements(linked_firebase_uid);
      CREATE INDEX IF NOT EXISTS idx_entitlements_sub ON entitlements(source_subscription_id);

      CREATE TABLE IF NOT EXISTS sponsor_slots (
        slot_id TEXT PRIMARY KEY,
        slot_number TEXT NOT NULL UNIQUE,
        tier TEXT NOT NULL,
        price_usd_minor INTEGER NOT NULL,
        price_inr_minor INTEGER NOT NULL,
        dodo_product_id_usd TEXT NOT NULL DEFAULT '',
        dodo_product_id_inr TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'available',
        active_campaign_id TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sponsor_campaigns (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'dodo',
        external_payment_id TEXT,
        external_subscription_id TEXT,
        brand_name TEXT NOT NULL,
        tagline TEXT NOT NULL,
        logo_text TEXT NOT NULL,
        logo_url TEXT,
        destination_url TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        amount_minor INTEGER NOT NULL,
        duration_months INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending_payment',
        impressions INTEGER NOT NULL DEFAULT 0,
        clicks INTEGER NOT NULL DEFAULT 0,
        starts_at TEXT,
        expires_at TEXT,
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_slot ON sponsor_campaigns(slot_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON sponsor_campaigns(status);

      CREATE TABLE IF NOT EXISTS webhook_events (
        webhook_id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'dodo',
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        error_message TEXT,
        received_at TEXT NOT NULL,
        processed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS email_notifications (
        id TEXT PRIMARY KEY,
        recipient_email TEXT NOT NULL,
        template TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        delivery_status TEXT NOT NULL,
        provider_message_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_credentials (
        id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        claimed_at TEXT NOT NULL
      );
    `);

    const applied = this.db
      .prepare('SELECT version FROM schema_migrations WHERE version = 1')
      .get();
    if (!applied) {
      this.db
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(1, 'provider_neutral_dodo_billing_v1', nowIso());
    }

    const v2 = this.db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get();
    if (!v2) {
      this.db
        .prepare(
          "UPDATE sponsor_slots SET price_usd_minor = 1500, updated_at = ? WHERE slot_id LIKE 'frame-0%' AND price_usd_minor = 1800"
        )
        .run(nowIso());
      this.db
        .prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(2, 'sponsor_frames_15_usd_v2', nowIso());
    }
  }

  private seedDefaults() {
    const ts = nowIso();
    const insertPricing = this.db.prepare(`
      INSERT OR IGNORE INTO pricing_items (
        id, kind, name, target_audience, sub_label,
        price_usd_minor, price_inr_minor, billing_interval, duration_days,
        credits_granted, featured, active,
        dodo_product_id_usd, dodo_product_id_inr, dodo_product_id_default,
        highlights_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of DEFAULT_PRICING_SEED) {
      insertPricing.run(
        item.id,
        item.kind,
        item.name,
        item.targetAudience,
        item.subLabel,
        item.priceUsdMinor,
        item.priceInrMinor,
        item.billingInterval,
        item.durationDays,
        item.creditsGranted,
        item.featured ? 1 : 0,
        item.active ? 1 : 0,
        item.dodoProductIdUsd,
        item.dodoProductIdInr,
        item.dodoProductIdDefault,
        JSON.stringify(item.highlights),
        ts
      );
    }

    const insertSlot = this.db.prepare(`
      INSERT OR IGNORE INTO sponsor_slots (
        slot_id, slot_number, tier, price_usd_minor, price_inr_minor,
        dodo_product_id_usd, dodo_product_id_inr, status, active_campaign_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'available', NULL, ?)
    `);

    for (const slot of DEFAULT_SPONSOR_SLOTS) {
      insertSlot.run(
        slot.slotId,
        slot.slotNumber,
        slot.tier,
        slot.priceUsdMinor,
        slot.priceInrMinor,
        process.env[slot.envUsd]?.trim() || '',
        process.env[slot.envInr]?.trim() || '',
        ts
      );
    }
  }

  // ---- Pricing Catalog ----
  public listPricingItems(includeInactive = false): PricingItemRecord[] {
    const sql = includeInactive
      ? 'SELECT * FROM pricing_items ORDER BY rowid ASC'
      : 'SELECT * FROM pricing_items WHERE active = 1 ORDER BY rowid ASC';
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
    return rows.map((r) => this.mapPricingRow(r));
  }

  public getPricingItem(id: string): PricingItemRecord | null {
    const row = this.db.prepare('SELECT * FROM pricing_items WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapPricingRow(row) : null;
  }

  public updatePricingItem(
    id: string,
    patch: {
      priceUsdMinor?: number;
      priceInrMinor?: number;
      active?: boolean;
      dodoProductIdUsd?: string;
      dodoProductIdInr?: string;
      dodoProductIdDefault?: string;
    }
  ): PricingItemRecord | null {
    const existing = this.getPricingItem(id);
    if (!existing) return null;
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE pricing_items SET
          price_usd_minor = ?,
          price_inr_minor = ?,
          active = ?,
          dodo_product_id_usd = ?,
          dodo_product_id_inr = ?,
          dodo_product_id_default = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        patch.priceUsdMinor ?? existing.priceUsdMinor,
        patch.priceInrMinor ?? existing.priceInrMinor,
        patch.active === undefined ? (existing.active ? 1 : 0) : patch.active ? 1 : 0,
        patch.dodoProductIdUsd ?? existing.dodoProductIdUsd,
        patch.dodoProductIdInr ?? existing.dodoProductIdInr,
        patch.dodoProductIdDefault ?? existing.dodoProductIdDefault,
        ts,
        id
      );
    return this.getPricingItem(id);
  }

  private mapPricingRow(r: Record<string, unknown>): PricingItemRecord {
    return {
      id: String(r.id),
      kind: String(r.kind) as PricingKind,
      name: String(r.name),
      targetAudience: String(r.target_audience),
      subLabel: String(r.sub_label),
      priceUsdMinor: Number(r.price_usd_minor),
      priceInrMinor: Number(r.price_inr_minor),
      billingInterval: (r.billing_interval ? String(r.billing_interval) : null) as BillingInterval,
      durationDays: r.duration_days === null ? null : Number(r.duration_days),
      creditsGranted: Number(r.credits_granted || 0),
      featured: Number(r.featured) === 1,
      active: Number(r.active) === 1,
      dodoProductIdUsd: String(r.dodo_product_id_usd || ''),
      dodoProductIdInr: String(r.dodo_product_id_inr || ''),
      dodoProductIdDefault: String(r.dodo_product_id_default || ''),
      highlights: JSON.parse(String(r.highlights_json || '[]')),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Checkout Sessions ----
  public createCheckoutSessionRecord(input: {
    id: string;
    externalSessionId?: string | null;
    kind: 'pro' | 'sponsor';
    itemId: string;
    currency: SupportedCurrency;
    amountMinor: number;
    customerEmail: string;
    customerName?: string | null;
    linkedFirebaseUid?: string | null;
    campaignId?: string | null;
    metadata?: Record<string, unknown>;
  }): CheckoutSessionRecord {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO checkout_sessions (
          id, provider, external_session_id, kind, item_id, currency, amount_minor,
          customer_email, customer_name, linked_firebase_uid, campaign_id,
          status, metadata_json, created_at, updated_at
        ) VALUES (?, 'dodo', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)`
      )
      .run(
        input.id,
        input.externalSessionId ?? null,
        input.kind,
        input.itemId,
        input.currency,
        input.amountMinor,
        input.customerEmail.toLowerCase(),
        input.customerName ?? null,
        input.linkedFirebaseUid ?? null,
        input.campaignId ?? null,
        JSON.stringify(input.metadata || {}),
        ts,
        ts
      );
    return this.getCheckoutSession(input.id)!;
  }

  public getCheckoutSession(idOrExternal: string): CheckoutSessionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM checkout_sessions WHERE id = ? OR external_session_id = ? LIMIT 1')
      .get(idOrExternal, idOrExternal) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      provider: String(row.provider) as PaymentProvider,
      externalSessionId: row.external_session_id ? String(row.external_session_id) : null,
      kind: String(row.kind) as 'pro' | 'sponsor',
      itemId: String(row.item_id),
      currency: String(row.currency) as SupportedCurrency,
      amountMinor: Number(row.amount_minor),
      customerEmail: String(row.customer_email),
      customerName: row.customer_name ? String(row.customer_name) : null,
      linkedFirebaseUid: row.linked_firebase_uid ? String(row.linked_firebase_uid) : null,
      campaignId: row.campaign_id ? String(row.campaign_id) : null,
      entitlementId: row.entitlement_id ? String(row.entitlement_id) : null,
      status: String(row.status) as CheckoutSessionRecord['status'],
      metadataJson: String(row.metadata_json || '{}'),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  public updateCheckoutSession(
    id: string,
    patch: {
      externalSessionId?: string | null;
      status?: CheckoutSessionRecord['status'];
      entitlementId?: string | null;
      campaignId?: string | null;
    }
  ) {
    const existing = this.getCheckoutSession(id);
    if (!existing) return;
    this.db
      .prepare(
        `UPDATE checkout_sessions SET
          external_session_id = ?,
          status = ?,
          entitlement_id = ?,
          campaign_id = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        patch.externalSessionId !== undefined ? patch.externalSessionId : existing.externalSessionId,
        patch.status ?? existing.status,
        patch.entitlementId !== undefined ? patch.entitlementId : existing.entitlementId,
        patch.campaignId !== undefined ? patch.campaignId : existing.campaignId,
        nowIso(),
        existing.id
      );
  }

  // ---- Webhook Idempotency ----
  public hasProcessedWebhook(webhookId: string): boolean {
    const row = this.db
      .prepare('SELECT webhook_id FROM webhook_events WHERE webhook_id = ?')
      .get(webhookId);
    return Boolean(row);
  }

  public recordWebhookEvent(input: {
    webhookId: string;
    provider?: PaymentProvider;
    eventType: string;
    status: 'processed' | 'ignored' | 'failed';
    payloadHash: string;
    errorMessage?: string | null;
  }) {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO webhook_events (
          webhook_id, provider, event_type, status, payload_hash, error_message, received_at, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.webhookId,
        input.provider || 'dodo',
        input.eventType,
        input.status,
        input.payloadHash,
        input.errorMessage ?? null,
        ts,
        ts
      );
  }

  public listWebhookEvents(limit = 40): WebhookEventRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      webhookId: String(r.webhook_id),
      provider: String(r.provider) as PaymentProvider,
      eventType: String(r.event_type),
      status: String(r.status) as WebhookEventRecord['status'],
      payloadHash: String(r.payload_hash),
      errorMessage: r.error_message ? String(r.error_message) : null,
      receivedAt: String(r.received_at),
      processedAt: r.processed_at ? String(r.processed_at) : null,
    }));
  }

  // ---- Payments Ledger (Provider-Neutral: Preserves Historical Stripe + New Dodo) ----
  public upsertPayment(input: {
    provider?: PaymentProvider;
    externalPaymentId: string;
    externalSessionId?: string | null;
    externalSubscriptionId?: string | null;
    kind: 'pro' | 'sponsor';
    itemId: string;
    customerEmail: string;
    currency: SupportedCurrency;
    amountMinor: number;
    status: PaymentRecord['status'];
    refundedAmountMinor?: number;
    refundReason?: string | null;
    externalRefundId?: string | null;
    metadata?: Record<string, unknown>;
  }): PaymentRecord {
    const provider = input.provider || 'dodo';
    const existing = this.getPaymentByExternalId(provider, input.externalPaymentId);
    const ts = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE payments SET
            external_session_id = COALESCE(?, external_session_id),
            external_subscription_id = COALESCE(?, external_subscription_id),
            status = ?,
            refunded_amount_minor = ?,
            refund_reason = COALESCE(?, refund_reason),
            external_refund_id = COALESCE(?, external_refund_id),
            metadata_json = ?,
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.externalSessionId ?? null,
          input.externalSubscriptionId ?? null,
          input.status,
          input.refundedAmountMinor ?? existing.refundedAmountMinor,
          input.refundReason ?? null,
          input.externalRefundId ?? null,
          input.metadata ? JSON.stringify(input.metadata) : existing.metadataJson,
          ts,
          existing.id
        );
      return this.getPaymentByExternalId(provider, input.externalPaymentId)!;
    }

    const id = `pay_${crypto.randomBytes(10).toString('hex')}`;
    this.db
      .prepare(
        `INSERT INTO payments (
          id, provider, external_payment_id, external_session_id, external_subscription_id,
          kind, item_id, customer_email, currency, amount_minor, status,
          refunded_amount_minor, refund_reason, external_refund_id, metadata_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        provider,
        input.externalPaymentId,
        input.externalSessionId ?? null,
        input.externalSubscriptionId ?? null,
        input.kind,
        input.itemId,
        input.customerEmail.toLowerCase(),
        input.currency,
        input.amountMinor,
        input.status,
        input.refundedAmountMinor ?? 0,
        input.refundReason ?? null,
        input.externalRefundId ?? null,
        JSON.stringify(input.metadata || {}),
        ts,
        ts
      );
    return this.getPaymentByExternalId(provider, input.externalPaymentId)!;
  }

  public getPaymentByExternalId(provider: PaymentProvider, externalPaymentId: string): PaymentRecord | null {
    const row = this.db
      .prepare('SELECT * FROM payments WHERE provider = ? AND external_payment_id = ? LIMIT 1')
      .get(provider, externalPaymentId) as Record<string, unknown> | undefined;
    return row ? this.mapPaymentRow(row) : null;
  }

  public getPaymentById(id: string): PaymentRecord | null {
    const row = this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapPaymentRow(row) : null;
  }

  public listPayments(limit = 100): PaymentRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM payments ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapPaymentRow(r));
  }

  private mapPaymentRow(r: Record<string, unknown>): PaymentRecord {
    return {
      id: String(r.id),
      provider: String(r.provider) as PaymentProvider,
      externalPaymentId: String(r.external_payment_id),
      externalSessionId: r.external_session_id ? String(r.external_session_id) : null,
      externalSubscriptionId: r.external_subscription_id ? String(r.external_subscription_id) : null,
      kind: String(r.kind) as 'pro' | 'sponsor',
      itemId: String(r.item_id),
      customerEmail: String(r.customer_email),
      currency: String(r.currency) as SupportedCurrency,
      amountMinor: Number(r.amount_minor),
      status: String(r.status) as PaymentRecord['status'],
      refundedAmountMinor: Number(r.refunded_amount_minor || 0),
      refundReason: r.refund_reason ? String(r.refund_reason) : null,
      externalRefundId: r.external_refund_id ? String(r.external_refund_id) : null,
      metadataJson: String(r.metadata_json || '{}'),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Subscriptions ----
  public upsertSubscription(input: {
    provider?: PaymentProvider;
    externalSubscriptionId: string;
    customerEmail: string;
    itemId: string;
    kind: 'pro' | 'sponsor';
    currency: SupportedCurrency;
    amountMinor: number;
    billingInterval: 'month' | 'year';
    status: SubscriptionRecord['status'];
    cancelAtPeriodEnd?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    entitlementId?: string | null;
    campaignId?: string | null;
  }): SubscriptionRecord {
    const provider = input.provider || 'dodo';
    const existing = this.getSubscriptionByExternalId(provider, input.externalSubscriptionId);
    const ts = nowIso();
    if (existing) {
      this.db
        .prepare(
          `UPDATE subscriptions SET
            status = ?,
            cancel_at_period_end = ?,
            current_period_start = COALESCE(?, current_period_start),
            current_period_end = COALESCE(?, current_period_end),
            entitlement_id = COALESCE(?, entitlement_id),
            campaign_id = COALESCE(?, campaign_id),
            updated_at = ?
          WHERE id = ?`
        )
        .run(
          input.status,
          input.cancelAtPeriodEnd ? 1 : existing.cancelAtPeriodEnd ? 1 : 0,
          input.currentPeriodStart ?? null,
          input.currentPeriodEnd ?? null,
          input.entitlementId ?? null,
          input.campaignId ?? null,
          ts,
          existing.id
        );
      return this.getSubscriptionByExternalId(provider, input.externalSubscriptionId)!;
    }

    const id = `sub_${crypto.randomBytes(10).toString('hex')}`;
    this.db
      .prepare(
        `INSERT INTO subscriptions (
          id, provider, external_subscription_id, customer_email, item_id, kind,
          currency, amount_minor, billing_interval, status, cancel_at_period_end,
          current_period_start, current_period_end, entitlement_id, campaign_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        provider,
        input.externalSubscriptionId,
        input.customerEmail.toLowerCase(),
        input.itemId,
        input.kind,
        input.currency,
        input.amountMinor,
        input.billingInterval,
        input.status,
        input.cancelAtPeriodEnd ? 1 : 0,
        input.currentPeriodStart ?? ts,
        input.currentPeriodEnd ?? null,
        input.entitlementId ?? null,
        input.campaignId ?? null,
        ts,
        ts
      );
    return this.getSubscriptionByExternalId(provider, input.externalSubscriptionId)!;
  }

  public getSubscriptionByExternalId(
    provider: PaymentProvider,
    externalSubscriptionId: string
  ): SubscriptionRecord | null {
    const row = this.db
      .prepare('SELECT * FROM subscriptions WHERE provider = ? AND external_subscription_id = ? LIMIT 1')
      .get(provider, externalSubscriptionId) as Record<string, unknown> | undefined;
    return row ? this.mapSubscriptionRow(row) : null;
  }

  public listSubscriptions(limit = 100): SubscriptionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapSubscriptionRow(r));
  }

  private mapSubscriptionRow(r: Record<string, unknown>): SubscriptionRecord {
    return {
      id: String(r.id),
      provider: String(r.provider) as PaymentProvider,
      externalSubscriptionId: String(r.external_subscription_id),
      customerEmail: String(r.customer_email),
      itemId: String(r.item_id),
      kind: String(r.kind) as 'pro' | 'sponsor',
      currency: String(r.currency) as SupportedCurrency,
      amountMinor: Number(r.amount_minor),
      billingInterval: String(r.billing_interval) as 'month' | 'year',
      status: String(r.status) as SubscriptionRecord['status'],
      cancelAtPeriodEnd: Number(r.cancel_at_period_end) === 1,
      currentPeriodStart: r.current_period_start ? String(r.current_period_start) : null,
      currentPeriodEnd: r.current_period_end ? String(r.current_period_end) : null,
      entitlementId: r.entitlement_id ? String(r.entitlement_id) : null,
      campaignId: r.campaign_id ? String(r.campaign_id) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Accountless Licences & Entitlements ----
  public createEntitlement(input: {
    provider?: PaymentProvider;
    customerEmail: string;
    linkedFirebaseUid?: string | null;
    planId: string;
    entitlementType: EntitlementRecord['entitlementType'];
    creditsGranted?: number;
    expiresAt?: string | null;
    sourcePaymentId?: string | null;
    sourceSubscriptionId?: string | null;
  }): { entitlement: EntitlementRecord; rawKey: string } {
    // Prevent duplicate entitlements for the same payment ID
    if (input.sourcePaymentId) {
      const existingByPay = this.getEntitlementBySourcePaymentId(input.sourcePaymentId);
      if (existingByPay) {
        const decrypted = decryptLicenseKey(existingByPay.licenseKeyEnc) || existingByPay.licenseKeyPreview;
        return { entitlement: existingByPay, rawKey: decrypted };
      }
    }

    const rawKey = generateRecoveryKey();
    const id = `ent_${crypto.randomBytes(10).toString('hex')}`;
    const ts = nowIso();
    const credits = input.creditsGranted ?? 0;

    this.db
      .prepare(
        `INSERT INTO entitlements (
          id, provider, license_key_hash, license_key_preview, license_key_enc,
          customer_email, linked_firebase_uid, plan_id, entitlement_type, status,
          credits_balance, credits_total, expires_at, source_payment_id,
          source_subscription_id, devices_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, '[]', ?, ?)`
      )
      .run(
        id,
        input.provider || 'dodo',
        hashLicenseKey(rawKey),
        maskLicenseKey(rawKey),
        encryptLicenseKey(rawKey),
        input.customerEmail.toLowerCase(),
        input.linkedFirebaseUid ?? null,
        input.planId,
        input.entitlementType,
        credits,
        credits,
        input.expiresAt ?? null,
        input.sourcePaymentId ?? null,
        input.sourceSubscriptionId ?? null,
        ts,
        ts
      );

    return { entitlement: this.getEntitlementById(id)!, rawKey };
  }

  public getEntitlementById(id: string): EntitlementRecord | null {
    const row = this.db.prepare('SELECT * FROM entitlements WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapEntitlementRow(row) : null;
  }

  public getEntitlementByRawKey(rawKey: string): EntitlementRecord | null {
    const row = this.db
      .prepare('SELECT * FROM entitlements WHERE license_key_hash = ? LIMIT 1')
      .get(hashLicenseKey(rawKey)) as Record<string, unknown> | undefined;
    return row ? this.mapEntitlementRow(row) : null;
  }

  public getEntitlementBySourcePaymentId(sourcePaymentId: string): EntitlementRecord | null {
    const row = this.db
      .prepare('SELECT * FROM entitlements WHERE source_payment_id = ? LIMIT 1')
      .get(sourcePaymentId) as Record<string, unknown> | undefined;
    return row ? this.mapEntitlementRow(row) : null;
  }

  public getEntitlementBySubscriptionId(sourceSubscriptionId: string): EntitlementRecord | null {
    const row = this.db
      .prepare('SELECT * FROM entitlements WHERE source_subscription_id = ? LIMIT 1')
      .get(sourceSubscriptionId) as Record<string, unknown> | undefined;
    return row ? this.mapEntitlementRow(row) : null;
  }

  public listEntitlementsByEmail(email: string): EntitlementRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM entitlements WHERE customer_email = ? ORDER BY created_at DESC')
      .all(email.trim().toLowerCase()) as Record<string, unknown>[];
    return rows.map((r) => this.mapEntitlementRow(r));
  }

  public listEntitlementsByUid(uid: string): EntitlementRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM entitlements WHERE linked_firebase_uid = ? ORDER BY created_at DESC')
      .all(uid) as Record<string, unknown>[];
    return rows.map((r) => this.mapEntitlementRow(r));
  }

  public listAllEntitlements(limit = 100): EntitlementRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM entitlements ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapEntitlementRow(r));
  }

  public updateEntitlement(
    id: string,
    patch: {
      status?: EntitlementRecord['status'];
      expiresAt?: string | null;
      creditsBalance?: number;
      creditsTotal?: number;
      linkedFirebaseUid?: string | null;
      devices?: string[];
      sourceSubscriptionId?: string | null;
    }
  ): EntitlementRecord | null {
    const existing = this.getEntitlementById(id);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE entitlements SET
          status = ?,
          expires_at = ?,
          credits_balance = ?,
          credits_total = ?,
          linked_firebase_uid = ?,
          devices_json = ?,
          source_subscription_id = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        patch.status ?? existing.status,
        patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
        patch.creditsBalance ?? existing.creditsBalance,
        patch.creditsTotal ?? existing.creditsTotal,
        patch.linkedFirebaseUid !== undefined ? patch.linkedFirebaseUid : existing.linkedFirebaseUid,
        JSON.stringify(patch.devices ?? existing.devices),
        patch.sourceSubscriptionId !== undefined ? patch.sourceSubscriptionId : existing.sourceSubscriptionId,
        nowIso(),
        id
      );
    return this.getEntitlementById(id);
  }

  public isEntitlementActive(ent: EntitlementRecord): boolean {
    if (ent.status !== 'active') return false;
    if (ent.entitlementType === 'credits') {
      return ent.creditsBalance > 0;
    }
    if (ent.expiresAt) {
      return new Date(ent.expiresAt).getTime() > Date.now();
    }
    return true;
  }

  private mapEntitlementRow(r: Record<string, unknown>): EntitlementRecord {
    return {
      id: String(r.id),
      provider: String(r.provider) as PaymentProvider,
      licenseKeyHash: String(r.license_key_hash),
      licenseKeyPreview: String(r.license_key_preview),
      licenseKeyEnc: String(r.license_key_enc),
      customerEmail: String(r.customer_email),
      linkedFirebaseUid: r.linked_firebase_uid ? String(r.linked_firebase_uid) : null,
      planId: String(r.plan_id),
      entitlementType: String(r.entitlement_type) as EntitlementRecord['entitlementType'],
      status: String(r.status) as EntitlementRecord['status'],
      creditsBalance: Number(r.credits_balance || 0),
      creditsTotal: Number(r.credits_total || 0),
      expiresAt: r.expires_at ? String(r.expires_at) : null,
      sourcePaymentId: r.source_payment_id ? String(r.source_payment_id) : null,
      sourceSubscriptionId: r.source_subscription_id ? String(r.source_subscription_id) : null,
      devices: JSON.parse(String(r.devices_json || '[]')),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Sponsor Slots & Campaigns ----
  public listSponsorSlots(): SponsorSlotRecord[] {
    this.expireStaleCampaigns();
    const rows = this.db
      .prepare("SELECT * FROM sponsor_slots ORDER BY CASE WHEN slot_id = 'frame-top' THEN 0 ELSE 1 END, slot_number ASC")
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.mapSlotRow(r));
  }

  public getSponsorSlot(slotId: string): SponsorSlotRecord | null {
    const row = this.db.prepare('SELECT * FROM sponsor_slots WHERE slot_id = ?').get(slotId) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSlotRow(row) : null;
  }

  public updateSponsorSlotPricing(
    slotId: string,
    patch: {
      priceUsdMinor?: number;
      priceInrMinor?: number;
      dodoProductIdUsd?: string;
      dodoProductIdInr?: string;
    }
  ): SponsorSlotRecord | null {
    const existing = this.getSponsorSlot(slotId);
    if (!existing) return null;
    this.db
      .prepare(
        `UPDATE sponsor_slots SET
          price_usd_minor = ?,
          price_inr_minor = ?,
          dodo_product_id_usd = ?,
          dodo_product_id_inr = ?,
          updated_at = ?
        WHERE slot_id = ?`
      )
      .run(
        patch.priceUsdMinor ?? existing.priceUsdMinor,
        patch.priceInrMinor ?? existing.priceInrMinor,
        patch.dodoProductIdUsd ?? existing.dodoProductIdUsd,
        patch.dodoProductIdInr ?? existing.dodoProductIdInr,
        nowIso(),
        slotId
      );
    return this.getSponsorSlot(slotId);
  }

  public createSponsorCampaign(input: {
    slotId: string;
    brandName: string;
    tagline: string;
    logoText: string;
    logoUrl?: string | null;
    destinationUrl: string;
    contactEmail: string;
    currency: SupportedCurrency;
    amountMinor: number;
    durationMonths: number;
  }): SponsorCampaignRecord {
    const id = `cmp_${crypto.randomBytes(10).toString('hex')}`;
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO sponsor_campaigns (
          id, slot_id, provider, brand_name, tagline, logo_text, logo_url,
          destination_url, contact_email, currency, amount_minor, duration_months,
          status, impressions, clicks, created_at, updated_at
        ) VALUES (?, ?, 'dodo', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 0, 0, ?, ?)`
      )
      .run(
        id,
        input.slotId,
        input.brandName,
        input.tagline,
        input.logoText,
        input.logoUrl ?? null,
        input.destinationUrl,
        input.contactEmail.toLowerCase(),
        input.currency,
        input.amountMinor,
        input.durationMonths,
        ts,
        ts
      );
    return this.getSponsorCampaign(id)!;
  }

  public getSponsorCampaign(id: string): SponsorCampaignRecord | null {
    const row = this.db.prepare('SELECT * FROM sponsor_campaigns WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapCampaignRow(row) : null;
  }

  public getSponsorCampaignByExternalPayment(externalPaymentId: string): SponsorCampaignRecord | null {
    const row = this.db
      .prepare('SELECT * FROM sponsor_campaigns WHERE external_payment_id = ? LIMIT 1')
      .get(externalPaymentId) as Record<string, unknown> | undefined;
    return row ? this.mapCampaignRow(row) : null;
  }

  public listSponsorCampaigns(status?: SponsorCampaignRecord['status']): SponsorCampaignRecord[] {
    this.expireStaleCampaigns();
    const rows = status
      ? (this.db
          .prepare('SELECT * FROM sponsor_campaigns WHERE status = ? ORDER BY created_at DESC')
          .all(status) as Record<string, unknown>[])
      : (this.db
          .prepare('SELECT * FROM sponsor_campaigns ORDER BY created_at DESC LIMIT 120')
          .all() as Record<string, unknown>[]);
    return rows.map((r) => this.mapCampaignRow(r));
  }

  public updateSponsorCampaign(
    id: string,
    patch: {
      status?: SponsorCampaignRecord['status'];
      externalPaymentId?: string | null;
      externalSubscriptionId?: string | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      adminNotes?: string | null;
    }
  ): SponsorCampaignRecord | null {
    const existing = this.getSponsorCampaign(id);
    if (!existing) return null;
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE sponsor_campaigns SET
          status = ?,
          external_payment_id = ?,
          external_subscription_id = ?,
          starts_at = ?,
          expires_at = ?,
          admin_notes = ?,
          updated_at = ?
        WHERE id = ?`
      )
      .run(
        patch.status ?? existing.status,
        patch.externalPaymentId !== undefined ? patch.externalPaymentId : existing.externalPaymentId,
        patch.externalSubscriptionId !== undefined
          ? patch.externalSubscriptionId
          : existing.externalSubscriptionId,
        patch.startsAt !== undefined ? patch.startsAt : existing.startsAt,
        patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
        patch.adminNotes !== undefined ? patch.adminNotes : existing.adminNotes,
        ts,
        id
      );

    // Synchronize slot occupancy strictly with admin-approved status
    if (patch.status === 'approved') {
      this.db
        .prepare(
          `UPDATE sponsor_slots SET status = 'occupied', active_campaign_id = ?, updated_at = ? WHERE slot_id = ?`
        )
        .run(id, ts, existing.slotId);
    } else if (
      patch.status === 'rejected' ||
      patch.status === 'expired' ||
      patch.status === 'refunded'
    ) {
      this.db
        .prepare(
          `UPDATE sponsor_slots SET status = 'available', active_campaign_id = NULL, updated_at = ? WHERE slot_id = ? AND active_campaign_id = ?`
        )
        .run(ts, existing.slotId, id);
    }

    return this.getSponsorCampaign(id);
  }

  public incrementCampaignMetric(campaignId: string, metric: 'impressions' | 'clicks') {
    const col = metric === 'clicks' ? 'clicks' : 'impressions';
    this.db
      .prepare(`UPDATE sponsor_campaigns SET ${col} = ${col} + 1 WHERE id = ? AND status = 'approved'`)
      .run(campaignId);
  }

  public expireStaleCampaigns() {
    const ts = nowIso();
    const expired = this.db
      .prepare(
        `SELECT id, slot_id FROM sponsor_campaigns WHERE status = 'approved' AND expires_at IS NOT NULL AND expires_at <= ?`
      )
      .all(ts) as { id: string; slot_id: string }[];

    for (const row of expired) {
      this.db
        .prepare(`UPDATE sponsor_campaigns SET status = 'expired', updated_at = ? WHERE id = ?`)
        .run(ts, row.id);
      this.db
        .prepare(
          `UPDATE sponsor_slots SET status = 'available', active_campaign_id = NULL, updated_at = ? WHERE slot_id = ? AND active_campaign_id = ?`
        )
        .run(ts, row.slot_id, row.id);
    }
  }

  public getPublicSponsorFrames() {
    const slots = this.listSponsorSlots();
    return slots.map((slot) => {
      const campaign =
        slot.status === 'occupied' && slot.activeCampaignId
          ? this.getSponsorCampaign(slot.activeCampaignId)
          : null;
      const liveCampaign = campaign && campaign.status === 'approved' ? campaign : null;
      return {
        id: slot.slotId,
        number: slot.slotNumber,
        tier: slot.tier,
        priceUsd: Math.round((slot.priceUsdMinor / 100) * 100) / 100,
        priceInr: Math.round((slot.priceInrMinor / 100) * 100) / 100,
        priceUsdMinor: slot.priceUsdMinor,
        priceInrMinor: slot.priceInrMinor,
        sponsor: liveCampaign
          ? {
              campaignId: liveCampaign.id,
              brandName: liveCampaign.brandName,
              tagline: liveCampaign.tagline,
              logoText: liveCampaign.logoText,
              logoUrl: liveCampaign.logoUrl || undefined,
              destinationUrl: liveCampaign.destinationUrl,
              expiresAt: liveCampaign.expiresAt,
            }
          : undefined,
      };
    });
  }

  private mapSlotRow(r: Record<string, unknown>): SponsorSlotRecord {
    return {
      slotId: String(r.slot_id),
      slotNumber: String(r.slot_number),
      tier: String(r.tier) as SponsorSlotRecord['tier'],
      priceUsdMinor: Number(r.price_usd_minor),
      priceInrMinor: Number(r.price_inr_minor),
      dodoProductIdUsd: String(r.dodo_product_id_usd || ''),
      dodoProductIdInr: String(r.dodo_product_id_inr || ''),
      status: String(r.status) as SponsorSlotRecord['status'],
      activeCampaignId: r.active_campaign_id ? String(r.active_campaign_id) : null,
      updatedAt: String(r.updated_at),
    };
  }

  private mapCampaignRow(r: Record<string, unknown>): SponsorCampaignRecord {
    return {
      id: String(r.id),
      slotId: String(r.slot_id),
      provider: String(r.provider) as PaymentProvider,
      externalPaymentId: r.external_payment_id ? String(r.external_payment_id) : null,
      externalSubscriptionId: r.external_subscription_id ? String(r.external_subscription_id) : null,
      brandName: String(r.brand_name),
      tagline: String(r.tagline),
      logoText: String(r.logo_text),
      logoUrl: r.logo_url ? String(r.logo_url) : null,
      destinationUrl: String(r.destination_url),
      contactEmail: String(r.contact_email),
      currency: String(r.currency) as SupportedCurrency,
      amountMinor: Number(r.amount_minor),
      durationMonths: Number(r.duration_months || 1),
      status: String(r.status) as SponsorCampaignRecord['status'],
      impressions: Number(r.impressions || 0),
      clicks: Number(r.clicks || 0),
      startsAt: r.starts_at ? String(r.starts_at) : null,
      expiresAt: r.expires_at ? String(r.expires_at) : null,
      adminNotes: r.admin_notes ? String(r.admin_notes) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  }

  // ---- Email Notifications Log ----
  public logEmailNotification(input: {
    recipientEmail: string;
    template: string;
    subject: string;
    bodyText: string;
    deliveryStatus: EmailNotificationRecord['deliveryStatus'];
    providerMessageId?: string | null;
  }): EmailNotificationRecord {
    const id = `eml_${crypto.randomBytes(8).toString('hex')}`;
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO email_notifications (
          id, recipient_email, template, subject, body_text, delivery_status, provider_message_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.recipientEmail.toLowerCase(),
        input.template,
        input.subject,
        input.bodyText,
        input.deliveryStatus,
        input.providerMessageId ?? null,
        ts
      );
    return {
      id,
      recipientEmail: input.recipientEmail.toLowerCase(),
      template: input.template,
      subject: input.subject,
      bodyText: input.bodyText,
      deliveryStatus: input.deliveryStatus,
      providerMessageId: input.providerMessageId ?? null,
      createdAt: ts,
    };
  }

  public listEmailNotifications(limit = 40): EmailNotificationRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM email_notifications ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      recipientEmail: String(r.recipient_email),
      template: String(r.template),
      subject: String(r.subject),
      bodyText: String(r.body_text),
      deliveryStatus: String(r.delivery_status) as EmailNotificationRecord['deliveryStatus'],
      providerMessageId: r.provider_message_id ? String(r.provider_message_id) : null,
      createdAt: String(r.created_at),
    }));
  }

  // ---- Admin Credentials (First-Run Claim Fallback when ADMIN_PASSCODE unset) ----
  public getAdminCredential(): { passwordHash: string; salt: string; claimedAt: string } | null {
    const row = this.db
      .prepare("SELECT password_hash, salt, claimed_at FROM admin_credentials WHERE id = 'primary'")
      .get() as { password_hash: string; salt: string; claimed_at: string } | undefined;
    if (!row) return null;
    return {
      passwordHash: row.password_hash,
      salt: row.salt,
      claimedAt: row.claimed_at,
    };
  }

  public claimAdminCredential(password: string): boolean {
    const existing = this.getAdminCredential();
    if (existing) return false;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const res = this.db
      .prepare(
        `INSERT OR IGNORE INTO admin_credentials (id, password_hash, salt, claimed_at) VALUES ('primary', ?, ?, ?)`
      )
      .run(hash, salt, nowIso());
    return Number(res.changes) > 0;
  }

  public verifyClaimedAdminPassword(password: string): boolean {
    const cred = this.getAdminCredential();
    if (!cred) return false;
    const derived = crypto.scryptSync(password, cred.salt, 64);
    const stored = Buffer.from(cred.passwordHash, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  }
}

let singletonDb: BillingDatabase | null = null;

export function getBillingDb(): BillingDatabase {
  if (!singletonDb) {
    singletonDb = new BillingDatabase();
  }
  return singletonDb;
}
