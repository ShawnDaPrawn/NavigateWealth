import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { NwImage } from '../components/NwImage';
import { SectionHead } from './SectionHead';
import { pad2 } from './format';
import '../styles/sections.css';
import '../styles/home.css';

export interface ServiceCard {
  title: string;
  description: string;
  link: string;
  image: string;
  imageKey?: string;
}

interface ServiceCardsProps {
  index: string;
  title: string;
  lead: string;
  services: readonly ServiceCard[];
  allLink: { label: string; to: string };
}

/**
 * A numbered card per service. On phones the cards become compact rows so
 * eight services do not run to eight screens.
 *
 * The photographs are decorative (alt=""): each card's link already reads out
 * the service's name.
 */
export function ServiceCards({ index, title, lead, services, allLink }: ServiceCardsProps) {
  return (
    <section className="nw-sec nw-sec--white" aria-labelledby="nwsc-title">
      <div className="nw-wrap">
        <div className="nw-sec-row">
          <SectionHead
            index={index}
            kicker="Services"
            title={title}
            lead={lead}
            titleId="nwsc-title"
          />
          <Link className="nw-textlink" to={allLink.to}>
            {allLink.label}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <ul className="nwsc-grid">
          {services.map((service, i) => (
            <li key={service.link}>
              <Link className="nwsc-card" to={service.link}>
                <span className="nwsc-media">
                  <NwImage
                    src={service.image}
                    imageKey={service.imageKey}
                    alt=""
                    sizes="(max-width: 640px) 104px, (max-width: 1000px) 50vw, 25vw"
                  />
                  <span className="nwsc-no nw-mono" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                </span>
                <span className="nwsc-body">
                  <h3 className="nwsc-title">{service.title}</h3>
                  <span className="nwsc-desc nw-clamp3">{service.description}</span>
                  <span className="nwsc-cta" aria-hidden="true">
                    Learn More
                    <ArrowRight size={15} strokeWidth={1.75} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
