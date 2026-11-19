/**
 * AdvisersServices — the six succession and advisory services as numbered
 * cards, each a link to where that service is taken further, with the
 * section's own call to action beside the heading.
 */
import { Link } from 'react-router';
import { ArrowRight, Check } from 'lucide-react';
import type { AdvisersIconType } from './AdvisersIcons';
import type { AdvisersAction } from './AdvisersHero';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/for-advisers.css';

export interface AdvisersService {
  no: string;
  title: string;
  description: string;
  features: readonly string[];
  to: string;
  cta: string;
  icon: AdvisersIconType;
}

interface AdvisersServicesProps {
  index: string;
  kicker: string;
  title: string;
  lead: string;
  action: AdvisersAction;
  services: readonly AdvisersService[];
}

export function AdvisersServices({
  index,
  kicker,
  title,
  lead,
  action,
  services,
}: AdvisersServicesProps) {
  return (
    <section className="nw-sec nw-sec--paper" aria-labelledby="nwfa-services-title">
      <div className="nw-wrap">
        <div className="nwfa-row">
          <SectionHead
            index={index}
            kicker={kicker}
            title={title}
            lead={lead}
            titleId="nwfa-services-title"
            className="nwfa-head nwfa-head--row"
          />
          <Link className="nw-btn" to={action.to}>
            {action.label}
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        </div>
        <ul className="nwfa-cards">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <li key={service.title}>
                <Link className="nwfa-card" to={service.to}>
                  <div className="nwfa-card-top">
                    <span className="nwfa-card-icon">
                      <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="nw-mono nwfa-card-no" aria-hidden="true">
                      {service.no}
                    </span>
                  </div>
                  <div>
                    <h3 className="nw-h nwfa-card-t">{service.title}</h3>
                    <p className="nwfa-card-d">{service.description}</p>
                  </div>
                  <ul className="nwfa-card-feats">
                    {service.features.map((feature) => (
                      <li key={feature}>
                        <Check size={15} strokeWidth={1.75} aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <span className="nwfa-card-cta">
                    {service.cta}
                    <ArrowRight
                      className="nwfa-arr"
                      size={15}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
