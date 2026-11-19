/**
 * ContactHero — the contact page's opening: the heading, the switchboard and
 * mailbox, and a stylised chart of the office with its address and hours.
 *
 * The chart is drawn inline (no map service, no third-party embed). The board
 * labels its grid with latitudes and longitudes; those are left out, because
 * the office's coordinates are not among the firm's checkable facts
 * (companyFacts.ts) and the board's grid puts the marker away from the
 * address. The drawing itself is the board's.
 */
import { ContactIcon } from './ContactIcons';
import '../styles/sections.css';
import '../styles/contact.css';

interface ContactHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  phone: { display: string; href: string };
  email: string;
  address: string;
  hours: string;
  languages: string;
}

export function ContactHero({
  badge,
  title,
  accent,
  lead,
  phone,
  email,
  address,
  hours,
  languages,
}: ContactHeroProps) {
  return (
    <section className="nwct-hero" aria-labelledby="nwct-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwct-hero-grid">
        <div>
          <div className="nwct-pill">
            <ContactIcon name="message" size={14} stroke="#C5CAD3" />
            <span>{badge}</span>
          </div>
          <h1 id="nwct-title" className="nwct-title">
            {title} <span className="nw-accent">{accent}</span>
          </h1>
          <p className="nwct-lead">{lead}</p>
          <div className="nwct-chips">
            <a className="nwct-chip" href={phone.href}>
              <span className="nwct-chip-icon" aria-hidden="true">
                <ContactIcon name="phone" size={17} />
              </span>
              <span>
                <span className="nwct-chip-l nw-mono">Switchboard</span>
                <span className="nwct-chip-v">{phone.display}</span>
              </span>
            </a>
            <a className="nwct-chip" href={`mailto:${email}`}>
              <span className="nwct-chip-icon" aria-hidden="true">
                <ContactIcon name="mail" size={17} />
              </span>
              <span>
                <span className="nwct-chip-l nw-mono">Email us</span>
                <span className="nwct-chip-v">{email}</span>
              </span>
            </a>
          </div>
        </div>

        <div className="nwct-chart">
          <OfficeChart />
          <dl className="nwct-chart-facts">
            <div className="nwct-chart-fact">
              <dt className="nwct-chart-l nw-mono">Office</dt>
              <dd className="nwct-chart-v">{address}</dd>
            </div>
            <div className="nwct-chart-fact">
              <dt className="nwct-chart-l nw-mono">Office hours</dt>
              <dd className="nwct-chart-v">{hours}</dd>
              <dd className="nwct-chart-s">{languages}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

const CONTOURS = [
  'M-20 250 C 80 210, 150 260, 250 220 S 420 150, 600 190',
  'M-20 215 C 90 175, 160 225, 260 185 S 420 115, 600 150',
  'M-20 180 C 100 140, 170 190, 270 150 S 430 80, 600 110',
  'M-20 290 C 70 255, 140 300, 240 262 S 410 195, 600 235',
  'M-20 120 C 110 90, 190 140, 290 105 S 440 40, 600 70',
];

/** The board's chart: a grid, contour lines, a dashed route to the office and a compass. */
function OfficeChart() {
  return (
    <svg
      className="nwct-chart-svg"
      viewBox="0 0 560 340"
      width="100%"
      role="img"
      aria-label="Stylised chart marking the Navigate Wealth office in Pretoria"
    >
      <rect width="560" height="340" fill="#0A0F1A" />
      <g stroke="rgba(255,255,255,0.05)">
        {[68, 136, 204, 272].map((y) => (
          <line key={`h${y}`} x1="0" y1={y} x2="560" y2={y} />
        ))}
        {[112, 224, 336, 448].map((x) => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="340" />
        ))}
      </g>
      <g fill="none" stroke="rgba(201, 209, 224, 0.16)">
        {CONTOURS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path
        d="M40 300 L 150 238 L 252 196 L 330 162"
        fill="none"
        stroke="#C5CAD3"
        strokeOpacity="0.7"
        strokeWidth="1.6"
        strokeDasharray="5 6"
      />
      <circle
        cx="330"
        cy="162"
        r="34"
        fill="#0D1626"
        fillOpacity="0.12"
        stroke="#C5CAD3"
        strokeOpacity="0.35"
      />
      <circle cx="330" cy="162" r="16" fill="#0D1626" fillOpacity="0.25" />
      <circle cx="330" cy="162" r="6" fill="#E3D9C3" />
      <g transform="translate(500 50)" fill="none" stroke="rgba(255,255,255,0.4)">
        <circle r="20" />
        <polygon points="0,-17 4,0 0,17 -4,0" fill="rgba(201, 209, 224, 0.6)" stroke="none" />
        <text
          y="-25"
          textAnchor="middle"
          fontFamily="'Inter Variable', Inter, sans-serif"
          fontSize="10"
          fill="#E3D9C3"
          stroke="none"
        >
          N
        </text>
      </g>
    </svg>
  );
}
