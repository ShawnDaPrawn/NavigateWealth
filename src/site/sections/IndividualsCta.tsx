/**
 * The closing call to action: a dark card with two actions and the
 * reassurances under them, a compass rose in its corner on wide screens.
 */
import { Link } from 'react-router';
import { ArrowIcon, CheckIcon } from './IndividualsIcons';
import '../styles/sections.css';
import '../styles/for-individuals.css';

interface IndividualsCtaProps {
  title: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  checks: readonly string[];
}

export function IndividualsCta({ title, lead, primary, secondary, checks }: IndividualsCtaProps) {
  return (
    <section className="nwfi-cta" aria-labelledby="nwfi-cta-title">
      <div className="nw-wrap">
        <div className="nwfi-cta-box">
          <div className="nw-grid-bg nwfi-cta-gridbg" aria-hidden="true" />
          <svg
            className="nwfi-cta-art"
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
          <div className="nwfi-cta-copy">
            <h2 id="nwfi-cta-title" className="nwfi-h2 nwfi-cta-t">
              {title}
            </h2>
            <p className="nwfi-cta-p">{lead}</p>
            <div className="nwfi-cta-actions">
              <Link className="nwfi-cta-light" to={primary.to}>
                {primary.label} <ArrowIcon size={18} />
              </Link>
              <Link className="nwfi-cta-ghost" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfi-checks nwfi-checks--cta">
              {checks.map((check) => (
                <li key={check}>
                  <CheckIcon size={15} />
                  {check}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
