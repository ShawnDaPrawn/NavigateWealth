/**
 * TeamApproach — "02 — Approach": three waypoints on a dashed course line
 * (paper band), then the page's closing actions.
 */
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { pad2 } from './format';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/team.css';

export interface TeamWaypoint {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
}

interface TeamApproachProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  points: readonly TeamWaypoint[];
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
}

export function TeamApproach({
  index,
  kicker,
  title,
  lead,
  points,
  primary,
  secondary,
}: TeamApproachProps) {
  return (
    <section className="nwtm-approach" aria-labelledby="nwtm-approach-title">
      <div className="nw-wrap">
        <div className="nwtm-approach-head">
          <p className="nw-kicker nw-mono">
            {index} — {kicker}
          </p>
          <h2 id="nwtm-approach-title" className="nw-sec-title">
            {title}
          </h2>
          <p className="nwtm-approach-lead">{lead}</p>
        </div>

        <div className="nwtm-track">
          <div className="nwtm-course" aria-hidden="true" />
          <ol className="nwtm-steps">
            {points.map(({ title: t, description, icon: Icon }, i) => (
              <li key={t} className="nwtm-step">
                <span className="nwtm-marker" aria-hidden="true">
                  <Icon size={24} />
                </span>
                <span className="nw-mono nwtm-leg" aria-hidden="true">
                  WAYPOINT {pad2(i + 1)}
                </span>
                <h3 className="nw-h nwtm-step-t">{t}</h3>
                <p className="nwtm-step-d">{description}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="nwtm-actions">
          <Link className="nw-btn nw-btn--lg" to={primary.to}>
            {primary.label}
            <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
          </Link>
          <Link className="nw-outline nw-btn--lg" to={secondary.to}>
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
