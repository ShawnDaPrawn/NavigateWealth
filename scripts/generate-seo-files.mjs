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
// Individual articles are excluded — the /resources hub page is what we want ranked.
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
  fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemapXml(), 'utf8');
  fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt(), 'utf8');

  console.log(`Generated sitemap and robots for ${siteUrl} (${sitemapEntries.length} URLs)`);
}
