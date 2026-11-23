import fs from 'node:fs';
import path from 'node:path';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import {
  createArticleStaticBodyHtml,
  DEFAULT_SITE_URL,
  NEWSLETTER_PATH_PREFIX,
  clampSeoDescription,
  createArticleRoute,
  createNewsletterRoute,
  createStaticBodyHtml,
  createStaticSeoHead,
  escapeHtml,
  normalizeSiteUrl,
  publicSeoRoutes,
  requireArticles,
  resolveSiteVerificationToken,
  routeCanonicalUrl,
} from './seo-static-data.mjs';

const distDir = path.resolve('dist');
const baseIndexPath = path.join(distDir, 'index.html');
const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);

const DOMPurify = createDOMPurify(new JSDOM('').window);

/** Cap injected article HTML so huge articles don't bloat the prerendered page. */
const ARTICLE_BODY_MAX_CHARS = 60_000;

main().catch((err) => {
  console.error('Failed to apply static SEO:', err);
  process.exitCode = 1;
});

async function main() {
  if (!fs.existsSync(baseIndexPath)) {
    throw new Error('dist/index.html was not found. Run vite build before applying static SEO.');
  }

  const baseHtml = injectSiteVerification(fs.readFileSync(baseIndexPath, 'utf8'));
  const articleRoutes = await fetchPublishedArticleRoutes();
  const newsletterRoutes = await fetchPublishedNewsletterRoutes();
  const routes = dedupeRoutes([...publicSeoRoutes, ...articleRoutes, ...newsletterRoutes]).map(
    (route) => ({
      ...route,
      description: clampSeoDescription(route.description),
    }),
  );

  for (const route of routes) {
    const html = applySeoToHtml(baseHtml, route);
    const outPath = outputPathForRoute(route.path);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
  }

  const manifest = routes.map((route) => ({
    path: route.path,
    canonicalUrl: routeCanonicalUrl(route, siteUrl),
    title: route.title,
    sitemap: route.sitemap !== false,
  }));
  fs.writeFileSync(
    path.join(distDir, 'seo-routes.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  writeRouteManifest(routes);
  writeNotFoundHtml(baseIndexPath);

  console.log(`Applied static SEO head tags to ${routes.length} routes`);
}

function writeRouteManifest(routes) {
  const paths = new Set();
  for (const route of routes) {
    if (route.path) paths.add(route.path);
    const canonical = route.canonicalPath;
    if (canonical && canonical !== route.path) paths.add(canonical);
  }

  const slugsUnder = (prefix) =>
    [
      ...new Set(
        routes
          .filter((route) => route.path?.startsWith(prefix))
          .map((route) => {
            const encoded = route.path.slice(prefix.length);
            try {
              return decodeURIComponent(encoded);
            } catch {
              return encoded;
            }
          }),
      ),
    ].sort();

  // The edge middleware reads both slug lists: a slug in neither was published
  // after this build, and gets its share tags from the API instead (see
  // src/middleware/share-meta.ts).
  const edgeManifest = {
    generated: true,
    generatedAt: new Date().toISOString(),
    paths: [...paths].sort(),
    articleSlugs: slugsUnder('/resources/article/'),
    newsletterSlugs: slugsUnder(NEWSLETTER_PATH_PREFIX),
  };

  const json = `${JSON.stringify(edgeManifest, null, 2)}\n`;
  fs.writeFileSync(path.resolve('seo-route-manifest.json'), json, 'utf8');
  fs.writeFileSync(path.join(distDir, 'seo-route-manifest.json'), json, 'utf8');
}

function writeNotFoundHtml(baseIndexPath) {
  fs.copyFileSync(baseIndexPath, path.join(distDir, '404.html'));
}

/**
 * Injects the Google Search Console verification <meta> into the document head
 * so it is present on every prerendered route (and the SPA fallback shell).
 * No-op when no token is configured or when one is already present.
 */
function injectSiteVerification(html) {
  const token = resolveSiteVerificationToken();
  if (!token) return html;
  if (/<meta\s+name=["']google-site-verification["']/i.test(html)) return html;

  const tag = `<meta name="google-site-verification" content="${escapeHtml(token)}" />`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n      ${tag}`);
  }
  return html.replace(/<\/head>/i, `      ${tag}\n    </head>`);
}

function dedupeRoutes(routes) {
  const seen = new Set();
  const deduped = [];
  for (const route of routes) {
    if (!route?.path || seen.has(route.path)) continue;
    seen.add(route.path);
    deduped.push(route);
  }
  return deduped;
}

function outputPathForRoute(routePath) {
  if (routePath === '/') return baseIndexPath;

  const safeParts = routePath.replace(/^\/+/, '').split('/').filter(Boolean);

  return path.join(distDir, ...safeParts, 'index.html');
}

function applySeoToHtml(html, route) {
  const cleaned = removeExistingStaticSeo(html);
  const head = createStaticSeoHead(route, siteUrl);
  const withHead = cleaned.replace(/<\/head>/i, `${head}\n    </head>`);
  return applyStaticBody(withHead, route);
}

function removeExistingStaticSeo(html) {
  return html
    .replace(/\s*<!-- static-seo:start -->[\s\S]*?<!-- static-seo:end -->/g, '')
    .replace(/\s*<!-- static-body:start -->[\s\S]*?<!-- static-body:end -->/g, '')
    .replace(/\s*<title>[\s\S]*?<\/title>/i, '')
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']keywords["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/\s*<meta\s+property=["']article:[^"']+["'][^>]*>/gi, '')
    .replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/\s*<script\s+id=["']seo-structured-data["'][\s\S]*?<\/script>/gi, '');
}

/**
 * Sanitize admin-authored article HTML for static injection. Truncates at a
 * paragraph boundary first (sanitizing afterwards re-balances any tags the cut
 * left open), then strips scripts/styles/frames and event handlers.
 */
function sanitizeArticleBodyHtml(route) {
  let raw = String(route.article?.body || '');
  if (raw.length > ARTICLE_BODY_MAX_CHARS) {
    const cut = raw.lastIndexOf('</p>', ARTICLE_BODY_MAX_CHARS);
    raw = cut > 0 ? raw.slice(0, cut + '</p>'.length) : raw.slice(0, ARTICLE_BODY_MAX_CHARS);
    raw += `<p><em>Continue reading the full article below.</em></p>`;
    console.warn(`[static-seo] Truncated static body for ${route.path} (>60KB)`);
  }
  const safe = DOMPurify.sanitize(raw, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['srcset'],
  });
  return safe.replace(/<\/script/gi, '<\\/script');
}

/**
 * Inject the visible static snapshot INSIDE #root: crawlers (and non-JS
 * agents) get real content, and React 18's createRoot().render() replaces the
 * container's children on mount, so nothing double-renders after hydration.
 */
function applyStaticBody(html, route) {
  const body =
    route.schema === 'article'
      ? createArticleStaticBodyHtml(route, siteUrl, sanitizeArticleBodyHtml(route))
      : createStaticBodyHtml(route, siteUrl);
  if (/<div\s+id=["']root["']\s*>\s*<\/div>/i.test(html)) {
    return html.replace(
      /<div\s+id=["']root["']\s*>\s*<\/div>/i,
      `<div id="root">${body}\n      </div>`,
    );
  }

  // Fallback if the root div is ever restructured: place before the module
  // script so the content still ships (it will not be auto-replaced by React).
  return html.replace(/<script\s+type=["']module["']/i, `${body}\n      <script type="module"`);
}

async function fetchPublishedArticleRoutes() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'vpjmdsltwrnpefzcgdmz';
  const fnBase =
    process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    `https://${projectRef}.supabase.co/functions/v1/make-server-91ed8379`;

  const url = `${fnBase}/publications/articles?status=published&limit=1000`;
  try {
    const anonKey = readSupabaseAnonKey();
    const res = await fetchWithOptionalAuth(url, anonKey);
    if (!res.ok) {
      return onArticleFetchFailure(`HTTP ${res.status}`);
    }

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rows.map((row) => createArticleRoute(row, siteUrl)).filter(Boolean);
  } catch (e) {
    return onArticleFetchFailure(e?.message || String(e));
  }
}

/**
 * Decides how to handle a failed article fetch. In strict mode (see
 * requireArticles()) the build hard-fails so a transient outage cannot silently
 * ship a deploy with no prerendered article pages; otherwise it degrades to the
 * static public routes only.
 */
function onArticleFetchFailure(reason) {
  if (requireArticles()) {
    throw new Error(
      `[static-seo] Article fetch failed (${reason}) and SEO_REQUIRE_ARTICLES is in effect. ` +
        'Refusing to prerender without published article pages.',
    );
  }
  console.warn(`[static-seo] Skipping article pages (${reason})`);
  return [];
}

/**
 * Published newsletter issues, for their own prerendered head. Lenient on any
 * failure: an issue without a prerender still renders (it previews as the
 * home page, as every issue did before), and the edge middleware fills in its
 * share tags. That is not worth failing a deploy over.
 */
async function fetchPublishedNewsletterRoutes() {
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'vpjmdsltwrnpefzcgdmz';
  const fnBase =
    process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    `https://${projectRef}.supabase.co/functions/v1/make-server-91ed8379`;

  try {
    const res = await fetchWithOptionalAuth(
      `${fnBase}/newsletter-site/newsletters`,
      readSupabaseAnonKey(),
    );
    if (!res.ok) {
      console.warn(`[static-seo] Skipping newsletter pages (HTTP ${res.status})`);
      return [];
    }
    const json = await res.json();
    const rows = Array.isArray(json?.newsletters) ? json.newsletters : [];
    return rows.map((row) => createNewsletterRoute(row)).filter(Boolean);
  } catch (e) {
    console.warn(`[static-seo] Skipping newsletter pages (${e?.message || String(e)})`);
    return [];
  }
}

async function fetchWithOptionalAuth(url, anonKey) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (res.status !== 401 || !anonKey) return res;

  return fetch(url, {
    headers: {
      accept: 'application/json',
      Authorization: `Bearer ${anonKey}`,
    },
  });
}

function readSupabaseAnonKey() {
  const envKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (envKey && String(envKey).trim()) return String(envKey).trim();

  try {
    const src = fs.readFileSync(path.resolve('src/utils/supabase/info.tsx'), 'utf8');
    const match = src.match(/export\s+const\s+publicAnonKey\s*=\s*"([^"]+)"/);
    return match?.[1] ? match[1].trim() : null;
  } catch {
    return null;
  }
}
