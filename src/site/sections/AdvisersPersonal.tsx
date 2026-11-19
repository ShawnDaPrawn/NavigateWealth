/**
 * AdvisersPersonal — the navy band between the services and the support
 * section: a short promise and the confidential-consultation action, with the
 * compass rose the board draws at its right edge (hidden on narrow screens).
 */
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import type { AdvisersAction } from './AdvisersHero';
import '../styles/sections.css';
import '../styles/for-advisers.css';

interface AdvisersPersonalProps {
  kicker: string;
  title: string;
  lead: string;
  action: AdvisersAction;
}

export function AdvisersPersonal({ kicker, title, lead, action }: AdvisersPersonalProps) {
  return (
    <section className="nwfa-band" aria-labelledby="nwfa-band-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <svg
        className="nwfa-band-rose"
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
      <div className="nw-wrap nwfa-band-row">
        <div className="nwfa-band-copy">
          <p className="nw-mono nwfa-band-kicker">{kicker}</p>
          <h2 id="nwfa-band-title" className="nwfa-band-title">
            {title}
          </h2>
          <p className="nwfa-band-lead">{lead}</p>
        </div>
        <Link className="nw-btn nwfa-band-btn" to={action.to}>
          <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
          {action.label}
        </Link>
      </div>
    </section>
  );
}
