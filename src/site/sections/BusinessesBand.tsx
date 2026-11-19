/**
 * The dark "Founder-led · Independent" band: a statement and one action, with
 * the compass rose drawn faintly behind it on wider screens.
 */
import { Link } from 'react-router';
import { CalendarIcon } from './BusinessesIcons';
import '../styles/for-businesses.css';

interface BusinessesBandProps {
  kicker: string;
  title: string;
  lead: string;
  action: { label: string; to: string };
}

export function BusinessesBand({ kicker, title, lead, action }: BusinessesBandProps) {
  return (
    <section className="nwfb-band" aria-labelledby="nwfb-band-title">
      <div className="nw-grid-bg nwfb-band-grid" aria-hidden="true" />
      <svg
        className="nwfb-band-art"
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
      <div className="nw-wrap nwfb-band-inner">
        <div className="nwfb-band-copy">
          <p className="nw-mono nwfb-band-k">{kicker}</p>
          <h2 id="nwfb-band-title" className="nwfb-h2 nwfb-band-t">
            {title}
          </h2>
          <p className="nwfb-band-p">{lead}</p>
        </div>
        <Link className="nw-btn nwfb-btn-lg nwfb-band-btn" to={action.to}>
          <CalendarIcon size={18} />
          {action.label}
        </Link>
      </div>
    </section>
  );
}
