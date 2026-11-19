import { Link } from 'react-router';
import { NwImage } from '../components/NwImage';
import { SectionHead } from './SectionHead';
import { ArrowIcon, CheckIcon } from './ServicesIcons';
import '../styles/sections.css';
import '../styles/services.css';

export interface ServiceRow {
  /** Also the row's anchor, which the hero's service index links to. */
  id: string;
  no: string;
  title: string;
  description: string;
  highlights: readonly string[];
  path: string;
  image: string;
  imageKey?: string;
}

interface ServicesRowsProps {
  index: string;
  title: string;
  lead: string;
  services: readonly ServiceRow[];
}

/**
 * Every service as one full-width row: name and summary, what it covers, a
 * photograph and an arrow. The whole row is the link to the service's page,
 * named by the service's title.
 *
 * The photographs are decorative (alt=""): the link already reads out the
 * service's name. Phones and tablets never download them, as the layout hides
 * them there.
 */
export function ServicesRows({ index, title, lead, services }: ServicesRowsProps) {
  return (
    <section className="nwsv-list" aria-labelledby="nwsv-list-title">
      <div className="nw-wrap">
        <SectionHead
          index={index}
          kicker="Services"
          title={title}
          lead={lead}
          titleId="nwsv-list-title"
          className="nwsv-head nwsv-head--list"
        />
        <ul className="nwsv-rows">
          {services.map((service) => {
            const titleId = `nwsv-row-${service.id}`;
            return (
              <li key={service.id}>
                <Link
                  id={service.id}
                  className="nwsv-row"
                  to={service.path}
                  aria-labelledby={titleId}
                >
                  <div className="nwsv-row-text">
                    <span className="nw-mono nwsv-row-no">{service.no}</span>
                    <h3 id={titleId} className="nwsv-row-t">
                      {service.title}
                    </h3>
                    <p className="nwsv-row-d">{service.description}</p>
                  </div>
                  <ul className="nwsv-row-hl">
                    {service.highlights.map((highlight) => (
                      <li key={highlight}>
                        <CheckIcon size={15} stroke="#0D1626" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                  <div className="nwsv-row-end">
                    <div className="nwsv-row-media">
                      <NwImage
                        src={service.image}
                        imageKey={service.imageKey}
                        alt=""
                        sizes="200px"
                        hiddenBelow={860}
                      />
                    </div>
                    <span className="nwsv-row-go" aria-hidden="true">
                      <ArrowIcon size={18} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
