import fs from 'node:fs';
import path from 'node:path';

/**
 * Static organisation facts shared with the client-side schema factory in
 * src/components/seo/SEO.tsx — edit organization.json, not this module, when
 * business details (address, phone, social links, …) change. Resolved from the
 * repo root, matching how the build scripts are invoked (`node ./scripts/…`).
 */
const organizationData = JSON.parse(
  fs.readFileSync(path.resolve('src/components/seo/organization.json'), 'utf8'),
);

/**
 * FAQ content shared with the client (src/components/seo/seo-config.ts re-exports
 * the same file), keyed by page: 'common' for the homepage, route slugs for
 * service pages. Keeps visible FAQ sections, FAQPage JSON-LD, and the
 * prerendered static HTML provably identical.
 */
const faqData = JSON.parse(fs.readFileSync(path.resolve('src/components/seo/faqs.json'), 'utf8'));

/** FAQ entries for a route, or an empty array when the page has none. */
export function faqsForRoute(route) {
  if (route.schema === 'home') return faqData.common || [];
  if (route.schema !== 'service') return [];
  return faqData[route.path.replace(/^\//, '')] || [];
}

export const DEFAULT_SITE_URL = 'https://www.navigatewealth.co';
export const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
export const DEFAULT_OG_IMAGE_PATH = '/brand-assets/navigate-wealth-og.png';
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;
export const DEFAULT_LANGUAGE = 'en-ZA';
export const DEFAULT_BUSINESS_NAME = organizationData.name;
export const DEFAULT_BUSINESS_PHONE = organizationData.telephone;
export const DEFAULT_BUSINESS_EMAIL = organizationData.email;

/**
 * Whether a failure to fetch published articles should hard-fail the build
 * instead of silently degrading to the cached/empty article set.
 *
 * Resolution order:
 *   1. Explicit `SEO_REQUIRE_ARTICLES` (1/true/yes → strict, 0/false/no → lenient).
 *   2. Otherwise default to strict on automated production builds (Vercel / CI),
 *      and lenient for local development so offline `npm run build` still works.
 */
export function requireArticles() {
  const explicit = process.env.SEO_REQUIRE_ARTICLES;
  if (explicit != null && explicit.trim() !== '') {
    return /^(1|true|yes)$/i.test(explicit.trim());
  }
  return Boolean(process.env.VERCEL || process.env.CI);
}

/**
 * Google Search Console "HTML tag" verification token, injected into the
 * prerendered <head> at build time when present. Set via the
 * `GOOGLE_SITE_VERIFICATION` (or `VITE_GOOGLE_SITE_VERIFICATION`) env var in the
 * deployment environment; a no-op when unset.
 */
export function resolveSiteVerificationToken() {
  const token =
    process.env.GOOGLE_SITE_VERIFICATION || process.env.VITE_GOOGLE_SITE_VERIFICATION || '';
  return token.trim();
}

export const disallowPaths = [
  '/admin',
  '/dashboard',
  '/dashboard/',
  '/products-services-dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/',
  '/account-type',
  '/get-started',
  '/application',
  '/application/',
  '/onboarding/',
  '/profile',
  '/security',
  '/history',
  '/communication',
  '/transactions-documents',
  '/my-adviser',
  '/ai-advisor',
  '/requests/',
  '/newsletter/',
  '/sign',
  '/verify',
  '/verify-document',
  '/og-preview',
  '/links',
  '/migration-helper',
  '/design-system',
  '/preview_page.html',
];

export const publicSeoRoutes = [
  {
    path: '/',
    lastmod: '2026-07-01',
    title: 'Independent Financial Advisors SA | Navigate Wealth',
    description:
      'Independent financial planning, investment management, retirement, risk, tax and estate planning services across South Africa from Navigate Wealth.',
    keywords:
      'financial advisor, wealth management, investment planning, retirement planning, risk management, tax planning, estate planning, South Africa, independent financial advisor',
    ogType: 'website',
    schema: 'home',
  },
  {
    path: '/services',
    lastmod: '2026-04-17',
    title: 'Our Services | Navigate Wealth',
    description:
      'Wealth management services from Navigate Wealth: risk, retirement, investments, medical aid, estate planning, tax planning and employee benefits.',
    keywords:
      'financial services, wealth management, risk management, retirement planning, investment management, medical aid, estate planning, tax planning, employee benefits, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/resources',
    lastmod: '2026-04-17',
    title: 'Resources & Insights | Navigate Wealth',
    description:
      'Financial planning articles, market insights and educational resources from Navigate Wealth — expert commentary on investing, retirement, tax and more.',
    keywords:
      'financial planning articles, investment insights, retirement planning resources, tax planning guides, market commentary, Navigate Wealth blog, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/about',
    lastmod: '2026-03-01',
    title: 'About Us | Navigate Wealth',
    description:
      'Learn about Navigate Wealth — our mission, values and experienced team of independent financial advisors helping you achieve financial independence.',
    keywords:
      'about navigate wealth, financial advisors team, independent financial planning, South Africa wealth management',
    ogType: 'website',
    schema: 'about',
  },
  {
    path: '/team',
    lastmod: '2026-03-01',
    title: 'Our Team | Meet the Advisors | Navigate Wealth',
    description:
      'Meet the experienced team of independent financial advisors at Navigate Wealth. Qualified professionals dedicated to your financial success across South Africa.',
    keywords:
      'Navigate Wealth team, financial advisors, certified financial planner, wealth management team, South Africa financial advisors',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/contact',
    lastmod: '2026-03-01',
    title: 'Contact Us | Navigate Wealth',
    description:
      'Get in touch with Navigate Wealth for a free consultation. Our independent financial advisors are ready to help you plan your financial future.',
    keywords:
      'contact navigate wealth, financial advisor consultation, free consultation, South Africa financial planning',
    ogType: 'website',
    schema: 'contact',
  },
  {
    path: '/schedule-consultation',
    lastmod: '2026-03-01',
    title: 'Schedule a Consultation | Navigate Wealth',
    description:
      'Schedule a consultation with Navigate Wealth to discuss independent financial planning, investment, retirement, risk, tax, estate, and medical aid advice.',
    keywords:
      'schedule consultation, financial advisor consultation, Navigate Wealth, financial planning South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/contact/consultation',
    sitemap: false,
    lastmod: '2026-03-01',
    title: 'Schedule a Consultation | Navigate Wealth',
    description:
      'Schedule a consultation with Navigate Wealth to discuss independent financial planning, investment, retirement, risk, tax, estate, and medical aid advice.',
    keywords:
      'schedule consultation, financial advisor consultation, Navigate Wealth, financial planning South Africa',
    canonicalPath: '/schedule-consultation',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/why-us',
    lastmod: '2026-03-01',
    title: 'Why Choose Navigate Wealth | Independent Financial Advisory',
    description:
      "Why Navigate Wealth is South Africa's trusted independent advisory: genuine independence, a personalised approach and long-term client relationships.",
    keywords:
      'why Navigate Wealth, independent financial advisor, best financial planner South Africa, trusted wealth management, personalised financial advice',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/risk-management',
    lastmod: '2026-07-01',
    title: 'Risk Management | Life & Disability Cover | Navigate Wealth',
    description:
      'Independent risk management advice in South Africa. Life cover, disability, severe illness & income protection from leading insurers.',
    keywords:
      'risk management South Africa, life cover, disability insurance, income protection, severe illness cover, business insurance, buy and sell agreement, key person insurance, life insurance South Africa, independent insurance advisor, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Risk Management',
  },
  {
    path: '/retirement-planning',
    lastmod: '2026-07-01',
    title: 'Retirement Planning | Annuities & Pensions | Navigate Wealth',
    description:
      'Comprehensive retirement planning in South Africa. Retirement annuities, preservation funds, living annuities & pension funds from leading providers.',
    keywords:
      'retirement planning South Africa, retirement annuity, living annuity, pension fund, provident fund, preservation fund, retirement savings, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Retirement Planning',
  },
  {
    path: '/investment-management',
    lastmod: '2026-07-01',
    title: 'Investment Management | Navigate Wealth',
    description:
      'Professional investment management in South Africa. Unit trusts, tax-free savings, offshore investments & corporate fund solutions.',
    keywords:
      'investment management South Africa, unit trusts, tax free savings account, offshore investments, endowments, corporate investments, wealth management, Allan Gray, Sygnia, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Investment Management',
  },
  {
    path: '/tax-planning',
    lastmod: '2026-07-01',
    title: 'Tax Planning & Optimisation | Navigate Wealth',
    description:
      'Expert tax planning for individuals and businesses in South Africa — tax-efficient structures, estate duty, capital gains and corporate tax strategies.',
    keywords:
      'tax planning South Africa, tax optimisation, estate duty, capital gains tax, corporate tax, tax-free savings, tax deductions, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Tax Planning',
  },
  {
    path: '/estate-planning',
    lastmod: '2026-07-01',
    title: 'Estate Planning | Wills & Trusts | Navigate Wealth',
    description:
      'Comprehensive estate planning in South Africa — wills, trusts, succession planning, estate duty optimisation and business continuity from specialists.',
    keywords:
      'estate planning South Africa, wills, trusts, succession planning, estate duty, inheritance, business succession, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Estate Planning',
  },
  {
    path: '/financial-planning',
    lastmod: '2026-07-01',
    title: 'Financial Planning | Wealth Strategy | Navigate Wealth',
    description:
      'Independent financial planning in South Africa. Strategies covering investments, retirement, tax, estate planning & debt management.',
    keywords:
      'financial planning South Africa, comprehensive financial plan, wealth strategy, retirement planning, investment strategy, tax planning, estate planning, debt management, certified financial planner, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Financial Planning',
  },
  {
    path: '/medical-aid',
    lastmod: '2026-07-01',
    title: 'Medical Aid & Health Insurance | Navigate Wealth',
    description:
      'Independent medical aid advice in South Africa: hospital and comprehensive plans, savings plans, group schemes and corporate wellness from leading schemes.',
    keywords:
      'medical aid South Africa, health insurance, hospital plan, medical savings, gap cover, group medical scheme, corporate wellness, Discovery Health, Momentum Health, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Medical Aid Advice',
  },
  {
    path: '/employee-benefits',
    lastmod: '2026-07-01',
    title: 'Employee Benefits | Group Risk & Health | Navigate Wealth',
    description:
      'Tailored employee benefits for businesses in South Africa. Group risk cover, retirement funds, medical aid & wellness programmes.',
    keywords:
      'employee benefits South Africa, group risk cover, group retirement fund, group medical aid, corporate wellness, employee wellness, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Employee Benefits',
  },
  {
    path: '/get-quote',
    lastmod: '2026-03-01',
    title: 'Get a Free Quote | Navigate Wealth',
    description:
      'Request a free, no-obligation quote for financial planning, insurance, investments, retirement or medical aid. We compare the market to find your best fit.',
    keywords:
      'free financial quote, insurance quote South Africa, investment quote, retirement planning quote, medical aid quote, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/individuals',
    lastmod: '2026-03-01',
    title: 'Financial Planning for Individuals | Navigate Wealth',
    description:
      'Personal financial planning for individuals in South Africa — risk, investments, retirement, tax, estate planning and medical aid from independent advisors.',
    keywords:
      'personal financial planning, individual wealth management, personal insurance, investment advice, retirement planning individual, South Africa, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/businesses',
    lastmod: '2026-03-01',
    title: 'Financial Solutions for Businesses | Navigate Wealth',
    description:
      'Corporate financial services in South Africa — employee benefits, group risk cover, business insurance, corporate investments and tax planning.',
    keywords:
      'business financial planning, corporate wealth management, employee benefits, group risk cover, business insurance, corporate investments, South Africa, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/solutions/advisers',
    lastmod: '2026-03-01',
    title: 'For Financial Advisers | Partner with Navigate Wealth',
    description:
      'Join Navigate Wealth as an independent financial adviser — access our technology platform, compliance support, product range and national network.',
    keywords:
      'financial adviser partnership, independent adviser network, financial services franchise, adviser support platform, Navigate Wealth partnership, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/ask-vasco',
    lastmod: '2026-03-01',
    title: 'Ask Vasco | AI Financial Navigator | Navigate Wealth',
    description:
      "Ask Vasco, Navigate Wealth's AI financial navigator, for general South African guidance on retirement, tax, risk cover, investing and estate planning.",
    keywords:
      'AI financial navigator South Africa, financial planning chatbot, retirement questions, tax planning guidance, Navigate Wealth Vasco',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/careers',
    lastmod: '2026-03-01',
    title: 'Careers | Join Our Team | Navigate Wealth',
    description:
      'Explore careers at Navigate Wealth and join a dynamic team of independent financial advisors helping South Africans achieve financial independence.',
    keywords:
      'Navigate Wealth careers, financial advisor jobs, wealth management careers, financial planning jobs South Africa, independent financial advisor vacancy',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/press',
    lastmod: '2026-03-01',
    title: 'Press & Media | Navigate Wealth',
    description:
      'Navigate Wealth press releases, media coverage and announcements. Access our media kit, brand assets and the latest news from our advisory firm.',
    keywords:
      'Navigate Wealth press, media coverage, financial advisor news, press releases, media kit, South Africa financial services news',
    ogType: 'website',
    schema: 'webpage',
  },
  {
    path: '/legal',
    lastmod: '2026-01-01',
    title: 'Legal & Compliance | Navigate Wealth',
    description:
      'Navigate Wealth legal information: privacy policy, terms and conditions, POPIA compliance, FAIS disclosure and regulatory details for our services.',
    keywords:
      'Navigate Wealth legal, privacy policy, terms and conditions, POPIA, FAIS disclosure, financial services compliance, South Africa',
    ogType: 'website',
    schema: 'webpage',
  },
];

export function normalizeSiteUrl(value) {
  const trimmed = String(value || DEFAULT_SITE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

export function routeCanonicalPath(route) {
  return route.canonicalPath || route.path;
}

/**
 * Absolute canonical URL for a route. Prefers an explicit absolute override
 * (`route.canonicalUrl` — e.g. an article's admin-set `seo_canonical_url`) over
 * the path-derived canonical, so the prerendered <link rel="canonical"> agrees
 * with the runtime <SEO> tag (ArticleDetailPage honours the same override).
 */
export function routeCanonicalUrl(route, siteUrl) {
  const override = typeof route.canonicalUrl === 'string' ? route.canonicalUrl.trim() : '';
  if (override) return override;
  return absoluteUrl(siteUrl, routeCanonicalPath(route));
}

/**
 * When an article carries an admin-set canonical (`seo_canonical_url`) that
 * points somewhere OTHER than its own URL, return that normalized absolute URL:
 * the page is a deliberate duplicate that should canonicalise elsewhere and stay
 * out of the sitemap. Returns null for a missing or self-referential canonical.
 */
export function resolveArticleCanonicalOverride(article, siteUrl) {
  const raw =
    typeof article?.seo_canonical_url === 'string' ? article.seo_canonical_url.trim() : '';
  if (!raw) return null;
  const slug = typeof article?.slug === 'string' ? article.slug.trim() : '';
  if (!slug) return null;
  const selfUrl = absoluteUrl(siteUrl, `/resources/article/${encodeURIComponent(slug)}`);
  const strip = (value) => value.replace(/\/+$/, '');
  return strip(raw) === strip(selfUrl) ? null : raw;
}

export function absoluteUrl(siteUrl, routePath) {
  return routePath === '/' ? siteUrl : `${siteUrl}${routePath}`;
}

export function resolveImageUrl(siteUrl, value) {
  if (!value) return `${siteUrl}${DEFAULT_OG_IMAGE_PATH}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
const TITLE_SUFFIX = ' | Navigate Wealth';

function collapseWhitespace(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ');
}

/** Truncate to a word boundary within `max` chars, appending an ellipsis. */
function truncateAtWord(value, max) {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[\s.,;:!?\u2013\u2014-]+$/, '')}\u2026`;
}

/** Clamp a meta description to the SERP-safe length, stripping markup. */
export function clampSeoDescription(value, max = SEO_DESCRIPTION_MAX) {
  const text = collapseWhitespace(stripHtml(value));
  return text.length <= max ? text : truncateAtWord(text, max);
}

/**
 * Build a SERP-safe article <title>. Keeps the brand suffix when the whole
 * tag fits, otherwise prefers the keyword-rich headline and drops/truncates
 * to stay within `SEO_TITLE_MAX`.
 */
export function buildArticleTitle(rawHeadline) {
  const headline = collapseWhitespace(rawHeadline) || 'Financial Planning Article';
  const withSuffix = `${headline}${TITLE_SUFFIX}`;
  if (withSuffix.length <= SEO_TITLE_MAX) return withSuffix;
  if (headline.length <= SEO_TITLE_MAX) return headline;
  return truncateAtWord(headline, SEO_TITLE_MAX);
}

export function createOrganizationSchema(siteUrl) {
  return {
    '@type': ['Organization', 'FinancialService'],
    '@id': `${siteUrl}/#organization`,
    ...organizationData,
    url: siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${siteUrl}/brand-assets/navigate-wealth-social.png`,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: organizationData.telephone,
      email: organizationData.email,
      availableLanguage: organizationData.availableLanguage,
    },
  };
}

export function createWebSiteSchema(siteUrl) {
  return {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: 'Navigate Wealth',
    url: siteUrl,
    publisher: { '@id': `${siteUrl}/#organization` },
    inLanguage: DEFAULT_LANGUAGE,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/resources?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function createWebPageSchema(route, siteUrl) {
  const url = absoluteUrl(siteUrl, routeCanonicalPath(route));
  return {
    '@type':
      route.schema === 'about'
        ? 'AboutPage'
        : route.schema === 'contact'
          ? 'ContactPage'
          : 'WebPage',
    '@id': `${url}#webpage`,
    name: route.title,
    description: route.description,
    url,
    inLanguage: DEFAULT_LANGUAGE,
    ...(route.lastmod ? { dateModified: route.lastmod } : {}),
    isPartOf: { '@id': `${siteUrl}/#website` },
    publisher: { '@id': `${siteUrl}/#organization` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  };
}

export function createBreadcrumbSchema(route, siteUrl) {
  const crumbs = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: siteUrl,
    },
  ];

  if (route.path !== '/') {
    const pathParts = route.path.split('/').filter(Boolean);
    let partial = '';
    pathParts.forEach((part, index) => {
      partial += `/${part}`;
      crumbs.push({
        '@type': 'ListItem',
        position: index + 2,
        name: part
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        item: absoluteUrl(siteUrl, partial),
      });
    });
  }

  return {
    '@type': 'BreadcrumbList',
    '@id': `${absoluteUrl(siteUrl, routeCanonicalPath(route))}#breadcrumb`,
    itemListElement: crumbs,
  };
}

export function createServiceSchema(route, siteUrl) {
  return {
    '@type': 'FinancialService',
    '@id': `${absoluteUrl(siteUrl, route.path)}#service`,
    name: route.serviceType || route.title.replace(/\s*\|.*$/, ''),
    description: route.description,
    url: absoluteUrl(siteUrl, route.path),
    serviceType: route.serviceType || 'Financial Advisory Services',
    provider: { '@id': `${siteUrl}/#organization` },
    inLanguage: DEFAULT_LANGUAGE,
    areaServed: {
      '@type': 'Country',
      name: 'South Africa',
    },
  };
}

export function createFAQPageSchema(route, siteUrl, faqs) {
  return {
    '@type': 'FAQPage',
    '@id': `${absoluteUrl(siteUrl, routeCanonicalPath(route))}#faq`,
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function createRouteSchema(route, siteUrl) {
  const graph = [
    createOrganizationSchema(siteUrl),
    createWebSiteSchema(siteUrl),
    createWebPageSchema(route, siteUrl),
  ];

  graph.push(createBreadcrumbSchema(route, siteUrl));

  if (route.schema === 'service') {
    graph.push(createServiceSchema(route, siteUrl));
  }

  const faqs = faqsForRoute(route);
  if (faqs.length > 0) {
    graph.push(createFAQPageSchema(route, siteUrl, faqs));
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

/**
 * Minimal presentation for the prerendered static body. Deliberately NOT a
 * Tailwind replica — just enough that the pre-hydration flash reads as an
 * intentional document (system font, centered column) before React replaces it.
 */
// The `html.js #seo-static-body` rule hides this SEO snapshot from real
// (JS-enabled) visitors so it never paints before React mounts — index.html sets
// the `js` class in <head> before the body paints. Non-JS crawlers keep the `js`
// class unset and still see the snapshot, so SEO is unaffected.
const STATIC_BODY_STYLE = `<style>
        html.js #seo-static-body{display:none}
        #seo-static-body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:52rem;margin:0 auto;padding:2.5rem 1.25rem;color:#1f2937;line-height:1.6}
        #seo-static-body h1{font-size:2rem;line-height:1.2;margin:0.5rem 0 1rem}
        #seo-static-body h2{font-size:1.4rem;margin:2rem 0 0.75rem}
        #seo-static-body a{color:#4338ca}
        #seo-static-body nav ol{list-style:none;display:flex;flex-wrap:wrap;gap:0.35rem;padding:0;margin:0 0 1rem;font-size:0.85rem}
        #seo-static-body nav ol li+li::before{content:'›';margin-right:0.35rem;color:#9ca3af}
        #seo-static-body img{max-width:100%;height:auto;border-radius:0.5rem}
        #seo-static-body ul{padding-left:1.25rem}
        #seo-static-body .seo-brand{font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin:0}
      </style>`;

/**
 * Hides the static snapshot when the SPA fallback shell (which carries the
 * homepage prerender) is served for a different URL — e.g. an app route or a
 * just-published article the middleware falls through for.
 */
function staticBodyPathGuard(routePath) {
  return `<script id="seo-static-body-guard">(function(){var p=location.pathname.replace(/\\/+$/,'')||'/';if(p!==${JSON.stringify(routePath)}){var el=document.getElementById('seo-static-body');if(el){el.style.display='none';}}})();</script>`;
}

function breadcrumbNavHtml(route, siteUrl) {
  const crumbs = breadcrumbItemsForRoute(route, siteUrl);
  return `<nav aria-label="Breadcrumb">
              <ol>
${crumbs
  .map(
    (crumb) =>
      `                <li><a href="${escapeHtml(crumb.url)}">${escapeHtml(crumb.name)}</a></li>`,
  )
  .join('\n')}
              </ol>
            </nav>`;
}

function faqBlockHtml(route) {
  const faqs = faqsForRoute(route);
  if (!faqs.length) return '';
  return `<section aria-label="Frequently asked questions">
              <h2>Frequently Asked Questions</h2>
${faqs
  .map(
    (faq) => `              <h3>${escapeHtml(faq.question)}</h3>
              <p>${escapeHtml(faq.answer)}</p>`,
  )
  .join('\n')}
            </section>`;
}

/** First title segment: "Risk Management | Life & Disability Cover" → "Risk Management". */
function routePageName(route) {
  return stripTitleSuffix(route.title).split('|')[0].trim();
}

/** Internal links: home lists every service page; other pages link to the core pages. */
function internalLinksHtml(route, siteUrl) {
  if (route.schema === 'home') {
    const services = publicSeoRoutes.filter((r) => r.schema === 'service');
    return `<section aria-label="Our services">
              <h2>Our Services</h2>
              <ul>
${services
  .map(
    (svc) =>
      `                <li><a href="${escapeHtml(absoluteUrl(siteUrl, svc.path))}">${escapeHtml(
        routePageName(svc),
      )}</a> — ${escapeHtml(svc.description)}</li>`,
  )
  .join('\n')}
              </ul>
            </section>`;
  }

  const links = [
    ['/', 'Home'],
    ['/services', 'Our Services'],
    ['/contact', 'Contact Us'],
    ['/schedule-consultation', 'Schedule a Consultation'],
  ].filter(([linkPath]) => linkPath !== routeCanonicalPath(route));
  return `<nav aria-label="Explore Navigate Wealth">
              <ul>
${links
  .map(
    ([linkPath, label]) =>
      `                <li><a href="${escapeHtml(absoluteUrl(siteUrl, linkPath))}">${escapeHtml(label)}</a></li>`,
  )
  .join('\n')}
              </ul>
            </nav>`;
}

/**
 * Visible static snapshot for a marketing route, injected inside #root so
 * crawlers (including non-JS AI crawlers) see real content; React's
 * createRoot().render() replaces it on hydration.
 */
export function createStaticBodyHtml(route, siteUrl) {
  // First title segment only — "Risk Management | Life & Disability Cover"
  // makes a good <title> but a clumsy <h1>.
  const pageName = routePageName(route);
  const serviceLine = route.serviceType
    ? `<p><strong>${escapeHtml(route.serviceType)}</strong> advice for individuals and businesses across South Africa — independent, provider-agnostic and tailored to your goals.</p>`
    : '';

  return `
      <!-- static-body:start -->
      ${STATIC_BODY_STYLE}
      <main id="seo-static-body" data-seo-static-body="true" aria-label="${escapeHtml(pageName)}">
        <article>
            ${breadcrumbNavHtml(route, siteUrl)}
            <header>
              <p class="seo-brand">${escapeHtml(DEFAULT_BUSINESS_NAME)}</p>
              <h1>${escapeHtml(pageName)}</h1>
              <p>${escapeHtml(route.description)}</p>
            </header>
            ${serviceLine}
            ${faqBlockHtml(route)}
            ${internalLinksHtml(route, siteUrl)}
        </article>
      </main>
      ${staticBodyPathGuard(route.path)}
      <!-- static-body:end -->`;
}

/**
 * Visible static snapshot for an article route. `sanitizedBodyHtml` MUST
 * already be sanitized (dompurify in apply-static-seo.mjs) — this module stays
 * dependency-light and does not sanitize.
 */
export function createArticleStaticBodyHtml(route, siteUrl, sanitizedBodyHtml) {
  const article = route.article || {};
  const pageName = stripTitleSuffix(article.title || route.title);
  const authorName = article.author_name || 'Navigate Wealth Editorial Team';
  const publishedDate = formatStaticDate(article.published_at);
  const readingTime = article.reading_time_minutes
    ? ` · ${Number(article.reading_time_minutes)} min read`
    : '';
  const heroUrl = route.ogImage ? resolveImageUrl(siteUrl, route.ogImage) : '';
  const hero =
    heroUrl && !heroUrl.endsWith(DEFAULT_OG_IMAGE_PATH)
      ? `<img src="${escapeHtml(heroUrl)}" alt="${escapeHtml(pageName)}" loading="lazy" />`
      : '';
  const excerpt = article.excerpt || article.subtitle || '';

  return `
      <!-- static-body:start -->
      ${STATIC_BODY_STYLE}
      <main id="seo-static-body" data-seo-static-body="true" aria-label="${escapeHtml(pageName)}">
        <article>
            ${breadcrumbNavHtml(route, siteUrl)}
            <header>
              <p class="seo-brand">${escapeHtml(DEFAULT_BUSINESS_NAME)}</p>
              <h1>${escapeHtml(pageName)}</h1>
              <p>By ${escapeHtml(authorName)}${publishedDate ? ` · ${escapeHtml(publishedDate)}` : ''}${escapeHtml(readingTime)}</p>
              ${excerpt ? `<p><em>${escapeHtml(excerpt)}</em></p>` : ''}
            </header>
            ${hero}
            <div class="seo-article-body">
${sanitizedBodyHtml}
            </div>
            <p><a href="${escapeHtml(absoluteUrl(siteUrl, '/resources'))}">Browse more articles from Navigate Wealth</a></p>
        </article>
      </main>
      ${staticBodyPathGuard(route.path)}
      <!-- static-body:end -->`;
}

function formatStaticDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: DEFAULT_TIMEZONE,
  }).format(date);
}

export function stripTitleSuffix(title) {
  return String(title || DEFAULT_BUSINESS_NAME)
    .replace(/\s*\|\s*Navigate Wealth\s*$/i, '')
    .trim();
}

function breadcrumbItemsForRoute(route, siteUrl) {
  const items = [{ name: 'Home', url: siteUrl }];
  const canonicalPath = routeCanonicalPath(route);
  if (canonicalPath === '/') return items;

  let partial = '';
  for (const part of canonicalPath.split('/').filter(Boolean)) {
    partial += `/${part}`;
    items.push({
      name: part
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      url: absoluteUrl(siteUrl, partial),
    });
  }

  return items;
}

export function createArticleRoute(article, siteUrl) {
  const slug = typeof article?.slug === 'string' ? article.slug.trim() : '';
  if (!slug) return null;

  const path = `/resources/article/${encodeURIComponent(slug)}`;
  const canonicalOverride = resolveArticleCanonicalOverride(article, siteUrl);
  const title = buildArticleTitle(article.title);
  const description = clampSeoDescription(
    article.excerpt ||
      article.subtitle ||
      'Financial planning article from Navigate Wealth with insights on investments, retirement, tax, risk management, and estate planning.',
  );
  const image =
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    DEFAULT_OG_IMAGE_PATH;

  return {
    path,
    lastmod: article.updated_at || article.published_at || article.created_at,
    title,
    description,
    keywords: Array.isArray(article.tags) ? article.tags.join(', ') : '',
    ogType: 'article',
    ogImage: image,
    schema: 'article',
    article,
    // A duplicate that canonicalises to another page: emit the override canonical
    // and keep it out of the sitemap so Google consolidates on the survivor.
    ...(canonicalOverride ? { canonicalUrl: canonicalOverride, sitemap: false } : {}),
  };
}

export function createArticleSchema(route, siteUrl) {
  const article = route.article || {};
  const canonical = routeCanonicalUrl(route, siteUrl);
  const image = resolveImageUrl(siteUrl, route.ogImage);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganizationSchema(siteUrl),
      createWebSiteSchema(siteUrl),
      createBreadcrumbSchema(route, siteUrl),
      {
        '@type': 'Article',
        '@id': `${canonical}#article`,
        headline: article.title || route.title,
        description: route.description,
        image,
        inLanguage: DEFAULT_LANGUAGE,
        author: {
          '@type': 'Person',
          name: article.author_name || 'Navigate Wealth Editorial Team',
        },
        publisher: { '@id': `${siteUrl}/#organization` },
        ...(article.published_at ? { datePublished: article.published_at } : {}),
        ...(article.updated_at ? { dateModified: article.updated_at } : {}),
        mainEntityOfPage: canonical,
        url: canonical,
      },
    ],
  };
}
