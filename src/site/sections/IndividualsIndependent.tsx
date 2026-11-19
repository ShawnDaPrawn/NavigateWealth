/**
 * "Independent Advice, Personally Delivered": a dark band with one call to
 * action, a compass rose drawn faintly behind it on wide screens.
 */
import { Link } from 'react-router';
import { CalendarIcon } from './IndividualsIcons';
import '../styles/sections.css';
import '../styles/for-individuals.css';

interface IndividualsIndependentProps {
  kicker: string;
  title: string;
  lead: string;
  action: { label: string; to: string };
}

export function IndividualsIndependent({
  kicker,
  title,
  lead,
  action,
}: IndividualsIndependentProps) {
  return (
    <section className="nwfi-indep" aria-labelledby="nwfi-indep-title">
      <div className="nw-grid-bg nwfi-indep-gridbg" aria-hidden="true" />
      <svg
        className="nwfi-indep-art"
        aria-hidden="true"
        focusable="false"
        width="420"
        height="420"
        viewBox="0 0 480 480"
        fill="none"
      >
        <circle cx="240" cy="240" r="224" stroke="rgba(255,255,255,0.12)" />
        <circle
          cx="240"
          cy="240"
          r="208"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="8"
          strokeDasharray="1 17.15"
        />
        <circle
          cx="240"
          cy="240"
          r="208"
          stroke="rgba(201, 209, 224, 0.45)"
          strokeWidth="16"
          strokeDasharray="2 106.92"
        />
        <polygon
          points="240,112 258.4,221.6 368,240 258.4,258.4 240,368 221.6,258.4 112,240 221.6,221.6"
          stroke="rgba(255,255,255,0.18)"
        />
      </svg>
      <div className="nw-wrap nwfi-indep-row">
        <div className="nwfi-indep-copy">
          <p className="nw-mono nwfi-indep-k">{kicker}</p>
          <h2 id="nwfi-indep-title" className="nwfi-h2 nwfi-indep-t">
            {title}
          </h2>
          <p className="nwfi-indep-p">{lead}</p>
        </div>
        <Link className="nw-btn nwfi-indep-btn" to={action.to}>
          <CalendarIcon size={18} />
          {action.label}
        </Link>
      </div>
    </section>
  );
}
