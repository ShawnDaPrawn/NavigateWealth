/**
 * The closing call to action: a dark card with two actions and the trust
 * line, the compass rose drawn faintly in its corner on wider screens.
 */
import { Link } from 'react-router';
import { ArrowIcon, CheckIcon } from './BusinessesIcons';
import '../styles/for-businesses.css';

interface BusinessesCtaProps {
  title: string;
  lead: string;
  primary: { label: string; to: string };
  secondary: { label: string; to: string };
  checks: readonly string[];
}

export function BusinessesCta({ title, lead, primary, secondary, checks }: BusinessesCtaProps) {
  return (
    <section className="nwfb-cta" aria-labelledby="nwfb-cta-title">
      <div className="nw-wrap">
        <div className="nwfb-cta-box">
          <div className="nw-grid-bg nwfb-cta-grid" aria-hidden="true" />
          <svg
            className="nwfb-cta-art"
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
          <div className="nwfb-cta-copy">
            <h2 id="nwfb-cta-title" className="nwfb-h2 nwfb-cta-t">
              {title}
            </h2>
            <p className="nwfb-cta-p">{lead}</p>
            <div className="nwfb-cta-actions">
              <Link className="nwfb-cta-light" to={primary.to}>
                {primary.label} <ArrowIcon size={18} />
              </Link>
              <Link className="nwfb-cta-ghost" to={secondary.to}>
                {secondary.label}
              </Link>
            </div>
            <ul className="nwfb-checks nwfb-cta-checks">
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
