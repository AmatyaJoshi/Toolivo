import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  getCategoryById,
  getToolBySlug,
  SEO_ARTICLES,
  type ToolCategoryId,
} from './data/catalog';
import { AppLayout, CommandPalette, ErrorBoundary } from './components/Layout';
import { useLenis } from './hooks/useLenis';
import {
  FaqHubPage,
  GuidesPage,
  HomePage,
  StaticInfoPage,
  ToolDetailPage,
  ToolsDirectoryPage,
} from './pages/PublicPages';
import { EntitlementProvider } from './context/EntitlementContext';

const ProPage = lazy(() => import('./pages/ProPage').then((m) => ({ default: m.ProPage })));
const AdvertisePage = lazy(() =>
  import('./pages/AdvertisePage').then((m) => ({ default: m.AdvertisePage }))
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

interface RouteState {
  pathname: string;
  search: string;
}

function readRoute(): RouteState {
  const cleaned = window.location.pathname.replace(/\/+$/, '') || '/';
  return { pathname: cleaned, search: window.location.search };
}

function resolveToolFromPath(path: string) {
  if (path.startsWith('/tools/')) {
    return getToolBySlug(path.replace('/tools/', ''));
  }
  const directSlug = path.slice(1);
  if (directSlug && !directSlug.includes('/')) {
    return getToolBySlug(directSlug);
  }
  return undefined;
}

export default function App() {
  useLenis();
  const [route, setRoute] = useState<RouteState>(readRoute);
  const [commandOpen, setCommandOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('toolivo-theme');
    if (saved) return saved === 'dark';
    return true; // Enterprise dark-first default
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    localStorage.setItem('toolivo-theme', darkMode ? 'dark' : 'light');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', darkMode ? '#07070E' : '#FFFFFF');
    }
  }, [darkMode]);

  const navigate = useCallback((target: string) => {
    const url = new URL(target, window.location.origin);
    const cleanedPath = url.pathname.replace(/\/+$/, '') || '/';
    const nextUrl = `${cleanedPath}${url.search}`;
    if (nextUrl !== `${window.location.pathname.replace(/\/+$/, '') || '/'}${window.location.search}`) {
      window.history.pushState({}, '', nextUrl);
    }
    setRoute({ pathname: cleanedPath, search: url.search });
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    const handlePop = () => setRoute(readRoute());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Global Ctrl+K / ⌘K quick tool launcher
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeTool = resolveToolFromPath(route.pathname);

  // Sync client-side SEO title, meta description, OpenGraph & canonical URL
  useEffect(() => {
    const path = route.pathname;
    let title = 'Toolivo — Free PDF, Video, Audio & Photo Tools (100% Local)';
    let description =
      'Merge, compress, split, sign, and convert PDFs, trim videos, make GIFs, boost audio, remove backgrounds, and format JSON directly in your browser. Zero uploads, no sign-up.';
    let canonicalPath = path;

    if (activeTool) {
      title = activeTool.seoTitle;
      description = activeTool.seoDescription;
      canonicalPath = `/${activeTool.slug}`;
    } else if (path.startsWith('/category/')) {
      const cat = getCategoryById(path.replace('/category/', ''));
      if (cat) {
        title = cat.seoTitle;
        description = cat.seoDescription;
      }
    } else if (path.startsWith('/guides/')) {
      const art = SEO_ARTICLES.find((a) => a.slug === path.replace('/guides/', ''));
      if (art) {
        title = `${art.title} | Toolivo Guides`;
        description = art.excerpt;
      }
    } else if (path === '/faq') {
      title = 'Frequently Asked Questions — Privacy, PDF & Media Tools | Toolivo';
      description =
        'Answers to common questions about Toolivo’s 100% browser-local PDF, video, audio, and image utilities.';
    } else if (path === '/pro') {
      title = 'Toolivo Pro — Accountless Sponsor-Free Workspace (INR & USD via Dodo Payments)';
      description =
        'Upgrade to Toolivo Pro with no account required. Multi-currency INR and USD checkout via Dodo Payments with instant recovery key delivery.';
    } else if (path === '/advertise') {
      title = 'Advertise on Toolivo — 8 Exclusive Sponsor Frames ($15/mo)';
      description =
        'Sponsor Toolivo across 8 curated homepage and alongside-tool frames starting at $15/mo USD (₹1,299/mo INR) via Dodo Payments.';
    } else if (path === '/admin') {
      title = 'Admin — Billing, Pricing & Sponsor Approval | Toolivo';
      description = 'Toolivo Dodo Payments pricing configuration and sponsor approval dashboard.';
    } else if (path === '/guides') {
      title = 'Guides & File Workflow Playbooks | Toolivo';
      description =
        'Step-by-step guides for compressing PDFs, converting Word/Excel to PDF, making passport photos, and converting MP4 to GIF.';
    }

    const ogImage = activeTool
      ? `${window.location.origin}/og/${activeTool.slug}.svg`
      : `${window.location.origin}/og.svg`;
    const canonicalUrl = `${window.location.origin}${canonicalPath === '/' ? '' : canonicalPath}`;

    document.title = title;
    const setMeta = (selector: string, content: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:image"]', ogImage);
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', ogImage);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);
  }, [route.pathname, activeTool]);

  let breadcrumbLabel: string | undefined;
  if (route.pathname === '/faq') breadcrumbLabel = 'FAQ & Help';
  else if (route.pathname === '/pro') breadcrumbLabel = 'Toolivo Pro';
  else if (route.pathname === '/advertise') breadcrumbLabel = 'Advertise';
  else if (route.pathname === '/admin') breadcrumbLabel = 'Admin';
  else if (route.pathname.startsWith('/guides')) breadcrumbLabel = 'Guides';
  else if (route.pathname.startsWith('/category/')) {
    breadcrumbLabel = getCategoryById(route.pathname.replace('/category/', ''))?.name;
  } else if (route.pathname === '/about') breadcrumbLabel = 'About';
  else if (route.pathname === '/privacy') breadcrumbLabel = 'Privacy';
  else if (route.pathname === '/terms') breadcrumbLabel = 'Terms';

  const renderPage = () => {
    const path = route.pathname;
    if (path === '/') {
      return <HomePage navigate={navigate} onOpenCommand={() => setCommandOpen(true)} />;
    }
    if (activeTool) {
      return <ToolDetailPage slug={activeTool.slug} navigate={navigate} />;
    }
    if (path === '/tools') {
      return <ToolsDirectoryPage initialCategory="all" navigate={navigate} />;
    }
    if (path.startsWith('/category/')) {
      const catSlug = path.replace('/category/', '') as ToolCategoryId;
      return (
        <ToolsDirectoryPage
          initialCategory={getCategoryById(catSlug) ? catSlug : 'all'}
          navigate={navigate}
        />
      );
    }
    if (path === '/pro') {
      return <ProPage navigate={navigate} />;
    }
    if (path === '/advertise') {
      return <AdvertisePage navigate={navigate} />;
    }
    if (path === '/admin') {
      return <AdminPage />;
    }
    if (path === '/faq') {
      return <FaqHubPage navigate={navigate} />;
    }
    if (path === '/guides') {
      return <GuidesPage navigate={navigate} />;
    }
    if (path.startsWith('/guides/')) {
      return <GuidesPage slug={path.replace('/guides/', '')} navigate={navigate} />;
    }
    if (path === '/about' || path === '/privacy' || path === '/terms') {
      return <StaticInfoPage page={path.slice(1) as 'about' | 'privacy' | 'terms'} />;
    }
    return <HomePage navigate={navigate} onOpenCommand={() => setCommandOpen(true)} />;
  };

  return (
    <ErrorBoundary>
      <EntitlementProvider>
        <AppLayout
          currentPath={route.pathname}
          activeTool={activeTool}
          breadcrumbLabel={breadcrumbLabel}
          navigate={navigate}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((d) => !d)}
          onOpenCommand={() => setCommandOpen(true)}
        >
          <Suspense
            fallback={
              <div className="mx-auto max-w-5xl px-4 py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                Loading workspace...
              </div>
            }
          >
            <div key={route.pathname}>{renderPage()}</div>
          </Suspense>
        </AppLayout>

        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          navigate={navigate}
        />
      </EntitlementProvider>
    </ErrorBoundary>
  );
}
