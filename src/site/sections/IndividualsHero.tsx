/**
 * The For Individuals hero: the headline and its actions on the left, the
 * three audience pages as a "Choose your course" selector on the right (this
 * page marked as the current one), and the firm's first three checkable
 * facts along the bottom.
 */
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import type { TrustFact } from '../../config/companyFacts';
import { ArrowIcon, CheckIcon, IndividualsIcon } from './IndividualsIcons';
import '../styles/sections.css';
import '../styles/for-individuals.css';

export interface IndividualsRoute {
  path: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}

interface IndividualsHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  checks: readonly string[];
  routes: readonly IndividualsRoute[];
  currentPath: string;
  facts: readonly TrustFact[];
}

export function IndividualsHero({
  badge,
  title,
  accent,
  lead,
  primary,
  secondary,
  checks,
  routes,
  currentPath,
  facts,
}: IndividualsHeroProps) {
  return (
    <section className="nwfi-hero" aria-label="Hero">
      <div className="nw-grid-bg nwfi-hero-gridbg" aria-hidden="true" />
      <div className="nwfi-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwfi-rel">
        <div className="nwfi-hero-grid">
          <div>
            <p className="nwfi-pill">
              <span className="nwfi-pill-rule" aria-hidden="true" />
              <span className="nwfi-pill-text">{badge}</span>
            </p>
            <h1 className="nwfi-h1">
              {title} <span className="nw-accent">{accent}</span>
            </h1>
            <p className="nwfi-hero-lead">{lead}</p>
            <div className="nwfi-hero-ctas">
              <Link className="nw-btn nwfi-hero-btn" to={primary.to}>
                {primary.label} <ArrowIcon size={18} />
              </Link>
              <Link className="nw-ghost-dark nwfi-hero-btn" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfi-checks nwfi-checks--hero">
              {checks.map((check) => (
                <li key={check}>
                  <CheckIcon size={15} stroke="#4ADE80" />
                  {check}
                </li>
              ))}
            </ul>
          </div>

          <nav className="nwfi-course" aria-label="Solutions">
            <div className="nwfi-course-head">
              <span className="nw-mono nwfi-course-k">Choose your course</span>
              <span className="nw-mono nwfi-course-s">Solutions</span>
            </div>
            <ul className="nwfi-course-list">
              {routes.map(({ path, label, description, icon }) => {
                const current = path === currentPath;
                return (
                  <li key={path}>
                    <Link
                      className={current ? 'nwfi-route nwfi-route--current' : 'nwfi-route'}
                      to={path}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span className="nwfi-route-icon" aria-hidden="true">
                        <IndividualsIcon icon={icon} size={20} />
                      </span>
                      <span className="nwfi-route-text">
                        <span className="nwfi-route-t">{label}</span>
                        {description ? <span className="nwfi-route-d">{description}</span> : null}
                      </span>
                      {current ? (
                        <span className="nw-mono nwfi-route-here">YOU ARE HERE</span>
                      ) : (
                        <ArrowIcon size={16} className="nwfi-arr" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <ul className="nwfi-facts">
          {facts.map(({ value, label, icon }) => (
            <li key={value} className="nwfi-fact">
              <span className="nwfi-fact-icon" aria-hidden="true">
                <IndividualsIcon icon={icon} size={19} />
              </span>
              <span>
                <span className="nwfi-fact-v">{value}</span>
                <span className="nwfi-fact-l">{label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
