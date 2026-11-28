import DodoPayments from 'dodopayments';
import type { Currency } from 'dodopayments/resources/misc';
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks/webhooks';
import type { PricingItemRecord, SponsorSlotRecord, SupportedCurrency } from '../db/billingDb.ts';

export type DodoEnvironment = 'test_mode' | 'live_mode';

export const DODO_SUPPORTED_LOCAL_CURRENCIES: SupportedCurrency[] = [
  'USD',
  'INR',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'SGD',
];

export function getDodoEnvironment(): DodoEnvironment {
  return process.env.DODO_PAYMENTS_ENVIRONMENT?.trim() === 'live_mode' ? 'live_mode' : 'test_mode';
}

export function isDodoConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim());
}

export function isDodoWebhookConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim());
}

export function createDodoClient(overrides?: {
  bearerToken?: string;
  webhookKey?: string;
  environment?: DodoEnvironment;
}): DodoPayments {
  const bearerToken = overrides?.bearerToken ?? process.env.DODO_PAYMENTS_API_KEY?.trim();
  const webhookKey = overrides?.webhookKey ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  const environment = overrides?.environment ?? getDodoEnvironment();

  return new DodoPayments({
    bearerToken: bearerToken || 'dodo_unconfigured_placeholder',
    webhookKey: webhookKey || undefined,
    environment,
  });
}

/**
 * Resolves the exact Dodo Product ID for a Pro / Pass / Credit item in the requested currency.
 * Separate INR and USD Dodo products preserve independent regional pricing without FX conversion.
 * For other adaptive currencies (EUR, GBP, CAD, AUD, SGD), falls back to the USD/default Dodo product
 * combined with Dodo's `billing_currency` Adaptive Currency parameter.
 */
export function resolveProDodoProductId(
  item: PricingItemRecord,
  currency: SupportedCurrency
): string {
  if (currency === 'INR') {
    return item.dodoProductIdInr || item.dodoProductIdDefault || item.dodoProductIdUsd;
  }
  if (currency === 'USD') {
    return item.dodoProductIdUsd || item.dodoProductIdDefault;
  }
  return item.dodoProductIdDefault || item.dodoProductIdUsd;
}

export function resolveSponsorDodoProductId(
  slot: SponsorSlotRecord,
  currency: SupportedCurrency
): string {
  if (currency === 'INR') {
    return slot.dodoProductIdInr || slot.dodoProductIdUsd;
  }
  return slot.dodoProductIdUsd;
}

export function getItemMinorAmount(
  item: Pick<PricingItemRecord, 'priceUsdMinor' | 'priceInrMinor'>,
  currency: SupportedCurrency
): number {
  if (currency === 'INR') return item.priceInrMinor;
  return item.priceUsdMinor;
}

export interface CreateDodoCheckoutInput {
  productId: string;
  quantity?: number;
  currency: SupportedCurrency;
  customerEmail: string;
  customerName?: string;
  returnUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}

export async function createDodoCheckoutSession(input: CreateDodoCheckoutInput) {
  if (!isDodoConfigured()) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured on the server.');
  }

  const client = createDodoClient();

  const session = await client.checkoutSessions.create({
    product_cart: [
      {
        product_id: input.productId,
        quantity: input.quantity ?? 1,
      },
    ],
    billing_currency: input.currency as Currency,
    customer: {
      email: input.customerEmail,
      ...(input.customerName ? { name: input.customerName } : {}),
    },
    metadata: input.metadata,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    feature_flags: {
      allow_currency_selection: false,
      allow_discount_code: true,
    },
    customization: {
      theme: 'system',
      show_order_details: true,
    },
  });

  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
  };
}

export async function retrieveDodoCheckoutStatus(dodoSessionId: string) {
  const client = createDodoClient();
  return client.checkoutSessions.retrieve(dodoSessionId);
}

/**
 * Cryptographically verifies incoming Dodo Payments webhooks using the Standard Webhooks
 * specification (`webhook-id`, `webhook-signature`, `webhook-timestamp`) via the official SDK.
 */
export function verifyAndUnwrapDodoWebhook(
  rawBody: string,
  headers: {
    'webhook-id': string;
    'webhook-signature': string;
    'webhook-timestamp': string;
  },
  webhookKeyOverride?: string
): UnwrapWebhookEvent {
  const secret = webhookKeyOverride ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim();
  if (!secret) {
    throw new Error('DODO_PAYMENTS_WEBHOOK_KEY is not configured on the server.');
  }
  const client = createDodoClient({ webhookKey: secret });
  return client.webhooks.unwrap(rawBody, {
    headers,
    key: secret,
  });
}

export async function createDodoRefund(externalPaymentId: string, reason?: string) {
  if (!isDodoConfigured()) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured on the server.');
  }
  const client = createDodoClient();
  return client.refunds.create({
    payment_id: externalPaymentId,
    reason: reason || 'Merchant initiated refund',
  });
}

export async function cancelDodoSubscription(externalSubscriptionId: string) {
  if (!isDodoConfigured()) {
    throw new Error('DODO_PAYMENTS_API_KEY is not configured on the server.');
  }
  const client = createDodoClient();
  return client.subscriptions.update(externalSubscriptionId, {
    cancel_at_next_billing_date: true,
  });
}
