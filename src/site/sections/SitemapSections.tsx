/**
 * SitemapSections — one card per category of sitemap/sitemapData.ts: its icon,
 * heading, description and page count, then every page as a link with its
 * access badge, its path and, where the data has one, its last update.
 *
 * Also exports the category index the page opens with ("Jump to a category")
 * and the access badge the help card's legend repeats.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { BookOpen, Building, FileText, Home, Settings, Shield, Users } from 'lucide-react';
import type { SitemapLink, SitemapSection } from '../../components/pages/sitemap/sitemapData';
import { pad2 } from './format';
import { SectionHead } from './SectionHead';
import { SitemapIcon, type SitemapIconName } from './SitemapIcons';
import '../styles/sections.css';
import '../styles/sitemap.css';

/** The board's drawing for each icon sitemapData.ts gives a category. */
const SECTION_ICONS = new Map<ComponentType<{ className?: string }>, SitemapIconName>([
  [Home, 'home'],
  [Shield, 'shield'],
  [Users, 'users'],
  [BookOpen, 'book'],
  [Building, 'building'],
  [Settings, 'settings'],
  [FileText, 'fileText'],
]);

function SitemapSectionIcon({ section, size }: { section: SitemapSection; size: number }) {
  const name = SECTION_ICONS.get(section.icon);
  if (name) return <SitemapIcon name={name} size={size} />;
  // A category added later with an icon the board does not draw.
  const Icon = section.icon;
  return (
    <span className="nwsm-ic-fallback" style={{ width: size, height: size }} aria-hidden="true">
      <Icon />
    </span>
  );
}

function pageCount(n: number): string {
  return `${n} ${n === 1 ? 'page' : 'pages'}`;
}

const BADGES: Record<
  NonNullable<SitemapLink['status']>,
  { label: string; icon: SitemapIconName; className: string }
> = {
  public: { label: 'Public', icon: 'globe', className: 'nwsm-badge--public' },
  'auth-required': { label: 'Login required', icon: 'lock', className: 'nwsm-badge--auth' },
  flexible: { label: 'Public & clients', icon: 'users', className: 'nwsm-badge--flexible' },
};

/** Who can open a page. The legend in the help card draws it without the icon. */
export function SitemapBadge({
  status,
  withIcon = true,
}: {
  status?: SitemapLink['status'];
  withIcon?: boolean;
}) {
  if (!status) return null;
  const badge = BADGES[status];
  return (
    <span className={`nwsm-badge ${badge.className}`}>
      {withIcon ? <SitemapIcon name={badge.icon} size={11} /> : null}
      {badge.label}
    </span>
  );
}

/** "01 — Chart index": a card per category, each an in-page link to it. */
export function SitemapIndex({ sections }: { sections: SitemapSection[] }) {
  return (
    <div className="nwsm-index">
      <SectionHead
        index={pad2(1)}
        kicker="Chart index"
        title="Jump to a category"
        className="nwsm-head"
      />
      <div className="nwsm-jumps">
        {sections.map((section) => (
          <a key={section.id} className="nwsm-jump" href={`#${section.id}`}>
            <span className="nwsm-jump-ic">
              <SitemapSectionIcon section={section} size={19} />
            </span>
            <span className="nwsm-jump-copy">
              <span className="nwsm-jump-t">{section.title}</span>
              <span className="nw-mono nwsm-jump-n">{pageCount(section.links.length)}</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function SitemapSections({ sections }: { sections: SitemapSection[] }) {
  return (
    <div className="nwsm-sections">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="nwsm-card">
          <div className="nwsm-card-head">
            <div className="nwsm-card-id">
              <span className="nwsm-card-ic">
                <SitemapSectionIcon section={section} size={21} />
              </span>
              <div className="nwsm-card-copy">
                <h2 className="nwsm-card-title">{section.title}</h2>
                <p className="nwsm-card-desc">{section.description}</p>
              </div>
            </div>
            <span className="nw-mono nwsm-count">{pageCount(section.links.length)}</span>
          </div>
          <ul className="nwsm-links">
            {section.links.map((link) => (
              <li key={link.path}>
                <Link className="nwsm-link" to={link.path}>
                  <span className="nwsm-link-body">
                    <span className="nwsm-link-top">
                      <span className="nwsm-link-t">{link.title}</span>
                      <SitemapBadge status={link.status} />
                    </span>
                    <span className="nwsm-link-d">{link.description}</span>
                    <span className="nwsm-link-meta">
                      <code className="nw-mono nwsm-path">{link.path}</code>
                      {link.lastModified ? (
                        <span className="nw-mono nwsm-date">Updated {link.lastModified}</span>
                      ) : null}
                    </span>
                  </span>
                  <SitemapIcon name="arrowUpRight" size={18} className="nwsm-link-arrow" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
