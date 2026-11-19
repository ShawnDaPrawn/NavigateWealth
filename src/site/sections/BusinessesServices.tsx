/**
 * The business services as four numbered cards, each linking to its service
 * page, with the quote action beside the section heading.
 */
import { Link } from 'react-router';
import { pad2 } from './format';
import { ArrowIcon, CheckIcon, type BusinessesIcon } from './BusinessesIcons';
import '../styles/for-businesses.css';

export interface BusinessesService {
  title: string;
  description: string;
  link: string;
  features: readonly string[];
  icon: BusinessesIcon;
}

interface BusinessesServicesProps {
  kicker: string;
  title: string;
  lead: string;
  action: { label: string; to: string };
  services: readonly BusinessesService[];
}

export function BusinessesServices({
  kicker,
  title,
  lead,
  action,
  services,
}: BusinessesServicesProps) {
  return (
    <section className="nw-sec nwfb-svc" aria-labelledby="nwfb-svc-title">
      <div className="nw-wrap">
        <div className="nwfb-svc-row">
          <div className="nwfb-svc-head">
            <p className="nw-kicker nw-mono">{kicker}</p>
            <h2 id="nwfb-svc-title" className="nwfb-h2">
              {title}
            </h2>
            <p className="nwfb-lead">{lead}</p>
          </div>
          <Link className="nw-btn nwfb-btn-md" to={action.to}>
            {action.label} <ArrowIcon size={16} />
          </Link>
        </div>
        <ul className="nwfb-svc-grid">
          {services.map(({ title: name, description, link, features, icon: Icon }, i) => (
            <li key={link}>
              <Link className="nwfb-card" to={link}>
                <span className="nwfb-card-top">
                  <span className="nwfb-card-icon" aria-hidden="true">
                    <Icon size={22} />
                  </span>
                  <span className="nw-mono nwfb-card-no" aria-hidden="true">
                    {pad2(i + 1)}
                  </span>
                </span>
                <span className="nwfb-card-body">
                  <h3 className="nwfb-card-t">{name}</h3>
                  <span className="nwfb-card-d">{description}</span>
                </span>
                <span className="nwfb-card-feats">
                  {features.map((feature) => (
                    <span key={feature} className="nwfb-card-f">
                      <CheckIcon size={15} stroke="#0D1626" />
                      {feature}
                    </span>
                  ))}
                </span>
                <span className="nwfb-card-cta" aria-hidden="true">
                  Learn More <ArrowIcon size={15} className="nwfb-arr" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
