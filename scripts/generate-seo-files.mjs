import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SITE_URL = 'https://navigatewealth.co';
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const siteUrl = normalizeSiteUrl(process.env.SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL);
const buildDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.SITEMAP_TIMEZONE || DEFAULT_TIMEZONE,
}).format(new Date());

const sitemapEntries = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/about', changefreq: 'monthly', priority: '0.8' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/team', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.8' },
  { path: '/resources', changefreq: 'weekly', priority: '0.8' },
  { path: '/get-quote', changefreq: 'monthly', priority: '0.8' },
  { path: '/risk-management', changefreq: 'monthly', priority: '0.8' },
  { path: '/retirement-planning', changefreq: 'monthly', priority: '0.8' },
  { path: '/investment-management', changefreq: 'monthly', priority: '0.8' },
  { path: '/employee-benefits', changefreq: 'monthly', priority: '0.7' },
  { path: '/tax-planning', changefreq: 'monthly', priority: '0.8' },
  { path: '/financial-planning', changefreq: 'monthly', priority: '0.7' },
  { path: '/estate-planning', changefreq: 'monthly', priority: '0.8' },
  { path: '/medical-aid', changefreq: 'monthly', priority: '0.7' },
  { path: '/solutions/individuals', changefreq: 'monthly', priority: '0.8' },
  { path: '/solutions/businesses', changefreq: 'monthly', priority: '0.8' },
  { path: '/solutions/advisers', changefreq: 'monthly', priority: '0.7' },
  { path: '/why-us', changefreq: 'monthly', priority: '0.7' },
  { path: '/careers', changefreq: 'monthly', priority: '0.5' },
  { path: '/press', changefreq: 'monthly', priority: '0.5' },
  { path: '/legal', changefreq: 'yearly', priority: '0.4' },
  { path: '/ask-vasco', changefreq: 'weekly', priority: '0.6' },
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
  '/sitemap/xml',
];

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemapXml(), 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt(), 'utf8');

console.log(`Generated sitemap and robots for ${siteUrl}`);

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
      ({ path: routePath, changefreq, priority }) => `  <url>
    <loc>${escapeXml(absoluteUrl(routePath))}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
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
