import React, { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Code2,
  Crown,
  FileText,
  Film,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Menu,
  Moon,
  Music,
  Search,
  ShieldCheck,
  Sun,
  Type,
  Wrench,
  X,
} from 'lucide-react';
import {
  CATEGORIES,
  TOOLS_CATALOG,
  type ToolCategoryId,
  type ToolFaq,
  type ToolMetadata,
} from '../data/catalog';
import { AnimatedAnnouncementBar } from './AnnouncementWidgets';
import { OfflineIndicator, PWAInstallButton } from './PWAInstallButton';
import { Button } from './ui/button';
import { scrollPageToTop } from '../hooks/useLenis';

export const ToolivoMark: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="1.5"
      y="1.5"
      width="25"
      height="25"
      rx="6"
      className="fill-slate-950 stroke-slate-800 dark:fill-white dark:stroke-slate-200"
      strokeWidth="1"
    />
    <path
      d="M8.5 9.5H19.5M14 9.5V19.5"
      strokeWidth="2.4"
      strokeLinecap="round"
      className="stroke-white dark:stroke-slate-950"
    />
    <rect x="17.5" y="16.5" width="3.5" height="3.5" rx="1" className="fill-blue-500" />
  </svg>
);

export function CategoryIcon({
  category,
  className = 'h-4 w-4',
}: {
  category: ToolCategoryId;
  className?: string;
}) {
  switch (category) {
    case 'pdf':
      return <FileText className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'video':
      return <Film className={className} />;
    case 'audio':
      return <Music className={className} />;
    case 'text':
      return <Type className={className} />;
    case 'developer':
      return <Code2 className={className} />;
    case 'productivity':
      return <Wrench className={className} />;
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-20 max-w-lg rounded-xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-[#0D121F]">
          <h1 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Reload Toolivo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* Reusable Accessible Collapsible FAQ Accordion */
export const FaqAccordion: React.FC<{
  items: ToolFaq[];
  defaultOpenFirst?: boolean;
}> = ({ items, defaultOpenFirst = false }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenFirst ? 0 : null);

  return (
    <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#0D121F]">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
            >
              <span className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                {item.question}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
                  isOpen ? 'rotate-180 text-blue-500' : ''
                }`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                  className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400"
                >
                  {item.answer}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
};


interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, navigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS_CATALOG.filter((t) => t.popular).slice(0, 10);
    return TOOLS_CATALOG.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.keywords.some((k) => k.toLowerCase().includes(q)) ||
        t.supportedFormats.some((f) => f.toLowerCase().includes(q))
    ).slice(0, 12);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 25);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigate(`/${results[selectedIndex].slug}`);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/75 px-4 pt-20 backdrop-blur-xs"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Quick tool launcher"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0D121F]"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump directly to any tool (Merge PDF, Compress, Sign, Video to GIF, Passport)..."
                className="w-full bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
              <kbd className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                ESC
              </kbd>
            </div>

            <div data-lenis-prevent className="sidebar-scroll max-h-96 overflow-y-auto p-2">
              {results.length > 0 ? (
                <ul>
                  {results.map((tool, idx) => {
                    const active = idx === selectedIndex;
                    return (
                      <li key={tool.slug}>
                        <button
                          type="button"
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => {
                            navigate(`/${tool.slug}`);
                            onClose();
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-colors ${
                            active
                              ? 'bg-blue-600/12 text-slate-950 dark:bg-blue-500/15 dark:text-white'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3 pr-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                              <CategoryIcon category={tool.category} className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{tool.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {tool.supportedFormats.join(', ')}
                              </p>
                            </div>
                          </div>
                          <ArrowRight
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              active ? 'translate-x-0.5 text-blue-600 dark:text-blue-400' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-8 text-center text-xs text-slate-500">
                  No utilities matched &ldquo;{query}&rdquo;.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>↑ ↓ and Enter to launch immediately</span>
              <span className="font-mono">{TOOLS_CATALOG.length} tools · 100% Private</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* Persistent One-Click Sidebar Navigation (Clip Utils pattern) */
const SIDEBAR_GROUPS: { label: string; categories: ToolCategoryId[] }[] = [
  { label: 'PDF Tools', categories: ['pdf'] },
  { label: 'Video Tools', categories: ['video'] },
  { label: 'Audio Tools', categories: ['audio'] },
  { label: 'Image Tools', categories: ['image'] },
  { label: 'Text & Dev Tools', categories: ['text', 'developer', 'productivity'] },
];

interface LayoutProps {
  currentPath: string;
  activeTool?: ToolMetadata;
  breadcrumbLabel?: string;
  navigate: (path: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenCommand: () => void;
  children: ReactNode;
}

export const AppLayout: React.FC<LayoutProps> = ({
  currentPath,
  activeTool,
  breadcrumbLabel,
  navigate,
  darkMode,
  onToggleTheme,
  onOpenCommand,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');

  const handleNav = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setDrawerOpen(false);
    navigate(path);
  };

  const renderSidebarContent = (showClose = false) => {
    const q = sidebarFilter.trim().toLowerCase();
    return (
      <div className="flex h-full flex-col">
        {/* Sidebar Brand + Theme Toggle + Optional Mobile Close Button (Side-by-Side, Zero Overlap) */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-4 dark:border-slate-800/80">
          <a
            href="/"
            onClick={(e) => handleNav(e, '/')}
            className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-base font-bold tracking-tight text-slate-950 dark:text-white"
          >
            <ToolivoMark className="h-5 w-5" />
            <span>Toolivo</span>
          </a>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onToggleTheme}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle color theme"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {showClose && (
              <button
                type="button"
                aria-label="Close tools menu"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Instant Sidebar Quick-Filter */}
        <div className="shrink-0 border-b border-slate-200/70 px-3 py-2.5 dark:border-slate-800/70">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={sidebarFilter}
              onChange={(e) => setSidebarFilter(e.target.value)}
              placeholder="Quick find tool..."
              aria-label="Filter sidebar tools"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-7 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-100 dark:focus:bg-slate-900"
            />
            {sidebarFilter && (
              <button
                type="button"
                onClick={() => setSidebarFilter('')}
                aria-label="Clear sidebar filter"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable One-Click Tool List */}
        <nav
          aria-label="All tools"
          data-lenis-prevent
          className="sidebar-scroll flex-1 space-y-5 overflow-y-auto px-3 py-3.5"
        >
          {!q && (
            <div className="space-y-0.5">
              <a
                href="/"
                onClick={(e) => handleNav(e, '/')}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  currentPath === '/'
                    ? 'bg-violet-600/10 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                }`}
              >
                <Home className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Home</span>
              </a>
              <a
                href="/faq"
                onClick={(e) => handleNav(e, '/faq')}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                  currentPath === '/faq'
                    ? 'bg-violet-600/10 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">FAQ &amp; Help</span>
              </a>

              {/* Eye-Catching Solid High-Contrast Go Pro Sidebar CTA (White font on Yellow in Dark Mode) */}
              <motion.a
                href="/pro"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => handleNav(e, '/pro')}
                className={`mt-2.5 block rounded-xl border p-3 shadow-sm transition-colors ${
                  currentPath === '/pro'
                    ? 'border-amber-500 bg-amber-300 text-slate-950 ring-2 ring-amber-400/50 dark:border-amber-300 dark:bg-amber-500 dark:text-white dark:ring-amber-400/40'
                    : 'border-amber-500 bg-amber-400 text-slate-950 hover:bg-amber-300 dark:border-amber-400 dark:bg-amber-500 dark:text-white dark:hover:bg-amber-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-xs font-extrabold tracking-tight text-slate-950 dark:text-white">
                    <Crown className="h-3.5 w-3.5 fill-slate-950 text-slate-950 dark:fill-white dark:text-white" />
                    Go Pro
                  </span>
                  <span className="rounded bg-slate-950 px-1.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wider text-amber-300 dark:bg-white/20 dark:text-white">
                    PRO
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] font-medium leading-snug text-slate-900 dark:text-white/95">
                  Sponsor-free workspace, batch presets &amp; INR/USD invoices
                </p>
              </motion.a>
            </div>
          )}

          {SIDEBAR_GROUPS.map((group) => {
            const groupTools = TOOLS_CATALOG.filter((t) => {
              if (!group.categories.includes(t.category)) return false;
              if (!q) return true;
              return (
                t.name.toLowerCase().includes(q) ||
                t.slug.includes(q) ||
                t.keywords.some((k) => k.toLowerCase().includes(q))
              );
            });
            if (groupTools.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-2.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {groupTools.map((tool) => {
                    const isActive =
                      currentPath === `/${tool.slug}` || currentPath === `/tools/${tool.slug}`;
                    return (
                      <li key={tool.slug}>
                        <a
                          href={`/${tool.slug}`}
                          onClick={(e) => handleNav(e, `/${tool.slug}`)}
                          className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                            isActive
                              ? 'bg-blue-600/12 font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                          }`}
                        >
                          <CategoryIcon category={tool.category} className="h-3.5 w-3.5 shrink-0 opacity-75" />
                          <span className="truncate">{tool.name}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Quiet Privacy Footer inside Sidebar */}
        <div className="shrink-0 border-t border-slate-200/80 px-4 py-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span>100% Local · Zero Uploads</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-toolivo-canvas flex min-h-screen text-slate-900 dark:text-slate-100">
      {/* Persistent Desktop Left Sidebar (256px) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-200/90 bg-[#FBFDFF] shadow-[1px_0_0_rgba(15,23,42,0.03)] lg:block dark:border-white/[0.08] dark:bg-[#090A13] dark:shadow-none">
        {renderSidebarContent()}
      </aside>

      {/* Mobile & Tablet Left Slide-Over Sidebar Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-50 flex bg-slate-950/60 backdrop-blur-xs lg:hidden"
          >
            <motion.aside
              initial={{ x: -272 }}
              animate={{ x: 0 }}
              exit={{ x: -272 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              aria-label="Tools navigation"
              className="relative h-full w-[272px] max-w-[82vw] border-r border-slate-200 bg-[#FBFDFF] shadow-2xl dark:border-white/[0.08] dark:bg-[#090A13]"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Workspace Viewport */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 1. Animated Announcement Bar (clean vertical slide/fade, non-sticky for 15% mobile cap) */}
        <AnimatedAnnouncementBar navigate={navigate} />

        {/* Clean Enterprise Contextual Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/88 px-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-md sm:px-6 dark:border-white/[0.08] dark:bg-[#07070E]/82 dark:shadow-none">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open tools sidebar"
              onClick={() => setDrawerOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden dark:border-slate-800 dark:text-slate-300"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Mobile brand + Desktop Breadcrumb */}
            <a
              href="/"
              onClick={(e) => handleNav(e, '/')}
              className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-bold text-slate-950 lg:hidden dark:text-white"
            >
              <ToolivoMark className="h-5 w-5" />
              <span>Toolivo</span>
            </a>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 lg:flex dark:text-slate-400">
              <a
                href="/"
                onClick={(e) => handleNav(e, '/')}
                className="shrink-0 whitespace-nowrap hover:text-slate-950 dark:hover:text-white"
              >
                Toolivo
              </a>
              {activeTool ? (
                <>
                  <span>/</span>
                  <a
                    href={`/category/${activeTool.category}`}
                    onClick={(e) => handleNav(e, `/category/${activeTool.category}`)}
                    className="shrink-0 whitespace-nowrap hover:text-slate-950 dark:hover:text-white"
                  >
                    {CATEGORIES.find((c) => c.id === activeTool.category)?.name}
                  </a>
                  <span>/</span>
                  <span className="truncate font-medium text-slate-950 dark:text-slate-100">
                    {activeTool.name}
                  </span>
                </>
              ) : breadcrumbLabel ? (
                <>
                  <span>/</span>
                  <span className="truncate font-medium text-slate-950 dark:text-slate-100">
                    {breadcrumbLabel}
                  </span>
                </>
              ) : (
                <>
                  <span>/</span>
                  <span className="truncate text-slate-700 dark:text-slate-300">
                    {TOOLS_CATALOG.length} Free Local Utilities
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Header Actions: PWA Install + Solid High-Contrast Go Pro + Search */}
          <div className="flex shrink-0 items-center gap-2">
            <PWAInstallButton compact />

            <Button
              asChild
              variant="pro"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <a href="/pro" onClick={(e) => handleNav(e, '/pro')}>
                <Crown className="h-3.5 w-3.5 fill-slate-950 text-slate-950 dark:fill-white dark:text-white" />
                <span>Go Pro</span>
              </a>
            </Button>

            <button
              type="button"
              onClick={onOpenCommand}
              className="inline-flex h-8 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 transition-colors hover:border-blue-500/60 hover:text-slate-950 dark:border-slate-800 dark:bg-[#0D121F] dark:text-slate-300 dark:hover:text-white"
            >
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">Search Tools</span>
              </span>
              <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 md:inline-block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Ctrl K
              </kbd>
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Structured SEO Internal-Link Footer Directory */}
        <footer className="mt-10 border-t border-slate-200/90 bg-white/90 px-4 py-7 backdrop-blur-xs sm:mt-14 sm:px-8 sm:py-10 dark:border-white/[0.08] dark:bg-[#090A13]/95">
          <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
            <div className="grid grid-cols-2 gap-5 text-xs sm:grid-cols-4 sm:gap-6">
              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-slate-100">Popular PDF Tools</p>
                <ul className="mt-2.5 space-y-1.5 text-slate-500 dark:text-slate-400">
                  {[
                    ['Merge PDF', '/merge-pdf'],
                    ['Compress PDF', '/compress-pdf'],
                    ['Split PDF', '/split-pdf'],
                    ['PDF to Word', '/pdf-to-word'],
                    ['Word to PDF', '/word-to-pdf'],
                    ['Sign PDF', '/sign-pdf'],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a href={href} onClick={(e) => handleNav(e, href)} className="hover:text-slate-950 dark:hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-slate-100">Image &amp; Photo Tools</p>
                <ul className="mt-2.5 space-y-1.5 text-slate-500 dark:text-slate-400">
                  {[
                    ['Background Remover', '/background-remover'],
                    ['Passport Photo Maker', '/passport-photo-maker'],
                    ['Image Compressor', '/image-compressor'],
                    ['Image Resizer', '/image-resizer'],
                    ['JPG to PDF', '/jpg-to-pdf'],
                    ['WebP Converter', '/webp-converter'],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a href={href} onClick={(e) => handleNav(e, href)} className="hover:text-slate-950 dark:hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-slate-100">Video, Audio &amp; Dev</p>
                <ul className="mt-2.5 space-y-1.5 text-slate-500 dark:text-slate-400">
                  {[
                    ['Video to GIF', '/video-to-gif'],
                    ['Video Trimmer', '/video-trimmer'],
                    ['Video Compressor', '/video-compressor'],
                    ['Audio Volume Booster', '/audio-volume-booster'],
                    ['JSON Formatter', '/json-formatter'],
                    ['QR Code Generator', '/qr-code-generator'],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a href={href} onClick={(e) => handleNav(e, href)} className="hover:text-slate-950 dark:hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="font-display font-semibold text-slate-900 dark:text-slate-100">Categories &amp; Info</p>
                <ul className="mt-2.5 space-y-1.5 text-slate-500 dark:text-slate-400">
                  {[
                    ['PDF Suite', '/category/pdf'],
                    ['Video Tools', '/category/video'],
                    ['Audio Tools', '/category/audio'],
                    ['FAQ & Help', '/faq'],
                    ['Workflow Guides', '/guides'],
                    ['Privacy Policy', '/privacy'],
                  ].map(([label, href]) => (
                    <li key={href}>
                      <a href={href} onClick={(e) => handleNav(e, href)} className="hover:text-slate-950 dark:hover:text-white">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 pt-6 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
              <p>© {new Date().getFullYear()} Toolivo · Every Tool You Need. One Click Away. · 100% Local Processing.</p>
              <div className="flex flex-wrap items-center gap-4">
                {[
                  { label: 'Go Pro', path: '/pro' },
                  { label: 'Advertise', path: '/advertise' },
                  { label: 'All Tools', path: '/tools' },
                  { label: 'About', path: '/about' },
                  { label: 'Terms', path: '/terms' },
                  { label: 'Admin', path: '/admin' },
                ].map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    onClick={(e) => handleNav(e, link.path)}
                    className="hover:text-slate-950 dark:hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>
      <BackToTopButton />
      <OfflineIndicator />
    </div>
  );
};

/* Floating Right-Side Back-to-Top Button */
const BackToTopButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 260);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    scrollPageToTop();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.92 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-5 bottom-6 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300/90 bg-white/95 text-slate-900 shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-violet-500 hover:bg-violet-600 hover:text-white hover:shadow-[0_0_24px_-4px_rgba(124,58,237,0.55)] focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none dark:border-violet-400/35 dark:bg-[#131629]/95 dark:text-white dark:hover:border-violet-400 dark:hover:bg-violet-600"
        >
          <ArrowUp className="h-4.5 w-4.5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
