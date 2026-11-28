import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  FileCheck2,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  CURRENCY_OPTIONS,
  PRO_FAQS,
  PRO_PLANS,
  formatBillingSuffix,
  formatMoney,
  type ProPlan,
  type SupportedCurrency,
} from '../data/proPlans';
import { FaqAccordion } from '../components/Layout';
import { Button } from '../components/ui/button';
import { useEntitlement } from '../context/EntitlementContext';

const COMPARISON_ROWS: { feature: string; free: string; pro: string }[] = [
  {
    feature: 'All 43 PDF, Image, Video, Audio & Dev Tools',
    free: 'Included (Free)',
    pro: 'Included + early access',
  },
  {
    feature: 'Local Browser Privacy (Zero Server Uploads)',
    free: '100% browser-local',
    pro: '100% browser-local',
  },
  {
    feature: 'Sponsor-Free Focused Workspace',
    free: 'Includes sponsor frames',
    pro: 'Zero sponsor frames',
  },
  {
    feature: 'Accountless Instant Recovery Key',
    free: 'No account needed',
    pro: 'No account needed + optional Google sync',
  },
  {
    feature: 'Export Quality & Batch Workflows',
    free: 'Standard HD & 300 DPI',
    pro: 'Unlimited power batches & presets',
  },
  {
    feature: 'Tax / GST Invoice (Merchant of Record)',
    free: 'Personal use',
    pro: 'Dodo Payments MoR invoice (INR & USD)',
  },
];

export const ProPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const {
    currency,
    setCurrency,
    entitlement,
    activeRecoveryKey,
    isPro,
    activateByKey,
    clearEntitlement,
    optionalUser,
    connectGoogleAccount,
    disconnectGoogleAccount,
  } = useEntitlement();

  const [plans, setPlans] = useState<ProPlan[]>(PRO_PLANS);
  const [dodoEnv, setDodoEnv] = useState<'test_mode' | 'live_mode'>('test_mode');
  const [tab, setTab] = useState<'plans' | 'credits'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('yearly');
  const [email, setEmail] = useState('');
  const [billingName, setBillingName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Accountless restoration & cross-device recovery state
  const [restoreKeyInput, setRestoreKeyInput] = useState('');
  const [restoreStatus, setRestoreStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Post-checkout webhook verification state (never trusts URL params blindly)
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [verifiedKey, setVerifiedKey] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch live multi-currency plans from backend (admin-configurable INR/USD pricing)
  useEffect(() => {
    fetch('/api/pro/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.plans?.length) {
          setPlans(data.plans);
        }
        if (data?.environment) {
          setDodoEnv(data.environment);
        }
      })
      .catch(() => {});
  }, []);

  // Inspect query parameters for `?restore=TLVO-...` or `?checkout=return&session_id=...`
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const restoreParam = params.get('restore');
    if (restoreParam) {
      setRestoreKeyInput(restoreParam);
      activateByKey(restoreParam).then((res) => {
        setRestoreStatus({
          ok: res.ok,
          msg: res.ok
            ? 'Toolivo Pro restored on this device! Sponsor frames are now hidden.'
            : res.error || 'Could not restore key.',
        });
      });
    }

    const checkoutFlag = params.get('checkout');
    const sid = params.get('session_id');
    if (checkoutFlag === 'cancelled') {
      setVerificationNotice('Checkout was cancelled. No charge was made.');
    } else if (checkoutFlag === 'return' && sid) {
      setPendingSessionId(sid);
      setVerificationNotice(
        'Verifying payment with Dodo Payments signed webhook... Your recovery key will appear automatically once verified.'
      );
    }
  }, [activateByKey]);

  // Poll server for webhook-verified entitlement (never activates from URL redirect alone)
  useEffect(() => {
    if (!pendingSessionId) return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/checkout/status/${encodeURIComponent(pendingSessionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.verified && data.recoveryKey && !cancelled) {
            setVerifiedKey(data.recoveryKey);
            setVerificationNotice(
              'Payment cryptographically verified by Dodo Payments! Your unique recovery key is active below and has been emailed to you.'
            );
            await activateByKey(data.recoveryKey);
            setPendingSessionId(null);
            return;
          }
          if (data.sessionStatus === 'failed' || data.sessionStatus === 'cancelled') {
            setVerificationNotice('Payment was not completed. No entitlement was activated.');
            setPendingSessionId(null);
            return;
          }
        }
      } catch {
        // Continue polling
      }
      if (!cancelled && attempts < 15) {
        setTimeout(poll, 2500);
      } else if (!cancelled) {
        setVerificationNotice(
          'Payment confirmation is still in transit from Dodo Payments. Check your email for your recovery key or click Retry Verification.'
        );
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [pendingSessionId, activateByKey]);

  const handleOpenCustomerPortal = async () => {
    if (!activeRecoveryKey) return;
    setPortalBusy(true);
    setPortalError(null);
    try {
      const res = await fetch('/api/pro/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: activeRecoveryKey }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setPortalError(data.error || 'Could not open Dodo Payments Customer Portal right now.');
    } catch {
      setPortalError('Unable to reach Dodo Payments Customer Portal right now.');
    } finally {
      setPortalBusy(false);
    }
  };

  const visiblePlans = plans.filter((p) =>
    tab === 'credits' ? p.kind === 'credits' : p.kind !== 'credits'
  );
  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || visiblePlans[0] || PRO_PLANS[2];

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/pro/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          email: email.trim(),
          customerName: billingName.trim() || undefined,
          currency,
          linkedFirebaseUid: optionalUser?.uid || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setFeedback(
        data.error ||
          'Dodo Payments Checkout activates once DODO_PAYMENTS_API_KEY and Dodo Product IDs are configured in Settings / /admin.'
      );
    } catch {
      setFeedback('Could not reach Dodo Payments checkout right now. Please try again shortly.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreStatus(null);
    const res = await activateByKey(restoreKeyInput);
    setRestoreStatus({
      ok: res.ok,
      msg: res.ok
        ? 'Pro access restored! Sponsor frames are now hidden across Toolivo.'
        : res.error || 'Invalid recovery key.',
    });
  };

  const handleEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverMsg(null);
    try {
      const res = await fetch('/api/pro/entitlement/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail.trim() }),
      });
      const data = await res.json();
      setRecoverMsg(data.message || data.error || 'Recovery instructions sent.');
    } catch {
      setRecoverMsg('Unable to send recovery email right now.');
    }
  };

  const handleCopyVerifiedKey = async () => {
    if (!verifiedKey) return;
    try {
      await navigator.clipboard.writeText(verifiedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const displayPrice = formatMoney(selectedPlan.priceUsd, selectedPlan.priceInr, currency);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-7 sm:space-y-12 sm:px-8 sm:py-10">
      {/* Active Entitlement Banner (if Pro is active on this device) */}
      {isPro && entitlement && (
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 dark:border-emerald-400/35 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-slate-950 dark:text-white">
                  Toolivo Pro Active — {entitlement.planName}
                </p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Key <code className="font-mono font-semibold">{entitlement.licenseKeyPreview}</code> ·{' '}
                  {entitlement.entitlementType === 'credits'
                    ? `${entitlement.creditsBalance} credits remaining`
                    : entitlement.expiresAt
                      ? `Valid until ${new Date(entitlement.expiresAt).toLocaleDateString()}`
                      : 'Permanent lifetime access'}{' '}
                  · Sponsor frames hidden
                </p>
                {portalError && (
                  <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    {portalError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeRecoveryKey && (
                <button
                  type="button"
                  disabled={portalBusy}
                  onClick={handleOpenCustomerPortal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {portalBusy ? 'Opening Dodo Portal...' : 'Manage Billing & Invoices'}
                </button>
              )}
              <button
                type="button"
                onClick={clearEntitlement}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Remove from this device
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Webhook Verification Result Banner (Post-Checkout Return) */}
      {verificationNotice && (
        <section className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-5 dark:border-violet-400/35 dark:bg-violet-500/12">
          <p className="text-xs font-semibold text-violet-900 dark:text-violet-200">
            {verificationNotice}
          </p>
          {verifiedKey && (
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <code className="rounded-lg border border-violet-400/50 bg-white px-3.5 py-2 font-mono text-sm font-bold tracking-wider text-slate-950 dark:bg-slate-950 dark:text-amber-300">
                {verifiedKey}
              </code>
              <button
                type="button"
                onClick={handleCopyVerifiedKey}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-600 dark:bg-white dark:text-slate-950"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedKey ? 'Copied Key' : 'Copy Recovery Key'}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Seamless Header + Multi-Currency Selector */}
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-2.5 py-0.5 font-mono text-[11px] font-extrabold tracking-wider text-slate-950 dark:bg-amber-500 dark:text-white">
            <Crown className="h-3.5 w-3.5 fill-slate-950 text-slate-950 dark:fill-white dark:text-white" />
            <span>TOOLIVO PRO · ACCOUNTLESS · DODO PAYMENTS</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            A cleaner, faster, sponsor-free workspace — no account required
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-200/85">
            Pay in INR (UPI &amp; Indian cards) or USD (global cards &amp; Apple Pay) through Dodo Payments Merchant of Record. Receive an instant recovery key to unlock Pro on any device.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
              <Lock className="h-3.5 w-3.5" />
              Zero file uploads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              No signup · Instant recovery key
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
              GST / VAT invoice included
            </span>
          </div>
        </div>

        {/* Multi-Currency Switcher + Plan/Credit Toggle */}
        <div className="flex flex-col items-start gap-2.5 sm:items-end">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-2xs dark:border-slate-800 dark:bg-[#0D101C]">
              {(['INR', 'USD'] as SupportedCurrency[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-colors ${
                    currency === code
                      ? 'bg-violet-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {code === 'INR' ? '₹ INR' : '$ USD'}
                </button>
              ))}
              <select
                aria-label="Other Dodo supported local currencies"
                value={['USD', 'INR'].includes(currency) ? '' : currency}
                onChange={(e) => {
                  if (e.target.value) setCurrency(e.target.value as SupportedCurrency);
                }}
                className="rounded-lg bg-transparent px-2 py-1 font-mono text-[11px] font-semibold text-slate-500 focus:outline-none dark:text-slate-400"
              >
                <option value="">More</option>
                {CURRENCY_OPTIONS.filter((c) => c.code !== 'USD' && c.code !== 'INR').map((opt) => (
                  <option key={opt.code} value={opt.code} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 dark:border-slate-800 dark:bg-[#0D101C]">
            <button
              type="button"
              onClick={() => {
                setTab('plans');
                setSelectedPlanId('yearly');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'plans'
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Passes, Subscriptions &amp; Lifetime
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('credits');
                setSelectedPlanId('credits-100');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'credits'
                  ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Coins className="h-3.5 w-3.5" />
              Credit Packs
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards Grid */}
      <section
        aria-label="Toolivo Pro plans"
        className={`grid grid-cols-1 gap-4 ${
          tab === 'credits' ? 'md:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {visiblePlans.map((plan) => {
          const active = selectedPlan.id === plan.id;
          const formatted = formatMoney(plan.priceUsd, plan.priceInr, currency);
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => {
                setSelectedPlanId(plan.id);
                setFeedback(null);
              }}
              className={`enterprise-card flex flex-col justify-between rounded-2xl p-5 text-left hover:-translate-y-0.5 ${
                active ? '!border-amber-500 ring-1 ring-amber-500/40 dark:!border-amber-400' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {plan.targetAudience}
                  </span>
                  {plan.featured && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      POPULAR
                    </span>
                  )}
                </div>

                <h2 className="mt-1.5 font-display text-base font-bold text-slate-950 dark:text-white">
                  {plan.name}
                </h2>

                <div className="mt-3.5 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-extrabold tracking-tight tabular-nums text-slate-950 dark:text-white">
                    {formatted}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {currency} {formatBillingSuffix(plan)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{plan.subLabel}</p>

                <ul className="mt-4 space-y-2 border-t border-slate-200/80 pt-4 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                  {plan.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5">
                <span
                  className={`block w-full rounded-lg px-3.5 py-2 text-center text-xs font-bold transition-colors ${
                    active
                      ? 'bg-amber-400 text-slate-950 dark:bg-amber-500 dark:text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {active ? `Selected — ${plan.name}` : `Select ${plan.name}`}
                </span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Enterprise 2-Column Dodo Payments Accountless Checkout Gateway */}
      <section
        aria-label="Dodo Payments checkout gateway"
        className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0D101C]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-slate-50/90 px-5 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-[#090B14]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
                Dodo Payments · Accountless Checkout ({currency})
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Merchant of Record · Signed webhook verification ·{' '}
                {dodoEnv === 'test_mode' ? 'Sandbox Mode Ready' : 'Live Production'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-slate-600 dark:text-slate-300">
            {(currency === 'INR'
              ? ['UPI', 'RUPAY', 'VISA', 'MASTERCARD']
              : ['VISA', 'MASTERCARD', 'AMEX', 'APPLE PAY']
            ).map((net) => (
              <span
                key={net}
                className="rounded border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-700 dark:bg-slate-900"
              >
                {net}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Itemized Order Summary */}
          <div className="border-b border-slate-200/90 bg-slate-50/50 p-5 sm:p-6 lg:col-span-5 lg:border-r lg:border-b-0 dark:border-slate-800 dark:bg-[#0A0C16]">
            <p className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Order Summary
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0E1120]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold text-slate-950 dark:text-white">
                    Toolivo {selectedPlan.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {selectedPlan.subLabel}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-slate-950 dark:text-white">
                  {displayPrice}
                </span>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-200/80 pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Billing type</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {selectedPlan.kind === 'subscription'
                      ? `Recurring ${selectedPlan.billingInterval}ly`
                      : selectedPlan.kind === 'pass'
                        ? 'Non-recurring 7-day pass'
                        : selectedPlan.kind === 'credits'
                          ? `${selectedPlan.creditsGranted} non-expiring credits`
                          : 'One-time permanent license'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span>Currency &amp; Tax</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {currency} · Handled by Dodo MoR
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/80 pt-2.5 font-display text-sm font-bold text-slate-950 dark:border-slate-800 dark:text-white">
                  <span>Total due today</span>
                  <span className="font-mono tabular-nums">
                    {displayPrice} {currency}
                  </span>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>Unique recovery key emailed automatically after verified Dodo webhook.</span>
              </li>
              <li className="flex items-center gap-2">
                <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                <span>Dodo Payments handles global VAT, sales tax, and Indian GST invoices.</span>
              </li>
            </ul>
          </div>

          {/* Right Column: Accountless Email Form */}
          <div className="p-5 sm:p-6 lg:col-span-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                No Account Needed — Enter Delivery Email
              </p>
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CreditCard className="h-3 w-3" />
                Dodo Hosted Checkout
              </span>
            </div>

            <form onSubmit={handleCheckout} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pro-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Receipt &amp; Recovery Key Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="pro-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-950 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-[#090B14] dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="pro-billing-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Full Name or Business (optional)
                  </label>
                  <input
                    id="pro-billing-name"
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder="For GST / VAT commercial invoice"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-950 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-[#090B14] dark:text-white"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="pro"
                size="lg"
                disabled={submitting}
                className="h-11 w-full text-xs sm:text-sm"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>
                  {submitting
                    ? 'Creating Dodo Payments Checkout Session...'
                    : `Pay ${displayPrice} ${currency} via Dodo Payments`}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>

              <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
                {selectedPlan.kind === 'subscription'
                  ? 'Cancel anytime in one click · Automatic tax/GST receipt from Dodo Payments'
                  : 'One-time purchase · Zero auto-renewal · Instant recovery key delivery'}
              </p>
            </form>

            {feedback && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs leading-relaxed text-amber-950 dark:text-amber-200">
                {feedback}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Restore Purchase Across Devices + Optional Google Account Sync */}
      <section
        aria-label="Restore Pro purchase"
        className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 md:grid-cols-2 dark:border-slate-800 dark:bg-[#0D101C]"
      >
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
              Already bought Pro? Restore on this device
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Paste your <code className="font-mono">TLVO-XXXX-XXXX-XXXX</code> recovery key from your email receipt.
          </p>

          <form onSubmit={handleManualRestore} className="mt-3 flex gap-2">
            <input
              type="text"
              required
              value={restoreKeyInput}
              onChange={(e) => setRestoreKeyInput(e.target.value)}
              placeholder="TLVO-XXXX-XXXX-XXXX"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-[#090B14] dark:text-white"
            />
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Restore
            </button>
          </form>

          {restoreStatus && (
            <p
              className={`mt-2 text-xs font-medium ${
                restoreStatus.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {restoreStatus.msg}
            </p>
          )}

          <form onSubmit={handleEmailRecovery} className="mt-4 border-t border-slate-200/80 pt-3.5 dark:border-slate-800">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Lost your key? Resend active key(s) by email
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="email"
                required
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
                placeholder="Receipt email address"
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-[#090B14] dark:text-white"
              />
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Mail className="h-3.5 w-3.5" />
                Resend
              </button>
            </div>
            {recoverMsg && (
              <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">{recoverMsg}</p>
            )}
          </form>
        </div>

        <div className="flex flex-col justify-between border-t border-slate-200/80 pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
                Optional Account Sync
              </h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Accounts are completely optional on Toolivo. If you prefer automatic syncing across laptops and mobile browsers without pasting keys, link a Google account anytime.
            </p>
          </div>

          <div className="mt-4">
            {optionalUser ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950 dark:text-white">
                    Synced as {optionalUser.email}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Active entitlements sync automatically
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => disconnectGoogleAccount()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setSyncMsg(null);
                  const res = await connectGoogleAccount();
                  if (!res.ok) setSyncMsg(res.error || 'Could not sign in.');
                  else setSyncMsg('Account linked — active entitlements synced automatically.');
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
              >
                <UserCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                Optionally Sync with Google Account
              </button>
            )}
            {syncMsg && <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">{syncMsg}</p>}
          </div>
        </div>
      </section>

      {/* Free vs Pro Concrete Comparison Table */}
      <section aria-label="Free vs Pro comparison">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Free vs Toolivo Pro
        </h2>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0D101C]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-500 uppercase dark:border-slate-800 dark:bg-[#090B14] dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Capability</th>
                <th className="px-5 py-3.5">Free</th>
                <th className="px-5 py-3.5 text-amber-600 dark:text-amber-400">Toolivo Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature}>
                  <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                    {row.feature}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{row.free}</td>
                  <td className="px-5 py-3.5 font-semibold text-slate-950 dark:text-white">
                    {row.pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pro FAQs */}
      <section aria-label="Toolivo Pro FAQs" className="max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            Pro Billing &amp; Recovery Questions
          </h2>
          <button
            type="button"
            onClick={() => navigate('/advertise')}
            className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-400"
          >
            Want to sponsor Toolivo? →
          </button>
        </div>
        <FaqAccordion items={PRO_FAQS} defaultOpenFirst />
      </section>
    </div>
  );
};
