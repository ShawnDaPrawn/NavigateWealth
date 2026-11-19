/**
 * NavigatorSitemapPage — the redesigned sitemap.
 *
 * Reads the same data as the live page (SitemapPage.tsx): the categories and
 * pages of sitemap/sitemapData.ts, every one a route the site serves, and the
 * SEO tags, JSON-LD and headline figures of sitemap/sitemapMeta.ts. The search
 * filters exactly as the live page's does (title, description or path).
 * The layout is the "Sitemap" board of the Website Redesign canvas. Beyond it:
 * - each result count is also announced through a polite live region that is
 *   always in the page, so the first one is read out too;
 * - "Clear search" puts focus back in the search box, since the button it was
 *   on disappears with the results;
 * - a category scrolls into view below the sticky header (the live page's
 *   offset) rather than the board's 24px, which the header would cover.
 */
import { useMemo, useRef, useState } from 'react';
import { SEO } from '../../components/seo/SEO';
import { sitemapSections } from '../../components/pages/sitemap/sitemapData';
import {
  SITEMAP_SEO,
  lastUpdatedLabel,
  publicPages,
  sitemapStructuredData,
  totalPages,
} from '../../components/pages/sitemap/sitemapMeta';
import { SitemapHelp } from '../sections/SitemapHelp';
import { SitemapHero, type SitemapStat } from '../sections/SitemapHero';
import { SitemapIcon } from '../sections/SitemapIcons';
import { SitemapIndex, SitemapSections } from '../sections/SitemapSections';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/sitemap.css';

const STATS: SitemapStat[] = [
  { icon: 'file', label: `${totalPages} pages` },
  { icon: 'layers', label: `${sitemapSections.length} categories` },
  { icon: 'globe', label: `${publicPages} public pages` },
  ...(lastUpdatedLabel ? [{ icon: 'clock' as const, label: `Updated ${lastUpdatedLabel}` }] : []),
];

export function NavigatorSitemapPage() {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim().toLowerCase();
  const filteredSections = useMemo(() => {
    if (!term) return sitemapSections;
    return sitemapSections
      .map((section) => ({
        ...section,
        links: section.links.filter(
          (link) =>
            link.title.toLowerCase().includes(term) ||
            link.description.toLowerCase().includes(term) ||
            link.path.toLowerCase().includes(term),
        ),
      }))
      .filter((section) => section.links.length > 0);
  }, [term]);

  const visibleCount = filteredSections.reduce((total, section) => total + section.links.length, 0);
  const isSearching = term.length > 0;
  const resultLabel =
    visibleCount === 0
      ? `No pages match “${query.trim()}”.`
      : `Showing ${visibleCount} ${visibleCount === 1 ? 'page' : 'pages'} matching “${query.trim()}”.`;

  const clear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="nw-site nwsm">
      <SEO {...SITEMAP_SEO} structuredData={sitemapStructuredData} />

      <SitemapHero query={query} onQueryChange={setQuery} inputRef={inputRef} stats={STATS} />

      <section className="nwsm-body">
        <div className="nw-wrap">
          <p className="nw-sr-only" role="status">
            {isSearching ? resultLabel : ''}
          </p>

          {isSearching ? (
            <div className="nwsm-results">
              <p className="nwsm-results-label">{resultLabel}</p>
              <button type="button" className="nwsm-clear nwsm-clear--row" onClick={clear}>
                Clear search
              </button>
            </div>
          ) : (
            <SitemapIndex sections={sitemapSections} />
          )}

          {isSearching && visibleCount === 0 ? (
            <div className="nwsm-empty">
              <SitemapIcon name="search" size={40} stroke="#C5CAD3" className="nwsm-empty-ic" />
              <p className="nw-h nwsm-empty-t">No matching pages</p>
              <p className="nwsm-empty-p">
                Try a different keyword, or{' '}
                <button type="button" className="nwsm-clear" onClick={clear}>
                  clear your search
                </button>{' '}
                to browse everything.
              </p>
            </div>
          ) : null}

          <SitemapSections sections={filteredSections} />

          <SitemapHelp />
        </div>
      </section>
    </div>
  );
}

export default NavigatorSitemapPage;
