/**
 * "Comprehensive Services": a numbered card per service, each with its
 * features and a link to the service's page.
 */
import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowIcon, CheckIcon, IndividualsIcon } from './IndividualsIcons';
import { SectionHead } from './SectionHead';
import { pad2 } from './format';
import '../styles/sections.css';
import '../styles/for-individuals.css';

export interface IndividualsService {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  features: readonly string[];
}

interface IndividualsServicesProps {
  index: string;
  title: string;
  lead: string;
  services: readonly IndividualsService[];
  action: { label: string; to: string };
}

export function IndividualsServices({
  index,
  title,
  lead,
  services,
  action,
}: IndividualsServicesProps) {
  return (
    <section className="nw-sec nwfi-paper" aria-labelledby="nwfi-svc-title">
      <div className="nw-wrap">
        <div className="nwfi-svc-head">
          <SectionHead
            index={index}
            kicker="Services"
            title={title}
            lead={lead}
            titleId="nwfi-svc-title"
            className="nwfi-head--640"
          />
          <Link className="nw-btn" to={action.to}>
            {action.label} <ArrowIcon size={16} />
          </Link>
        </div>
        <ul className="nwfi-svc-grid">
          {services.map((service, i) => (
            <li key={service.link}>
              <Link className="nwfi-svc" to={service.link}>
                <div className="nwfi-svc-top">
                  <span className="nwfi-svc-icon" aria-hidden="true">
                    <IndividualsIcon icon={service.icon} size={22} />
                  </span>
                  <span className="nw-mono nwfi-svc-no" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                </div>
                <div>
                  <h3 className="nwfi-svc-t">{service.title}</h3>
                  <p className="nwfi-svc-d">{service.description}</p>
                </div>
                <ul className="nwfi-svc-feats">
                  {service.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon size={15} stroke="#0D1626" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <span className="nwfi-svc-more" aria-hidden="true">
                  Learn More <ArrowIcon size={15} className="nwfi-arr" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
