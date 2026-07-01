import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_OG_IMAGE_HEIGHT,
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_SITE_URL,
  absoluteUrl,
  clampSeoDescription,
  createArticleRoute,
  createArticleSchema,
  createRouteSchema,
  createStaticBodyHtml,
  escapeHtml,
  normalizeSiteUrl,
  publicSeoRoutes,
  requireArticles,
  resolveImageUrl,
  resolveSiteVerificationToken,
  routeCanonicalPath,
} from './seo-static-data.mjs';

const distDir = path.resolve('dist');
const baseIndexPath = path.join(distDir, 'index.html');
const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);

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
  const routes = dedupeRoutes([...publicSeoRoutes, ...articleRoutes]).map((route) => ({
    ...route,
    description: clampSeoDescription(route.description),
  }));

  for (const route of routes) {
    const html = applySeoToHtml(baseHtml, route);
    const outPath = outputPathForRoute(route.path);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
  }

  const manifest = routes.map((route) => ({
    path: route.path,
    canonicalUrl: absoluteUrl(siteUrl, routeCanonicalPath(route)),
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

  const articleSlugs = [
    ...new Set(
      routes
        .filter((route) => route.path?.startsWith('/resources/article/'))
        .map((route) => {
          const encoded = route.path.replace('/resources/article/', '');
          try {
            return decodeURIComponent(encoded);
          } catch {
            return encoded;
          }
        }),
    ),
  ].sort();

  const edgeManifest = {
    generated: true,
    generatedAt: new Date().toISOString(),
    paths: [...paths].sort(),
    articleSlugs,
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
  const head = buildHead(route);
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

function buildHead(route) {
  const canonicalUrl = absoluteUrl(siteUrl, routeCanonicalPath(route));
  const ogImageUrl = resolveImageUrl(siteUrl, route.ogImage || DEFAULT_OG_IMAGE_PATH);
  const schema =
    route.schema === 'article'
      ? createArticleSchema(route, siteUrl)
      : createRouteSchema(route, siteUrl);
  const json = JSON.stringify(schema).replace(/<\/script/gi, '<\\/script');

  const keywordsTag = route.keywords
    ? `      <meta name="keywords" content="${escapeHtml(route.keywords)}" />\n`
    : '';

  return `
      <!-- static-seo:start -->
      <title>${escapeHtml(route.title)}</title>
      <meta name="description" content="${escapeHtml(route.description)}" />
      <meta name="robots" content="index, follow" />
${keywordsTag}      <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
      <meta property="og:title" content="${escapeHtml(route.title)}" />
      <meta property="og:description" content="${escapeHtml(route.description)}" />
      <meta property="og:type" content="${escapeHtml(route.ogType || 'website')}" />
      <meta property="og:site_name" content="Navigate Wealth" />
      <meta property="og:locale" content="en_ZA" />
      <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
      <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
${ogImageDimensionTags(ogImageUrl)}      <meta property="og:image:alt" content="${escapeHtml(route.title)}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(route.title)}" />
      <meta name="twitter:description" content="${escapeHtml(route.description)}" />
      <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
      <meta name="twitter:site" content="@NavigateWealthSA" />
      <script id="seo-structured-data" type="application/ld+json">${json}</script>
      <!-- static-seo:end -->`;
}

/**
 * Emit og:image:width/height only for our own OG asset — dimensions of
 * arbitrary page images (article heroes) are unknown at build time.
 */
function ogImageDimensionTags(ogImageUrl) {
  if (!ogImageUrl.endsWith(DEFAULT_OG_IMAGE_PATH)) return '';
  return (
    `      <meta property="og:image:width" content="${DEFAULT_OG_IMAGE_WIDTH}" />\n` +
    `      <meta property="og:image:height" content="${DEFAULT_OG_IMAGE_HEIGHT}" />\n`
  );
}

function applyStaticBody(html, route) {
  const body = createStaticBodyHtml(route, siteUrl);
  if (/<div\s+id=["']root["']\s*>\s*<\/div>/i.test(html)) {
    return html.replace(/(<div\s+id=["']root["']\s*>\s*<\/div>)/i, `$1${body}`);
  }

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
