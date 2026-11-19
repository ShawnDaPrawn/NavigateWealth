/**
 * AdvisersHero — the For Advisers page's opening, as the "For Advisers" board
 * draws it: the badge, the page's one H1, the lead, two actions and the
 * assurance line; beside them the "Choose your course" card of the three
 * solutions pages (this one marked as the current page); below, the three
 * trust facts.
 */
import { Link } from 'react-router';
import { ArrowRight, Briefcase, Check } from 'lucide-react';
import type { TrustFact } from '../../config/companyFacts';
import type { AdvisersIconType } from './AdvisersIcons';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/for-advisers.css';

export interface AdvisersAction {
  label: string;
  to: string;
}

export interface AdvisersPath {
  to: string;
  label: string;
  description: string;
  icon: AdvisersIconType;
}

interface AdvisersHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  primary: AdvisersAction;
  secondary: AdvisersAction;
  assurances: readonly string[];
  pathsLabel: string;
  pathsKicker: string;
  paths: readonly AdvisersPath[];
  /** The path of this page, marked "You are here" in the card. */
  current: string;
  facts: readonly TrustFact[];
}

export function AdvisersHero({
  badge,
  title,
  accent,
  lead,
  primary,
  secondary,
  assurances,
  pathsLabel,
  pathsKicker,
  paths,
  current,
  facts,
}: AdvisersHeroProps) {
  return (
    <section className="nwfa-hero" aria-label="Hero">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwfa-glow" aria-hidden="true" />
      <div className="nw-wrap nwfa-hero-wrap">
        <div className="nwfa-hero-grid">
          <div>
            <div className="nwfa-badge">
              <Briefcase size={14} strokeWidth={1.75} aria-hidden="true" />
              <span>{badge}</span>
            </div>
            <h1 className="nwfa-h1">
              {title} <span className="nw-accent">{accent}</span>
            </h1>
            <p className="nwfa-lead">{lead}</p>
            <div className="nwfa-hero-ctas">
              <Link className="nw-btn nwfa-hero-btn" to={primary.to}>
                {primary.label}
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link className="nw-ghost-dark nwfa-hero-btn" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfa-assure nwfa-assure--hero">
              {assurances.map((item) => (
                <li key={item}>
                  <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <nav className="nwfa-paths" aria-label={pathsLabel}>
            <div className="nwfa-paths-head">
              <span className="nw-mono nwfa-paths-kicker">{pathsKicker}</span>
              <span className="nw-mono nwfa-paths-label">{pathsLabel}</span>
            </div>
            <ul className="nwfa-paths-list">
              {paths.map((path) => {
                const isCurrent = path.to === current;
                const Icon = path.icon;
                return (
                  <li key={path.to}>
                    <Link
                      className="nwfa-path"
                      to={path.to}
                      aria-current={isCurrent ? 'page' : undefined}
                    >
                      <span className="nwfa-path-icon">
                        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span className="nwfa-path-text">
                        <span className="nwfa-path-t">{path.label}</span>
                        <span className="nwfa-path-d">{path.description}</span>
                      </span>
                      {isCurrent ? (
                        <span className="nw-mono nwfa-path-here">YOU ARE HERE</span>
                      ) : (
                        <ArrowRight
                          className="nwfa-arr"
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <ul className="nwfa-facts">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <li key={fact.value}>
                <span className="nwfa-fact-icon">
                  <Icon size={19} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span>
                  <span className="nw-h nwfa-fact-v">{fact.value}</span>
                  <span className="nwfa-fact-l">{fact.label}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
