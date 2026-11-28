import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from './ui/button';

interface AnnouncementItem {
  id: string;
  label: string;
  message: string;
  cta: string;
  href: string;
}

const ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'pdf-local',
    label: 'PDF SUITE',
    message: 'All 19 PDF tools run 100% locally in your browser with zero file uploads',
    cta: 'Open Merge PDF',
    href: '/merge-pdf',
  },
  {
    id: 'pro-launch',
    label: 'TOOLIVO PRO',
    message: 'Go sponsor-free from $2.99 USD (7-Day Pass) or save 44% on Yearly Pro',
    cta: 'Go Pro',
    href: '/pro',
  },
  {
    id: 'passport-studio',
    label: 'NEW RELEASE',
    message: 'Create 300 DPI passport photos and 4×6 tiled print sheets offline',
    cta: 'Try Passport Maker',
    href: '/passport-photo-maker',
  },
  {
    id: 'sponsor-frames',
    label: 'SPONSORS',
    message: '8 dedicated sponsor frames open at $15 first month across homepage & 43 tools',
    cta: 'Book a Frame',
    href: '/advertise',
  },
];

/* =========================================================================
   1. ANIMATED ANNOUNCEMENT BAR — Solid High-Contrast Minimal Strip (Zero JS-rAF Overhead)
   ========================================================================= */
export const AnimatedAnnouncementBar: React.FC<{
  navigate: (path: string) => void;
}> = React.memo(({ navigate }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (paused || dismissed) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setIndex((i) => (i + 1) % ANNOUNCEMENTS.length);
    }, 6800);
    return () => window.clearInterval(timer);
  }, [paused, dismissed]);

  if (dismissed) return null;

  const current = ANNOUNCEMENTS[index];

  const handleAction = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === '/#sponsors') {
      navigate('/');
      window.setTimeout(() => {
        document.getElementById('sponsors')?.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    navigate(href);
  };

  return (
    <div
      role="region"
      aria-label="Site announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="border-b border-indigo-400/30 bg-gradient-to-r from-[#4338CA] via-[#7C5CFF] to-[#2563EB] px-3 text-xs text-white shadow-[0_1px_12px_rgba(124,92,255,0.28)]"
    >
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-3">
        <div className="hidden items-center gap-0.5 sm:flex">
          <button
            type="button"
            aria-label="Previous announcement"
            onClick={() => setIndex((i) => (i - 1 + ANNOUNCEMENTS.length) % ANNOUNCEMENTS.length)}
            className="rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Next announcement"
            onClick={() => setIndex((i) => (i + 1) % ANNOUNCEMENTS.length)}
            className="rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div
            key={current.id}
            className="flex min-w-0 items-center justify-center gap-2.5 truncate"
          >
            <span className="hidden shrink-0 rounded bg-white/18 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-200 sm:inline">
              {current.label}
            </span>
            <span className="truncate font-semibold text-white">{current.message}</span>
            <a
              href={current.href}
              onClick={(e) => handleAction(e, current.href)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-950 shadow-2xs transition-colors hover:bg-amber-300"
            >
              <span>{current.cta}</span>
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss announcement bar"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

/* =========================================================================
   2. INFINITE MARQUEE — GPU-Composited Sibling Tracks (Single Texture Tile, Zero Lag)
   ========================================================================= */
const MARQUEE_ITEMS: { label: string; meta: string; slug: string }[] = [
  { label: 'Merge PDF', meta: 'PDF + PDF → 1', slug: 'merge-pdf' },
  { label: 'Compress PDF', meta: 'Up to 85% smaller', slug: 'compress-pdf' },
  { label: 'PDF to Word', meta: 'Editable .DOC', slug: 'pdf-to-word' },
  { label: 'Sign PDF', meta: 'Draw or type', slug: 'sign-pdf' },
  { label: 'Video to GIF', meta: 'Looping GIF89a', slug: 'video-to-gif' },
  { label: 'Passport Photo', meta: '300 DPI · 4×6 Sheet', slug: 'passport-photo-maker' },
  { label: 'Background Remover', meta: 'Transparent PNG', slug: 'background-remover' },
  { label: 'Volume Booster', meta: 'Up to +18 dB', slug: 'audio-volume-booster' },
  { label: 'JSON Formatter', meta: 'Validate & sort', slug: 'json-formatter' },
  { label: 'QR Code Generator', meta: 'PNG & SVG', slug: 'qr-code-generator' },
];

export const InfiniteToolsMarquee: React.FC<{
  navigate: (path: string) => void;
}> = React.memo(({ navigate }) => {
  const containerRef = useRef<HTMLElement>(null);

  // Automatically pause GPU animation when scrolled offscreen or browser tab is hidden (zero React re-renders)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let inView = true;
    const syncPaused = () => {
      el.dataset.paused = !inView || document.hidden ? 'true' : 'false';
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              inView = entries[0]?.isIntersecting ?? true;
              syncPaused();
            },
            { threshold: 0 }
          )
        : null;

    observer?.observe(el);
    document.addEventListener('visibilitychange', syncPaused);
    syncPaused();

    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncPaused);
    };
  }, []);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a[data-slug]') as HTMLAnchorElement | null;
    if (!anchor) return;
    const slug = anchor.dataset.slug;
    if (!slug) return;
    e.preventDefault();
    navigate(`/${slug}`);
  };

  const renderTrack = (copyKey: string) => (
    <div
      key={copyKey}
      className="toolivo-marquee-track"
      aria-hidden={copyKey === 'b'}
    >
      {MARQUEE_ITEMS.map((item) => (
        <React.Fragment key={`${copyKey}-${item.slug}`}>
          <a
            href={`/${item.slug}`}
            data-slug={item.slug}
            tabIndex={copyKey === 'b' ? -1 : 0}
            className="group inline-flex items-center gap-2 whitespace-nowrap px-4 py-1.5 text-xs"
          >
            <span className="font-display font-semibold text-white group-hover:text-amber-300 dark:text-slate-950 dark:group-hover:text-blue-700">
              {item.label}
            </span>
            <span className="font-mono text-[11px] text-slate-400 dark:text-slate-600">
              {item.meta}
            </span>
          </a>
          <span className="select-none text-slate-600 dark:text-slate-400" aria-hidden="true">
            •
          </span>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <section
      ref={containerRef}
      aria-label="Instant utilities marquee"
      className="marquee-container w-full overflow-hidden border-y border-slate-900 bg-[#0B0E18] py-2 dark:border-white/25 dark:bg-[#F8FAFC]"
    >
      <div className="flex w-full overflow-hidden" onClick={handleTrackClick}>
        {renderTrack('a')}
        {renderTrack('b')}
      </div>
    </section>
  );
});

/* =========================================================================
   3. NOTIFICATION CAROUSEL — Contrasting Solid Surface + Motion Swipe Gestures
   ========================================================================= */
interface CarouselNotice {
  id: string;
  category: string;
  dateLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  surfaceClass: string;
  accentTextClass: string;
  ctaVariant: 'pro' | 'default';
}

const CAROUSEL_NOTICES: CarouselNotice[] = [
  {
    id: 'release-pdf-suite',
    category: 'FEATURE RELEASE',
    dateLabel: 'PDF Suite',
    title: 'Visual Organize, E-Sign & Permanent Redact PDF are now live',
    description:
      'Drag thumbnails to reorder or delete pages, draw or type cursive signatures, and permanently flatten blacked-out redactions directly in browser memory.',
    ctaLabel: 'Open Sign PDF',
    href: '/sign-pdf',
    surfaceClass: 'bg-[#4F46E5] border-[#6366F1]',
    accentTextClass: 'text-indigo-100',
    ctaVariant: 'default',
  },
  {
    id: 'release-passport-bg',
    category: 'FEATURE RELEASE',
    dateLabel: 'Image Studio',
    title: '300 DPI Passport Photo Maker & Instant Background Remover',
    description:
      'Frame biometric US 2×2 in, UK/EU/India 35×45 mm, or Canada 50×70 mm portraits and export tiled 4×6 print sheets with zero cloud uploads.',
    ctaLabel: 'Try Passport Maker',
    href: '/passport-photo-maker',
    surfaceClass: 'bg-[#0284C7] border-[#38BDF8]',
    accentTextClass: 'text-sky-100',
    ctaVariant: 'default',
  },
  {
    id: 'update-media-gif',
    category: 'PRODUCT UPDATE',
    dateLabel: 'Video & Audio',
    title: 'Browser-Native MP4 to Animated GIF89a & +18 dB Volume Booster',
    description:
      'Trim clips to exact seconds, encode lightweight animated GIFs locally, or boost quiet recordings up to +18 dB with soft-clip protection.',
    ctaLabel: 'Launch Video to GIF',
    href: '/video-to-gif',
    surfaceClass: 'bg-[#7C3AED] border-[#8B5CF6]',
    accentTextClass: 'text-violet-100',
    ctaVariant: 'default',
  },
  {
    id: 'promo-pro',
    category: 'TOOLIVO PRO',
    dateLabel: 'INR & USD Plans',
    title: 'Go Sponsor-Free from $2.99 USD (7-Day Pass) or Save 44% Yearly',
    description:
      'Accountless 7-Day Pass, Monthly, Yearly, Lifetime, or Credit Packs with separate INR & USD pricing and commercial invoices via Dodo Payments.',
    ctaLabel: 'Go Pro Now',
    href: '/pro',
    surfaceClass: 'bg-[#D97706] border-[#F59E0B]',
    accentTextClass: 'text-amber-100',
    ctaVariant: 'pro',
  },
  {
    id: 'promo-sponsors',
    category: 'ANNOUNCEMENT',
    dateLabel: 'Sponsor Frames',
    title: '8 Dedicated Sponsor Frames Open at $15 First Month',
    description:
      'Showcase your product logo, brand name, and tagline across the Toolivo homepage and all 43 tools with automatic ?ref=toolivo attribution.',
    ctaLabel: 'Book a Frame',
    href: '/advertise',
    surfaceClass: 'bg-[#059669] border-[#10B981]',
    accentTextClass: 'text-emerald-100',
    ctaVariant: 'default',
  },
];

export const NotificationCarousel: React.FC<{
  navigate: (path: string) => void;
}> = React.memo(({ navigate }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    // Lowered calm rotation speed (8.5s)
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setActiveIdx((i) => (i + 1) % CAROUSEL_NOTICES.length);
    }, 8500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const current = CAROUSEL_NOTICES[activeIdx];

  const handleNext = () => setActiveIdx((i) => (i + 1) % CAROUSEL_NOTICES.length);
  const handlePrev = () =>
    setActiveIdx((i) => (i - 1 + CAROUSEL_NOTICES.length) % CAROUSEL_NOTICES.length);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -45) handleNext();
    else if (info.offset.x > 45) handlePrev();
  };

  const handleGo = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === '/#sponsors') {
      document.getElementById('sponsors')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    navigate(href);
  };

  return (
    <section
      aria-label="Product updates and announcements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`overflow-hidden rounded-2xl border p-4 text-white shadow-sm transition-colors duration-500 sm:px-6 sm:py-5 ${current.surfaceClass}`}
    >
      <div className="flex flex-col justify-between gap-3.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={handleDragEnd}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-white/18 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white">
                  {current.category}
                </span>
                <span className={`font-medium ${current.accentTextClass}`}>{current.dateLabel}</span>
                <span className="text-white/45" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] tabular-nums text-white/80">
                  0{activeIdx + 1} / 0{CAROUSEL_NOTICES.length}
                </span>
              </div>

              <h2 className="mt-1.5 font-display text-sm font-bold tracking-tight text-white sm:text-lg">
                {current.title}
              </h2>
              <p className="mt-1 line-clamp-2 max-w-3xl text-xs leading-relaxed text-white/90 sm:line-clamp-none sm:text-sm">
                {current.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
          <Button
            asChild
            variant="contrast"
            size="sm"
            className="h-9 bg-white px-4 text-xs font-bold text-slate-950 shadow-xs hover:bg-slate-100 hover:text-slate-950 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <a href={current.href} onClick={(e) => handleGo(e, current.href)}>
              <span>{current.ctaLabel}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Select announcement">
              {CAROUSEL_NOTICES.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeIdx}
                  aria-label={`Show update ${idx + 1}: ${item.category}`}
                  onClick={() => setActiveIdx(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeIdx
                      ? 'w-6 bg-white'
                      : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1 pl-1">
              <button
                type="button"
                aria-label="Previous update"
                onClick={handlePrev}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition-colors hover:border-white/50 hover:bg-white/20"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next update"
                onClick={handleNext}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white transition-colors hover:border-white/50 hover:bg-white/20"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
