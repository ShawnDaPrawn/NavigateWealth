/**
 * VascoHero — Ask Vasco's dark page header: the compass mark, the page's one
 * H1 and the three short facts about the public chat. The chat card below
 * overlaps its lower edge, so the section leaves room for it.
 */
import { VascoIcon } from './VascoIcons';
import '../styles/sections.css';
import '../styles/ask-vasco.css';

interface VascoHeroProps {
  kicker: string;
  title: string;
  accent: string;
  lead: string;
  facts: readonly string[];
}

export function VascoHero({ kicker, title, accent, lead, facts }: VascoHeroProps) {
  return (
    <section className="nwav-hero" aria-labelledby="nwav-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwav-hero-inner">
        <span className="nwav-mark" aria-hidden="true">
          <VascoIcon name="compass" size={24} stroke="#E3D9C3" />
        </span>
        <p className="nwav-kicker">{kicker}</p>
        <h1 id="nwav-title" className="nwav-title">
          {title} <span className="nw-accent">{accent}</span>
        </h1>
        <p className="nwav-lead">{lead}</p>
        <ul className="nwav-meta">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
