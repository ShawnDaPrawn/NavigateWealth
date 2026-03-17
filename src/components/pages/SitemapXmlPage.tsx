import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * SitemapXmlPage — renders the XML sitemap as a proper React component.
 *
 * Architecture:
 * - Fetches the XML from the backend (single source of truth) using the anon key
 * - Falls back to client-side generation if the backend is unreachable
 * - Renders as a React component (not destructive DOM manipulation) so Googlebot
 *   can parse the rendered DOM after JavaScript execution
 *
 * Route: /sitemap/xml (not /sitemap.xml — Figma Make hosting doesn't serve
 * SPA fallback routes for paths with file extensions)
 *
 * WORKAROUND: Supabase Edge Functions require auth headers on all requests,
 * so crawlers can't hit the backend endpoint directly. This SPA route fetches
 * with the anon key and renders the content client-side. Googlebot renders
 * JavaScript and will see the full sitemap content.
 */
const SITEMAP_API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/sitemap/xml`;

const BASE_URL = 'https://www.navigatewealth.co';

// Mirrors SITEMAP_URLS in /supabase/functions/server/sitemap.tsx
// Used as a client-side fallback if the backend is unreachable
const FALLBACK_URLS = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/about', priority: '0.8', changefreq: 'monthly' },
  { loc: '/services', priority: '0.9', changefreq: 'monthly' },
  { loc: '/team', priority: '0.7', changefreq: 'monthly' },
  { loc: '/contact', priority: '0.8', changefreq: 'monthly' },
  { loc: '/resources', priority: '0.8', changefreq: 'weekly' },
  { loc: '/get-quote', priority: '0.8', changefreq: 'monthly' },
  { loc: '/risk-management', priority: '0.8', changefreq: 'monthly' },
  { loc: '/retirement-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/investment-management', priority: '0.8', changefreq: 'monthly' },
  { loc: '/tax-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/estate-planning', priority: '0.8', changefreq: 'monthly' },
  { loc: '/employee-benefits', priority: '0.7', changefreq: 'monthly' },
  { loc: '/medical-aid', priority: '0.7', changefreq: 'monthly' },
  { loc: '/financial-planning', priority: '0.7', changefreq: 'monthly' },
  { loc: '/solutions/individuals', priority: '0.8', changefreq: 'monthly' },
  { loc: '/solutions/businesses', priority: '0.8', changefreq: 'monthly' },
  { loc: '/solutions/advisers', priority: '0.7', changefreq: 'monthly' },
  { loc: '/why-us', priority: '0.7', changefreq: 'monthly' },
  { loc: '/careers', priority: '0.5', changefreq: 'monthly' },
  { loc: '/press', priority: '0.5', changefreq: 'monthly' },
  { loc: '/legal', priority: '0.4', changefreq: 'yearly' },
  { loc: '/sitemap', priority: '0.3', changefreq: 'monthly' },
] as const;

function generateFallbackXml(): string {
  const today = new Date().toISOString().split('T')[0];
  const entries = FALLBACK_URLS.map(
    (u) =>
      `  <url>\n    <loc>${BASE_URL}${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

export function SitemapXmlPage() {
  const [xmlContent, setXmlContent] = useState<string>('Loading sitemap…');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    document.title = 'Sitemap XML - Navigate Wealth';

    fetch(SITEMAP_API_URL, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.text();
      })
      .then((xml) => {
        setXmlContent(xml);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to fetch sitemap XML from backend:', err);
        setXmlContent(generateFallbackXml());
        setIsLoaded(true);
      });
  }, []);

  return (
    <div
      style={{
        margin: 0,
        padding: '10px',
        fontFamily: 'monospace',
        fontSize: '13px',
        lineHeight: '1.4',
        background: '#ffffff',
        color: '#333333',
        minHeight: '100vh',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
      }}
    >
      {xmlContent}
    </div>
  );
}
