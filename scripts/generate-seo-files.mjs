import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_URL = 'https://navigatewealth.co';
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL);
const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.SITEMAP_TIMEZONE || DEFAULT_TIMEZONE,
}).format(new Date());

// Google ignores <priority> and <changefreq> — only <loc> and <lastmod> matter.
// lastmod should reflect genuinely meaningful content changes.
// Only canonical, indexable public pages belong here. No auth, dashboard, or admin routes.
const sitemapEntries = [
  { path: '/', lastmod: buildDate },
  { path: '/services', lastmod: buildDate },
  { path: '/resources', lastmod: buildDate },
  { path: '/about', lastmod: '2026-03-01' },
  { path: '/team', lastmod: '2026-03-01' },
  { path: '/contact', lastmod: '2026-03-01' },
  { path: '/why-us', lastmod: '2026-03-01' },
  { path: '/risk-management', lastmod: '2026-03-01' },
  { path: '/retirement-planning', lastmod: '2026-03-01' },
  { path: '/investment-management', lastmod: '2026-03-01' },
  { path: '/tax-planning', lastmod: '2026-03-01' },
  { path: '/estate-planning', lastmod: '2026-03-01' },
  { path: '/financial-planning', lastmod: '2026-03-01' },
  { path: '/medical-aid', lastmod: '2026-03-01' },
  { path: '/employee-benefits', lastmod: '2026-03-01' },
  { path: '/get-quote', lastmod: '2026-03-01' },
  { path: '/solutions/individuals', lastmod: '2026-03-01' },
  { path: '/solutions/businesses', lastmod: '2026-03-01' },
  { path: '/solutions/advisers', lastmod: '2026-03-01' },
  { path: '/ask-vasco', lastmod: '2026-03-01' },
  { path: '/careers', lastmod: '2026-03-01' },
  { path: '/press', lastmod: '2026-03-01' },
  { path: '/legal', lastmod: '2026-01-01' },
];

const disallowPaths = [
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
  '/sitemap/xml',
  '/preview_page.html',
];

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

main();

function normalizeSiteUrl(value) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function absoluteUrl(routePath) {
  return routePath === '/' ? siteUrl : `${siteUrl}${routePath}`;
}

function generateSitemapXml() {
  const urls = sitemapEntries
    .map(
      ({ path: routePath, lastmod }) => `  <url>
    <loc>${escapeXml(absoluteUrl(routePath))}</loc>
    <lastmod>${lastmod || buildDate}</lastmod>
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function generateRobotsTxt() {
  const rules = disallowPaths.map((routePath) => `Disallow: ${routePath}`).join('\n');

  return `User-agent: *
Allow: /
${rules}

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function main() {
  Promise.resolve()
    .then(async () => {
      const articleEntries = await fetchPublishedArticleEntries();
      if (articleEntries.length) {
        sitemapEntries.push(...articleEntries);
      }

      // De-dupe paths (defensive)
      const seen = new Set();
      const deduped = [];
      for (const e of sitemapEntries) {
        if (!e?.path) continue;
        if (seen.has(e.path)) continue;
        seen.add(e.path);
        deduped.push(e);
      }
      sitemapEntries.length = 0;
      sitemapEntries.push(...deduped);

      fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemapXml(), 'utf8');
      fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt(), 'utf8');

      console.log(`Generated sitemap and robots for ${siteUrl} (${sitemapEntries.length} URLs)`);
    })
    .catch((err) => {
      console.error('Failed to generate SEO files:', err);
      process.exitCode = 1;
    });
}

function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.SITEMAP_TIMEZONE || DEFAULT_TIMEZONE,
  }).format(d);
}

async function fetchPublishedArticleEntries() {
  // Pull published articles from the public Edge Function endpoint.
  // This ensures the sitemap reflects live content, and avoids listing draft/unpublished posts.
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'vpjmdsltwrnpefzcgdmz';
  const fnBase =
    process.env.SUPABASE_FUNCTIONS_BASE_URL ||
    `https://${projectRef}.supabase.co/functions/v1/make-server-91ed8379`;

  const url = `${fnBase}/publications/articles?status=published&limit=1000`;
  try {
    const anonKey = readSupabaseAnonKey();
    const res = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!res.ok) {
      // Some Supabase function gateways require an Authorization header even for public routes.
      if (res.status === 401 && anonKey) {
        const retry = await fetch(url, {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${anonKey}`,
          },
        });
        if (!retry.ok) {
          console.warn(`[sitemap] Skipping articles (HTTP ${retry.status})`);
          return [];
        }
        const json = await retry.json();
        const rows = Array.isArray(json?.data) ? json.data : [];
        return rowsToArticleEntries(rows);
      }

      console.warn(`[sitemap] Skipping articles (HTTP ${res.status})`);
      return [];
    }

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    return rowsToArticleEntries(rows);
  } catch (e) {
    console.warn('[sitemap] Skipping articles (fetch failed)', e?.message || e);
    return [];
  }
}

function rowsToArticleEntries(rows) {
  const entries = [];
  for (const a of rows) {
    const slug = typeof a?.slug === 'string' ? a.slug.trim() : '';
    if (!slug) continue;

    const lastmod =
      toDateOnly(a.updated_at) ||
      toDateOnly(a.published_at) ||
      toDateOnly(a.created_at) ||
      buildDate;

    entries.push({
      path: `/resources/article/${encodeURIComponent(slug)}`,
      lastmod,
    });
  }
  return entries;
}

function readSupabaseAnonKey() {
  // Prefer explicit env var for CI; fall back to reading repo constant.
  const envKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.PUBLIC_SUPABASE_ANON_KEY;
  if (envKey && String(envKey).trim()) return String(envKey).trim();

  try {
    const p = path.resolve('src/utils/supabase/info.tsx');
    const src = fs.readFileSync(p, 'utf8');
    const m = src.match(/export\s+const\s+publicAnonKey\s*=\s*\"([^\"]+)\"/);
    return m?.[1] ? m[1].trim() : null;
  } catch {
    return null;
  }
}
