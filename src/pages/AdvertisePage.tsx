import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Globe,
  Layers,
  Lock,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  SponsorBookingModal,
  SponsorFrameTile,
  TopSponsorBannerTile,
} from '../components/SponsorFrames';
import { TOP_BANNER_FRAME, type SponsorFrame } from '../data/sponsors';
import type { SupportedCurrency } from '../data/proPlans';
import { useEntitlement } from '../context/EntitlementContext';

export const AdvertisePage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const { currency, setCurrency, sponsorFrames, refreshSponsors } = useEntitlement();
  const [selectedFrame, setSelectedFrame] = useState<SponsorFrame | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const [verifiedCampaign, setVerifiedCampaign] = useState<{
    id: string;
    slotId: string;
    brandName: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    refreshSponsors();
  }, [refreshSponsors]);

  // Verify sponsor payment strictly via backend webhook state (never trusts return URL alone)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('checkout');
    const sessionId = params.get('session_id');
    if (flag === 'cancelled') {
      setCheckoutNotice('Sponsor checkout was cancelled. No payment was taken and the slot remains open.');
      return;
    }
    if (flag === 'return' && sessionId) {
      setCheckoutNotice('Verifying your Dodo Payments transaction via signed webhook...');
      let cancelled = false;
      let attempts = 0;
      const poll = async () => {
        attempts += 1;
        try {
          const res = await fetch(`/api/checkout/status/${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.verified && data.campaign && !cancelled) {
              setVerifiedCampaign(data.campaign);
              setCheckoutNotice(
                `Payment verified for ${data.campaign.brandName}! Your campaign is now in Pending Admin Approval and will publish to Frame ${data.campaign.slotId.replace('frame-', '')} immediately upon review.`
              );
              return;
            }
          }
        } catch {
          // Keep polling
        }
        if (!cancelled && attempts < 12) {
          setTimeout(poll, 2500);
        } else if (!cancelled) {
          setCheckoutNotice(
            'Payment verification is in progress. Once Dodo Payments delivers the signed webhook, your campaign will automatically enter Pending Admin Approval and you will receive an email receipt.'
          );
        }
      };
      poll();
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const topBannerFrame = sponsorFrames.find((f) => f.id === 'frame-top') || TOP_BANNER_FRAME;
  const frames = sponsorFrames.filter((f) => f.id !== 'frame-top').slice(0, 8);
  const openCount = frames.filter((f) => !f.sponsor).length;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-7 sm:space-y-12 sm:px-8 sm:py-10">
      {checkoutNotice && (
        <section className="rounded-2xl border border-violet-500/40 bg-violet-500/10 p-5 dark:border-violet-400/35">
          <div className="flex items-start gap-3">
            {verifiedCampaign ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
            )}
            <div>
              <p className="text-xs font-semibold text-slate-950 dark:text-white">{checkoutNotice}</p>
              {verifiedCampaign && (
                <p className="mt-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  Campaign ID: {verifiedCampaign.id} · Status: {verifiedCampaign.status.toUpperCase()}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Header */}
      <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded bg-violet-600 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-white">
            <Sparkles className="h-3.5 w-3.5" />
            <span>SPONSOR TOOLIVO · 8 EXCLUSIVE FRAMES</span>
          </div>
          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            Put your brand beside 43 high-intent browser utilities
          </h1>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-200/85">
            Clean, non-intrusive sponsor placements displayed on the Toolivo homepage and right beside every active PDF, video, audio, and image workbench—billed transparently via Dodo Payments in USD or INR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-slate-400" />
          <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-2xs dark:border-slate-800 dark:bg-[#0D101C]">
            {(['USD', 'INR'] as SupportedCurrency[]).map((code) => (
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
                {code === 'INR' ? '₹ INR (₹1,299)' : '$ USD ($15)'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Key Value Props */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: Layers,
            title: 'Only 8 Curated Frames',
            desc: 'Flat $15 USD (₹1,299 INR) first month across all 8 frames—zero banner clutter.',
          },
          {
            icon: MousePointerClick,
            title: 'Verified Clicks & Impressions',
            desc: 'Every outbound link includes automatic ?ref=toolivo attribution plus real-time impression and click tracking.',
          },
          {
            icon: ShieldCheck,
            title: 'Editorial Approval & MoR Tax',
            desc: 'Paid campaigns are verified via signed Dodo webhooks and reviewed before going live. Full refunds if declined.',
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="enterprise-card rounded-2xl p-5">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/12 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h2 className="mt-3 font-display text-sm font-bold text-slate-950 dark:text-white">
                {item.title}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {item.desc}
              </p>
            </div>
          );
        })}
      </section>

      {/* Interactive 8-Frame Booking Wall */}
      <section aria-label="Select sponsor slot">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
              Select an Open Sponsor Frame
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {openCount} of 8 frames open · Click any available frame to preview your brand and pay via Dodo Payments.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Lock className="h-3.5 w-3.5" />
            Dodo Payments · Merchant of Record
          </span>
        </div>

        <div className="mt-4">
          <TopSponsorBannerTile
            frame={topBannerFrame}
            currency={currency}
            onSelectOpen={setSelectedFrame}
          />
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200/90 bg-slate-100/60 p-3 dark:border-white/[0.08] dark:bg-[#0B0D15]">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {frames.map((frame) => (
              <SponsorFrameTile
                key={frame.id}
                frame={frame}
                currency={currency}
                large
                onSelectOpen={setSelectedFrame}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How Sponsor Approval Works */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#0D101C]">
        <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
          How Sponsor Bookings Work
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">
          {[
            ['01', 'Choose Frame & Creative', 'Pick any open frame (01–08) and enter brand name, logo, tagline, https:// URL, and email.'],
            ['02', 'Pay via Dodo Payments', 'Complete checkout in USD or INR (UPI/Cards/Apple Pay) with automatic GST/VAT invoicing.'],
            ['03', 'Webhook Verification', 'Toolivo verifies the signed Dodo webhook and queues your campaign in Pending Admin Approval.'],
            ['04', 'Live Publication', 'Once approved by our team, your brand goes live across Home & all 43 tools with click tracking.'],
          ].map(([step, title, body]) => (
            <li key={step} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-[#090B14]">
              <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{step}</span>
              <p className="mt-1.5 font-display text-xs font-bold text-slate-950 dark:text-white">{title}</p>
              <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-4 text-xs dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            Looking to remove sponsor frames from your own workspace instead?
          </span>
          <button
            type="button"
            onClick={() => navigate('/pro')}
            className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
          >
            Upgrade to Toolivo Pro →
          </button>
        </div>
      </section>

      <SponsorBookingModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </div>
  );
};
