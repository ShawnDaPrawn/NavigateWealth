import { Link } from 'react-router';
import { pad2 } from './format';
import { ArrowIcon, CheckIcon, CompassIcon, ShieldCheckIcon } from './ServicesIcons';
import '../styles/sections.css';
import '../styles/services.css';

export interface ServiceIndexEntry {
  /** The id of the service's row further down the page. */
  id: string;
  no: string;
  title: string;
}

interface ServicesHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  /** The first line is the firm's authorisation (a shield); the rest are ticks. */
  trust: readonly string[];
  services: readonly ServiceIndexEntry[];
}

/**
 * The Services page's hero: the headline and actions on the left, and on the
 * right an index of every service that jumps to its row on this page.
 */
export function ServicesHero({
  badge,
  title,
  accent,
  lead,
  primary,
  secondary,
  trust,
  services,
}: ServicesHeroProps) {
  return (
    <section className="nwsv-hero" aria-labelledby="nwsv-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwsv-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwsv-hero-inner">
        <div>
          <p className="nwsv-pill">
            <CompassIcon size={14} stroke="#C5CAD3" />
            <span>{badge}</span>
          </p>
          <h1 id="nwsv-title" className="nwsv-h1">
            {title} <span className="nw-accent">{accent}</span>
          </h1>
          <p className="nwsv-hero-lead">{lead}</p>
          <div className="nwsv-ctas">
            <Link className="nw-btn nw-btn--lg" to={primary.to}>
              {primary.label} <ArrowIcon size={18} />
            </Link>
            <Link className="nw-ghost-dark nw-btn--lg" to={secondary.to}>
              {secondary.label}
            </Link>
          </div>
          <ul className="nw-trust nw-trust--dark" aria-label="Why clients choose us">
            {trust.map((line, i) => (
              <li key={line}>
                {i === 0 ? <ShieldCheckIcon size={15} /> : <CheckIcon size={14} />}
                {line}
              </li>
            ))}
          </ul>
        </div>

        <nav className="nwsv-index" aria-label="Service index">
          <div className="nwsv-index-head">
            <span className="nw-mono nwsv-index-label">Chart your course</span>
            <span className="nw-mono nwsv-index-count">{pad2(services.length)} services</span>
          </div>
          <ul className="nwsv-index-list">
            {services.map((service) => (
              <li key={service.id}>
                <a className="nwsv-index-link" href={`#${service.id}`}>
                  <span className="nw-mono nwsv-index-no" aria-hidden="true">
                    {service.no}
                  </span>
                  <span className="nwsv-index-t">{service.title}</span>
                  <ArrowIcon size={14} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
