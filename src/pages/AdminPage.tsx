import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface AdminPricingItem {
  id: string;
  kind: string;
  name: string;
  priceUsdMinor: number;
  priceInrMinor: number;
  active: boolean;
  dodoProductIdUsd: string;
  dodoProductIdInr: string;
  dodoProductIdDefault: string;
}

interface AdminSponsorSlot {
  slotId: string;
  slotNumber: string;
  priceUsdMinor: number;
  priceInrMinor: number;
  dodoProductIdUsd: string;
  dodoProductIdInr: string;
  status: string;
  activeCampaignId: string | null;
}

interface AdminCampaign {
  id: string;
  slotId: string;
  provider: string;
  brandName: string;
  tagline: string;
  destinationUrl: string;
  contactEmail: string;
  currency: string;
  amountMinor: number;
  durationMonths: number;
  status: string;
  impressions: number;
  clicks: number;
  expiresAt: string | null;
  createdAt: string;
}

interface AdminPayment {
  id: string;
  provider: string;
  externalPaymentId: string;
  kind: string;
  itemId: string;
  customerEmail: string;
  currency: string;
  amountMinor: number;
  status: string;
  createdAt: string;
}

interface AdminSubscription {
  id: string;
  provider: string;
  externalSubscriptionId: string;
  customerEmail: string;
  itemId: string;
  currency: string;
  amountMinor: number;
  billingInterval: string;
  status: string;
  currentPeriodEnd: string | null;
}

interface AdminEntitlement {
  id: string;
  provider: string;
  planName: string;
  entitlementType: string;
  status: string;
  active: boolean;
  creditsBalance: number;
  licenseKeyPreview: string;
  customerEmail: string;
  expiresAt: string | null;
}

interface AdminWebhookEvent {
  webhookId: string;
  provider: string;
  eventType: string;
  status: string;
  receivedAt: string;
  errorMessage: string | null;
}

interface AdminEmailLog {
  id: string;
  recipientEmail: string;
  template: string;
  subject: string;
  deliveryStatus: string;
  createdAt: string;
}

interface AdminOverview {
  environment: 'test_mode' | 'live_mode';
  dodoConfigured: boolean;
  webhookConfigured: boolean;
  pricing: AdminPricingItem[];
  slots: AdminSponsorSlot[];
  campaigns: AdminCampaign[];
  payments: AdminPayment[];
  subscriptions: AdminSubscription[];
  entitlements: AdminEntitlement[];
  webhooks: AdminWebhookEvent[];
  emails: AdminEmailLog[];
}

function fmtMinor(amountMinor: number, currency: string): string {
  const val = amountMinor / 100;
  if (currency === 'INR') return `₹${Math.round(val).toLocaleString('en-IN')} INR`;
  return `$${val.toFixed(2)} ${currency}`;
}

export const AdminPage: React.FC = () => {
  // Security: Bearer admin token lives strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'loading' | 'env_passcode' | 'claimed_password' | 'unclaimed_setup'>('loading');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [tab, setTab] = useState<'pricing' | 'sponsors' | 'ledger'>('pricing');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);

  // Editable draft maps for pricing & sponsor slots
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, AdminPricingItem>>({});
  const [slotDrafts, setSlotDrafts] = useState<Record<string, AdminSponsorSlot>>({});

  useEffect(() => {
    fetch('/api/admin/auth/status')
      .then((r) => r.json())
      .then((d) => setAuthMode(d.mode || 'claimed_password'))
      .catch(() => setAuthMode('claimed_password'));
  }, []);

  const loadOverview = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/overview', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status === 401) {
      setToken(null);
      return;
    }
    if (res.ok) {
      const data = (await res.json()) as AdminOverview;
      setOverview(data);
      const pMap: Record<string, AdminPricingItem> = {};
      data.pricing.forEach((p) => {
        pMap[p.id] = { ...p };
      });
      setPricingDrafts(pMap);

      const sMap: Record<string, AdminSponsorSlot> = {};
      data.slots.forEach((s) => {
        sMap[s.slotId] = { ...s };
      });
      setSlotDrafts(sMap);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadOverview(token);
    }
  }, [token, loadOverview]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    const endpoint = authMode === 'unclaimed_setup' ? '/api/admin/auth/claim' : '/api/admin/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setPassword('');
      } else {
        setAuthError(data.error || 'Authentication failed.');
      }
    } catch {
      setAuthError('Unable to reach server.');
    } finally {
      setAuthBusy(false);
    }
  };

  const savePricingItem = async (id: string) => {
    if (!token || !pricingDrafts[id]) return;
    const item = pricingDrafts[id];
    setBusyMsg(`Saving ${item.name}...`);
    const res = await fetch(`/api/admin/pricing/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        priceUsdMinor: item.priceUsdMinor,
        priceInrMinor: item.priceInrMinor,
        active: item.active,
        dodoProductIdUsd: item.dodoProductIdUsd,
        dodoProductIdInr: item.dodoProductIdInr,
        dodoProductIdDefault: item.dodoProductIdDefault,
      }),
    });
    if (res.ok) {
      setBusyMsg(`Saved ${item.name} INR/USD pricing & Dodo Product IDs.`);
      await loadOverview(token);
    } else {
      const err = await res.json().catch(() => ({}));
      setBusyMsg(err.error || 'Failed to save pricing item.');
    }
  };

  const saveSlotItem = async (slotId: string) => {
    if (!token || !slotDrafts[slotId]) return;
    const slot = slotDrafts[slotId];
    setBusyMsg(`Saving Frame ${slot.slotNumber}...`);
    const res = await fetch(`/api/admin/sponsors/slots/${encodeURIComponent(slotId)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        priceUsdMinor: slot.priceUsdMinor,
        priceInrMinor: slot.priceInrMinor,
        dodoProductIdUsd: slot.dodoProductIdUsd,
        dodoProductIdInr: slot.dodoProductIdInr,
      }),
    });
    if (res.ok) {
      setBusyMsg(`Saved Frame ${slot.slotNumber} INR/USD pricing & Dodo Product IDs.`);
      await loadOverview(token);
    } else {
      setBusyMsg('Failed to update sponsor slot.');
    }
  };

  const handleCampaignAction = async (
    campaignId: string,
    action: 'approve' | 'reject' | 'expire' | 'refund'
  ) => {
    if (!token) return;
    setBusyMsg(`Running ${action} on campaign ${campaignId}...`);
    const res = await fetch(`/api/admin/sponsors/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setBusyMsg(`Campaign updated (${action}).`);
      await loadOverview(token);
    } else {
      setBusyMsg(data.error || `Campaign ${action} failed.`);
    }
  };

  const handlePaymentRefund = async (paymentId: string) => {
    if (!token) return;
    setBusyMsg(`Initiating refund for ${paymentId}...`);
    const res = await fetch(`/api/admin/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Admin dashboard refund' }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyMsg(res.ok ? 'Refund completed and entitlement revoked.' : data.error || 'Refund failed.');
    if (res.ok) await loadOverview(token);
  };

  const handleCancelSub = async (externalSubId: string) => {
    if (!token) return;
    setBusyMsg(`Cancelling subscription ${externalSubId}...`);
    const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(externalSubId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setBusyMsg(res.ok ? 'Subscription set to cancel at period end.' : data.error || 'Cancel failed.');
    if (res.ok) await loadOverview(token);
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0D101C]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
              <Lock className="h-4.5 w-4.5" />
            </span>
            <div>
              <h1 className="font-display text-base font-bold text-slate-950 dark:text-white">
                {authMode === 'unclaimed_setup'
                  ? 'First-Run Admin Setup'
                  : 'Toolivo Billing & Sponsor Admin'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {authMode === 'unclaimed_setup'
                  ? 'Choose an admin password to lock this dashboard (or set ADMIN_PASSCODE in Secrets).'
                  : 'Server-verified session · Dodo Payments & Pricing Control'}
              </p>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-5 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {authMode === 'unclaimed_setup' ? 'Create Admin Password (min 6 chars)' : 'Admin Password'}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-[#090B14] dark:text-white"
              />
            </div>

            {authError && (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{authError}</p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {authBusy
                ? 'Verifying...'
                : authMode === 'unclaimed_setup'
                  ? 'Claim Admin Access'
                  : 'Sign In to Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-slate-950 dark:text-white">
            Dodo Payments &amp; Sponsor Admin
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure separate INR/USD pricing &amp; Dodo Product IDs, approve paid sponsor campaigns, and audit transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadOverview(token)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0D101C] dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setToken(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0D101C] dark:text-slate-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </button>
        </div>
      </div>

      {/* Environment Readiness Summary */}
      {overview && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0D101C]">
            <p className="font-mono text-[10px] uppercase text-slate-500">Dodo Environment</p>
            <p className="mt-1 font-display text-sm font-bold text-slate-950 dark:text-white">
              {overview.environment === 'live_mode' ? 'Live Production' : 'Sandbox (test_mode)'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0D101C]">
            <p className="font-mono text-[10px] uppercase text-slate-500">Dodo API &amp; Webhook</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold">
              {overview.dodoConfigured ? (
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-slate-900 dark:text-white">
                API: {overview.dodoConfigured ? 'Set' : 'Missing'} · Webhook: {overview.webhookConfigured ? 'Set' : 'Missing'}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0D101C]">
            <p className="font-mono text-[10px] uppercase text-slate-500">Pending Sponsor Reviews</p>
            <p className="mt-1 font-display text-sm font-bold text-amber-600 dark:text-amber-400">
              {overview.campaigns.filter((c) => c.status === 'pending_approval').length} awaiting approval
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0D101C]">
            <p className="font-mono text-[10px] uppercase text-slate-500">Active Pro Licences</p>
            <p className="mt-1 font-display text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {overview.entitlements.filter((e) => e.active).length} active keys
            </p>
          </div>
        </div>
      )}

      {busyMsg && (
        <div className="rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-2.5 text-xs font-medium text-violet-900 dark:text-violet-200">
          {busyMsg}
        </div>
      )}

      {/* Admin Section Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: 'pricing', label: 'Pricing & Dodo Products', icon: DollarSign },
          { id: 'sponsors', label: 'Sponsor Campaigns & Approval', icon: Megaphone },
          { id: 'ledger', label: 'Payments, Licences & Webhooks', icon: CreditCard },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as 'pricing' | 'sponsors' | 'ledger')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                active
                  ? 'bg-violet-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0D101C] dark:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Multi-Currency Pricing & Dodo Product IDs */}
      {tab === 'pricing' && overview && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
              Pro Plans, Passes, Lifetime &amp; Credit Packs (Independent INR &amp; USD Pricing)
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2 pr-3">Plan</th>
                    <th className="py-2 pr-3">USD ($)</th>
                    <th className="py-2 pr-3">INR (₹)</th>
                    <th className="py-2 pr-3">Dodo Product ID (USD)</th>
                    <th className="py-2 pr-3">Dodo Product ID (INR)</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {overview.pricing.map((item) => {
                    const draft = pricingDrafts[item.id] || item;
                    return (
                      <tr key={item.id}>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                          {item.name}
                          <span className="block font-mono text-[10px] font-normal text-slate-500">
                            {item.id} · {item.kind}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="number"
                            step="0.01"
                            value={(draft.priceUsdMinor / 100).toFixed(2)}
                            onChange={(e) =>
                              setPricingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  priceUsdMinor: Math.max(50, Math.round(Number(e.target.value || 0) * 100)),
                                },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="number"
                            step="1"
                            value={Math.round(draft.priceInrMinor / 100)}
                            onChange={(e) =>
                              setPricingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  priceInrMinor: Math.max(1000, Math.round(Number(e.target.value || 0) * 100)),
                                },
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            value={draft.dodoProductIdUsd}
                            placeholder="pdt_..."
                            onChange={(e) =>
                              setPricingDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, dodoProductIdUsd: e.target.value },
                              }))
                            }
                            className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            value={draft.dodoProductIdInr}
                            placeholder="pdt_..."
                            onChange={(e) =>
                              setPricingDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, dodoProductIdInr: e.target.value },
                              }))
                            }
                            className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => savePricingItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700"
                          >
                            <Save className="h-3 w-3" />
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
              8 Sponsor Frames (Default $18 USD / ₹1,299 INR First Month)
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2 pr-3">Frame</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">USD ($)</th>
                    <th className="py-2 pr-3">INR (₹)</th>
                    <th className="py-2 pr-3">Dodo Product (USD)</th>
                    <th className="py-2 pr-3">Dodo Product (INR)</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                  {overview.slots.slice(0, 8).map((slot) => {
                    const draft = slotDrafts[slot.slotId] || slot;
                    return (
                      <tr key={slot.slotId}>
                        <td className="py-2.5 pr-3 font-mono font-bold text-slate-900 dark:text-white">
                          Frame {slot.slotNumber}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              slot.status === 'occupied'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {slot.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="number"
                            value={Math.round(draft.priceUsdMinor / 100)}
                            onChange={(e) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [slot.slotId]: {
                                  ...draft,
                                  priceUsdMinor: Math.max(100, Math.round(Number(e.target.value || 0) * 100)),
                                },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="number"
                            value={Math.round(draft.priceInrMinor / 100)}
                            onChange={(e) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [slot.slotId]: {
                                  ...draft,
                                  priceInrMinor: Math.max(1000, Math.round(Number(e.target.value || 0) * 100)),
                                },
                              }))
                            }
                            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            value={draft.dodoProductIdUsd}
                            placeholder="pdt_..."
                            onChange={(e) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [slot.slotId]: { ...draft, dodoProductIdUsd: e.target.value },
                              }))
                            }
                            className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            type="text"
                            value={draft.dodoProductIdInr}
                            placeholder="pdt_..."
                            onChange={(e) =>
                              setSlotDrafts((prev) => ({
                                ...prev,
                                [slot.slotId]: { ...draft, dodoProductIdInr: e.target.value },
                              }))
                            }
                            className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => saveSlotItem(slot.slotId)}
                            className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700"
                          >
                            <Save className="h-3 w-3" />
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: Sponsor Approval Queue & Live Tracking */}
      {tab === 'sponsors' && overview && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
          <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
            Sponsor Campaigns (Webhook-Verified → Admin Approval → Live)
          </h2>
          {overview.campaigns.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">No sponsor campaigns booked yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {overview.campaigns.map((cmp) => (
                <div
                  key={cmp.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800 dark:bg-[#090B14]"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-bold text-slate-950 dark:text-white">
                        {cmp.brandName}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {cmp.slotId} · {fmtMinor(cmp.amountMinor, cmp.currency)} ({cmp.durationMonths} mo)
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          cmp.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : cmp.status === 'pending_approval'
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {cmp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {cmp.tagline} · <span className="font-mono">{cmp.destinationUrl}</span> · {cmp.contactEmail}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      Impressions: {cmp.impressions} · Clicks: {cmp.clicks} · CTR:{' '}
                      {cmp.impressions > 0 ? `${((cmp.clicks / cmp.impressions) * 100).toFixed(1)}%` : '0.0%'}
                      {cmp.expiresAt ? ` · Expires ${new Date(cmp.expiresAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cmp.status === 'pending_approval' && (
                      <button
                        type="button"
                        onClick={() => handleCampaignAction(cmp.id, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve &amp; Publish
                      </button>
                    )}
                    {(cmp.status === 'pending_approval' || cmp.status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => handleCampaignAction(cmp.id, 'reject')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        Reject
                      </button>
                    )}
                    {cmp.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleCampaignAction(cmp.id, 'expire')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Expire
                      </button>
                    )}
                    {cmp.status !== 'refunded' && cmp.status !== 'pending_payment' && (
                      <button
                        type="button"
                        onClick={() => handleCampaignAction(cmp.id, 'refund')}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Refund via Dodo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Provider-Neutral Payments, Subscriptions, Licences, Webhooks & Emails */}
      {tab === 'ledger' && overview && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
              Payments Ledger (Dodo + Preserved Historical Stripe Records)
            </h2>
            {overview.payments.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No payments recorded yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 font-mono text-[10px] uppercase text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Customer</th>
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                    {overview.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 pr-3 font-mono text-[11px] uppercase font-bold text-violet-600 dark:text-violet-400">
                          {p.provider}
                        </td>
                        <td className="py-2 pr-3">{p.customerEmail}</td>
                        <td className="py-2 pr-3 font-mono text-[11px]">{p.kind}:{p.itemId}</td>
                        <td className="py-2 pr-3 font-mono font-semibold">{fmtMinor(p.amountMinor, p.currency)}</td>
                        <td className="py-2 pr-3 font-mono text-[11px] uppercase">{p.status}</td>
                        <td className="py-2">
                          {p.status === 'succeeded' && p.provider === 'dodo' && (
                            <button
                              type="button"
                              onClick={() => handlePaymentRefund(p.id)}
                              className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-950 dark:text-white">
                <KeyRound className="h-4 w-4 text-amber-500" />
                Issued Pro Licences &amp; Entitlements
              </h2>
              <div className="mt-3 space-y-2 text-xs">
                {overview.entitlements.length === 0 ? (
                  <p className="text-slate-500">No entitlements issued yet.</p>
                ) : (
                  overview.entitlements.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-white">
                          {e.customerEmail} · <span className="font-mono text-[11px]">{e.licenseKeyPreview}</span>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {e.provider.toUpperCase()} · {e.planName} · {e.status}
                          {e.entitlementType === 'credits' ? ` · ${e.creditsBalance} credits` : ''}
                        </p>
                      </div>
                      <span className={`font-mono text-[10px] font-bold uppercase ${e.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                        {e.active ? 'Active' : e.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#0D101C]">
              <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-950 dark:text-white">
                <Mail className="h-4 w-4 text-violet-500" />
                Subscriptions, Webhooks &amp; Email Log
              </h2>
              <div className="mt-3 space-y-2 text-xs">
                {overview.subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {sub.customerEmail} ({sub.itemId})
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {sub.provider.toUpperCase()} · {sub.status} · {fmtMinor(sub.amountMinor, sub.currency)}/{sub.billingInterval}
                      </p>
                    </div>
                    {sub.status === 'active' && sub.provider === 'dodo' && (
                      <button
                        type="button"
                        onClick={() => handleCancelSub(sub.externalSubscriptionId)}
                        className="rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold dark:border-slate-700"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
                {overview.webhooks.slice(0, 6).map((w) => (
                  <div key={w.webhookId} className="rounded-lg border border-slate-200/80 px-3 py-2 font-mono text-[11px] dark:border-slate-800">
                    <span className="font-bold text-violet-600 dark:text-violet-400">{w.eventType}</span> · {w.status} · {w.webhookId}
                  </div>
                ))}
                {overview.emails.slice(0, 4).map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200/80 px-3 py-2 text-[11px] dark:border-slate-800">
                    <span className="font-semibold">{m.subject}</span> → {m.recipientEmail} ({m.deliveryStatus})
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
