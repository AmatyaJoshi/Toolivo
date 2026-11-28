# Toolivo — Dodo Payments Migration & Operations Guide

Toolivo uses **Dodo Payments** exclusively as its Merchant of Record (MoR) payment provider for accountless Pro purchases, multi-currency INR & USD checkout, and advertising sponsor bookings.

## 1. Stripe Components Removed
- Removed `stripe` package from `package.json`.
- Removed `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from `.env.example`.
- Removed all `Stripe` SDK imports, checkout session handlers, and Stripe UI branding from:
  - `src/server/controllers/apiController.ts`
  - `src/pages/ProPage.tsx`
  - `src/components/SponsorFrames.tsx`
- Preserved provider-neutral storage (`provider: 'stripe' | 'dodo'`) inside `payments`, `subscriptions`, `entitlements`, and `sponsor_campaigns` so historical Stripe transactions and legacy user entitlements remain intact and readable in `/admin`.

## 2. Dodo Payments Integrations Implemented
- **Official SDK**: `dodopayments` (`src/server/services/dodoService.ts`) configured with `environment: 'test_mode' | 'live_mode'`.
- **Checkout Sessions API**: `client.checkoutSessions.create(...)` with `product_cart`, `billing_currency`, `customer`, `metadata`, `return_url`, and `cancel_url`.
- **Multi-Currency Independent Pricing**:
  - Separate configurable **INR (`₹`)** and **USD (`$`)** prices stored in SQLite (`pricing_items` & `sponsor_slots`) and mapped to dedicated INR & USD Dodo Product IDs (never exchange-rate converted).
  - Supports additional Dodo Adaptive Currencies (`EUR`, `GBP`, `CAD`, `AUD`, `SGD`) when Adaptive Currency is enabled in Dodo Dashboard.
- **Monetisation Models**:
  - Monthly subscription (`monthly`)
  - Annual subscription (`yearly`)
  - Short-duration non-recurring pass (`pass-7d`)
  - One-time permanent purchase (`lifetime`)
  - Usage-based credit packs (`credits-100`, `credits-500`)
  - 8 Sponsor Frames (`frame-01` .. `frame-08`, standard `$18 USD / ₹1,299 INR` first month)
- **Signed Webhook Verification**:
  - `POST /api/payments/dodo/webhook` mounted with `express.raw({ type: 'application/json' })` before JSON body parsing.
  - Cryptographically verifies `webhook-id`, `webhook-signature`, and `webhook-timestamp` via `client.webhooks.unwrap(...)` (Standard Webhooks specification).
  - Enforces strict idempotency in `webhook_events` (`webhook_id PRIMARY KEY`) so duplicate deliveries never create duplicate entitlements or duplicate credits.
- **Accountless Pro Experience**:
  - No mandatory sign-up; collects customer email only.
  - Issues unique `TLVO-XXXX-XXXX-XXXX` recovery keys after webhook verification, stores SHA-256 hashes + AES-256-GCM encrypted copies, emails keys securely, supports cross-device restoration, and supports optional Google Account sync via Firebase Auth.
- **Advertising / Sponsor Workflow**:
  - Dedicated `/advertise` page + 8-frame Homepage wall + alongside-tool 2-frame rail.
  - Paid bookings transition strictly to `pending_approval` upon verified webhook and publish live ONLY after admin approval in `/admin`.
  - Supports renewals, expiry automation, Dodo Refunds (`client.refunds.create`), and real impression/click tracking.

## 3. Required Dodo Payments Dashboard Configuration
1. **API Keys (`Developer -> API Keys`)**:
   - Generate a Test Mode API key for sandbox (`DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_ENVIRONMENT=test_mode`).
   - Generate a Live Mode API key once merchant KYC/verification is approved (`DODO_PAYMENTS_ENVIRONMENT=live_mode`).
2. **Products (`Products -> Create Product`)**:
   - Create separate **USD** and **INR** products for:
     - `7-Day Pass` (One-Time: `$2.99 USD` / `₹149 INR`)
     - `Monthly Pro` (Subscription, Monthly: `$5.99 USD` / `₹299 INR`)
     - `Yearly Pro` (Subscription, Yearly: `$39.99 USD` / `₹2,499 INR`)
     - `Lifetime Pro` (One-Time: `$79.00 USD` / `₹4,999 INR`)
     - `100 Pro Credits` (One-Time: `$4.99 USD` / `₹249 INR`)
     - `500 Pro Credits` (One-Time: `$14.99 USD` / `₹799 INR`)
     - `Sponsor Frame (Monthly)` (One-Time or Subscription: `$18.00 USD` / `₹1,299 INR`)
   - Enable **Adaptive Currency** in Dodo Dashboard if you want `EUR/GBP/CAD/AUD/SGD` local currency checkout.
   - Paste each `pdt_...` Product ID into `/admin -> Pricing & Dodo Products` (or `.env` variables).
3. **Webhooks (`Developer -> Webhooks`)**:
   - Endpoint URL: `https://<your-domain>/api/payments/dodo/webhook`
   - Subscribe to events:
     - `payment.succeeded`, `payment.failed`, `payment.cancelled`
     - `subscription.active`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`, `subscription.on_hold`, `subscription.past_due`, `subscription.paused`, `subscription.failed`
     - `refund.succeeded`, `refund.failed`
     - `entitlement_grant.revoked`, `dispute.lost`
   - Copy the `whsec_...` signing secret into `DODO_PAYMENTS_WEBHOOK_KEY`.

## 4. Running Automated Sandbox & Webhook Tests
```bash
npx tsx --test tests/dodo-payments.test.ts
```
