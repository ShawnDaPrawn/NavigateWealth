import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_OG_IMAGE_PATH,
  DEFAULT_SITE_URL,
  SEO_TITLE_MAX,
  absoluteUrl,
  disallowPaths,
  faqsForRoute,
  normalizeSiteUrl,
  publicSeoRoutes,
  requireArticles,
  resolveSiteVerificationToken,
} from './seo-static-data.mjs';

const siteUrl = normalizeSiteUrl(
  process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL,
);
const distDir = path.resolve('dist');
const failures = [];

verifyRobots();
verifySitemap();
verifyStaticHtml();
verifyArticlesPrerendered();
verifySiteVerification();
verifyEdgeNotFound();

if (failures.length) {
  console.error('SEO verification failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('SEO verification passed');

function verifyRobots() {
  const robotsPath = path.resolve('public/robots.txt');
  if (!fs.existsSync(robotsPath)) {
    failures.push('public/robots.txt is missing');
    return;
  }

  const robots = fs.readFileSync(robotsPath, 'utf8');
  if (!/^Allow:\s*\/\s*$/im.test(robots)) {
    failures.push('robots.txt does not explicitly allow public crawling');
  }
  if (/^Disallow:\s*\/\s*$/im.test(robots)) {
    failures.push('robots.txt blocks the entire site with Disallow: /');
  }
  if (!robots.includes(`Sitemap: ${siteUrl}/sitemap.xml`)) {
    failures.push('robots.txt does not reference the canonical sitemap URL');
  }
}

function verifySitemap() {
  const sitemapPath = path.resolve('public/sitemap.xml');
  if (!fs.existsSync(sitemapPath)) {
    failures.push('public/sitemap.xml is missing');
    return;
  }

  const sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => decodeXml(match[1]));
  if (!urls.length) {
    failures.push('sitemap.xml contains no URLs');
    return;
  }
  if (
    !/xmlns:image=["']http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1["']/.test(sitemap)
  ) {
    failures.push('sitemap.xml is missing the image sitemap namespace');
  }

  const disallowedPrefixes = disallowPaths
    .filter((routePath) => routePath !== '/')
    .map((routePath) => absoluteUrl(siteUrl, routePath.replace(/\/$/, '')));

  for (const url of urls) {
    if (!url.startsWith(siteUrl)) {
      failures.push(`sitemap URL is not canonical: ${url}`);
    }
    const isDisallowed = disallowedPrefixes.some(
      (prefix) => url === prefix || url.startsWith(`${prefix}/`),
    );
    if (isDisallowed) {
      failures.push(`sitemap URL is disallowed by robots.txt: ${url}`);
    }
  }
}

function verifyStaticHtml() {
  const manifestPath = path.join(distDir, 'seo-routes.json');
  if (!fs.existsSync(manifestPath)) {
    failures.push('dist/seo-routes.json is missing; static SEO was not applied');
    return;
  }

  const routes = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const route of routes) {
    const htmlPath = outputPathForRoute(route.path);
    if (!fs.existsSync(htmlPath)) {
      failures.push(`static route HTML is missing for ${route.path}`);
      continue;
    }

    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!/<title>[^<]+<\/title>/i.test(html)) {
      failures.push(`${route.path} is missing an initial title tag`);
    }
    if (!/<meta\s+name=["']description["']\s+content=["'][^"']+["']\s*\/?>/i.test(html)) {
      failures.push(`${route.path} is missing an initial meta description`);
    }
    if (!/<meta\s+name=["']robots["']\s+content=["']index,\s*follow["']\s*\/?>/i.test(html)) {
      failures.push(`${route.path} is missing an indexable robots meta tag`);
    }
    if (!html.includes(`rel="canonical" href="${route.canonicalUrl}"`)) {
      failures.push(`${route.path} is missing the expected canonical URL`);
    }
    if (!/<meta\s+property=["']og:title["']\s+content=["'][^"']+["']\s*\/?>/i.test(html)) {
      failures.push(`${route.path} is missing initial Open Graph title metadata`);
    }
    if (
      html.includes(`content="${siteUrl}${DEFAULT_OG_IMAGE_PATH}"`) &&
      !/<meta\s+property=["']og:image:width["']/i.test(html)
    ) {
      failures.push(`${route.path} uses the default OG image but omits its dimensions`);
    }
    const titleText = decodeXml(html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '');
    if (titleText.length > SEO_TITLE_MAX) {
      failures.push(
        `${route.path} title exceeds the ${SEO_TITLE_MAX}-char SERP budget (${titleText.length})`,
      );
    }
    if (
      !/<script\s+id=["']seo-structured-data["']\s+type=["']application\/ld\+json["']>/i.test(html)
    ) {
      failures.push(`${route.path} is missing initial JSON-LD structured data`);
    }
    verifyStaticBody(route, html);
    verifyJsonLd(route.path, html);
  }
}

/**
 * On production builds (Vercel/CI, or SEO_REQUIRE_ARTICLES) at least one article
 * must have been prerendered. A silently-empty article set means the build-time
 * Supabase fetch degraded and every /resources/article/* URL would ship as a
 * thin SPA shell — the exact "Crawled – currently not indexed" regression this
 * pipeline exists to prevent. Local/offline builds are exempt.
 */
function verifyArticlesPrerendered() {
  if (!requireArticles()) return;

  const manifestPath = path.join(distDir, 'seo-routes.json');
  if (!fs.existsSync(manifestPath)) return; // verifyStaticHtml already reports this.

  const routes = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const articleCount = routes.filter((route) =>
    route.path.startsWith('/resources/article/'),
  ).length;
  if (articleCount === 0) {
    failures.push(
      'no article pages were prerendered on a production build — the article fetch likely failed',
    );
  }
}

/**
 * The static snapshot must be VISIBLE (inside #root, no <noscript> wrapper —
 * Google devalues noscript content) and must carry real page content: article
 * body text for articles, FAQ text for service pages.
 */
function verifyStaticBody(route, html) {
  if (!/<div\s+id=["']root["']>[\s\S]*?data-seo-static-body/i.test(html)) {
    failures.push(`${route.path} static body snapshot is missing or not inside #root`);
    return;
  }
  if (/<noscript[^>]*data-seo-static-body/i.test(html)) {
    failures.push(`${route.path} static body is wrapped in <noscript> (invisible to Google)`);
  }
  if (!/<main\s+id=["']seo-static-body["']/i.test(html)) {
    failures.push(`${route.path} is missing semantic static body markup`);
  }

  const bodyMatch = html.match(/<!-- static-body:start -->([\s\S]*?)<!-- static-body:end -->/);
  const staticBody = bodyMatch ? bodyMatch[1] : '';

  // Only our path-guard script may appear inside the snapshot — anything else
  // means admin-authored article HTML slipped past the sanitizer.
  const scripts = [...staticBody.matchAll(/<script\b[^>]*>/gi)].filter(
    (m) => !m[0].includes('seo-static-body-guard'),
  );
  if (scripts.length > 0) {
    failures.push(`${route.path} static body contains unexpected <script> tags`);
  }

  if (route.path.startsWith('/resources/article/')) {
    if (!/<h1>[^<]+<\/h1>/.test(staticBody)) {
      failures.push(`${route.path} static body is missing its <h1> headline`);
    }
    const text = staticBody
      .replace(/<style>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 200) {
      failures.push(`${route.path} static body has almost no article text (${text.length} chars)`);
    }
  }

  const sourceRoute = publicSeoRoutes.find((r) => r.path === route.path);
  if (sourceRoute) {
    const faqs = faqsForRoute(sourceRoute);
    if (faqs.length > 0 && !staticBody.includes(escapeHtmlLikeBuilder(faqs[0].question))) {
      failures.push(`${route.path} static body is missing its FAQ content`);
    }
  }
}

/** Mirrors escapeHtml in seo-static-data.mjs for content comparisons. */
function escapeHtmlLikeBuilder(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function verifyJsonLd(routePath, html) {
  const match = html.match(
    /<script\s+id=["']seo-structured-data["']\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i,
  );
  if (!match) return;

  try {
    JSON.parse(match[1]);
  } catch (error) {
    failures.push(`${routePath} has invalid JSON-LD: ${error.message}`);
  }
}

function outputPathForRoute(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  const safeParts = routePath.replace(/^\/+/, '').split('/').filter(Boolean);
  return path.join(distDir, ...safeParts, 'index.html');
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

/**
 * When a Google Search Console token is configured, assert it was injected into
 * the home page head so a misconfigured build can't silently ship unverified.
 */
function verifySiteVerification() {
  const token = resolveSiteVerificationToken();
  if (!token) return;

  const homePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(homePath)) {
    failures.push('dist/index.html is missing; cannot verify google-site-verification tag');
    return;
  }

  const html = fs.readFileSync(homePath, 'utf8');
  const match = html.match(
    /<meta\s+name=["']google-site-verification["']\s+content=["']([^"']+)["']\s*\/?>/i,
  );
  if (!match) {
    failures.push('GOOGLE_SITE_VERIFICATION is set but no verification meta tag was injected');
  } else if (decodeXml(match[1]) !== token) {
    failures.push('google-site-verification meta tag content does not match the configured token');
  }
}

function verifyEdgeNotFound() {
  const notFoundPath = path.join(distDir, '404.html');
  if (!fs.existsSync(notFoundPath)) {
    failures.push('dist/404.html is missing; edge middleware cannot serve a real 404 body');
  }

  const manifestPath = path.resolve('seo-route-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    failures.push('seo-route-manifest.json is missing at project root');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    failures.push(`seo-route-manifest.json is invalid JSON: ${error.message}`);
    return;
  }

  if (parsed.generated !== true) {
    failures.push('seo-route-manifest.json was not marked generated=true by the build');
  }
  if (!Array.isArray(parsed.paths) || parsed.paths.length === 0) {
    failures.push('seo-route-manifest.json contains no paths');
  }
  if (!Array.isArray(parsed.articleSlugs)) {
    failures.push('seo-route-manifest.json is missing articleSlugs');
  }
}
