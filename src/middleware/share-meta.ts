/**
 * Share tags at the edge, for an article or newsletter issue published after
 * the last build.
 *
 * WHY
 * ---
 * Link previews (WhatsApp, LinkedIn, Facebook, X, iMessage, Telegram, Slack)
 * read only the HTML head; none runs JavaScript. The build prerenders a head
 * for every article and issue that existed when it ran
 * (scripts/seo/apply-static-seo.mjs). Anything published since is answered
 * with the SPA shell, whose head is the HOME page's, so a brand-new article
 * shared on WhatsApp previewed as the home page. Publishing through the
 * content pipeline does not trigger a rebuild, so that window can last until
 * the next merge to main.
 *
 * WHAT
 * ----
 * For a link-preview fetcher (or search crawler) asking for such a slug, the
 * middleware reads the item from the public API, writes its share tags into
 * the shell's static-seo block, and answers that. People in browsers are left
 * alone: the SPA sets their tags once it loads, and they never wait on the
 * extra API call. Anything that fails (timeout, 404, a shell without the
 * markers) falls back to exactly what was served before.
 *
 * The tags must match what the build would have written for the same item.
 * This module cannot import the build's plain-JS module, so it carries a port
 * of the few helpers it needs; src/__tests__/share-meta-parity.test.ts fails
 * if the two ever produce different tags.
 */
import type { SeoRouteManifest } from './route-policy';
import { normalizePathname } from './route-policy';

/** The canonical origin, as DEFAULT_SITE_URL in scripts/seo/seo-static-data.mjs. */
export const SITE_URL = 'https://www.navigatewealth.co';

/** The deployed Edge Function (public, as in vercel.json's rewrites). */
export const FUNCTIONS_BASE_URL =
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379';

const ARTICLE_PREFIX = '/resources/article/';
const NEWSLETTER_PREFIX = '/resources/newsletter/';

/** Mirrors the build's share constants (seo-static-data.mjs, "Share cards"). */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;
export const SHARE_TITLE_MAX = 150;
export const SHARE_DESCRIPTION_MAX = 200;
export const SHARE_IMAGE_RENDER_QUERY =
  'width=1200&height=630&resize=cover&quality=80&format=origin';
export const DEFAULT_SHARE_IMAGE_PATH = '/brand-assets/share/navigate-wealth.png';
export const NEWSLETTER_SHARE_IMAGE_PATH = '/brand-assets/share/newsletter.png';
const SHARE_IMAGE_DIR = '/brand-assets/share/';
const TITLE_SUFFIX = ' | Navigate Wealth';
const BUSINESS_NAME = 'Navigate Wealth';
const DEFAULT_ARTICLE_SUMMARY =
  'Financial planning article from Navigate Wealth with insights on investments, retirement, tax, risk management, and estate planning.';

/** Give up on the API after this long and serve the plain shell. */
export const SHARE_FETCH_TIMEOUT_MS = 3000;

export interface ShareTarget {
  kind: 'article' | 'newsletter';
  slug: string;
  /** The request's path, decoded and without a trailing slash. */
  path: string;
}

export interface ShareImage {
  url: string;
  type?: string;
  width?: number;
  height?: number;
}

export interface ShareMeta {
  /** Path on the site (slug URI-encoded, as the build writes it). */
  path: string;
  canonicalUrl: string;
  /** Search <title> and meta description, at the SERP budget. */
  title: string;
  description: string;
  /** The card's own text: whole headline, whole sentences. */
  shareTitle: string;
  shareDescription: string;
  /** The page's H1 in the static snapshot. */
  heading: string;
  image: ShareImage;
  ogType: 'article' | 'website';
  publishedTime?: string;
  modifiedTime?: string;
}

// ── Which requests ──────────────────────────────────────────────────────────

/**
 * An article or issue slug the build did not prerender, or null. Only
 * meaningful once a build has written the manifest.
 */
export function pendingShareTarget(
  pathname: string,
  manifest: SeoRouteManifest,
): ShareTarget | null {
  if (!manifest.generated) return null;
  const path = normalizePathname(pathname);

  for (const [kind, prefix, known] of [
    ['article', ARTICLE_PREFIX, manifest.articleSlugs],
    ['newsletter', NEWSLETTER_PREFIX, manifest.newsletterSlugs ?? []],
  ] as const) {
    if (!path.startsWith(prefix)) continue;
    const slug = path.slice(prefix.length);
    if (!slug || slug.includes('/')) return null;
    return known.includes(slug) ? null : { kind, slug, path };
  }
  return null;
}

/**
 * Link-preview fetchers and crawlers, which read the head without running the
 * page. Browsers are excluded on purpose: they get the SPA, which sets its
 * own tags, and should never wait on the API. iMessage announces itself as
 * "facebookexternalhit … Twitterbot"; a request with no user agent at all is
 * treated as a fetcher.
 */
const PREVIEW_AGENT =
  /bot\b|bot\/|crawler|spider|preview|facebookexternalhit|facebot|whatsapp|telegram|slack|discord|linkedin|skype|teams|pinterest|embedly|iframely|vkshare|viber|snapchat|signal|mastodon|bluesky|google-|googleother|bingpreview|outlook|microsoft office|curl\/|wget\/|python|okhttp|go-http-client|node-fetch|undici|axios|java\/|libwww|httpclient|headless/i;

export function isLinkPreviewAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  return ua === '' || PREVIEW_AGENT.test(ua);
}

// ── Text (ports of the build's helpers) ─────────────────────────────────────

function collapseWhitespace(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value: unknown): string {
  return String(value ?? '').replace(/<[^>]*>/g, ' ');
}

function truncateAtWord(value: string, max: number): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.replace(/[\s.,;:!?–—-]+$/, '')}…`;
}

export function clampSeoDescription(value: unknown, max = SEO_DESCRIPTION_MAX): string {
  const text = collapseWhitespace(stripHtml(value));
  return text.length <= max ? text : truncateAtWord(text, max);
}

export function buildArticleTitle(rawHeadline: unknown): string {
  const headline = collapseWhitespace(rawHeadline) || 'Financial Planning Article';
  const withSuffix = `${headline}${TITLE_SUFFIX}`;
  if (withSuffix.length <= SEO_TITLE_MAX) return withSuffix;
  if (headline.length <= SEO_TITLE_MAX) return headline;
  return truncateAtWord(headline, SEO_TITLE_MAX);
}

export function clampShareText(value: unknown, max: number): string {
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

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Images ──────────────────────────────────────────────────────────────────

const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/)object\/public\/([^?#]+)$/i;

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function imageTypeFor(url: string): string | undefined {
  const match = /\.([a-z0-9]+)$/i.exec(url.split(/[?#]/)[0]);
  return match ? IMAGE_TYPES[match[1].toLowerCase()] : undefined;
}

/** As resolveShareImage in seo-static-data.mjs. */
export function resolveShareImage(
  value: string | null | undefined,
  siteUrl = SITE_URL,
): ShareImage {
  const raw = value || DEFAULT_SHARE_IMAGE_PATH;
  const url = /^https?:\/\//i.test(raw)
    ? raw
    : `${siteUrl}${raw.startsWith('/') ? raw : `/${raw}`}`;
  const type = imageTypeFor(url);
  if (url.startsWith(`${siteUrl}${SHARE_IMAGE_DIR}`)) {
    return { url, type, width: 1200, height: 630 };
  }
  const supabase = SUPABASE_PUBLIC_OBJECT.exec(url);
  if (supabase) {
    return {
      url: `${supabase[1]}render/image/public/${supabase[2]}?${SHARE_IMAGE_RENDER_QUERY}`,
      type,
      width: 1200,
      height: 630,
    };
  }
  return { url, type };
}

// ── From the API's records ──────────────────────────────────────────────────

/** The public article record (toPublicArticle), as far as share tags need it. */
export interface PublicArticle {
  slug?: string;
  title?: string;
  excerpt?: string;
  subtitle?: string;
  hero_image_url?: string;
  featured_image_url?: string;
  feature_image_url?: string;
  featured_image?: string;
  thumbnail_image_url?: string;
  published_at?: string;
  updated_at?: string;
  seo_canonical_url?: string;
}

/** The public newsletter record (PublishedNewsletter). */
export interface PublicNewsletter {
  slug?: string;
  title?: string;
  description?: string;
  publishedAt?: string;
}

function canonicalFor(path: string, override: unknown, siteUrl: string): string {
  const raw = typeof override === 'string' ? override.trim() : '';
  return /^https?:\/\//i.test(raw) ? raw : `${siteUrl}${path}`;
}

/** As createArticleRoute + createStaticSeoHead in the build. */
export function articleShareMeta(article: PublicArticle, siteUrl = SITE_URL): ShareMeta | null {
  const slug = typeof article?.slug === 'string' ? article.slug.trim() : '';
  if (!slug) return null;

  const path = `${ARTICLE_PREFIX}${encodeURIComponent(slug)}`;
  const title = buildArticleTitle(article.title);
  const summary = article.excerpt || article.subtitle || DEFAULT_ARTICLE_SUMMARY;
  const image =
    article.hero_image_url ||
    article.featured_image_url ||
    article.feature_image_url ||
    article.featured_image ||
    article.thumbnail_image_url ||
    DEFAULT_SHARE_IMAGE_PATH;
  const shareTitle = clampShareText(collapseWhitespace(article.title) || title, SHARE_TITLE_MAX);

  return {
    path,
    canonicalUrl: canonicalFor(path, article.seo_canonical_url, siteUrl),
    title,
    description: clampSeoDescription(summary),
    shareTitle,
    shareDescription: clampShareText(summary, SHARE_DESCRIPTION_MAX),
    heading: collapseWhitespace(article.title) || title,
    image: resolveShareImage(image, siteUrl),
    ogType: 'article',
    publishedTime: article.published_at || undefined,
    modifiedTime: article.updated_at || undefined,
  };
}

/** As createNewsletterRoute + createStaticSeoHead in the build. */
export function newsletterShareMeta(
  newsletter: PublicNewsletter,
  siteUrl = SITE_URL,
): ShareMeta | null {
  const slug = typeof newsletter?.slug === 'string' ? newsletter.slug.trim() : '';
  if (!slug) return null;

  const path = `${NEWSLETTER_PREFIX}${encodeURIComponent(slug)}`;
  const fullTitle = collapseWhitespace(newsletter.title) || 'Navigate Wealth Newsletter';
  const headline = fullTitle.replace(/^Navigate Wealth\s*\|\s*/i, '') || fullTitle;
  const description =
    collapseWhitespace(newsletter.description) || 'The Navigate Wealth monthly newsletter.';

  return {
    path,
    canonicalUrl: `${siteUrl}${path}`,
    title: buildArticleTitle(headline),
    description: clampSeoDescription(description),
    shareTitle: clampShareText(fullTitle, SHARE_TITLE_MAX),
    shareDescription: clampShareText(description, SHARE_DESCRIPTION_MAX),
    heading: headline,
    image: resolveShareImage(NEWSLETTER_SHARE_IMAGE_PATH, siteUrl),
    ogType: 'website',
  };
}

// ── HTML ────────────────────────────────────────────────────────────────────

/** The static-seo block: the same tags, in the same order, as the build's. */
export function shareHeadHtml(meta: ShareMeta): string {
  const tag = (attr: string, key: string, content: string | number | undefined) =>
    content ? `      <meta ${attr}="${key}" content="${escapeHtml(content)}" />\n` : '';

  return `
      <!-- static-seo:start -->
      <title>${escapeHtml(meta.title)}</title>
      <meta name="description" content="${escapeHtml(meta.description)}" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" />
${tag('property', 'og:title', meta.shareTitle)}${tag('property', 'og:description', meta.shareDescription)}${tag('property', 'og:type', meta.ogType)}${tag('property', 'og:site_name', BUSINESS_NAME)}${tag('property', 'og:locale', 'en_ZA')}${tag('property', 'og:url', meta.canonicalUrl)}${tag('property', 'og:image', meta.image.url)}${tag('property', 'og:image:secure_url', meta.image.url)}${tag('property', 'og:image:type', meta.image.type)}${tag('property', 'og:image:width', meta.image.width)}${tag('property', 'og:image:height', meta.image.height)}${tag('property', 'og:image:alt', meta.shareTitle)}${tag('property', 'article:published_time', meta.publishedTime)}${tag('property', 'article:modified_time', meta.modifiedTime)}      <meta name="twitter:card" content="summary_large_image" />
${tag('name', 'twitter:title', meta.shareTitle)}${tag('name', 'twitter:description', meta.shareDescription)}${tag('name', 'twitter:image', meta.image.url)}${tag('name', 'twitter:image:alt', meta.shareTitle)}      <meta name="twitter:site" content="@Navigate_ZA" />
      <!-- static-seo:end -->`;
}

/**
 * A small visible snapshot in place of the home page's: the heading, the
 * summary and the picture. No script, so the CSP hashes are untouched.
 */
export function shareBodyHtml(meta: ShareMeta, siteUrl = SITE_URL): string {
  const image = meta.image.url.includes(SHARE_IMAGE_DIR)
    ? ''
    : `\n          <img src="${escapeHtml(meta.image.url)}" alt="${escapeHtml(meta.heading)}" />`;
  return `
      <!-- static-body:start -->
      <style>html.js #seo-static-body{display:none}#seo-static-body{font-family:system-ui,sans-serif;max-width:52rem;margin:0 auto;padding:2.5rem 1.25rem;color:#1f2937;line-height:1.6}#seo-static-body img{max-width:100%;height:auto}</style>
      <main id="seo-static-body" data-seo-static-body="true" data-seo-path="${escapeHtml(meta.path)}" aria-label="${escapeHtml(meta.heading)}">
        <article>
          <p>${BUSINESS_NAME}</p>
          <h1>${escapeHtml(meta.heading)}</h1>
          <p>${escapeHtml(meta.shareDescription)}</p>${image}
          <p><a href="${escapeHtml(`${siteUrl}/resources`)}">Browse more from ${BUSINESS_NAME}</a></p>
        </article>
      </main>
      <!-- static-body:end -->`;
}

const SEO_BLOCK = /\s*<!-- static-seo:start -->[\s\S]*?<!-- static-seo:end -->/;
const BODY_BLOCK = /\s*<!-- static-body:start -->[\s\S]*?<!-- static-body:end -->/;

/**
 * The shell with its home-page head and snapshot swapped for `meta`'s, or
 * null when the shell does not carry the build's markers.
 */
export function injectShareMeta(shellHtml: string, meta: ShareMeta): string | null {
  if (!SEO_BLOCK.test(shellHtml) || !BODY_BLOCK.test(shellHtml)) return null;
  return shellHtml
    .replace(SEO_BLOCK, () => shareHeadHtml(meta))
    .replace(BODY_BLOCK, () => shareBodyHtml(meta));
}

// ── The request ─────────────────────────────────────────────────────────────

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

function apiUrl(target: ShareTarget): string {
  const slug = encodeURIComponent(target.slug);
  return target.kind === 'article'
    ? `${FUNCTIONS_BASE_URL}/publications/articles/slug/${slug}`
    : `${FUNCTIONS_BASE_URL}/newsletter-site/newsletters/${slug}`;
}

async function readMeta(
  target: ShareTarget,
  fetchImpl: Fetch,
  signal: AbortSignal,
): Promise<ShareMeta | null> {
  const res = await fetchImpl(apiUrl(target), { headers: { accept: 'application/json' }, signal });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: PublicArticle; newsletter?: PublicNewsletter };
  return target.kind === 'article'
    ? json.data
      ? articleShareMeta(json.data)
      : null
    : json.newsletter
      ? newsletterShareMeta(json.newsletter)
      : null;
}

async function readShell(request: Request, fetchImpl: Fetch, signal: AbortSignal) {
  const res = await fetchImpl(new URL('/index.html', request.url), { signal });
  return res.ok ? res.text() : null;
}

/**
 * The shell with `target`'s share tags, or undefined to let the request
 * continue exactly as it would have without this module.
 */
export async function renderPendingShare(
  request: Request,
  target: ShareTarget,
  fetchImpl: Fetch = fetch,
  timeoutMs = SHARE_FETCH_TIMEOUT_MS,
): Promise<Response | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [meta, shell] = await Promise.all([
      readMeta(target, fetchImpl, controller.signal),
      readShell(request, fetchImpl, controller.signal),
    ]);
    if (!meta || !shell) return undefined;
    const html = injectShareMeta(shell, meta);
    if (!html) return undefined;
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        // Browsers asking for the same URL get the plain shell.
        vary: 'User-Agent',
        'x-nw-share-meta': target.kind,
      },
    });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
