/**
 * GetQuoteHero — the Get a Quote page's opening: a centred headline on navy
 * with the four reasons to ask for a quote beneath it.
 */
import { GetQuoteIcon, type GetQuoteIconName } from './GetQuoteIcons';
import '../styles/sections.css';
import '../styles/get-quote.css';

export interface GetQuoteHighlight {
  icon: GetQuoteIconName;
  label: string;
}

interface GetQuoteHeroProps {
  badge: string;
  title: string;
  accent: string;
  lead: string;
  highlights: readonly GetQuoteHighlight[];
}

export function GetQuoteHero({ badge, title, accent, lead, highlights }: GetQuoteHeroProps) {
  return (
    <section className="nwgq-hero" aria-labelledby="nwgq-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwgq-hero-glow" aria-hidden="true" />
      <div className="nw-wrap nwgq-hero-inner">
        <p className="nwgq-pill">
          <span className="nwgq-pill-dot" aria-hidden="true" />
          {badge}
        </p>
        <h1 id="nwgq-title" className="nwgq-h1">
          {title} <span className="nw-accent">{accent}</span>
        </h1>
        <p className="nwgq-lead">{lead}</p>
        <ul className="nwgq-highlights">
          {highlights.map((item) => (
            <li key={item.label}>
              <GetQuoteIcon name={item.icon} size={15} stroke="#C5CAD3" />
              {item.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
