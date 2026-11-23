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
const articleCanonicalOverrides = JSON.parse(
  fs.readFileSync(path.resolve('src/components/seo/article-canonical-overrides.json'), 'utf8'),
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
/**
 * The site's default share image: the redesign's ShareBrand board, 1200×630.
 * It must stay in step with BRAND_SHARE_IMAGE_PATH in
 * src/components/seo/shareImages.ts, which the SPA uses once it has loaded;
 * social crawlers read only this prerendered head.
 */
export const DEFAULT_OG_IMAGE_PATH = '/brand-assets/share/navigate-wealth.png';
/** Every image under this folder is a 1200×630 share image. */
export const SHARE_IMAGE_DIR = '/brand-assets/share/';
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
    shareTitle: 'Navigate Wealth | Independent Financial Advice in South Africa',
    shareDescription:
      'Financial planning, investments, retirement, risk, tax and estate planning from an independent, founder-led practice in Pretoria (FSP 54606).',
  },
  {
    path: '/services',
    lastmod: '2026-04-17',
    title: 'Financial Advice Services in South Africa | Navigate Wealth',
    description:
      'Wealth management services from Navigate Wealth: risk, retirement, investments, medical aid, estate planning, tax planning and employee benefits.',
    keywords:
      'financial services, wealth management, risk management, retirement planning, investment management, medical aid, estate planning, tax planning, employee benefits, South Africa',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Financial Advice Services | Navigate Wealth',
    shareDescription:
      'Independent advice on risk cover, retirement, investments, medical aid, tax, estate planning and employee benefits — compared across the providers we work with.',
    ogImage: '/brand-assets/share/services.png',
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
    shareTitle: 'Insights & Resources | Navigate Wealth',
    shareDescription:
      'Articles, market news and monthly newsletters on investing, retirement, tax and protecting your wealth in South Africa.',
    ogImage: '/brand-assets/share/resources.png',
  },
  {
    path: '/about',
    lastmod: '2026-10-16',
    title: 'About Navigate Wealth | Independent Financial Advisors',
    description:
      'About Navigate Wealth, an independent, founder-led financial advisory practice (FSP 54606). Read a note from our founder, Shawn Francisco.',
    keywords:
      'about navigate wealth, founder-led financial advice, Shawn Francisco, independent financial planning, South Africa wealth management',
    ogType: 'website',
    schema: 'about',
    shareTitle: 'About Navigate Wealth | Your Trusted Financial Partner',
    shareDescription:
      'An independent, founder-led practice that helps individuals and families build, protect and transfer wealth through financial planning and investment management.',
    ogImage: '/brand-assets/share/about.png',
  },
  {
    path: '/team',
    lastmod: '2026-10-16',
    title: 'Meet Our Founder, Shawn Francisco | Navigate Wealth',
    description:
      'Meet Shawn Francisco, founder of Navigate Wealth — an independent, founder-led financial advisory practice authorised by the FSCA (FSP 54606).',
    keywords:
      'Navigate Wealth founder, Shawn Francisco, founder-led financial advice, independent financial advisor, South Africa',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Meet Our Founder, Shawn Francisco | Navigate Wealth',
    shareDescription:
      'Navigate Wealth is a founder-led practice. Shawn Francisco founded the firm in 2024 and works with clients directly.',
    ogImage: '/brand-assets/share/team.png',
  },
  {
    path: '/contact',
    lastmod: '2026-10-16',
    title: 'Contact a Financial Advisor in Pretoria | Navigate Wealth',
    description:
      "Get in touch with Navigate Wealth for a free consultation. We're ready to help you plan your financial future.",
    keywords:
      'contact navigate wealth, financial advisor consultation, free consultation, South Africa financial planning',
    ogType: 'website',
    schema: 'contact',
    shareTitle: 'Contact Navigate Wealth | Financial Advisors in Pretoria',
    shareDescription:
      'Book a complimentary consultation — in person at our Pretoria office or online, in English or Afrikaans.',
    ogImage: '/brand-assets/share/contact.png',
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
    shareTitle: 'Book a Free Consultation | Navigate Wealth',
    shareDescription:
      'Book a complimentary session with an independent financial adviser, in person or online. Choose a time that works for you — no obligation.',
    ogImage: '/brand-assets/share/consultation.png',
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
    shareTitle: 'Book a Free Consultation | Navigate Wealth',
    shareDescription:
      'Book a complimentary session with an independent financial adviser, in person or online. Choose a time that works for you — no obligation.',
    ogImage: '/brand-assets/share/consultation.png',
  },
  {
    path: '/why-us',
    lastmod: '2026-10-16',
    title: 'Why Choose Navigate Wealth | Independent Financial Advisory',
    description:
      'Why choose Navigate Wealth: genuinely independent financial advice in South Africa, a personal founder-led approach, and long-term client relationships.',
    keywords:
      'why Navigate Wealth, independent financial advisor, founder-led financial advice, personalised financial advice, South Africa',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Why Choose Navigate Wealth?',
    shareDescription:
      "We're a truly independent practice: we work for you — not product providers, banks or shareholders. Your financial success is our only measure of success.",
    ogImage: '/brand-assets/share/why-us.png',
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
    ogImage: '/brand-assets/share/risk-management.png',
    shareTitle: 'Life Cover & Risk Management | Navigate Wealth',
    shareDescription:
      'Comprehensive risk cover for individuals and businesses. We search the market to find you the best protection at the right price — tailored to your life.',
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
    ogImage: '/brand-assets/share/retirement-planning.png',
    shareTitle: 'Retirement Planning in South Africa | Navigate Wealth',
    shareDescription:
      'Comprehensive retirement planning for individuals and businesses — from retirement annuities to pension funds, tailored to your goals.',
  },
  {
    path: '/investment-management',
    lastmod: '2026-07-01',
    title: 'Investment Management in South Africa | Navigate Wealth',
    description:
      'Professional investment management in South Africa. Unit trusts, tax-free savings, offshore investments & corporate fund solutions.',
    keywords:
      'investment management South Africa, unit trusts, tax free savings account, offshore investments, endowments, corporate investments, wealth management, Allan Gray, Sygnia, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Investment Management',
    ogImage: '/brand-assets/share/investment-management.png',
    shareTitle: 'Investment Management in South Africa | Navigate Wealth',
    shareDescription:
      "Expert investment management to build and preserve your wealth over time — with access to South Africa's leading fund managers.",
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
    ogImage: '/brand-assets/share/tax-planning.png',
    shareTitle: 'Tax Planning in South Africa | Navigate Wealth',
    shareDescription:
      'Expert tax planning strategies to minimise your tax burden and maximise your wealth — for individuals and businesses.',
  },
  {
    path: '/estate-planning',
    lastmod: '2026-07-01',
    title: 'Estate Planning | Wills & Trusts | Navigate Wealth',
    description:
      'Estate planning in South Africa — wills, trusts, succession planning, estate duty and business continuity, through our estate planning partners.',
    keywords:
      'estate planning South Africa, wills, trusts, succession planning, estate duty, inheritance, business succession, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Estate Planning',
    ogImage: '/brand-assets/share/estate-planning.png',
    shareTitle: 'Estate Planning, Wills & Trusts | Navigate Wealth',
    shareDescription:
      'Estate planning for individuals and businesses — wills, trusts, succession planning and business continuity, through our estate planning partners.',
  },
  {
    path: '/financial-planning',
    lastmod: '2026-07-01',
    title: 'Financial Planning | Wealth Strategy | Navigate Wealth',
    description:
      'Independent financial planning in South Africa. Strategies covering investments, retirement, tax, estate planning & debt management.',
    keywords:
      'financial planning South Africa, comprehensive financial plan, wealth strategy, retirement planning, investment strategy, tax planning, estate planning, debt management, Navigate Wealth',
    ogType: 'website',
    schema: 'service',
    serviceType: 'Financial Planning',
    ogImage: '/brand-assets/share/financial-planning.png',
    shareTitle: 'Independent Financial Planning | Navigate Wealth',
    shareDescription:
      'Financial planning that aligns your money with your life goals: personalised strategies covering investments, retirement, tax and estate planning.',
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
    ogImage: '/brand-assets/share/medical-aid.png',
    shareTitle: 'Independent Medical Aid Advice | Navigate Wealth',
    shareDescription:
      'Medical aid solutions so you and your family receive the right healthcare — tailored to your needs and budget, compared across leading schemes.',
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
    ogImage: '/brand-assets/share/employee-benefits.png',
    shareTitle: 'Employee Benefits for Businesses | Navigate Wealth',
    shareDescription:
      'Tailored employee benefits — from group risk cover and retirement funds to medical aid and wellness programmes.',
  },
  {
    path: '/get-quote',
    lastmod: '2026-03-01',
    title: 'Get a Free Quote | Navigate Wealth',
    description:
      'Request a free, no-obligation quote for insurance, investments, retirement or medical aid. We compare the providers we work with to find your fit.',
    keywords:
      'free financial quote, insurance quote South Africa, investment quote, retirement planning quote, medical aid quote, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Get a Free, Personalised Quote | Navigate Wealth',
    shareDescription:
      'Insurance, investments, retirement or medical aid: tell us what you need and we compare options across the providers we work with. Free, no obligation.',
    ogImage: '/brand-assets/share/get-quote.png',
  },
  {
    path: '/get-quote/medical-aid',
    lastmod: '2026-08-19',
    title: 'Medical Aid Quote | Navigate Wealth',
    description:
      'Compare medical aid quotes in South Africa. Independent advice on schemes, hospital plans and gap cover from Navigate Wealth.',
    keywords:
      'medical aid quote South Africa, hospital plan, gap cover, medical scheme comparison, Navigate Wealth',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Get a Medical Aid Quote | Navigate Wealth',
    shareDescription:
      'Independent advice on medical schemes, hospital plans and gap cover, compared across the schemes we work with. Free, no obligation.',
    ogImage: '/brand-assets/share/medical-aid.png',
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
    shareTitle: 'Financial Planning for Individuals | Navigate Wealth',
    shareDescription:
      "We help you make smart, confident financial decisions — whether you're starting out, growing your career, protecting your family, or planning for retirement.",
    ogImage: '/brand-assets/share/individuals.png',
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
    shareTitle: 'Financial Solutions for Businesses | Navigate Wealth',
    shareDescription:
      'Employee benefits, cash management, risk protection and tax optimisation — financial solutions that drive stability and growth for businesses of all sizes.',
    ogImage: '/brand-assets/share/businesses.png',
  },
  {
    path: '/solutions/advisers',
    lastmod: '2026-03-01',
    title: 'For Advisers | Succession Planning | Navigate Wealth',
    description:
      'Succession planning for South African financial advisers: practice valuation, practice sales, client transitions and legacy planning, from Navigate Wealth.',
    keywords:
      'financial adviser succession planning, practice valuation, sell financial advisory practice, client transitions, legacy planning, Navigate Wealth, South Africa',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Succession Planning for Advisers | Navigate Wealth',
    shareDescription:
      "Secure the future of your practice — practice valuation, practice sales and client transitions that preserve the relationships you've built.",
    ogImage: '/brand-assets/share/advisers.png',
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
    shareTitle: "Ask Vasco | Navigate Wealth's AI Financial Navigator",
    shareDescription:
      'Explore South African finance — retirement, tax, risk cover, investing and estate planning — with our AI financial navigator. No login required.',
    ogImage: '/brand-assets/share/ask-vasco.png',
  },
  {
    path: '/careers',
    lastmod: '2026-10-16',
    title: 'Careers in Financial Advice | Navigate Wealth',
    description:
      'Explore careers at Navigate Wealth, an independent, founder-led financial advisory practice helping South Africans achieve financial independence.',
    keywords:
      'Navigate Wealth careers, financial advisor jobs, wealth management careers, financial planning jobs South Africa, independent financial advisor vacancy',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Careers at Navigate Wealth',
    shareDescription:
      'Build your career in financial advisory at an independent, founder-led practice that combines modern technology with personalised service.',
    ogImage: '/brand-assets/share/careers.png',
  },
  {
    path: '/press',
    lastmod: '2026-03-01',
    title: 'Press & Media | Navigate Wealth',
    description:
      'Navigate Wealth press releases and company announcements. Request our media kit, with brand assets, founder photos and company information.',
    keywords:
      'Navigate Wealth press, press releases, company announcements, media kit, South Africa financial services news',
    ogType: 'website',
    schema: 'webpage',
    shareTitle: 'Press & Media | Navigate Wealth',
    shareDescription:
      'The latest announcements and company news from Navigate Wealth, an independent, founder-led financial advisory practice. Media kit on request.',
    ogImage: '/brand-assets/share/press.png',
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
    shareTitle: 'Legal & Compliance | Navigate Wealth',
    shareDescription:
      'Our privacy notice, terms, POPIA and PAIA manuals, FAIS disclosures and other regulatory documents, in one place.',
    ogImage: '/brand-assets/share/legal.png',
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
  const slug = typeof article?.slug === 'string' ? article.slug.trim() : '';
  if (!slug) return null;

  let raw = typeof article?.seo_canonical_url === 'string' ? article.seo_canonical_url.trim() : '';
  if (!raw) {
    const mapped = articleCanonicalOverrides[slug];
    if (typeof mapped === 'string' && mapped.trim()) {
      raw = /^https?:\/\//i.test(mapped.trim())
        ? mapped.trim()
        : absoluteUrl(siteUrl, mapped.trim());
    }
  }
  if (!raw) return null;

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

// ── Share cards (Open Graph and X) ──────────────────────────────────────────
//
// What WhatsApp, LinkedIn, Facebook, X, iMessage, Telegram and Slack show when
// a page is linked: a picture, a title, a line or two of description and the
// domain. None of them run JavaScript, so this prerendered head is all they
// ever see.
//
// It is deliberately NOT the search snippet. <title> and the meta description
// are cut to Google's budget (60 and 160 characters, ending in "…"); in a chat
// those read as a sentence chopped mid-word, which is how 147 of 194 article
// headlines looked on WhatsApp before this. A share card carries its own text:
// the whole headline, whole sentences, and a picture every app will display.

/** Longest share title kept whole. Article headlines run to ~120. */
export const SHARE_TITLE_MAX = 150;
/** WhatsApp shows about two lines of description; LinkedIn and Facebook a few more. */
export const SHARE_DESCRIPTION_MAX = 200;
/**
 * Supabase Storage's image endpoint, asked for the share size: 1200×630,
 * cropped to fill, re-encoded in the original format (`format=origin` stops
 * it answering WebP, which some apps will not preview). An article hero of
 * 100–380 KB comes back as a ~100 KB JPEG — under the ~300 KB at which
 * WhatsApp silently drops a preview picture. 190 of the 194 published heroes
 * are already 1200×630, so the crop changes nothing on them.
 */
export const SHARE_IMAGE_RENDER_QUERY =
  'width=1200&height=630&resize=cover&quality=80&format=origin';

const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/)object\/public\/([^?#]+)$/i;

const IMAGE_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Trim share text at a sentence end when one falls in the back half of the
 * budget, else at a word, so a card never ends mid-word.
 */
export function clampShareText(value, max) {
  const text = collapseWhitespace(stripHtml(value));
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! '),
  );
  if (sentenceEnd >= max * 0.5) return slice.slice(0, sentenceEnd + 1);
  return truncateAtWord(text, max);
}

/** The card's title: the route's own share title, else its <title>. */
export function shareTitleForRoute(route) {
  return clampShareText(route.shareTitle || route.title, SHARE_TITLE_MAX);
}

/** The card's description: the route's own share text, else its meta description. */
export function shareDescriptionForRoute(route) {
  return clampShareText(route.shareDescription || route.description, SHARE_DESCRIPTION_MAX);
}

function imageTypeFor(url) {
  const match = /\.([a-z0-9]+)$/i.exec(url.split(/[?#]/)[0]);
  return match ? IMAGE_TYPES[match[1].toLowerCase()] : undefined;
}

/**
 * The share picture for an og:image value: `{ url, type?, width?, height? }`.
 * Our own share images are 1200×630; a Supabase Storage picture (an article
 * hero) is sent through the image endpoint at that size; anything else is
 * used as given, without claiming dimensions we do not know.
 */
export function resolveShareImage(siteUrl, value) {
  const url = resolveImageUrl(siteUrl, value || DEFAULT_OG_IMAGE_PATH);
  const type = imageTypeFor(url);
  if (url.startsWith(`${siteUrl}${SHARE_IMAGE_DIR}`)) {
    return { url, type, width: DEFAULT_OG_IMAGE_WIDTH, height: DEFAULT_OG_IMAGE_HEIGHT };
  }
  const supabase = SUPABASE_PUBLIC_OBJECT.exec(url);
  if (supabase) {
    return {
      url: `${supabase[1]}render/image/public/${supabase[2]}?${SHARE_IMAGE_RENDER_QUERY}`,
      type,
      width: DEFAULT_OG_IMAGE_WIDTH,
      height: DEFAULT_OG_IMAGE_HEIGHT,
    };
  }
  return { url, type };
}

/**
 * The prerendered head for a route: search tags (title, description,
 * canonical, robots), the share card (og:*, article:*, twitter:*) and the
 * JSON-LD graph, between the static-seo markers the build and the edge
 * middleware both replace.
 */
export function createStaticSeoHead(route, siteUrl) {
  const canonicalUrl = routeCanonicalUrl(route, siteUrl);
  const shareTitle = shareTitleForRoute(route);
  const shareDescription = shareDescriptionForRoute(route);
  const image = resolveShareImage(siteUrl, route.ogImage);
  const schema =
    route.schema === 'article'
      ? createArticleSchema(route, siteUrl)
      : createRouteSchema(route, siteUrl);
  const json = JSON.stringify(schema).replace(/<\/script/gi, '<\\/script');
  const article = route.schema === 'article' ? route.article || {} : null;

  const tag = (attr, key, content) =>
    content ? `      <meta ${attr}="${key}" content="${escapeHtml(content)}" />\n` : '';

  return `
      <!-- static-seo:start -->
      <title>${escapeHtml(route.title)}</title>
      <meta name="description" content="${escapeHtml(route.description)}" />
      <meta name="robots" content="index, follow" />
${tag('name', 'keywords', route.keywords)}      <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
${tag('property', 'og:title', shareTitle)}${tag('property', 'og:description', shareDescription)}${tag(
    'property',
    'og:type',
    route.ogType || 'website',
  )}${tag('property', 'og:site_name', DEFAULT_BUSINESS_NAME)}${tag('property', 'og:locale', 'en_ZA')}${tag(
    'property',
    'og:url',
    canonicalUrl,
  )}${tag('property', 'og:image', image.url)}${tag('property', 'og:image:secure_url', image.url)}${tag(
    'property',
    'og:image:type',
    image.type,
  )}${tag('property', 'og:image:width', image.width && String(image.width))}${tag(
    'property',
    'og:image:height',
    image.height && String(image.height),
  )}${tag('property', 'og:image:alt', shareTitle)}${tag(
    'property',
    'article:published_time',
    article?.published_at,
  )}${tag('property', 'article:modified_time', article?.updated_at)}      <meta name="twitter:card" content="summary_large_image" />
${tag('name', 'twitter:title', shareTitle)}${tag('name', 'twitter:description', shareDescription)}${tag(
    'name',
    'twitter:image',
    image.url,
  )}${tag('name', 'twitter:image:alt', shareTitle)}      <meta name="twitter:site" content="@Navigate_ZA" />
      <script id="seo-structured-data" type="application/ld+json">${json}</script>
      <!-- static-seo:end -->`;
}

// ── Newsletter issues ───────────────────────────────────────────────────────

export const NEWSLETTER_PATH_PREFIX = '/resources/newsletter/';
/** Every issue shares the newsletter's own card; issues carry no picture of their own. */
export const NEWSLETTER_SHARE_IMAGE_PATH = '/brand-assets/share/newsletter.png';

/**
 * A prerendered route for a published newsletter issue (the public
 * /newsletter-site/newsletters payload). Before this, an issue's URL served
 * the home page's head, so a shared issue previewed as the home page.
 */
export function createNewsletterRoute(newsletter) {
  const slug = typeof newsletter?.slug === 'string' ? newsletter.slug.trim() : '';
  if (!slug) return null;

  const fullTitle = collapseWhitespace(newsletter.title) || 'Navigate Wealth Newsletter';
  // "Navigate Wealth | October 2026 | The Wealth Compass: …" — the brand
  // prefix costs the search title 18 characters it cannot spare.
  const headline = fullTitle.replace(/^Navigate Wealth\s*\|\s*/i, '') || fullTitle;
  const description =
    collapseWhitespace(newsletter.description) || 'The Navigate Wealth monthly newsletter.';
  const pdfUrl =
    typeof newsletter.pdfUrl === 'string' && /^https:\/\//i.test(newsletter.pdfUrl)
      ? newsletter.pdfUrl
      : '';

  return {
    path: `${NEWSLETTER_PATH_PREFIX}${encodeURIComponent(slug)}`,
    lastmod: newsletter.publishedAt,
    title: buildArticleTitle(headline),
    description: clampSeoDescription(description),
    shareTitle: fullTitle,
    shareDescription: description,
    heading: headline,
    ogType: 'website',
    ogImage: NEWSLETTER_SHARE_IMAGE_PATH,
    schema: 'webpage',
    // Not in sitemap.xml (generate-seo-files.mjs lists pages and articles).
    sitemap: false,
    ...(pdfUrl ? { pdfUrl } : {}),
  };
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
 *
 * The route is read from `data-seo-path` on the element rather than
 * interpolated into the script. That is what makes the snippet BYTE-IDENTICAL
 * across all 26 prerendered routes, which in turn is what lets
 * `script-src` carry ONE sha256 hash instead of 26 — and what stops a renamed
 * slug from silently invalidating a hash and taking `'unsafe-inline'` back.
 * See docs/archive/production-readiness-ledger-2026.md § CSP.
 */
export function staticBodyPathGuard() {
  return `<script id="seo-static-body-guard">(function(){var el=document.getElementById('seo-static-body');if(!el)return;var want=el.getAttribute('data-seo-path')||'/';var p=location.pathname.replace(/\\/+$/,'')||'/';if(p!==want){el.style.display='none';}})();</script>`;
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
  // makes a good <title> but a clumsy <h1>. A route whose title is not
  // page-name-first (a newsletter issue) names its heading.
  const pageName = route.heading || routePageName(route);
  const serviceLine = route.serviceType
    ? `<p><strong>${escapeHtml(route.serviceType)}</strong> advice for individuals and businesses across South Africa — independent, provider-agnostic and tailored to your goals.</p>`
    : '';

  return `
      <!-- static-body:start -->
      ${STATIC_BODY_STYLE}
      <main id="seo-static-body" data-seo-static-body="true" data-seo-path="${escapeHtml(route.path)}" aria-label="${escapeHtml(pageName)}">
        <article>
            ${breadcrumbNavHtml(route, siteUrl)}
            <header>
              <p class="seo-brand">${escapeHtml(DEFAULT_BUSINESS_NAME)}</p>
              <h1>${escapeHtml(pageName)}</h1>
              <p>${escapeHtml(route.description)}</p>
            </header>
            ${serviceLine}
            ${route.pdfUrl ? `<p><a href="${escapeHtml(route.pdfUrl)}">Read this newsletter (PDF)</a></p>` : ''}
            ${faqBlockHtml(route)}
            ${internalLinksHtml(route, siteUrl)}
        </article>
      </main>
      ${staticBodyPathGuard()}
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
      <main id="seo-static-body" data-seo-static-body="true" data-seo-path="${escapeHtml(route.path)}" aria-label="${escapeHtml(pageName)}">
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
      ${staticBodyPathGuard()}
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
  const summary =
    article.excerpt ||
    article.subtitle ||
    'Financial planning article from Navigate Wealth with insights on investments, retirement, tax, risk management, and estate planning.';
  const description = clampSeoDescription(summary);
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
    // The share card keeps the whole headline and excerpt (see "Share cards").
    shareTitle: collapseWhitespace(article.title) || title,
    shareDescription: summary,
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

// ── llms.txt (https://llmstxt.org) ──────────────────────────────────────────

export const ARTICLE_PATH_PREFIX = '/resources/article/';

/**
 * Cap on an article's excerpt in llms.txt. Wider than the 160-char SERP budget
 * meta descriptions use: that one exists for Google's snippet, and at 160 most
 * excerpts (median ~190 chars) were cut mid-sentence. 320 keeps nearly all of
 * them whole.
 */
export const LLMS_DESCRIPTION_MAX = 320;

/**
 * The opening sentence and the closing line of the "Important Disclosure" in
 * the site footer (src/site/layout/NavigatorFooter.tsx), quoted word for word
 * so a model summarising the site knows the status of what it read. A test
 * fails if the footer wording changes and this copy does not.
 */
export const LLMS_DISCLOSURE =
  'The information on this website is for general informational purposes only and does not constitute financial, investment, tax, legal, or other professional advice. For tailored advice, please contact us directly.';

/**
 * llms.txt sections, in output order. Each claims the sitemap routes its
 * predicate matches, first match wins. A route no section claims is listed
 * under "More pages", so a public route added later is never silently left
 * out of llms.txt.
 */
const LLMS_SECTIONS = [
  {
    heading: 'Services',
    includes: (route) => route.path === '/services' || route.schema === 'service',
  },
  { heading: 'Who we help', includes: (route) => route.path.startsWith('/solutions/') },
  {
    heading: 'Get advice or a quote',
    includes: (route) =>
      ['/contact', '/schedule-consultation', '/get-quote'].includes(route.path) ||
      route.path.startsWith('/get-quote/'),
  },
  {
    heading: 'About Navigate Wealth',
    includes: (route) =>
      ['/', '/about', '/team', '/why-us', '/careers', '/press', '/legal'].includes(route.path),
  },
  { heading: 'Resources', includes: (route) => ['/resources', '/ask-vasco'].includes(route.path) },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Render llms.txt: the business name, a one-line summary, the business facts,
 * then the site's indexable pages grouped by topic. Published articles go under
 * "Optional", the spec's marker for links a model may skip when its context is
 * short, newest first.
 *
 * Built from the same inputs as the sitemap (the sitemap-eligible
 * `publicSeoRoutes` plus the published articles), so the two list the same
 * pages; verify-seo-build.mjs fails the build if they drift.
 *
 * @param {string} siteUrl
 * @param {{
 *   routes?: Array<{ path: string, title: string, description: string, schema?: string, sitemap?: boolean }>,
 *   articles?: Array<{ path: string, title: string, description?: string, published?: string }>,
 * }} [options]
 */
export function createLlmsTxt(siteUrl, { routes = publicSeoRoutes, articles = [] } = {}) {
  const lines = [
    `# ${DEFAULT_BUSINESS_NAME}`,
    '',
    `> ${collapseWhitespace(organizationData.description)}`,
    '',
    ...llmsFactLines(siteUrl),
    '',
    LLMS_DISCLOSURE,
    '',
    `Every indexable page is also listed in the [sitemap](${siteUrl}/sitemap.xml). Articles from the Resources library are listed under Optional, newest first.`,
  ];

  const unclaimed = routes.filter((route) => route.sitemap !== false);
  const routeLink = (route) =>
    llmsLink(
      absoluteUrl(siteUrl, route.path),
      route.path === '/' ? 'Home' : routePageName(route),
      route.description,
    );

  const sections = LLMS_SECTIONS.map(({ heading, includes }) => {
    const claimed = unclaimed.filter(includes);
    for (const route of claimed) unclaimed.splice(unclaimed.indexOf(route), 1);
    return [heading, claimed.map(routeLink)];
  });
  sections.push(['More pages', unclaimed.map(routeLink)]);
  sections.push([
    'Optional',
    newestFirst(articles).map((article) =>
      llmsLink(
        absoluteUrl(siteUrl, article.path),
        article.title,
        [article.published ? `Published ${article.published}.` : '', article.description]
          .filter(Boolean)
          .join(' '),
      ),
    ),
  ]);

  for (const [heading, items] of sections) {
    if (items.length) lines.push('', `## ${heading}`, '', ...items);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Read the article entries back out of a previously generated llms.txt — the
 * inverse of the "Optional" section createLlmsTxt writes. The generator falls
 * back on it when the build-time article fetch fails, the way it falls back on
 * the article URLs already in sitemap.xml, so an offline build keeps each
 * article's title and excerpt instead of losing them.
 */
export function parseLlmsTxtArticles(text, siteUrl) {
  const optional = String(text ?? '').split(/^## Optional[ \t]*$/m)[1];
  if (!optional) return [];

  const entries = [];
  const section = optional.split(/^## /m)[0];
  for (const match of section.matchAll(
    /^- \[((?:\\.|[^\\\]])*)\]\(([^)\s]+)\)(?::[ \t]*(.*))?$/gm,
  )) {
    const [, rawTitle, href, notes = ''] = match;
    if (!href.startsWith(`${siteUrl}${ARTICLE_PATH_PREFIX}`)) continue;

    const dated = notes.match(/^Published (\d{4}-\d{2}-\d{2})\.[ \t]*(.*)$/);
    entries.push({
      path: decodeLlmsHref(href.slice(siteUrl.length)),
      title: rawTitle.replace(/\\(.)/g, '$1'),
      published: dated ? dated[1] : '',
      description: dated ? dated[2] : notes,
    });
  }
  return entries;
}

/** "Published" dates are YYYY-MM-DD, so they sort as strings; undated last. */
function newestFirst(articles) {
  return [...articles].sort((a, b) =>
    String(b.published || '').localeCompare(String(a.published || '')),
  );
}

/**
 * One llms.txt list item: `- [name](url): notes`. Square brackets in the name
 * are escaped and parentheses in the URL percent-encoded, so neither can end
 * the Markdown link early. encodeURIComponent leaves parentheses literal,
 * which is why a slug can carry them.
 */
function llmsLink(url, name, notes) {
  const text = collapseWhitespace(name).replace(/[\\[\]]/g, '\\$&');
  const href = url.replace(/\(/g, '%28').replace(/\)/g, '%29');
  const detail = collapseWhitespace(notes);
  return `- [${text}](${href})${detail ? `: ${detail}` : ''}`;
}

function decodeLlmsHref(href) {
  return href.replace(/%28/gi, '(').replace(/%29/gi, ')');
}

/** The business facts block, every value read from organization.json. */
function llmsFactLines(siteUrl) {
  const org = organizationData;
  const address = org.address || {};
  const facts = [
    ['Legal name', org.legalName],
    ['Website', siteUrl],
    ['Founder', org.founder?.name],
    ['Founded', org.foundingDate],
    [
      'Office',
      [
        address.streetAddress,
        address.addressLocality,
        address.addressRegion,
        address.postalCode,
        countryName(address.addressCountry),
      ]
        .filter(Boolean)
        .join(', '),
    ],
    ['Telephone', org.telephone],
    ['Email', org.email],
    ['Office hours', formatOpeningHours(org.openingHoursSpecification)],
    ['Languages', [].concat(org.availableLanguage || []).join(', ')],
    ['Area served', org.areaServed?.name],
    ['Advice areas', [].concat(org.knowsAbout || []).join(', ')],
    ['Social profiles', [].concat(org.sameAs || []).join(', ')],
  ];
  return facts.filter(([, value]) => value).map(([label, value]) => `- ${label}: ${value}`);
}

function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

/** "Monday to Friday, 08:30 to 16:30 (South African Standard Time)". */
function formatOpeningHours(specs) {
  const parts = [].concat(specs || []).map((spec) => {
    const days = [].concat(spec.dayOfWeek || []);
    return `${formatDays(days)}, ${spec.opens} to ${spec.closes}`;
  });
  return parts.length ? `${parts.join('; ')} (South African Standard Time)` : '';
}

/** A run of three or more consecutive weekdays reads as a range. */
function formatDays(days) {
  const index = days.map((day) => WEEKDAYS.indexOf(day));
  const isRun =
    days.length > 2 &&
    index.every((value, i) => value >= 0 && (i === 0 || value === index[i - 1] + 1));
  return isRun ? `${days[0]} to ${days[days.length - 1]}` : days.join(', ');
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
