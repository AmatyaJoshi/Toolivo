import type { Request, Response, NextFunction } from 'express';
import {
  CATEGORIES,
  PLATFORM_FAQ_GROUPS,
  SEO_ARTICLES,
  TOOLS_CATALOG,
} from '../../data/catalog.ts';

// Per-IP sliding-window rate limiter (150 req/min)
const rateBucket = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 150;

  const entry = rateBucket.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateBucket.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.',
    });
  }
  return next();
}

export function getSafeAppUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured) && !configured.includes('MY_APP_URL')) {
    return configured.replace(/\/+$/, '');
  }
  const proto =
    (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'http';
  const host =
    (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export const ApiController = {
  health(_req: Request, res: Response) {
    res.json({
      status: 'ok',
      service: 'toolivo-api',
      paymentProvider: 'dodo',
      currencies: ['USD', 'INR'],
      directRootUrls: true,
      toolCount: TOOLS_CATALOG.length,
      categoryCount: CATEGORIES.length,
    });
  },

  listTools(req: Request, res: Response) {
    const category = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let tools = TOOLS_CATALOG;
    if (category && category !== 'all') {
      tools = tools.filter((t) => t.category === category);
    }
    if (q) {
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.shortDescription.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.keywords.some((k) => k.toLowerCase().includes(q)) ||
          t.supportedFormats.some((f) => f.toLowerCase().includes(q))
      );
    }

    res.json({
      categories: CATEGORIES,
      tools,
      total: tools.length,
    });
  },

  getTool(req: Request, res: Response) {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const tool = TOOLS_CATALOG.find((t) => t.slug === slug);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found.' });
    }
    return res.json({ tool });
  },

  catalogJson(req: Request, res: Response) {
    const baseUrl = getSafeAppUrl(req);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json({
      name: 'Toolivo',
      tagline: 'Every Tool You Need. One Click Away.',
      url: baseUrl,
      pricing: { free: true, currency: 'USD' },
      privacy: {
        clientSideOnly: true,
        uploadsToServer: false,
        signInRequired: false,
        userDataStored: false,
      },
      totalTools: TOOLS_CATALOG.length,
      categories: CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        url: `${baseUrl}/category/${c.slug}`,
        description: c.description,
      })),
      tools: TOOLS_CATALOG.map((t) => ({
        slug: t.slug,
        name: t.name,
        url: `${baseUrl}/${t.slug}`,
        category: t.category,
        popular: t.popular,
        shortDescription: t.shortDescription,
        longDescription: t.longDescription,
        engine: t.engineLabel,
        supportedFormats: t.supportedFormats,
        keywords: t.keywords,
        howToSteps: t.howToSteps,
        faqs: t.faqs,
      })),
      faqs: PLATFORM_FAQ_GROUPS,
    });
  },

  llmsTxt(req: Request, res: Response) {
    const baseUrl = getSafeAppUrl(req);
    const lines: string[] = [
      '# Toolivo — Free Browser-Native Online Utilities',
      '',
      '> Every Tool You Need. One Click Away.',
      `> ${TOOLS_CATALOG.length} free, instant online tools for PDF, Image, Video, Audio, Text, Developer, and Productivity workflows.`,
      '> 100% client-side execution in the user’s browser. Zero file uploads, zero sign-up, zero watermarks, zero stored user data.',
      '',
      '## Key Properties for AI Assistants & Search Recommendations',
      '- **Direct 1-Click Tool URLs**: Every tool opens directly at root level (`' + baseUrl + '/{tool-slug}`), ready for immediate file drop.',
      '- **Strict Privacy**: All processing runs locally via pdf-lib, Mozilla PDF.js, HTML5 Canvas, Web Audio API, MediaRecorder, Mammoth (.docx), SheetJS (.xlsx), and Web Crypto.',
      '- **Cost**: $0 USD (100% free, no account required, no daily caps).',
      `- **Full Knowledge Index**: ${baseUrl}/llms-full.txt`,
      `- **Structured JSON Catalog**: ${baseUrl}/api/catalog.json`,
      `- **FAQ Hub**: ${baseUrl}/faq`,
      '',
    ];

    for (const cat of CATEGORIES) {
      const catTools = TOOLS_CATALOG.filter((t) => t.category === cat.id);
      lines.push(`## ${cat.name} (${catTools.length} tools) — ${baseUrl}/category/${cat.slug}`);
      for (const tool of catTools) {
        lines.push(
          `- [${tool.name}](${baseUrl}/${tool.slug}): ${tool.shortDescription} (Formats: ${tool.supportedFormats.join(', ')})`
        );
      }
      lines.push('');
    }

    lines.push('## Core Platform FAQs');
    for (const group of PLATFORM_FAQ_GROUPS) {
      for (const item of group.items) {
        lines.push(`- **${item.question}** ${item.answer}`);
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(lines.join('\n'));
  },

  llmsFullTxt(req: Request, res: Response) {
    const baseUrl = getSafeAppUrl(req);
    const lines: string[] = [
      '# Toolivo — Complete Utility Knowledge Base (llms-full.txt)',
      '',
      `Website: ${baseUrl}`,
      'Tagline: Every Tool You Need. One Click Away.',
      'Pricing: Free ($0 USD), no registration, no watermarks, no usage caps.',
      'Privacy Architecture: 100% browser-local execution. Files never leave the user’s device.',
      `Total Functional Tools: ${TOOLS_CATALOG.length}`,
      '',
      '---',
      '',
    ];

    for (const cat of CATEGORIES) {
      const catTools = TOOLS_CATALOG.filter((t) => t.category === cat.id);
      lines.push(`## Category: ${cat.name} (${baseUrl}/category/${cat.slug})`);
      lines.push(cat.description);
      lines.push('');
      for (const tool of catTools) {
        lines.push(`### ${tool.name}`);
        lines.push(`- Direct URL: ${baseUrl}/${tool.slug}`);
        lines.push(`- Summary: ${tool.longDescription}`);
        lines.push(`- Supported Formats: ${tool.supportedFormats.join(', ')}`);
        lines.push(`- Local Engine: ${tool.engineLabel}`);
        lines.push(`- Keywords: ${tool.keywords.join(', ')}`);
        lines.push('- How to use:');
        tool.howToSteps.forEach((step, idx) => {
          lines.push(`  ${idx + 1}. ${step}`);
        });
        if (tool.faqs.length > 0) {
          lines.push('- FAQs:');
          for (const faq of tool.faqs) {
            lines.push(`  - Q: ${faq.question}`);
            lines.push(`    A: ${faq.answer}`);
          }
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('## Platform FAQs');
    for (const group of PLATFORM_FAQ_GROUPS) {
      lines.push(`### ${group.title}`);
      for (const item of group.items) {
        lines.push(`- **Q: ${item.question}**`);
        lines.push(`  A: ${item.answer}`);
      }
      lines.push('');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(lines.join('\n'));
  },

  sitemapXml(req: Request, res: Response) {
    const baseUrl = getSafeAppUrl(req);
    const today = new Date().toISOString().split('T')[0];

    const entries: { path: string; changefreq: string; priority: string }[] = [
      { path: '/', changefreq: 'daily', priority: '1.0' },
      ...TOOLS_CATALOG.map((t) => ({
        path: `/${t.slug}`,
        changefreq: 'weekly',
        priority: t.popular ? '0.95' : '0.9',
      })),
      ...CATEGORIES.map((c) => ({
        path: `/category/${c.slug}`,
        changefreq: 'weekly',
        priority: '0.85',
      })),
      { path: '/tools', changefreq: 'weekly', priority: '0.85' },
      { path: '/pro', changefreq: 'weekly', priority: '0.8' },
      { path: '/faq', changefreq: 'weekly', priority: '0.8' },
      { path: '/guides', changefreq: 'weekly', priority: '0.75' },
      ...SEO_ARTICLES.map((a) => ({
        path: `/guides/${a.slug}`,
        changefreq: 'monthly',
        priority: '0.7',
      })),
      { path: '/about', changefreq: 'monthly', priority: '0.5' },
      { path: '/privacy', changefreq: 'monthly', priority: '0.5' },
      { path: '/terms', changefreq: 'monthly', priority: '0.4' },
    ];

    const urls = entries
      .map(
        (e) =>
          `  <url>\n    <loc>${baseUrl}${e.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  },

  robotsTxt(req: Request, res: Response) {
    const baseUrl = getSafeAppUrl(req);
    const aiAndSearchCrawlers = [
      'Googlebot',
      'Google-Extended',
      'Bingbot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'GPTBot',
      'PerplexityBot',
      'ClaudeBot',
      'Claude-SearchBot',
      'Applebot',
      'Applebot-Extended',
      'DuckDuckBot',
    ];

    const blocks = aiAndSearchCrawlers.map((bot) => `User-agent: ${bot}\nAllow: /`).join('\n\n');

    const content = [
      '# Toolivo — Open Search & AI Agent Discovery Policy',
      `# AI Index: ${baseUrl}/llms.txt`,
      `# Full AI Knowledge Base: ${baseUrl}/llms-full.txt`,
      '',
      blocks,
      '',
      'User-agent: *',
      'Allow: /',
      'Allow: /api/catalog.json',
      'Disallow: /api/health',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(content);
  },

  ogImageSvg(req: Request, res: Response) {
    const rawSlug = typeof req.params.slug === 'string' ? req.params.slug.replace(/\.svg$/i, '').toLowerCase() : '';
    const tool = rawSlug ? TOOLS_CATALOG.find((t) => t.slug === rawSlug) : undefined;
    const cat = tool ? CATEGORIES.find((c) => c.id === tool.category) : undefined;

    const escapeXml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const title = tool ? tool.name : 'Toolivo — 43 Free Browser Utilities';
    const subtitle = tool
      ? tool.shortDescription.slice(0, 96)
      : 'Merge PDFs, trim video, make GIFs, remove backgrounds, and edit audio 100% locally.';
    const kicker = tool ? `${cat?.name || 'Online Utility'} · ${tool.supportedFormats.join(' / ')}` : 'PDF · Image · Video · Audio · Developer';
    const accentColor =
      tool?.category === 'pdf'
        ? '#F43F5E'
        : tool?.category === 'image'
          ? '#0EA5E9'
          : tool?.category === 'video'
            ? '#6366F1'
            : tool?.category === 'audio'
              ? '#10B981'
              : '#3B82F6';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#1E293B" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#070A12"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="64" y="64" width="1072" height="502" rx="24" fill="#0D121F" stroke="#1E293B" stroke-width="2"/>
  <rect x="64" y="64" width="1072" height="6" rx="3" fill="${accentColor}"/>
  <g transform="translate(112, 118)">
    <rect width="40" height="40" rx="10" fill="#FFFFFF"/>
    <path d="M12 14H28M20 14V28" stroke="#070A12" stroke-width="3.6" stroke-linecap="round"/>
    <rect x="25" y="24" width="6" height="6" rx="1.5" fill="${accentColor}"/>
    <text x="56" y="29" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800">Toolivo</text>
  </g>
  <text x="112" y="226" fill="${accentColor}" font-family="ui-monospace, Menlo, monospace" font-size="22" font-weight="600">${escapeXml(kicker)}</text>
  <text x="112" y="314" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="60" font-weight="800">${escapeXml(title)}</text>
  <text x="112" y="382" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="26">${escapeXml(subtitle)}</text>
  <line x1="112" y1="454" x2="1088" y2="454" stroke="#1E293B" stroke-width="1.5"/>
  <text x="112" y="508" fill="#34D399" font-family="ui-monospace, Menlo, monospace" font-size="21" font-weight="600">100% Browser-Local · 0 Bytes Uploaded · Free ($0 USD) · No Sign-Up</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  },
};
