/**
 * The For Businesses hero: the heading and its two actions on the left, the
 * "Choose your course" panel of the three solutions pages on the right, and
 * the trust strip along the bottom.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { Globe, Shield, UserCheck, type LucideIcon } from 'lucide-react';
import type { TrustFact } from '../../config/companyFacts';
import {
  ArrowIcon,
  BriefcaseIcon,
  BuildingIcon,
  CheckIcon,
  GlobeIcon,
  ShieldIcon,
  UserCheckIcon,
  UserIcon,
} from './BusinessesIcons';
import '../styles/for-businesses.css';

type BoardIcon = ComponentType<{ size: number; stroke?: string }>;

/** The trust facts carry lucide icons; the board draws its own cut of each. */
const TRUST_ICONS = new Map<LucideIcon, BoardIcon>([
  [Shield, ShieldIcon],
  [Globe, GlobeIcon],
  [UserCheck, UserCheckIcon],
]);

/** The solutions pages, keyed by route, each with the board's icon. */
const ROUTE_ICONS: Record<string, BoardIcon> = {
  '/solutions/individuals': UserIcon,
  '/solutions/businesses': BuildingIcon,
  '/solutions/advisers': BriefcaseIcon,
};

export interface BusinessesRoute {
  path: string;
  label: string;
  description?: string;
}

interface BusinessesHeroProps {
  pill: string;
  title: string;
  accent: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  checks: readonly string[];
  routes: readonly BusinessesRoute[];
  currentPath: string;
  facts: readonly TrustFact[];
}

function TrustIcon({ icon: Lucide }: { icon: LucideIcon }) {
  const Board = TRUST_ICONS.get(Lucide);
  return Board ? <Board size={19} /> : <Lucide size={19} strokeWidth={1.75} aria-hidden="true" />;
}

export function BusinessesHero({
  pill,
  title,
  accent,
  lead,
  primary,
  secondary,
  checks,
  routes,
  currentPath,
  facts,
}: BusinessesHeroProps) {
  return (
    <section className="nwfb-hero" aria-label="Hero">
      <div className="nw-grid-bg nwfb-hero-grid" aria-hidden="true" />
      <div className="nwfb-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwfb-rel">
        <div className="nwfb-hero-main">
          <div>
            <p className="nwfb-pill">
              <BuildingIcon size={14} stroke="#C5CAD3" />
              <span>{pill}</span>
            </p>
            <h1 className="nwfb-h1">
              {title} <span className="nw-accent">{accent}</span>
            </h1>
            <p className="nwfb-hero-lead">{lead}</p>
            <div className="nwfb-hero-actions">
              <Link className="nw-btn nwfb-hero-btn" to={primary.to}>
                {primary.label} <ArrowIcon size={18} />
              </Link>
              <Link className="nw-ghost-dark nwfb-hero-ghost" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfb-checks nwfb-hero-checks">
              {checks.map((check) => (
                <li key={check}>
                  <CheckIcon size={15} stroke="#4ADE80" />
                  {check}
                </li>
              ))}
            </ul>
          </div>

          <nav className="nwfb-routes" aria-label="Solutions">
            <div className="nwfb-routes-head">
              <span className="nw-mono nwfb-routes-k">Choose your course</span>
              <span className="nw-mono nwfb-routes-s">Solutions</span>
            </div>
            <ul className="nwfb-routes-list">
              {routes.map(({ path, label, description }) => {
                const current = path === currentPath;
                const RouteIcon = ROUTE_ICONS[path] ?? BuildingIcon;
                return (
                  <li key={path}>
                    <Link
                      className={current ? 'nwfb-route nwfb-route--on' : 'nwfb-route'}
                      to={path}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span className="nwfb-route-icon" aria-hidden="true">
                        <RouteIcon size={20} />
                      </span>
                      <span className="nwfb-route-text">
                        <span className="nwfb-route-t">{label}</span>
                        {description ? <span className="nwfb-route-d">{description}</span> : null}
                      </span>
                      {current ? (
                        <span className="nw-mono nwfb-route-here">YOU ARE HERE</span>
                      ) : (
                        <ArrowIcon size={16} className="nwfb-arr" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <ul className="nwfb-facts">
          {facts.map((fact) => (
            <li key={fact.value} className="nwfb-fact">
              <span className="nwfb-fact-icon" aria-hidden="true">
                <TrustIcon icon={fact.icon} />
              </span>
              <span>
                <span className="nwfb-fact-v">{fact.value}</span>
                <span className="nwfb-fact-l">{fact.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
