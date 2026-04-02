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
 * Google ignores <priority> and <changefreq> so we only emit <loc> and <lastmod>.
 * Only canonical, indexable public pages are listed. Individual articles are
 * excluded — the /resources hub page is what we want ranked.
 */
const SITEMAP_API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/sitemap/xml`;

const BASE_URL = 'https://navigatewealth.co';

type SitemapEntry = {
  loc: string;
  lastmod: string;
};

const FALLBACK_URLS: SitemapEntry[] = [
  { loc: '/', lastmod: '2026-04-02' },
  { loc: '/services', lastmod: '2026-04-02' },
  { loc: '/resources', lastmod: '2026-04-02' },
  { loc: '/about', lastmod: '2026-03-01' },
  { loc: '/team', lastmod: '2026-03-01' },
  { loc: '/contact', lastmod: '2026-03-01' },
  { loc: '/why-us', lastmod: '2026-03-01' },
  { loc: '/risk-management', lastmod: '2026-03-01' },
  { loc: '/retirement-planning', lastmod: '2026-03-01' },
  { loc: '/investment-management', lastmod: '2026-03-01' },
  { loc: '/tax-planning', lastmod: '2026-03-01' },
  { loc: '/estate-planning', lastmod: '2026-03-01' },
  { loc: '/financial-planning', lastmod: '2026-03-01' },
  { loc: '/medical-aid', lastmod: '2026-03-01' },
  { loc: '/employee-benefits', lastmod: '2026-03-01' },
  { loc: '/get-quote', lastmod: '2026-03-01' },
  { loc: '/solutions/individuals', lastmod: '2026-03-01' },
  { loc: '/solutions/businesses', lastmod: '2026-03-01' },
  { loc: '/solutions/advisers', lastmod: '2026-03-01' },
  { loc: '/ask-vasco', lastmod: '2026-03-01' },
  { loc: '/careers', lastmod: '2026-03-01' },
  { loc: '/press', lastmod: '2026-03-01' },
  { loc: '/legal', lastmod: '2026-01-01' },
];

function generateFallbackXml(): string {
  const entries = FALLBACK_URLS.map(
    (u) =>
      `  <url>\n    <loc>${BASE_URL}${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}

export function SitemapXmlPage() {
  const [xmlContent, setXmlContent] = useState<string>('Loading sitemap…');

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
      })
      .catch((err) => {
        console.error('Failed to fetch sitemap XML from backend:', err);
        setXmlContent(generateFallbackXml());
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
