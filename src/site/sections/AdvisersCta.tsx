/**
 * AdvisersCta — the closing navy card: the heading, the lead, a light primary
 * action and a ghost secondary one, the assurance line, and the compass rose
 * the board sets in the bottom-right corner (hidden on narrow screens).
 */
import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import type { AdvisersAction } from './AdvisersHero';
import '../styles/sections.css';
import '../styles/for-advisers.css';

interface AdvisersCtaProps {
  title: string;
  lead: string;
  primary: AdvisersAction;
  secondary: AdvisersAction;
  assurances: readonly string[];
}

export function AdvisersCta({ title, lead, primary, secondary, assurances }: AdvisersCtaProps) {
  return (
    <section className="nwfa-cta" aria-labelledby="nwfa-cta-title">
      <div className="nw-wrap">
        <div className="nwfa-cta-card">
          <div className="nw-grid-bg" aria-hidden="true" />
          <svg
            className="nwfa-cta-rose"
            aria-hidden="true"
            focusable="false"
            width="380"
            height="380"
            viewBox="0 0 480 480"
            fill="none"
          >
            <circle cx="240" cy="240" r="224" stroke="rgba(255,255,255,0.3)" />
            <circle
              cx="240"
              cy="240"
              r="208"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="10"
              strokeDasharray="1 17.15"
            />
            <polygon
              points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
              stroke="rgba(255,255,255,0.4)"
            />
          </svg>
          <div className="nwfa-cta-copy">
            <h2 id="nwfa-cta-title" className="nwfa-cta-title">
              {title}
            </h2>
            <p className="nwfa-cta-lead">{lead}</p>
            <div className="nwfa-cta-actions">
              <Link className="nwfa-cta-light" to={primary.to}>
                {primary.label}
                <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link className="nwfa-cta-ghost" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfa-assure nwfa-assure--cta">
              {assurances.map((item) => (
                <li key={item}>
                  <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
