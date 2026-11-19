/**
 * GetQuoteServices — step one of the quote flow: the progress card, a card
 * per service that goes straight to that service's contact step, a navy card
 * for visitors who are not sure where to start, and the firm's credentials.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { GetQuoteIcon, type GetQuoteIconName } from './GetQuoteIcons';
import { GetQuoteSteps, type GetQuoteStep } from './GetQuoteSteps';
import '../styles/sections.css';
import '../styles/get-quote.css';

export interface GetQuoteServiceCard {
  id: string;
  no: string;
  label: string;
  description: string;
  chips: readonly string[];
  icon: GetQuoteIconName;
  /** Where the card goes: the service's contact step. */
  to: string;
}

interface GetQuoteServicesProps {
  steps: readonly GetQuoteStep[];
  notes: readonly string[];
  /** The phone-width hint on which card to pick. */
  hint: ReactNode;
  services: readonly GetQuoteServiceCard[];
  help: {
    title: string;
    text: string;
    action: { label: string; to: string };
    phone: { display: string; href: string };
  };
  footnote: string;
  trust: readonly { label: string; icon: GetQuoteIconName }[];
}

export function GetQuoteServices({
  steps,
  notes,
  hint,
  services,
  help,
  footnote,
  trust,
}: GetQuoteServicesProps) {
  return (
    <section className="nwgq-choose">
      <div className="nw-wrap">
        <GetQuoteSteps steps={steps} notes={notes} />

        <p className="nwgq-hint">{hint}</p>

        <div className="nwgq-grid">
          {services.map((service) => (
            <Link
              key={service.id}
              className="nwgq-card"
              to={service.to}
              aria-label={`Get a ${service.label} quote`}
            >
              <div className="nwgq-card-top">
                <span className="nwgq-card-icon">
                  <GetQuoteIcon name={service.icon} size={22} />
                </span>
                <span className="nw-mono nwgq-card-no">{service.no}</span>
              </div>
              <div>
                <h2 className="nwgq-card-title">{service.label}</h2>
                <p className="nwgq-card-text">{service.description}</p>
              </div>
              <div className="nwgq-chips">
                {service.chips.map((chip) => (
                  <span key={chip} className="nwgq-chip">
                    {chip}
                  </span>
                ))}
              </div>
              <span className="nwgq-card-go">
                Start quote <GetQuoteIcon name="arrowRight" size={15} />
              </span>
            </Link>
          ))}

          <div className="nwgq-help">
            <div className="nw-grid-bg" aria-hidden="true" />
            <span className="nwgq-help-icon">
              <GetQuoteIcon name="compass" size={22} />
            </span>
            <div className="nwgq-help-copy">
              <h2 className="nwgq-help-title">{help.title}</h2>
              <p className="nwgq-help-text">{help.text}</p>
            </div>
            <div className="nwgq-help-actions">
              <Link className="nw-btn" to={help.action.to}>
                {help.action.label}
              </Link>
              <a className="nwgq-help-call" href={help.phone.href}>
                <GetQuoteIcon name="phone" size={14} />
                {help.phone.display}
              </a>
            </div>
          </div>
        </div>

        <div className="nwgq-foot">
          <p className="nwgq-foot-text">{footnote}</p>
          <ul className="nwgq-trust">
            {trust.map((item) => (
              <li key={item.label}>
                <GetQuoteIcon name={item.icon} size={15} stroke="#15803D" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
