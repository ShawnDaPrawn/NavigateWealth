/**
 * ContactEnquiry — "How Can We Help?": three audience tabs, a card for the
 * chosen audience (what we offer them and how to reach us), and the enquiry
 * form beside it.
 *
 * Every audience card is rendered and the inactive ones carry `hidden`, so
 * all three are in the document for search engines and find-in-page, as on
 * the live page. Tabs follow the WAI-ARIA pattern: arrow keys, Home and End;
 * only the selected tab is in the tab order. The form keeps what has been
 * typed when the audience changes, and files the enquiry under the audience
 * selected when it is sent.
 */
import { useId, useRef, type KeyboardEvent } from 'react';
import { ContactForm } from './ContactForm';
import { ContactIcon } from './ContactIcons';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';
import '../styles/contact.css';

export interface EnquiryType {
  key: string;
  code: string;
  label: string;
  description: string;
  services: readonly string[];
  messagePlaceholder: string;
}

interface ContactEnquiryProps {
  kicker: string;
  title: string;
  lead: string;
  types: readonly EnquiryType[];
  active: string;
  onSelect: (key: string) => void;
  /** The rows under each audience card. */
  details: readonly { label: string; value: string }[];
  consultationHref: string;
}

export function ContactEnquiry({
  kicker,
  title,
  lead,
  types,
  active,
  onSelect,
  details,
  consultationHref,
}: ContactEnquiryProps) {
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = types.length;
  const activeIndex = Math.max(
    0,
    types.findIndex((t) => t.key === active),
  );
  const current = types[activeIndex];
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowDown: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      ArrowUp: activeIndex - 1,
      Home: 0,
      End: count - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = (moves[e.key] + count) % count;
    onSelect(types[next].key);
    tabRefs.current[next]?.focus({ preventScroll: true });
  };

  if (!current) return null;

  return (
    <section className="nwct-help" aria-labelledby={`${base}-title`}>
      <div className="nw-wrap">
        <div className="nwct-help-top">
          <SectionHead
            kicker={kicker}
            title={title}
            lead={lead}
            titleId={`${base}-title`}
            className="nwct-head"
          />
          <div role="tablist" aria-label="Enquiry type" className="nwct-tablist">
            {types.map((t, i) => (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={i === activeIndex}
                aria-controls={panelId(i)}
                tabIndex={i === activeIndex ? 0 : -1}
                className="nwct-tab"
                onClick={() => onSelect(t.key)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="nwct-grid">
          {types.map((t, i) => (
            <div
              key={t.key}
              role="tabpanel"
              id={panelId(i)}
              aria-labelledby={tabId(i)}
              hidden={i !== activeIndex}
              className="nwct-card"
            >
              <div className="nw-grid-bg" aria-hidden="true" />
              <div className="nwct-card-inner">
                <p className="nwct-card-code nw-mono">{t.code}</p>
                <h3 className="nwct-card-title">{t.label}</h3>
                <p className="nwct-card-desc">{t.description}</p>
                <ul className="nwct-services">
                  {t.services.map((service) => (
                    <li key={service}>
                      <ContactIcon name="check" size={16} stroke="#C5CAD3" />
                      {service}
                    </li>
                  ))}
                </ul>
                <dl className="nwct-card-dl">
                  {details.map((row) => (
                    <div key={row.label} className="nwct-card-row">
                      <dt className="nw-mono">{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ))}

          <ContactForm
            clientType={current.key}
            typeLabel={current.label}
            messagePlaceholder={current.messagePlaceholder}
            consultationHref={consultationHref}
          />
        </div>
      </div>
    </section>
  );
}
