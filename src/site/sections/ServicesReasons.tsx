import { SectionHead } from './SectionHead';
import type { ServicesIcon } from './ServicesIcons';
import '../styles/sections.css';
import '../styles/services.css';

export interface ServiceReason {
  title: string;
  description: string;
  icon: ServicesIcon;
}

interface ServicesReasonsProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  reasons: readonly ServiceReason[];
}

/** The reasons to choose the firm, as tiles on a dark band. */
export function ServicesReasons({ index, kicker, title, lead, reasons }: ServicesReasonsProps) {
  return (
    <section className="nwsv-why" aria-labelledby="nwsv-why-title">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nw-wrap nwsv-why-inner">
        <SectionHead
          index={index}
          kicker={kicker}
          title={title}
          lead={lead}
          center
          dark
          titleId="nwsv-why-title"
          className="nwsv-head nwsv-head--why"
        />
        <ul className="nwsv-tiles">
          {reasons.map(({ title: name, description, icon: Icon }) => (
            <li key={name} className="nwsv-tile">
              <span className="nwsv-tile-icon" aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3 className="nwsv-tile-t">{name}</h3>
              <p className="nwsv-tile-d">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
