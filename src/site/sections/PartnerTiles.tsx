import { NwLogo } from '../components/NwLogo';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';

export interface PartnerTile {
  id: string;
  name: string;
  logo: string;
  est: string;
}

interface PartnerTilesProps {
  id?: string;
  index: string;
  kicker: string;
  title: string;
  partners: PartnerTile[];
}

/** Provider logos, each with the year it was established. */
export function PartnerTiles({
  id = 'partners',
  index,
  kicker,
  title,
  partners,
}: PartnerTilesProps) {
  if (partners.length === 0) return null;
  return (
    <section id={id} aria-label="Trusted partners" className="nw-sec nw-sec--white">
      <div className="nw-wrap">
        <SectionHead index={index} kicker={kicker} title={title} center className="nwl-head" />
        <ul className="nwl-grid">
          {partners.map((p) => (
            <li key={p.id} className="nwl-tile">
              <NwLogo src={p.logo} alt={`${p.name} logo`} sizes="140px" />
              <span className="nwl-est nw-mono">Est. {p.est}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
