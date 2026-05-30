import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_SITE_URL,
  absoluteUrl,
  disallowPaths,
  normalizeSiteUrl,
  resolveSiteVerificationToken,
} from './seo-static-data.mjs';

const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL);
const distDir = path.resolve('dist');
const failures = [];

verifyRobots();
verifySitemap();
verifyStaticHtml();
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
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
    decodeXml(match[1])
  );
  if (!urls.length) {
    failures.push('sitemap.xml contains no URLs');
    return;
  }
  if (!/xmlns:image=["']http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1["']/.test(sitemap)) {
    failures.push('sitemap.xml is missing the image sitemap namespace');
  }

  const disallowedPrefixes = disallowPaths
    .filter((routePath) => routePath !== '/')
    .map((routePath) => absoluteUrl(siteUrl, routePath.replace(/\/$/, '')));

  for (const url of urls) {
    if (!url.startsWith(siteUrl)) {
      failures.push(`sitemap URL is not canonical: ${url}`);
    }
    const isDisallowed = disallowedPrefixes.some((prefix) => url === prefix || url.startsWith(`${prefix}/`));
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
    if (!/<script\s+id=["']seo-structured-data["']\s+type=["']application\/ld\+json["']>/i.test(html)) {
      failures.push(`${route.path} is missing initial JSON-LD structured data`);
    }
    if (!/<noscript\s+data-seo-static-body=["']true["']>/i.test(html)) {
      failures.push(`${route.path} is missing its static no-JS body snapshot`);
    }
    if (!/<main\s+id=["']seo-static-body["']/i.test(html)) {
      failures.push(`${route.path} is missing semantic static body markup`);
    }
    verifyJsonLd(route.path, html);
  }
}

function verifyJsonLd(routePath, html) {
  const match = html.match(/<script\s+id=["']seo-structured-data["']\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
  if (!match) return;

  try {
    JSON.parse(match[1]);
  } catch (error) {
    failures.push(`${routePath} has invalid JSON-LD: ${error.message}`);
  }
}

function outputPathForRoute(routePath) {
  if (routePath === '/') return path.join(distDir, 'index.html');
  const safeParts = routePath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);
  return path.join(distDir, ...safeParts, 'index.html');
}

function decodeXml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
