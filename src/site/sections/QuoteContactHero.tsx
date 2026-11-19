/**
 * QuoteContactHero — the opening of the quote funnel's "your details" step:
 * the breadcrumb back to the services, where the visitor is in the funnel,
 * the service being quoted as the page's one H1, and the board's compass
 * drawing (hidden on narrow screens, as on the board).
 */
import { Link } from 'react-router';
import '../styles/sections.css';
import '../styles/quote-contact.css';

interface QuoteContactHeroProps {
  /** The service being quoted, e.g. "Risk Management". */
  label: string;
  eyebrow: string;
  lead: string;
  servicesHref: string;
}

export function QuoteContactHero({ label, eyebrow, lead, servicesHref }: QuoteContactHeroProps) {
  return (
    <section className="nwqc-hero" aria-labelledby="nwqc-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <svg
        className="nwqc-compass nwqc-hide-md"
        aria-hidden="true"
        focusable="false"
        width="360"
        height="360"
        viewBox="0 0 360 360"
        fill="none"
      >
        <circle
          cx="180"
          cy="180"
          r="170"
          stroke="#C5CAD3"
          strokeOpacity="0.35"
          strokeWidth="0.75"
        />
        <circle
          cx="180"
          cy="180"
          r="158"
          stroke="#C5CAD3"
          strokeOpacity="0.3"
          strokeWidth="6"
          strokeDasharray="0.75 15.79"
        />
        <circle
          cx="180"
          cy="180"
          r="110"
          stroke="#C5CAD3"
          strokeOpacity="0.22"
          strokeWidth="0.75"
        />
        <path
          d="M180 22 L189 171 L338 180 L189 189 L180 338 L171 189 L22 180 L171 171 Z"
          stroke="#C5CAD3"
          strokeOpacity="0.4"
          strokeWidth="0.75"
        />
        <path
          d="M68 68 L292 292 M292 68 L68 292"
          stroke="#C5CAD3"
          strokeOpacity="0.16"
          strokeWidth="0.75"
        />
        <text
          x="180"
          y="14"
          textAnchor="middle"
          fontFamily="'Newsreader Variable', Georgia, serif"
          fontStyle="italic"
          fontSize="13"
          fill="#E3D9C3"
          fillOpacity="0.75"
        >
          N
        </text>
      </svg>
      <div className="nw-wrap nwqc-hero-wrap">
        <nav aria-label="Breadcrumb" className="nwqc-crumbs">
          <Link className="nwqc-crumb" to="/">
            Home
          </Link>
          <span aria-hidden="true" className="nwqc-crumb-sep">
            /
          </span>
          <Link className="nwqc-crumb" to={servicesHref}>
            Get a Quote
          </Link>
          <span aria-hidden="true" className="nwqc-crumb-sep">
            /
          </span>
          <span aria-current="page" className="nwqc-crumb-here">
            {label}
          </span>
        </nav>
        <p className="nw-eyebrow nwqc-eyebrow">{eyebrow}</p>
        <h1 id="nwqc-title" className="nw-h nwqc-title">
          {label} <span className="nw-accent">quote</span>
        </h1>
        <p className="nwqc-lead">{lead}</p>
      </div>
    </section>
  );
}
