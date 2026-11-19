/**
 * ProductQuoteHero — the opening of the quote funnel's last step: the
 * breadcrumb back to the services, where the visitor is in the funnel, the
 * service being quoted as the page's one H1, its summary (from
 * quote/constants.ts), and the board's route drawing (service, details, your
 * quote), hidden on narrow screens as on the board.
 */
import { Link } from 'react-router';
import '../styles/sections.css';
import '../styles/product-quote.css';

const MIST = '#C5CAD3';
const CREAM = '#E3D9C3';

interface ProductQuoteHeroProps {
  /** The service being quoted, e.g. "Risk Management". */
  label: string;
  summary: string;
  servicesHref: string;
}

export function ProductQuoteHero({ label, summary, servicesHref }: ProductQuoteHeroProps) {
  return (
    <section className="nwpq-hero" aria-labelledby="nwpq-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <svg
        className="nwpq-route nwpq-hide-md"
        aria-hidden="true"
        focusable="false"
        width="420"
        height="300"
        viewBox="0 0 420 300"
        fill="none"
      >
        <path
          d="M10 270 C 90 230, 150 210, 210 150 S 330 60, 410 30"
          stroke={MIST}
          strokeOpacity="0.45"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
        <path
          d="M10 210 L410 90 M10 120 L410 240 M60 290 L360 10"
          stroke={MIST}
          strokeOpacity="0.14"
          strokeWidth="0.75"
        />
        <circle cx="90" cy="232" r="4" stroke={MIST} strokeOpacity="0.6" strokeWidth="0.75" />
        <circle cx="210" cy="150" r="4" stroke={MIST} strokeOpacity="0.6" strokeWidth="0.75" />
        <circle cx="350" cy="52" r="7" stroke={CREAM} strokeOpacity="0.8" strokeWidth="0.75" />
        <circle cx="350" cy="52" r="2" fill={CREAM} fillOpacity="0.8" />
        <text
          x="96"
          y="256"
          fontFamily="'Newsreader Variable', Georgia, serif"
          fontStyle="italic"
          fontSize="12"
          fill={MIST}
          fillOpacity="0.7"
        >
          service
        </text>
        <text
          x="218"
          y="172"
          fontFamily="'Newsreader Variable', Georgia, serif"
          fontStyle="italic"
          fontSize="12"
          fill={MIST}
          fillOpacity="0.7"
        >
          details
        </text>
        <text
          x="300"
          y="84"
          fontFamily="'Newsreader Variable', Georgia, serif"
          fontStyle="italic"
          fontSize="12"
          fill={CREAM}
          fillOpacity="0.85"
        >
          your quote
        </text>
      </svg>
      <div className="nw-wrap nwpq-hero-wrap">
        <nav aria-label="Breadcrumb" className="nwpq-crumbs">
          <Link className="nwpq-crumb" to="/">
            Home
          </Link>
          <span aria-hidden="true" className="nwpq-crumb-sep">
            /
          </span>
          <Link className="nwpq-crumb" to={servicesHref}>
            Get a Quote
          </Link>
          <span aria-hidden="true" className="nwpq-crumb-sep">
            /
          </span>
          <span aria-current="page" className="nwpq-crumb-here">
            {label}
          </span>
        </nav>
        <p className="nw-eyebrow nwpq-eyebrow">Step 3 of 3 — Quote details · last step</p>
        <h1 id="nwpq-title" className="nw-h nwpq-title">
          {label} <span className="nw-accent">quote</span>
        </h1>
        <p className="nwpq-lead">{summary}</p>
      </div>
    </section>
  );
}
