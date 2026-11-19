/**
 * SitemapHelp — the two cards that close the sitemap: what the access badges
 * mean, and where to go next (contact, a quote, the resources).
 */
import { Link } from 'react-router';
import { SitemapIcon } from './SitemapIcons';
import { SitemapBadge } from './SitemapSections';
import '../styles/sections.css';
import '../styles/sitemap.css';

export function SitemapHelp() {
  return (
    <div className="nwsm-help">
      <div className="nwsm-about">
        <h2 className="nwsm-help-title">
          <SitemapIcon name="file" size={20} stroke="#0D1626" />
          About this sitemap
        </h2>
        <p className="nwsm-help-p">
          This page lists every section of the Navigate Wealth website to help both visitors and
          search engines discover our content quickly. Each entry shows who can access it.
        </p>
        <ul className="nwsm-legend">
          <li>
            <SitemapBadge status="public" withIcon={false} />
            Accessible to everyone.
          </li>
          <li>
            <SitemapBadge status="flexible" withIcon={false} />
            Open to all, with extra tools once you sign in.
          </li>
          <li>
            <SitemapBadge status="auth-required" withIcon={false} />
            Secure portal — sign in to access.
          </li>
        </ul>
      </div>
      <div className="nwsm-next">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nwsm-next-copy">
          <h2 className="nwsm-help-title">Can&apos;t find what you need?</h2>
          <p className="nwsm-help-p">
            We are here to help you navigate our services and find the right financial solution for
            your goals.
          </p>
          <div className="nwsm-next-actions">
            <Link className="nw-btn nwsm-next-btn" to="/contact">
              Contact us
              <SitemapIcon name="arrowRight" size={16} />
            </Link>
            <Link className="nwsm-next-link" to="/get-quote">
              Get a personalised quote
              <SitemapIcon name="arrowRight" size={16} />
            </Link>
            <Link className="nwsm-next-link" to="/resources">
              Browse our resources
              <SitemapIcon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
