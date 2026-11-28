import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import gsap from 'gsap';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Link2,
  Lock,
  Search,
  X,
  Zap,
} from 'lucide-react';
import {
  CATEGORIES,
  PLATFORM_FAQ_GROUPS,
  SEO_ARTICLES,
  TOOLS_CATALOG,
  getCategoryById,
  getToolBySlug,
  type ToolCategoryId,
  type ToolMetadata,
} from '../data/catalog';
import { getToolComponent } from '../tools/registry';
import { CategoryIcon, FaqAccordion } from '../components/Layout';
import { ToolVisual } from '../components/ToolVisual';
import { SponsorFramesSection, ToolPageSponsorRail } from '../components/SponsorFrames';
import { InfiniteToolsMarquee, NotificationCarousel } from '../components/AnnouncementWidgets';
import { ParticleWaveBanner } from '../components/ParticleWaveBanner';
import { ToolGridSkeleton, ToolWorkbenchSkeleton } from '../components/ui/skeleton';

const MOST_USED_SLUGS = [
  'merge-pdf',
  'compress-pdf',
  'pdf-to-word',
  'sign-pdf',
  'video-to-gif',
  'passport-photo-maker',
];

const SHORT_CUES: Record<string, string> = {
  'merge-pdf': 'Combine PDFs in order',
  'compress-pdf': 'Shrink PDF file size',
  'pdf-to-word': 'Editable .doc export',
  'sign-pdf': 'Draw or type e-signature',
  'video-to-gif': 'MP4 to looping GIF',
  'passport-photo-maker': '300 DPI + 4×6 sheet',
};

function CompactToolTile({
  tool,
  navigate,
  cue,
  className = '',
}: {
  tool: ToolMetadata;
  navigate: (path: string) => void;
  cue?: string;
  className?: string;
}) {
  return (
    <motion.a
      href={`/${tool.slug}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/${tool.slug}`);
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={`enterprise-card group flex flex-col gap-2 rounded-xl p-2.5 sm:gap-3 sm:p-3.5 ${className}`}
    >
      {/* Instant Visual Preview — Compact on Mobile/Tablet, Full on Desktop */}
      <ToolVisual slug={tool.slug} category={tool.category} variant="card" />

      <div className="flex items-start gap-2 px-0.5 sm:gap-2.5">
        <div className="mt-0.5 hidden h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200/90 bg-slate-50 text-slate-600 transition-colors group-hover:border-violet-500/40 group-hover:text-violet-600 sm:flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:text-violet-400">
          <CategoryIcon category={tool.category} className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="truncate font-display text-xs font-semibold text-slate-950 sm:text-sm dark:text-white">
              {tool.name}
            </h3>
            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-violet-500 group-hover:opacity-100 sm:inline" />
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500 sm:line-clamp-2 sm:text-xs dark:text-slate-400">
            {cue || tool.shortDescription}
          </p>
        </div>
      </div>
    </motion.a>
  );
}

const RECENT_TOOLS_KEY = 'toolivo-recent-tools';

function readRecentToolSlugs(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_TOOLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, 4) : [];
  } catch {
    return [];
  }
}

function recordRecentToolSlug(slug: string) {
  try {
    const prev = readRecentToolSlugs().filter((s) => s !== slug);
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify([slug, ...prev].slice(0, 4)));
  } catch {
    // localStorage disabled
  }
}

/* =========================================================================
   HOMEPAGE — Top 2×6 Sponsors + Instant-Action Visual Grid (Clip Utils + iLovePDF)
   ========================================================================= */
export const HomePage: React.FC<{
  navigate: (path: string) => void;
  onOpenCommand: () => void;
}> = ({ navigate, onOpenCommand }) => {
  const [activeCategory, setActiveCategory] = useState<ToolCategoryId | 'all'>('all');
  const [inlineQuery, setInlineQuery] = useState('');
  const [gridLoading, setGridLoading] = useState(false);
  const [showAllToolsMobile, setShowAllToolsMobile] = useState(false);
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() => readRecentToolSlugs());
  const homeRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecentSlugs(readRecentToolSlugs());
  }, []);

  // GSAP entrance stagger for hero & featured tiles (respects reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-gsap-hero]',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: 'power3.out', clearProps: 'transform' }
      );
      gsap.fromTo(
        '[data-gsap-featured]',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.42, stagger: 0.045, delay: 0.08, ease: 'power2.out', clearProps: 'transform' }
      );
    }, homeRootRef);
    return () => ctx.revert();
  }, []);

  const handleCategoryChange = (nextCategory: ToolCategoryId | 'all') => {
    if (nextCategory === activeCategory) return;
    setGridLoading(true);
    setActiveCategory(nextCategory);
    window.setTimeout(() => setGridLoading(false), 160);
  };

  const mostUsed = useMemo(
    () => MOST_USED_SLUGS.map((s) => getToolBySlug(s)).filter(Boolean) as ToolMetadata[],
    []
  );

  const recentTools = useMemo(
    () => recentSlugs.map((s) => getToolBySlug(s)).filter(Boolean) as ToolMetadata[],
    [recentSlugs]
  );

  const visibleTools = useMemo(() => {
    const q = inlineQuery.trim().toLowerCase();
    return TOOLS_CATALOG.filter((t) => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q)) ||
        t.supportedFormats.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, inlineQuery]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of TOOLS_CATALOG) {
      map[t.category] = (map[t.category] || 0) + 1;
    }
    return map;
  }, []);

  const homepageFaqs = useMemo(
    () => PLATFORM_FAQ_GROUPS.flatMap((g) => g.items).slice(0, 6),
    []
  );

  return (
    <div ref={homeRootRef}>
      {/* Zone 1: Open, Seamless Hero over Continuous Aurora Canvas (Zero Partition Line) */}
      <section>
        <div
          data-gsap-hero
          className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-7 pb-7 sm:px-8 sm:pt-10 sm:pb-9"
        >
          <div className="max-w-4xl">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-balance text-slate-950 sm:text-4xl lg:text-[42px] lg:leading-[1.12] dark:text-white">
              Free PDF, Video, Audio &amp; Photo Tools
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px] dark:text-slate-200/85">
              Merge, compress, convert, sign, trim, and edit files directly in your browser. Zero uploads, zero sign-up, zero watermarks.
            </p>
          </div>

          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                <Lock className="h-3.5 w-3.5" />
                100% Private (0 bytes uploaded)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Zap className="h-3.5 w-3.5 text-violet-600 dark:text-violet-300" />
                {TOOLS_CATALOG.length} instant local tools
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                No account · Offline-ready
              </span>
            </div>

            {/* Clean Floating Enterprise Search Input */}
            <div className="flex w-full shrink-0 items-center gap-2 lg:w-96">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={inlineQuery}
                  onChange={(e) => setInlineQuery(e.target.value)}
                  placeholder="Search 43 tools (PDF, GIF...)"
                  aria-label="Filter tools"
                  className="w-full rounded-xl border border-slate-300/90 bg-white/95 py-2.5 pr-8 pl-10 text-xs text-slate-950 shadow-xs backdrop-blur-md placeholder:text-slate-400 focus:border-violet-500 focus:outline-none dark:border-white/15 dark:bg-[#0E101C]/85 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-violet-400"
                />
                {inlineQuery && (
                  <button
                    type="button"
                    aria-label="Clear filter"
                    onClick={() => setInlineQuery('')}
                    className="absolute top-1/2 right-2.5 z-10 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenCommand}
                title="Open quick launcher (Ctrl K)"
                className="hidden shrink-0 rounded-xl border border-slate-300/90 bg-white/95 px-3 py-2.5 font-mono text-[11px] font-medium text-slate-600 shadow-xs backdrop-blur-md transition-colors hover:border-violet-500 hover:text-slate-950 sm:inline-flex dark:border-white/15 dark:bg-[#0E101C]/85 dark:text-slate-300 dark:hover:border-violet-400 dark:hover:text-white"
              >
                Ctrl K
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Full-Bleed Edge-to-Edge Infinite Marquee directly on the Hero/Content Partition */}
      {!inlineQuery && <InfiniteToolsMarquee navigate={navigate} />}

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:space-y-7 sm:px-8 sm:py-7 lg:space-y-9">

      {/* Recently Used Strip (appears automatically after using any tool — zero server storage) */}
      {recentTools.length > 0 && !inlineQuery && (
        <section aria-label="Recently used tools" className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            Jump back in:
          </span>
          {recentTools.map((tool) => (
            <a
              key={tool.slug}
              href={`/${tool.slug}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/${tool.slug}`);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition-colors hover:border-blue-500 hover:text-blue-600 dark:border-slate-800 dark:bg-[#0D121F] dark:text-slate-300 dark:hover:border-blue-500/70 dark:hover:text-blue-400"
            >
              {tool.name}
            </a>
          ))}
        </section>
      )}

      {/* Zone 2: Most Used — Compact 2-col Mobile / 3-col Tablet & Desktop */}
      {!inlineQuery && (
        <section aria-label="Most used tools">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Most used
            </h2>
            <span className="font-mono text-[11px] text-slate-400">1 click to launch</span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:mt-3 sm:grid-cols-3 sm:gap-3.5">
            {mostUsed.map((tool) => (
              <div key={tool.slug} data-gsap-featured>
                <CompactToolTile
                  tool={tool}
                  navigate={navigate}
                  cue={SHORT_CUES[tool.slug]}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Zone 3: 8 Larger Sponsor Frames (2 rows of 4 on desktop covering the 12-frame area) */}
      {!inlineQuery && <SponsorFramesSection navigate={navigate} />}

      {/* 3. Notification Carousel — Rotating Product Updates, Releases & Promos */}
      {!inlineQuery && <NotificationCarousel navigate={navigate} />}

      {/* Zone 4: Complete One-Click Visual Utility Grid with Single-Row Mobile Category Tabs */}
      <section aria-label="All tools">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <h2 className="font-display text-base font-bold tracking-tight text-slate-950 sm:text-lg dark:text-white">
            {inlineQuery ? `Matching Tools (${visibleTools.length})` : 'All Tools'}
          </h2>

          <div
            role="tablist"
            aria-label="Filter by category"
            className="no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 sm:flex-wrap dark:border-slate-800 dark:bg-[#0E101C]"
          >
            {[
              { id: 'all' as const, label: `All (${TOOLS_CATALOG.length})` },
              ...CATEGORIES.map((c) => ({
                id: c.id,
                label: `${c.shortName} (${categoryCounts[c.id] || 0})`,
              })),
            ].map((tab) => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleCategoryChange(tab.id)}
                  className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'text-slate-950 dark:text-white'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="home-cat-pill"
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-slate-800"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {gridLoading ? (
          <div className="mt-3.5">
            <ToolGridSkeleton count={6} />
          </div>
        ) : visibleTools.length > 0 ? (
          <>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5">
              {visibleTools.map((tool, idx) => (
                <CompactToolTile
                  key={tool.slug}
                  tool={tool}
                  navigate={navigate}
                  className={
                    !inlineQuery && activeCategory === 'all' && !showAllToolsMobile && idx >= 12
                      ? 'hidden lg:flex'
                      : ''
                  }
                />
              ))}
            </div>

            {!inlineQuery && activeCategory === 'all' && visibleTools.length > 12 && (
              <div className="mt-4 flex justify-center lg:hidden">
                <button
                  type="button"
                  onClick={() => setShowAllToolsMobile((v) => !v)}
                  className="rounded-xl border border-slate-300/90 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 shadow-xs transition-colors hover:border-violet-500 hover:text-slate-950 dark:border-slate-700 dark:bg-[#0E101C] dark:text-slate-200 dark:hover:border-violet-400 dark:hover:text-white"
                >
                  {showAllToolsMobile
                    ? 'Show fewer tools'
                    : `Show all ${visibleTools.length} tools (+${visibleTools.length - 12} more)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-8 text-center dark:border-slate-800 dark:bg-[#0E101C]/70">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No tools matched &ldquo;{inlineQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => {
                setInlineQuery('');
                setActiveCategory('all');
              }}
              className="mt-3 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              Show all {TOOLS_CATALOG.length} tools
            </button>
          </div>
        )}
      </section>

      {/* Luminous 3D Particle Wave Banner with Tagline in Noto Serif Ethiopic Condensed */}
      {!inlineQuery && <ParticleWaveBanner />}

      {/* Collapsible FAQ Section — Cleanly Below the Fold for Users, Search Engines & AI Agents */}
      <section aria-label="Frequently asked questions" className="border-t border-slate-200/90 pt-7 sm:pt-10 dark:border-slate-800/80">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-slate-950 sm:text-xl dark:text-white">
              Frequently Asked Questions
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Privacy, browser processing, and supported file formats.
            </p>
          </div>
          <a
            href="/faq"
            onClick={(e) => {
              e.preventDefault();
              navigate('/faq');
            }}
            className="text-xs font-semibold text-violet-700 hover:underline dark:text-violet-400"
          >
            View all FAQs →
          </a>
        </div>
        <div className="mt-4">
          <FaqAccordion items={homepageFaqs} />
        </div>
      </section>
      </div>
    </div>
  );
};

/* =========================================================================
   DIRECT TOOL LANDING PAGE (/{slug} — iLovePDF Blind-Usability First!)
   ========================================================================= */
export const ToolDetailPage: React.FC<{
  slug: string;
  navigate: (path: string) => void;
}> = ({ slug, navigate }) => {
  const tool = getToolBySlug(slug);
  const ToolComponent = getToolComponent(slug);
  const [copiedLink, setCopiedLink] = useState(false);
  const [workbenchReady, setWorkbenchReady] = useState(false);

  useEffect(() => {
    setWorkbenchReady(false);
    const id = window.setTimeout(() => setWorkbenchReady(true), 130);
    return () => window.clearTimeout(id);
  }, [slug]);

  useEffect(() => {
    if (!tool) return;
    recordRecentToolSlug(tool.slug);
    const cat = getCategoryById(tool.category);
    const canonicalUrl = `${window.location.origin}/${tool.slug}`;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'toolivo-tool-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: `${tool.name} — Toolivo`,
          url: canonicalUrl,
          image: `${window.location.origin}/og/${tool.slug}.svg`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Any Web Browser',
          isAccessibleForFree: true,
          description: tool.seoDescription,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          featureList: tool.supportedFormats.join(', '),
        },
        {
          '@type': 'HowTo',
          name: `How to use ${tool.name} online for free`,
          description: tool.shortDescription,
          step: tool.howToSteps.map((s, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            text: s,
          })),
        },
        {
          '@type': 'FAQPage',
          mainEntity: tool.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${window.location.origin}/` },
            {
              '@type': 'ListItem',
              position: 2,
              name: cat?.name || 'Tools',
              item: `${window.location.origin}/category/${tool.category}`,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: tool.name,
              item: canonicalUrl,
            },
          ],
        },
      ],
    });
    document.head.appendChild(script);
    return () => {
      document.getElementById('toolivo-tool-jsonld')?.remove();
    };
  }, [tool]);

  if (!tool || !ToolComponent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">Tool not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Pick any utility from the left sidebar or return to the homepage.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          Back to All Tools
        </button>
      </div>
    );
  }

  const related = tool.relatedSlugs.map((s) => getToolBySlug(s)).filter(Boolean) as ToolMetadata[];

  const handleCopyDirectLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${tool.slug}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      {/* Direct 2-Second Header + Visual Understanding Diagram */}
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
              {tool.name}
            </h1>
            <button
              type="button"
              onClick={handleCopyDirectLink}
              title={`Copy direct URL (/${tool.slug})`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-500/60 hover:text-slate-950 dark:border-slate-800 dark:bg-[#0D121F] dark:text-slate-400 dark:hover:text-white"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span>Copied link</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" />
                  <span>Share</span>
                </>
              )}
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {tool.shortDescription}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400">Runs locally · 0 bytes uploaded</span>
            {' · '}
            <span>{tool.supportedFormats.join(' / ')}</span>
          </p>
        </div>
        <div className="shrink-0">
          <ToolVisual slug={tool.slug} category={tool.category} variant="banner" />
        </div>
      </div>

      {/* Main Focal Anchor + 2 Sponsor Frames Alongside Workbench (Exact Clip Utils Placement) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
        {workbenchReady ? (
          <section
            aria-label={`${tool.name} workspace`}
            className="rounded-2xl border border-slate-200 bg-white/95 p-5 sm:p-7 dark:border-slate-800 dark:bg-[#0D121F]/95"
          >
            <ToolComponent />
          </section>
        ) : (
          <ToolWorkbenchSkeleton />
        )}

        <ToolPageSponsorRail slug={tool.slug} />
      </div>

      {/* Compact 3-Step Guide + Collapsible FAQ (Below the fold for SEO/GEO & quick answers) */}
      <section className="space-y-8 border-t border-slate-200 pt-8 dark:border-slate-800/80">
        <div>
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
            How to use {tool.name}
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {tool.howToSteps.map((step, i) => (
              <li
                key={step}
                className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0D121F] dark:text-slate-400"
              >
                <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                  0{i + 1}.
                </span>{' '}
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
            {tool.name} FAQ
          </h2>
          <div className="mt-3">
            <FaqAccordion items={tool.faqs} defaultOpenFirst />
          </div>
        </div>
      </section>

      {/* 1-Click Related Workflows */}
      {related.length > 0 && (
        <section className="border-t border-slate-200 pt-8 dark:border-slate-800/80">
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
            Continue with another tool
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <CompactToolTile key={r.slug} tool={r} navigate={navigate} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

/* =========================================================================
   CATEGORY LANDING PAGE (/category/:slug & /tools)
   ========================================================================= */
export const ToolsDirectoryPage: React.FC<{
  initialCategory?: ToolCategoryId | 'all';
  navigate: (path: string) => void;
}> = ({ initialCategory = 'all', navigate }) => {
  const [category, setCategory] = useState<ToolCategoryId | 'all'>(initialCategory);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  const catObj = category === 'all' ? null : getCategoryById(category);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS_CATALOG.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q)) ||
        t.supportedFormats.some((f) => f.toLowerCase().includes(q))
      );
    });
  }, [category, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            {catObj ? catObj.name : 'All Browser Utilities'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {catObj
              ? catObj.description
              : 'Select any utility to start immediately—zero sign-up, zero file uploads.'}
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter tools..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-[#0D121F] dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tool) => (
          <CompactToolTile key={tool.slug} tool={tool} navigate={navigate} />
        ))}
      </div>

      {catObj && catObj.faqs.length > 0 && (
        <section className="border-t border-slate-200 pt-8 dark:border-slate-800/80">
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
            {catObj.name} — Frequently Asked Questions
          </h2>
          <div className="mt-4">
            <FaqAccordion items={catObj.faqs} defaultOpenFirst />
          </div>
        </section>
      )}
    </div>
  );
};

/* =========================================================================
   SEARCHABLE FAQ HUB (/faq)
   ========================================================================= */
export const FaqHubPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLATFORM_FAQ_GROUPS;
    return PLATFORM_FAQ_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.question.toLowerCase().includes(q) || it.answer.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Clear answers about local file privacy, PDF & media capabilities, and browser support.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-xs dark:border-slate-800 dark:bg-[#0D121F]"
          />
        </div>
      </div>

      <div className="space-y-8">
        {filteredGroups.map((group) => (
          <section key={group.id}>
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              {group.title}
            </h2>
            <div className="mt-3">
              <FaqAccordion items={group.items} defaultOpenFirst={group.id === 'privacy'} />
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-[#0D121F]">
        <p className="font-semibold text-slate-950 dark:text-white">Ready to run a tool?</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Pick any utility from the left sidebar or return to the homepage to start immediately.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Open All Tools
        </button>
      </div>
    </div>
  );
};

/* =========================================================================
   SEO GUIDES (/guides & /guides/:slug)
   ========================================================================= */
export const GuidesPage: React.FC<{ slug?: string; navigate: (path: string) => void }> = ({
  slug,
  navigate,
}) => {
  if (slug) {
    const article = SEO_ARTICLES.find((a) => a.slug === slug);
    if (!article) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Guide not found</h1>
          <button
            type="button"
            onClick={() => navigate('/guides')}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
          >
            All Guides
          </button>
        </div>
      );
    }
    const relatedTools = article.relatedToolSlugs
      .map((s) => getToolBySlug(s))
      .filter(Boolean) as ToolMetadata[];

    return (
      <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-8">
        <div className="font-mono text-xs text-slate-500">
          <a
            href="/guides"
            onClick={(e) => {
              e.preventDefault();
              navigate('/guides');
            }}
            className="hover:text-slate-900 dark:hover:text-white"
          >
            Guides
          </a>{' '}
          · {article.readMinutes} min read · {article.publishedDate}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {article.title}
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-400">{article.excerpt}</p>

        <div className="space-y-6 border-t border-slate-200 pt-6 dark:border-slate-800">
          {article.sections.map((sec) => (
            <section key={sec.heading}>
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
                {sec.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {sec.body}
              </p>
            </section>
          ))}
        </div>

        <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
            Launch these tools directly
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {relatedTools.map((t) => (
              <CompactToolTile key={t.slug} tool={t} navigate={navigate} />
            ))}
          </div>
        </section>
      </article>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          Guides & File Workflow Playbooks
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Practical guides for compressing PDFs, converting Office documents, creating 300 DPI passport photos, and optimizing media locally.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SEO_ARTICLES.map((art) => (
          <a
            key={art.slug}
            href={`/guides/${art.slug}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/guides/${art.slug}`);
            }}
            className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-500/80 dark:border-slate-800 dark:bg-[#0D121F]"
          >
            <p className="font-mono text-[11px] text-slate-500">
              {art.category} · {art.readMinutes} min read
            </p>
            <h2 className="mt-2 font-display text-base font-bold text-slate-950 dark:text-white">
              {art.title}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {art.excerpt}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   STATIC LEGAL & ABOUT PAGES (/about, /privacy, /terms)
   ========================================================================= */
export const StaticInfoPage: React.FC<{ page: 'about' | 'privacy' | 'terms' }> = ({ page }) => {
  const content: Record<typeof page, { title: string; subtitle: string; sections: { h: string; p: string }[] }> = {
    about: {
      title: 'About Toolivo',
      subtitle: 'Every Tool You Need. One Click Away.',
      sections: [
        {
          h: 'Built for 2-Second Instant Utility',
          p: 'Toolivo brings together 43 everyday PDF, image, video, audio, text, developer, and productivity utilities into one fast workspace—no downloads, no sign-in walls, and no watermarks.',
        },
        {
          h: '100% Browser-Native Execution',
          p: 'Every conversion, compression, redaction, signature, and audio export runs directly inside your device browser using pdf-lib, Mozilla PDF.js, HTML5 Canvas, Web Audio API, Mammoth, SheetJS, and Web Crypto.',
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'Zero sign-in. Zero file uploads. Zero stored user data.',
      sections: [
        {
          h: 'Local-Only File Processing',
          p: 'Files you drop into Toolivo utilities are processed strictly inside your browser tab RAM and are never uploaded to Toolivo servers or third-party cloud storage.',
        },
        {
          h: 'No User Accounts or Behavioral Profiling',
          p: 'Toolivo does not require accounts, does not collect personal profiles, and only stores your chosen Light/Dark theme preference locally in browser localStorage.',
        },
      ],
    },
    terms: {
      title: 'Terms of Service',
      subtitle: 'Simple terms for using Toolivo utilities.',
      sections: [
        {
          h: 'Permitted Use',
          p: 'All Toolivo browser utilities are provided free of charge for personal, academic, and commercial file workflows. You retain 100% ownership and responsibility for any files you process locally.',
        },
        {
          h: 'No Warranty',
          p: 'Utilities execute locally in your browser as-is; always keep original backups of critical legal, financial, or media files.',
        },
      ],
    },
  };

  const doc = content[page];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
          {doc.title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{doc.subtitle}</p>
      </div>
      <div className="space-y-6 border-t border-slate-200 pt-6 dark:border-slate-800">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">{s.h}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{s.p}</p>
          </section>
        ))}
      </div>
    </div>
  );
};
