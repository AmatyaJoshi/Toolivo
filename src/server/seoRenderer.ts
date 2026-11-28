import {
  CATEGORIES,
  PLATFORM_FAQ_GROUPS,
  SEO_ARTICLES,
  TOOLS_CATALOG,
  getCategoryById,
  getToolBySlug,
} from '../data/catalog.ts';
import { PRO_FAQS, PRO_PLANS } from '../data/proPlans.ts';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

interface ResolvedRouteSeo {
  title: string;
  description: string;
  keywords: string[];
  canonicalPath: string;
  ogImagePath: string;
  ogType: 'website' | 'article';
  graph: Record<string, unknown>[];
  noscriptHtml: string;
}

function buildOrgAndSiteNodes(baseUrl: string) {
  return [
    {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'Toolivo',
      url: baseUrl,
      slogan: 'Every Tool You Need. One Click Away.',
      description:
        'Privacy-first browser utility suite for PDF, image, video, audio, text, developer, and productivity workflows with zero file uploads and zero sign-up.',
    },
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      name: 'Toolivo',
      url: baseUrl,
      publisher: { '@id': `${baseUrl}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/tools?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

function resolveRouteSeo(pathname: string, baseUrl: string): ResolvedRouteSeo {
  const cleanPath = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const orgAndSite = buildOrgAndSiteNodes(baseUrl);

  // 1. Direct root-level tool route (/{slug}) or legacy (/tools/{slug})
  const directSlug = cleanPath.startsWith('/tools/')
    ? cleanPath.slice('/tools/'.length)
    : cleanPath !== '/' && !cleanPath.slice(1).includes('/')
      ? cleanPath.slice(1)
      : '';

  const tool = directSlug ? getToolBySlug(directSlug) : undefined;
  if (tool) {
    const category = getCategoryById(tool.category);
    const canonicalUrl = `${baseUrl}/${tool.slug}`;
    const relatedTools = tool.relatedSlugs
      .map((s) => getToolBySlug(s))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    const graph: Record<string, unknown>[] = [
      ...orgAndSite,
      {
        '@type': 'SoftwareApplication',
        '@id': `${canonicalUrl}#app`,
        name: `${tool.name} — Toolivo`,
        url: canonicalUrl,
        image: `${baseUrl}/og/${tool.slug}.svg`,
        applicationCategory: 'UtilitiesApplication',
        applicationSubCategory: category?.name || 'Online Utility',
        operatingSystem: 'Any (Web Browser — Windows, macOS, Linux, iOS, Android)',
        browserRequirements: 'Requires modern HTML5 web browser with JavaScript enabled',
        isAccessibleForFree: true,
        description: tool.longDescription,
        featureList: [
          '100% client-side browser processing (zero server uploads)',
          'No sign-up, account, or watermark required',
          `Engine: ${tool.engineLabel}`,
          `Supported formats: ${tool.supportedFormats.join(', ')}`,
          ...tool.useCases,
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        publisher: { '@id': `${baseUrl}/#organization` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
          ...(category
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: category.name,
                  item: `${baseUrl}/category/${category.slug}`,
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: category ? 3 : 2,
            name: tool.name,
            item: canonicalUrl,
          },
        ],
      },
    ];

    if (tool.howToSteps.length > 0) {
      graph.push({
        '@type': 'HowTo',
        name: `How to use ${tool.name} online for free`,
        description: tool.shortDescription,
        totalTime: 'PT30S',
        tool: [{ '@type': 'HowToTool', name: 'Modern Web Browser' }],
        step: tool.howToSteps.map((step, idx) => ({
          '@type': 'HowToStep',
          position: idx + 1,
          name: `Step ${idx + 1}`,
          text: step,
        })),
      });
    }

    if (tool.faqs.length > 0) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: tool.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    const noscriptHtml = `
      <main>
        <h1>${escapeHtml(tool.name)}</h1>
        <p>${escapeHtml(tool.longDescription)}</p>
        <p>Supported formats: ${escapeHtml(tool.supportedFormats.join(', '))}. Runs 100% locally in your browser with zero file uploads and no account required.</p>
        <h2>How to use ${escapeHtml(tool.name)}</h2>
        <ol>${tool.howToSteps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        ${
          tool.faqs.length > 0
            ? `<h2>Frequently Asked Questions</h2>${tool.faqs
                .map((f) => `<h3>${escapeHtml(f.question)}</h3><p>${escapeHtml(f.answer)}</p>`)
                .join('')}`
            : ''
        }
        ${
          relatedTools.length > 0
            ? `<h2>Related Free Tools</h2><ul>${relatedTools
                .map((r) => `<li><a href="/${escapeHtml(r.slug)}">${escapeHtml(r.name)}</a> — ${escapeHtml(r.shortDescription)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </main>`;

    return {
      title: tool.seoTitle,
      description: tool.seoDescription,
      keywords: tool.keywords,
      canonicalPath: `/${tool.slug}`,
      ogImagePath: `/og/${tool.slug}.svg`,
      ogType: 'website',
      graph,
      noscriptHtml,
    };
  }

  // 2. Category route (/category/{slug})
  if (cleanPath.startsWith('/category/')) {
    const catSlug = cleanPath.slice('/category/'.length);
    const cat = CATEGORIES.find((c) => c.slug === catSlug);
    if (cat) {
      const catTools = TOOLS_CATALOG.filter((t) => t.category === cat.id);
      const canonicalUrl = `${baseUrl}/category/${cat.slug}`;
      const graph: Record<string, unknown>[] = [
        ...orgAndSite,
        {
          '@type': 'CollectionPage',
          name: cat.name,
          url: canonicalUrl,
          description: cat.seoDescription,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: catTools.length,
            itemListElement: catTools.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: t.name,
              url: `${baseUrl}/${t.slug}`,
              description: t.shortDescription,
            })),
          },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: cat.name, item: canonicalUrl },
          ],
        },
      ];
      if (cat.faqs.length > 0) {
        graph.push({
          '@type': 'FAQPage',
          mainEntity: cat.faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        });
      }
      return {
        title: cat.seoTitle,
        description: cat.seoDescription,
        keywords: [cat.name, `free online ${cat.slug} tools`, 'browser utility', 'no upload'],
        canonicalPath: `/category/${cat.slug}`,
        ogImagePath: '/og.svg',
        ogType: 'website',
        graph,
        noscriptHtml: `<main><h1>${escapeHtml(cat.name)}</h1><p>${escapeHtml(cat.description)}</p><ul>${catTools
          .map((t) => `<li><a href="/${escapeHtml(t.slug)}">${escapeHtml(t.name)}</a> — ${escapeHtml(t.shortDescription)}</li>`)
          .join('')}</ul></main>`,
      };
    }
  }

  // 3. FAQ Hub (/faq)
  if (cleanPath === '/faq') {
    const allFaqs = [
      ...PLATFORM_FAQ_GROUPS.flatMap((g) => g.items),
      ...TOOLS_CATALOG.filter((t) => t.popular).flatMap((t) => t.faqs.slice(0, 1)),
    ];
    return {
      title: 'Frequently Asked Questions — Privacy, PDF, Video, Audio & Image Tools | Toolivo',
      description:
        'Answers about Toolivo local browser processing, zero file uploads, PDF conversion, video/audio editing, passport photos, and compatibility.',
      keywords: ['toolivo faq', 'browser pdf privacy', 'free online tools faq', 'no upload converter'],
      canonicalPath: '/faq',
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'FAQPage',
          mainEntity: allFaqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${baseUrl}/faq` },
          ],
        },
      ],
      noscriptHtml: `<main><h1>Toolivo Frequently Asked Questions</h1>${allFaqs
        .map((f) => `<h2>${escapeHtml(f.question)}</h2><p>${escapeHtml(f.answer)}</p>`)
        .join('')}</main>`,
    };
  }

  // 4. Guides & Individual Guide (/guides or /guides/{slug})
  if (cleanPath.startsWith('/guides/')) {
    const articleSlug = cleanPath.slice('/guides/'.length);
    const article = SEO_ARTICLES.find((a) => a.slug === articleSlug);
    if (article) {
      const canonicalUrl = `${baseUrl}/guides/${article.slug}`;
      return {
        title: `${article.title} | Toolivo Guides`,
        description: article.excerpt,
        keywords: [article.category, 'online utility guide', 'toolivo tutorial'],
        canonicalPath: `/guides/${article.slug}`,
        ogImagePath: '/og.svg',
        ogType: 'article',
        graph: [
          ...orgAndSite,
          {
            '@type': 'Article',
            headline: article.title,
            description: article.excerpt,
            datePublished: article.publishedDate,
            dateModified: article.publishedDate,
            author: { '@id': `${baseUrl}/#organization` },
            publisher: { '@id': `${baseUrl}/#organization` },
            mainEntityOfPage: canonicalUrl,
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
              { '@type': 'ListItem', position: 2, name: 'Guides', item: `${baseUrl}/guides` },
              { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl },
            ],
          },
        ],
        noscriptHtml: `<main><article><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt)}</p>${article.sections
          .map((s) => `<h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.body)}</p>`)
          .join('')}</article></main>`,
      };
    }
  }

  if (cleanPath === '/guides') {
    return {
      title: 'Practical File & Media Guides | Toolivo',
      description:
        'Step-by-step browser guides for compressing PDFs, converting Office documents, creating passport photos, making GIFs, and formatting JSON.',
      keywords: ['pdf guide', 'image compression tutorial', 'video to gif guide'],
      canonicalPath: '/guides',
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'CollectionPage',
          name: 'Toolivo Guides',
          url: `${baseUrl}/guides`,
          description: 'Actionable tutorials for PDF, image, video, audio, and developer utilities.',
        },
      ],
      noscriptHtml: `<main><h1>Toolivo Guides</h1><ul>${SEO_ARTICLES.map(
        (a) => `<li><a href="/guides/${escapeHtml(a.slug)}">${escapeHtml(a.title)}</a> — ${escapeHtml(a.excerpt)}</li>`
      ).join('')}</ul></main>`,
    };
  }

  // 5. All Tools directory (/tools)
  if (cleanPath === '/tools') {
    return {
      title: `All ${TOOLS_CATALOG.length} Free Online Tools — PDF, Image, Video, Audio & Dev | Toolivo`,
      description: `Browse all ${TOOLS_CATALOG.length} free browser-native utilities on Toolivo. Merge PDFs, convert Word/Excel, trim videos, boost audio, remove backgrounds, and format JSON locally.`,
      keywords: ['all online tools', 'free pdf tools', 'free video tools', 'free image tools', 'browser utilities'],
      canonicalPath: '/tools',
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'CollectionPage',
          name: 'All Toolivo Utilities',
          url: `${baseUrl}/tools`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: TOOLS_CATALOG.length,
            itemListElement: TOOLS_CATALOG.map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: t.name,
              url: `${baseUrl}/${t.slug}`,
              description: t.shortDescription,
            })),
          },
        },
      ],
      noscriptHtml: `<main><h1>All ${TOOLS_CATALOG.length} Free Browser Tools</h1><ul>${TOOLS_CATALOG.map(
        (t) => `<li><a href="/${escapeHtml(t.slug)}">${escapeHtml(t.name)}</a> — ${escapeHtml(t.shortDescription)}</li>`
      ).join('')}</ul></main>`,
    };
  }

  // 5b. Toolivo Pro (/pro)
  if (cleanPath === '/pro') {
    const canonicalUrl = `${baseUrl}/pro`;
    return {
      title: 'Toolivo Pro — Accountless Sponsor-Free Plans (INR & USD)',
      description:
        'Upgrade to Toolivo Pro with no account required. Separate INR & USD pricing for 7-Day Pass, Monthly, Yearly, Lifetime, and Credit Packs via Dodo Payments.',
      keywords: ['toolivo pro', 'ad free pdf tools', 'browser utility pro plan', 'batch pdf tools', 'dodo payments'],
      canonicalPath: '/pro',
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'SoftwareApplication',
          name: 'Toolivo Pro',
          url: canonicalUrl,
          image: `${baseUrl}/og.svg`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'All',
          offers: PRO_PLANS.map((p) => ({
            '@type': 'Offer',
            name: p.name,
            price: p.priceUsd.toFixed(2),
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          })),
        },
        {
          '@type': 'FAQPage',
          mainEntity: PRO_FAQS.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Toolivo Pro', item: canonicalUrl },
          ],
        },
      ],
      noscriptHtml: `<main><h1>Toolivo Pro</h1><p>Accountless sponsor-free workspace and power presets with separate INR and USD pricing via Dodo Payments.</p><ul>${PRO_PLANS.map(
        (p) => `<li>${escapeHtml(p.name)} — $${p.priceUsd.toFixed(2)} USD / ₹${p.priceInr} INR (${escapeHtml(p.subLabel)})</li>`
      ).join('')}</ul></main>`,
    };
  }

  // 5c. Sponsor Advertising (/advertise)
  if (cleanPath === '/advertise') {
    const canonicalUrl = `${baseUrl}/advertise`;
    return {
      title: 'Advertise on Toolivo — 8 Dedicated Sponsor Frames ($15 First Month)',
      description:
        'Book one of 8 dedicated sponsor frames across the Toolivo homepage and all 43 browser utilities at $15 USD first month (or ₹1,299 INR) via Dodo Payments.',
      keywords: ['advertise on toolivo', 'sponsor frames', 'developer tool sponsorship', 'saas sponsorship'],
      canonicalPath: '/advertise',
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Toolivo', item: baseUrl },
            { '@type': 'ListItem', position: 2, name: 'Advertise', item: canonicalUrl },
          ],
        },
      ],
      noscriptHtml:
        '<main><h1>Advertise on Toolivo</h1><p>8 dedicated sponsor frames across the homepage and all 43 tools at $15 USD first month (₹1,299 INR), verified via Dodo Payments and published after admin review.</p></main>',
    };
  }

  // 6. Static pages (/about, /privacy, /terms)
  if (cleanPath === '/about' || cleanPath === '/privacy' || cleanPath === '/terms') {
    const labels: Record<string, { title: string; desc: string }> = {
      '/about': {
        title: 'About Toolivo — Browser-Native Free Utility Platform',
        desc: 'Learn how Toolivo runs 43 PDF, image, video, audio, text, and developer tools 100% locally in your browser with zero file uploads.',
      },
      '/privacy': {
        title: 'Privacy Policy — Zero File Uploads & Zero User Data | Toolivo',
        desc: 'Toolivo never uploads your files, never requires sign-in, and stores zero personal data. Every utility executes locally in browser memory.',
      },
      '/terms': {
        title: 'Terms of Use | Toolivo',
        desc: 'Simple, transparent terms for using Toolivo free browser-native utilities.',
      },
    };
    const info = labels[cleanPath];
    return {
      title: info.title,
      description: info.desc,
      keywords: ['toolivo', 'privacy-first tools', 'browser utilities'],
      canonicalPath: cleanPath,
      ogImagePath: '/og.svg',
      ogType: 'website',
      graph: [
        ...orgAndSite,
        {
          '@type': 'WebPage',
          name: info.title,
          url: `${baseUrl}${cleanPath}`,
          description: info.desc,
        },
      ],
      noscriptHtml: `<main><h1>${escapeHtml(info.title)}</h1><p>${escapeHtml(info.desc)}</p></main>`,
    };
  }

  // 7. Homepage (default)
  const homeFaqs = PLATFORM_FAQ_GROUPS.flatMap((g) => g.items);
  return {
    title: `Toolivo — ${TOOLS_CATALOG.length} Free PDF, Video, Audio & Image Tools`,
    description: `Merge, compress, sign & convert PDFs, trim video, make GIFs, remove backgrounds & edit audio locally in your browser. Zero uploads, zero sign-up.`,
    keywords: [
      'free online pdf tools',
      'merge pdf online free',
      'compress pdf',
      'pdf to word',
      'video trimmer online',
      'video to gif',
      'passport photo maker',
      'background remover free',
      'audio volume booster',
      'json formatter',
      'no upload online tools',
    ],
    canonicalPath: '/',
    ogImagePath: '/og.svg',
    ogType: 'website',
    graph: [
      ...orgAndSite,
      {
        '@type': 'WebApplication',
        '@id': `${baseUrl}/#webapp`,
        name: 'Toolivo',
        url: baseUrl,
        image: `${baseUrl}/og.svg`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'All',
        isAccessibleForFree: true,
        description: `All-in-one browser-native utility platform with ${TOOLS_CATALOG.length} free PDF, image, video, audio, text, developer, and productivity tools running 100% locally with zero uploads.`,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
      {
        '@type': 'ItemList',
        name: 'Toolivo Free Online Utilities',
        numberOfItems: TOOLS_CATALOG.length,
        itemListElement: TOOLS_CATALOG.map((t, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: t.name,
          url: `${baseUrl}/${t.slug}`,
          description: t.shortDescription,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: homeFaqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      },
    ],
    noscriptHtml: `<main><h1>Toolivo — Every Tool You Need. One Click Away.</h1><p>${TOOLS_CATALOG.length} free online PDF, image, video, audio, text, and developer tools running 100% in your browser with zero uploads and no sign-up.</p><ul>${TOOLS_CATALOG.map(
      (t) => `<li><a href="/${escapeHtml(t.slug)}">${escapeHtml(t.name)}</a> — ${escapeHtml(t.shortDescription)}</li>`
    ).join('')}</ul></main>`,
  };
}

export function injectRouteSeo(htmlTemplate: string, pathname: string, baseUrl: string): string {
  const seo = resolveRouteSeo(pathname, baseUrl);
  const canonicalUrl = `${baseUrl}${seo.canonicalPath === '/' ? '' : seo.canonicalPath}`;
  const ogImageUrl = `${baseUrl}${seo.ogImagePath}`;

  const headInjection = [
    `<meta name="description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />`,
    `<meta name="author" content="Toolivo" />`,
    `<meta name="application-name" content="Toolivo" />`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:type" content="${seo.ogType}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:site_name" content="Toolivo" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(seo.title)}" />`,
    `<script type="application/ld+json">${safeJsonLd({
      '@context': 'https://schema.org',
      '@graph': seo.graph,
    })}</script>`,
  ].join('\n    ');

  const noscriptBlock = `<noscript>${seo.noscriptHtml}</noscript>`;

  let output = htmlTemplate.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(seo.title)}</title>`
  );

  if (output.includes('<!--SEO_HEAD-->')) {
    output = output.replace('<!--SEO_HEAD-->', headInjection);
  } else {
    output = output.replace('</head>', `    ${headInjection}\n  </head>`);
  }

  if (output.includes('<!--SEO_NOSCRIPT-->')) {
    output = output.replace('<!--SEO_NOSCRIPT-->', noscriptBlock);
  }

  return output;
}
