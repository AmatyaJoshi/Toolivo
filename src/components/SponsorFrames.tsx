import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  OWNER_SPONSOR_EMAIL,
  TOP_BANNER_FRAME,
  appendReferralParam,
  formatFramePrice,
  formatFramePriceShort,
  getToolSponsorPair,
  type SponsorFrame,
} from '../data/sponsors';
import type { SupportedCurrency } from '../data/proPlans';
import { useEntitlement } from '../context/EntitlementContext';

interface SponsorModalProps {
  frame: SponsorFrame | null;
  onClose: () => void;
}

export const SponsorBookingModal: React.FC<SponsorModalProps> = ({ frame, onClose }) => {
  const { currency, setCurrency } = useEntitlement();
  const [brandName, setBrandName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoText, setLogoText] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('https://');
  const [contactEmail, setContactEmail] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fallbackReady, setFallbackReady] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!frame) return null;

  const isInr = currency === 'INR';
  const unitDisplay = isInr ? frame.priceInr : frame.priceUsd;
  const totalDisplay = unitDisplay * durationMonths;
  const formattedTotal = isInr
    ? `₹${Math.round(totalDisplay).toLocaleString('en-IN')} INR`
    : `$${totalDisplay.toFixed(0)} ${currency === 'USD' ? 'USD' : currency}`;

  const previewBrand = brandName.trim() || 'Your Brand';
  const previewTagline = tagline.trim() || 'Fast cloud tool for modern teams';
  const previewMonogram = (logoText.trim() || previewBrand.slice(0, 2)).toUpperCase();
  const previewTrackedUrl = destinationUrl.startsWith('https://')
    ? appendReferralParam(destinationUrl)
    : 'https://yourbrand.com?ref=toolivo';

  const isBanner = frame.id === 'frame-top';
  const frameTitle = isBanner ? 'Full-Width Top Banner' : `Frame ${frame.number}`;

  const bookingBrief = [
    `Toolivo Sponsor Reservation — ${frameTitle}`,
    `Total: ${formattedTotal} (${durationMonths} mo · ${formatFramePrice(frame, currency)})`,
    `Brand Name: ${previewBrand}`,
    `Tagline: ${previewTagline}`,
    `Monogram: ${previewMonogram}`,
    logoUrl.trim() ? `Logo URL: ${logoUrl.trim()}` : '',
    `Destination URL: ${previewTrackedUrl}`,
    `Contact Email: ${contactEmail || '(not provided)'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage(null);
    setFallbackReady(false);

    try {
      const res = await fetch('/api/sponsors/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameId: frame.id,
          brandName: brandName.trim(),
          tagline: tagline.trim(),
          logoText: logoText.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
          destinationUrl: destinationUrl.trim(),
          contactEmail: contactEmail.trim(),
          currency,
          durationMonths,
        }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setStatusMessage(
        data.error ||
          'Dodo Payments Checkout activates once DODO_PAYMENTS_API_KEY and Sponsor Product IDs are configured in /admin. You can copy or email your reservation brief below.'
      );
      setFallbackReady(true);
    } catch {
      setStatusMessage('Unable to reach Dodo Payments checkout right now. Use direct reservation email or copy brief below.');
      setFallbackReady(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(bookingBrief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={`Sponsor Frame ${frame.number}`}
          className="sidebar-scroll max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0D121F]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <p className="font-mono text-xs text-violet-600 dark:text-violet-400">
                {isBanner ? 'Full-Width Top Banner · Dodo Payments MoR' : `Frame ${frame.number} of 08 · Dodo Payments MoR`}
              </p>
              <h2 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">
                {isBanner ? 'Sponsor Full-Width Top Banner' : `Sponsor Frame ${frame.number}`}
              </h2>
              <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatFramePrice(frame, currency)} · {isBanner ? 'Exclusive top full-width slot' : 'First month flat rate'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Multi-currency & Duration Selector */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-900">
              {(['USD', 'INR'] as SupportedCurrency[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={`rounded-md px-3 py-1 font-mono text-xs font-semibold transition-colors ${
                    currency === code
                      ? 'bg-violet-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {code === 'INR' ? 'INR (₹ · UPI)' : 'USD ($ · Global)'}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-900">
              {[1, 3, 6].map((mo) => (
                <button
                  key={mo}
                  type="button"
                  onClick={() => setDurationMonths(mo)}
                  className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    durationMonths === mo
                      ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {mo} mo
                </button>
              ))}
            </div>
          </div>

          {/* Live Frame Preview */}
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Live placement preview (Home wall + alongside all 43 tool pages)
            </p>
            <div className="mt-2 flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white font-display text-xs font-bold text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                {logoUrl.startsWith('https://') ? (
                  <img
                    src={logoUrl}
                    alt={previewBrand}
                    referrerPolicy="no-referrer"
                    className="h-6 w-6 rounded object-contain"
                  />
                ) : (
                  previewMonogram
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {previewBrand}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {previewTagline}
                </p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </div>
            <p className="mt-1.5 truncate font-mono text-[11px] text-slate-500">
              Tracked link: {previewTrackedUrl}
            </p>
          </div>

          <form onSubmit={handleCheckout} className="mt-5 space-y-3.5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Brand Name (max 32 chars)
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Acme Cloud"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Logo Monogram
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  placeholder="AC"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs uppercase text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Short Tagline (max 60 chars)
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Ship faster with 0 setup"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Logo Image URL (optional https://)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yourbrand.com/logo.png"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Destination URL (https://)
                </label>
                <input
                  type="url"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="founder@yourbrand.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-950 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {statusMessage && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-[#090B14] dark:text-slate-300">
                {statusMessage}
              </div>
            )}

            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-[#090B14]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <Lock className="h-3 w-3" />
                  Dodo Payments · Merchant of Record
                </span>
                <span className="font-mono text-[10px] font-semibold">
                  {isInr ? 'UPI · RUPAY · CARDS · GST' : 'VISA · MC · AMEX · APPLE PAY'}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {submitting
                    ? 'Connecting to Dodo Payments...'
                    : `Pay ${formattedTotal} · Reserve ${frameTitle}`}
                </button>

                {fallbackReady && (
                  <>
                    <a
                      href={`mailto:${OWNER_SPONSOR_EMAIL}?subject=${encodeURIComponent(
                        `Toolivo Sponsor Frame ${frame.number} (${formattedTotal})`
                      )}&body=${encodeURIComponent(bookingBrief)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email Owner
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyBrief}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy Brief'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                Paid bookings are verified via signed Dodo webhook and queued for quick admin approval before going live across Home &amp; all 43 tools with <code className="font-mono text-slate-700 dark:text-slate-300">?ref=toolivo</code> tracking.
              </span>
            </p>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export function SponsorFrameTile({
  frame,
  currency,
  onSelectOpen,
  large = false,
  className = '',
}: {
  frame: SponsorFrame;
  currency: SupportedCurrency;
  onSelectOpen: (frame: SponsorFrame) => void;
  large?: boolean;
  className?: string;
}) {
  const impressionLogged = useRef(false);

  useEffect(() => {
    const campaignId = frame.sponsor?.campaignId;
    if (campaignId && !impressionLogged.current) {
      impressionLogged.current = true;
      fetch(`/api/sponsors/${encodeURIComponent(campaignId)}/impression`, {
        method: 'POST',
      }).catch(() => {});
    }
  }, [frame.sponsor?.campaignId]);

  if (frame.sponsor) {
    const sp = frame.sponsor;
    const href = sp.campaignId
      ? `/api/sponsors/${encodeURIComponent(sp.campaignId)}/click`
      : appendReferralParam(sp.destinationUrl);

    if (large) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className={`group relative flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-slate-200/95 bg-white px-4 py-5 text-center shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-h-[144px] dark:border-white/90 dark:bg-white ${className}`}
        >
          <span className="absolute top-2.5 left-3 font-mono text-[10px] text-slate-400">
            {frame.number}
          </span>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 font-display text-xs font-bold text-slate-900">
            {sp.logoUrl ? (
              <img
                src={sp.logoUrl}
                alt={sp.brandName}
                referrerPolicy="no-referrer"
                className="h-7 w-7 rounded object-contain"
              />
            ) : (
              sp.logoText || sp.brandName.slice(0, 2).toUpperCase()
            )}
          </div>
          <p className="mt-3 max-w-full truncate font-display text-sm font-bold text-slate-950">
            {sp.brandName}
          </p>
          <p className="mt-0.5 max-w-full truncate text-xs text-slate-500">
            {sp.tagline}
          </p>
        </a>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`enterprise-card group flex items-center gap-3 rounded-xl px-3 py-2.5 ${className}`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-display text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {sp.logoUrl ? (
            <img
              src={sp.logoUrl}
              alt={sp.brandName}
              referrerPolicy="no-referrer"
              className="h-5 w-5 rounded object-contain"
            />
          ) : (
            sp.logoText || sp.brandName.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <p className="truncate text-xs font-semibold text-slate-950 dark:text-white">
              {sp.brandName}
            </p>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400" />
          </div>
          <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {sp.tagline}
          </p>
        </div>
      </a>
    );
  }

  if (large) {
    return (
      <button
        type="button"
        onClick={() => onSelectOpen(frame)}
        className={`group relative flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/90 bg-white/85 px-4 py-5 text-center transition-all hover:border-solid hover:border-slate-400 hover:bg-white sm:min-h-[144px] dark:border-white/[0.14] dark:bg-[#171923] dark:hover:border-white/30 dark:hover:bg-[#1D202D] ${className}`}
      >
        <span className="absolute top-2.5 left-3 font-mono text-[10px] text-slate-400 dark:text-slate-500">
          {frame.number}
        </span>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300/80 text-slate-400 transition-colors group-hover:border-slate-400 group-hover:text-slate-700 dark:border-white/15 dark:text-slate-400 dark:group-hover:border-white/30 dark:group-hover:text-white">
          <Plus className="h-4 w-4" />
        </span>
        <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
          Your brand
        </span>
        <span className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {formatFramePriceShort(frame, currency)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectOpen(frame)}
      className={`group flex items-center gap-3 rounded-xl border border-dashed border-slate-300/90 bg-white/85 px-3 py-2.5 text-left transition-all hover:border-solid hover:border-slate-400 hover:bg-white dark:border-white/[0.14] dark:bg-[#171923] dark:hover:border-white/30 dark:hover:bg-[#1D202D] ${className}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] font-medium text-slate-500 dark:border-white/12 dark:bg-white/[0.04] dark:text-slate-400">
        {frame.number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
            Your brand
          </span>
          <Plus className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </div>
        <p className="mt-0.5 truncate text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
          {formatFramePriceShort(frame, currency)}
        </p>
      </div>
    </button>
  );
}

/* Complete Full-Width Minimalistic Featured Banner above the 8 Sponsor Frames */
export function TopSponsorBannerTile({
  frame,
  currency = 'USD',
  onSelectOpen,
}: {
  frame: SponsorFrame;
  currency?: SupportedCurrency;
  onSelectOpen: (frame: SponsorFrame) => void;
}) {
  const impressionLogged = useRef(false);

  useEffect(() => {
    const campaignId = frame.sponsor?.campaignId;
    if (campaignId && !impressionLogged.current) {
      impressionLogged.current = true;
      fetch(`/api/sponsors/${encodeURIComponent(campaignId)}/impression`, {
        method: 'POST',
      }).catch(() => {});
    }
  }, [frame.sponsor?.campaignId]);

  if (frame.sponsor) {
    const sp = frame.sponsor;
    const href = sp.campaignId
      ? `/api/sponsors/${encodeURIComponent(sp.campaignId)}/click`
      : appendReferralParam(sp.destinationUrl);

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="group flex w-full flex-col justify-between gap-3 rounded-xl border border-slate-200/95 bg-white px-4 py-3.5 shadow-2xs transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:px-5 dark:border-white/12 dark:bg-[#131520] dark:hover:border-white/25"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 font-display text-xs font-bold text-slate-900 dark:border-white/12 dark:bg-black/40 dark:text-white">
            {sp.logoUrl ? (
              <img
                src={sp.logoUrl}
                alt={sp.brandName}
                referrerPolicy="no-referrer"
                className="h-6 w-6 rounded object-contain"
              />
            ) : (
              sp.logoText || sp.brandName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-slate-950 dark:text-white">
              {sp.brandName}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {sp.tagline}
            </p>
          </div>
        </div>

        <span className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:group-hover:bg-slate-200">
          <span>Visit site</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelectOpen(frame)}
      className="group flex w-full flex-col justify-between gap-3 rounded-xl border border-slate-200/95 bg-white/95 px-4 py-3.5 text-left transition-colors hover:border-slate-300 hover:bg-white sm:flex-row sm:items-center sm:px-5 dark:border-white/12 dark:bg-[#131520] dark:hover:border-white/25 dark:hover:bg-[#171926]"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors group-hover:border-slate-400 group-hover:text-slate-700 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-400 dark:group-hover:border-white/30 dark:group-hover:text-white">
          <Plus className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-slate-950 dark:text-white">
            Your brand — Full-width banner
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            Featured top placement across homepage &amp; 43 tools
          </p>
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold tabular-nums text-white transition-colors group-hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:group-hover:bg-slate-200">
        <span>{formatFramePriceShort(frame, currency)}</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/* Homepage Sponsor Wall — ClipUtils-inspired ultra-minimalist full-width banner + 8 centered frames */
export const SponsorFramesSection: React.FC<{ navigate?: (path: string) => void }> = ({ navigate }) => {
  const { isPro, sponsorFrames } = useEntitlement();
  const [selectedFrame, setSelectedFrame] = useState<SponsorFrame | null>(null);
  const [showAllMobile, setShowAllMobile] = useState(false);

  // Active Toolivo Pro users receive a 100% sponsor-free workspace
  if (isPro) return null;

  const topBannerFrame = sponsorFrames.find((f) => f.id === 'frame-top') || TOP_BANNER_FRAME;
  const gridFrames = sponsorFrames.filter((f) => f.id !== 'frame-top').slice(0, 8);
  const displayCurrency: SupportedCurrency = 'USD';

  return (
    <section id="sponsors" aria-label="Sponsors">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white">
            Sponsors keep Toolivo free
          </h2>
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            · Ad
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (navigate) {
              navigate('/advertise');
              return;
            }
            setSelectedFrame(gridFrames.find((f) => !f.sponsor) || gridFrames[0]);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-emerald-600 transition-colors hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          <span>Put your brand here · ${gridFrames[0]?.priceUsd ?? 15} first month →</span>
        </button>
      </div>

      {/* Complete Full-Width Top Banner */}
      <div className="mt-3">
        <TopSponsorBannerTile
          frame={topBannerFrame}
          currency={displayCurrency}
          onSelectOpen={setSelectedFrame}
        />
      </div>

      {/* Clean Minimalist 8-Frame Tray (2 rows × 4 columns on desktop) */}
      <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-100/60 p-3 dark:border-white/[0.08] dark:bg-[#0B0D15]">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {gridFrames.map((frame, idx) => (
            <SponsorFrameTile
              key={frame.id}
              frame={frame}
              currency={displayCurrency}
              large
              onSelectOpen={setSelectedFrame}
              className={!showAllMobile && idx >= 4 ? 'hidden lg:flex' : ''}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => setShowAllMobile((v) => !v)}
          className="rounded-lg border border-slate-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-400 hover:text-slate-950 dark:border-white/12 dark:bg-[#131520] dark:text-slate-300 dark:hover:text-white"
        >
          {showAllMobile ? 'Show fewer frames' : `Show all ${gridFrames.length} frames`}
        </button>
      </div>

      <SponsorBookingModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </section>
  );
};

/* Alongside-Tool 2-Frame Rail (hidden automatically for active Pro users) */
export const ToolPageSponsorRail: React.FC<{ slug: string }> = ({ slug }) => {
  const { isPro, currency, sponsorFrames } = useEntitlement();
  const [selectedFrame, setSelectedFrame] = useState<SponsorFrame | null>(null);

  if (isPro) return null;

  const frames = sponsorFrames.filter((f) => f.id !== 'frame-top').slice(0, 8);
  const [frameA, frameB] = getToolSponsorPair(slug, frames);

  return (
    <aside aria-label="Sponsors" className="space-y-2.5 lg:sticky lg:top-20">
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-medium">Sponsors</span>
        <button
          type="button"
          onClick={() => setSelectedFrame(!frameA.sponsor ? frameA : !frameB.sponsor ? frameB : frames[0])}
          className="inline-flex items-center gap-0.5 font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          <span>{formatFramePriceShort(frameA, currency)}</span>
          <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
        <SponsorFrameTile frame={frameA} currency={currency} onSelectOpen={setSelectedFrame} />
        <SponsorFrameTile frame={frameB} currency={currency} onSelectOpen={setSelectedFrame} />
      </div>
      <SponsorBookingModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </aside>
  );
};
