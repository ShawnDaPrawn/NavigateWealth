/**
 * What the Navigator article page derives from an article: the same field
 * fallbacks, reading time, sanitising, canonical URL and JSON-LD as the live
 * page (ArticleDetailPage.tsx), plus what the "Article" board needs on top of
 * them — the table of contents, its dates written out, and which service page
 * an article's topic leads to.
 */
import DOMPurify from 'dompurify';
import { SITE_ORIGIN } from '@/utils/siteOrigin';
import { COMPANY } from '../../config/companyFacts';
import {
  createBreadcrumbSchema,
  createOrganizationSchema,
  createWebSiteSchema,
} from '../../components/seo/SEO';
import { buildArticleTitle } from '../../components/seo/seo-config';
import { knownArticleCanonicalUrl } from '../../components/seo/articleCanonical';
import {
  enhanceArticleHtml,
  estimateReadingTime,
  formatDate,
} from '../../components/pages/articleDetail/articleHelpers';
import type { ArticleDisplay } from '../../components/pages/articleDetail/articleTypes';

// ── Fields, resolved as the live page resolves them ─────────────────────────

export interface ArticleFacts {
  body: string;
  category: string;
  image: string;
  author: string;
  readingTime: number;
  /** "12 October 2026", as the board writes it; '' without a date. */
  published: string;
  /** Shown only when it differs from the published date, as on the live page. */
  updated: string;
  /** "7 views", or '' when the count is zero or missing. */
  views: string;
}

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

/** "12 October 2026". Empty for a missing or unreadable date. */
export function formatLongDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', LONG_DATE);
}

export function articleFacts(article: ArticleDisplay): ArticleFacts {
  const body = (article.body || article.content || '') as string;
  const published = formatLongDate(article.published_at);
  const updated = formatLongDate(article.updated_at);
  const count = article.view_count;
  return {
    body,
    category: article.category_name || article.category?.name || '',
    image:
      article.hero_image_url ||
      article.featured_image_url ||
      article.feature_image_url ||
      article.featured_image ||
      article.thumbnail_image_url ||
      '',
    author: article.author_name || 'Navigate Wealth',
    readingTime: article.reading_time_minutes || estimateReadingTime(body),
    published,
    updated: updated && updated !== published ? updated : '',
    views:
      count !== undefined && count > 0
        ? `${count.toLocaleString()} view${count !== 1 ? 's' : ''}`
        : '',
  };
}

/**
 * The by-line the print view carries, worded exactly as the live page's meta
 * row (which the live print scrapes): author, US-style date, reading time,
 * views.
 */
export function printMetaParts(article: ArticleDisplay, facts: ArticleFacts): string[] {
  return [
    facts.author,
    article.published_at ? formatDate(article.published_at) : '',
    `${facts.readingTime} min read`,
    facts.views,
  ].filter(Boolean);
}

// ── Title accent ─────────────────────────────────────────────────────────────

/**
 * The board sets the last words of its headline in the italic accent ("The
 * will you signed may *not be valid*"). A CMS headline carries no mark-up, so
 * the same treatment falls on its last three words (two for a short one,
 * none for three words or fewer). The heading's text is unchanged.
 */
export function splitTitleAccent(title: string): { lead: string; accent: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const take = words.length >= 6 ? 3 : words.length >= 4 ? 2 : 0;
  if (take === 0) return { lead: title.trim(), accent: '' };
  return {
    lead: words.slice(0, -take).join(' '),
    accent: words.slice(-take).join(' '),
  };
}

// ── Body ─────────────────────────────────────────────────────────────────────

export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface PreparedBody {
  html: string;
  toc: TocEntry[];
}

/**
 * The article body, made safe and shaped for the page.
 *
 * Sanitising and enhancement are the live page's own (DOMPurify's defaults,
 * then enhanceArticleHtml's lead paragraph, callouts and pull quotes). After
 * that, on the already-sanitised markup:
 *  - every h2 and h3 gets the id the live table of contents gives it
 *    (`toc-heading-<n>`, counting h2s and h3s in order) unless it has one, so
 *    a link to a section works in either design;
 *  - an h1 written into the body becomes an h2, keeping the page to one H1;
 *  - each table is wrapped so it scrolls inside the column on a phone.
 */
export function prepareArticleBody(body: string): PreparedBody {
  const enhanced = enhanceArticleHtml(DOMPurify.sanitize(body));
  const container = document.createElement('div');
  container.innerHTML = enhanced;

  container.querySelectorAll('h1').forEach((h1) => {
    const h2 = document.createElement('h2');
    for (const attr of Array.from(h1.attributes)) h2.setAttribute(attr.name, attr.value);
    while (h1.firstChild) h2.appendChild(h1.firstChild);
    h1.replaceWith(h2);
  });

  const toc: TocEntry[] = [];
  container.querySelectorAll('h2, h3').forEach((heading, index) => {
    if (!heading.id) heading.id = `toc-heading-${index}`;
    toc.push({
      id: heading.id,
      text: heading.textContent?.trim() || '',
      level: heading.tagName === 'H2' ? 2 : 3,
    });
  });

  container.querySelectorAll('table').forEach((table) => {
    const frame = document.createElement('div');
    frame.className = 'nwar-table';
    frame.setAttribute('role', 'region');
    frame.setAttribute('aria-label', 'Table');
    frame.tabIndex = 0;
    table.replaceWith(frame);
    frame.appendChild(table);
  });

  return { html: container.innerHTML, toc };
}

// ── SEO, exactly as the live page builds it ──────────────────────────────────

export function articleSeo(article: ArticleDisplay, facts: ArticleFacts) {
  // Canonical always uses the production origin (never window.location.origin,
  // which would emit preview-deployment canonicals).
  const selfUrl = `${SITE_ORIGIN}/resources/article/${article.slug}`;
  const canonicalUrl =
    article.seo_canonical_url || knownArticleCanonicalUrl(article.slug) || selfUrl;
  const isCanonicalDuplicate = canonicalUrl.replace(/\/+$/, '') !== selfUrl.replace(/\/+$/, '');
  const description = article.excerpt || article.subtitle || '';
  const structuredData: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      createOrganizationSchema(),
      createWebSiteSchema(),
      createBreadcrumbSchema([
        { name: 'Home', url: SITE_ORIGIN },
        { name: 'Resources', url: `${SITE_ORIGIN}/resources` },
        { name: article.title },
      ]),
      {
        '@type': 'Article',
        '@id': `${canonicalUrl}#article`,
        headline: article.title,
        description,
        ...(facts.image && { image: facts.image }),
        inLanguage: 'en-ZA',
        author: {
          '@type': 'Person',
          name: facts.author,
        },
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        ...(article.published_at && { datePublished: article.published_at }),
        ...(article.updated_at && { dateModified: article.updated_at }),
        mainEntityOfPage: canonicalUrl,
        url: canonicalUrl,
      },
    ],
  };
  return {
    title: buildArticleTitle(article.title),
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage: facts.image || undefined,
    robotsContent: isCanonicalDuplicate ? 'noindex, follow' : undefined,
    structuredData,
    articleMeta: {
      author: facts.author,
      publishedTime: article.published_at ?? undefined,
      modifiedTime: article.updated_at ?? undefined,
    },
  };
}

// ── Where an article's topic leads ───────────────────────────────────────────

/**
 * The board's call to action is written for its sample article (a will:
 * "Estate Planning", "Have your will reviewed…"). Here the article's category
 * picks the service page the second button opens, and what the heading offers
 * to review; anything unrecognised leads to Financial Planning.
 */
export interface ArticleTopic {
  /** The service page's name and route, as the Services page lists them. */
  label: string;
  path: string;
  /** What the heading offers to review; '' for the general wording. */
  subject: string;
}

const TOPICS: ReadonlyArray<ArticleTopic & { match: RegExp }> = [
  {
    match: /estate|will|trust|inherit/i,
    label: 'Estate Planning',
    path: '/estate-planning',
    subject: 'estate plan',
  },
  { match: /tax/i, label: 'Tax Planning', path: '/tax-planning', subject: 'tax position' },
  {
    match: /retire|pension|annuit/i,
    label: 'Retirement Planning',
    path: '/retirement-planning',
    subject: 'retirement savings',
  },
  { match: /medical|health/i, label: 'Medical Aid', path: '/medical-aid', subject: 'medical aid' },
  {
    match: /risk|insur|cover/i,
    label: 'Risk Management',
    path: '/risk-management',
    subject: 'cover',
  },
  {
    match: /employee|employer|business/i,
    label: 'Employee Benefits',
    path: '/employee-benefits',
    subject: 'employee benefits',
  },
  {
    match: /invest|market|econom|global|offshore/i,
    label: 'Investment Management',
    path: '/investment-management',
    subject: 'investments',
  },
];

const GENERAL: ArticleTopic = {
  label: 'Financial Planning',
  path: '/financial-planning',
  subject: '',
};

export function articleTopic(category: string): ArticleTopic {
  const hit = TOPICS.find((t) => t.match.test(category));
  return hit ? { label: hit.label, path: hit.path, subject: hit.subject } : GENERAL;
}

/** "Independent, founder-led advice · FSP 54606", from companyFacts. */
export const ADVICE_LINE = `Independent, founder-led advice · FSP ${COMPANY.fspNumber}`;

/** The live page's compliance disclaimer, word for word. */
export const DISCLAIMER =
  'This article is for informational purposes only and does not constitute financial, tax, or legal advice. Please consult a qualified financial adviser before making any investment decisions. Navigate Wealth is an authorised Financial Services Provider.';
