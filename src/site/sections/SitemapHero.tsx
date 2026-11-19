/**
 * SitemapHero — the sitemap's navy opening: the breadcrumb, the badge, the
 * heading, the search box that filters the page, and the page counts. The
 * compass rose on the right is hidden below 860px, as on the board.
 */
import type { ChangeEvent, RefObject } from 'react';
import { Link } from 'react-router';
import { SitemapIcon, type SitemapIconName } from './SitemapIcons';
import '../styles/sections.css';
import '../styles/sitemap.css';

export interface SitemapStat {
  icon: SitemapIconName;
  label: string;
}

interface SitemapHeroProps {
  query: string;
  onQueryChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement>;
  stats: SitemapStat[];
}

export const SITEMAP_SEARCH_ID = 'nwsm-search';

export function SitemapHero({ query, onQueryChange, inputRef, stats }: SitemapHeroProps) {
  return (
    <section className="nwsm-hero" aria-label="Sitemap hero">
      <div className="nw-grid-bg nwsm-fade" aria-hidden="true" />
      <div className="nwsm-glow" aria-hidden="true" />
      <svg
        className="nwsm-rose"
        aria-hidden="true"
        focusable="false"
        width="460"
        height="460"
        viewBox="0 0 480 480"
        fill="none"
      >
        <circle cx="240" cy="240" r="224" stroke="rgba(255,255,255,0.12)" />
        <circle
          cx="240"
          cy="240"
          r="208"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="8"
          strokeDasharray="1 17.15"
        />
        <circle
          cx="240"
          cy="240"
          r="208"
          stroke="#C5CAD3"
          strokeOpacity="0.5"
          strokeWidth="16"
          strokeDasharray="2 106.92"
        />
        <circle cx="240" cy="240" r="140" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 6" />
        <polygon
          points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
          fill="rgba(255,255,255,0.02)"
          stroke="rgba(255,255,255,0.16)"
        />
        <g fontFamily="Inter, sans-serif" fontSize="12" fill="#9AA3B2" textAnchor="middle">
          <text x="240" y="64" fill="#E3D9C3" fontSize="15" fontWeight="600">
            N
          </text>
          <text x="420" y="245">
            E
          </text>
          <text x="240" y="425">
            S
          </text>
          <text x="60" y="245">
            W
          </text>
        </g>
      </svg>
      <div className="nw-wrap nwsm-hero-inner">
        <div className="nwsm-hero-copy">
          <nav aria-label="Breadcrumb" className="nw-mono nwsm-crumbs">
            <Link to="/" className="nwsm-crumb">
              Home
            </Link>
            <SitemapIcon name="chevronRight" size={12} />
            <span className="nwsm-crumb-here" aria-current="page">
              Sitemap
            </span>
          </nav>
          <div className="nwsm-pill">
            <SitemapIcon name="globe" size={14} stroke="#C5CAD3" />
            <span>Everything on Navigate Wealth, in one place</span>
          </div>
          <h1 className="nwsm-title">
            Navigate Wealth <span className="nw-accent">Sitemap</span>
          </h1>
          <p className="nwsm-lead">
            Your complete guide to every page on our site — services, solutions, resources, and your
            secure client portal. Search below or browse by category to find exactly what you need.
          </p>
          <div className="nwsm-search">
            <label htmlFor={SITEMAP_SEARCH_ID} className="nw-sr-only">
              Search the sitemap
            </label>
            <SitemapIcon name="search" size={18} stroke="#9AA3B2" className="nwsm-search-ic" />
            <input
              ref={inputRef}
              id={SITEMAP_SEARCH_ID}
              className="nwsm-search-input"
              type="search"
              value={query}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
              placeholder="Search pages — e.g. retirement, tax, contact…"
            />
          </div>
          <div className="nwsm-stats">
            {stats.map((stat) => (
              <span key={stat.label}>
                <SitemapIcon name={stat.icon} size={16} stroke="#C5CAD3" />
                {stat.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
