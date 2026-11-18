/**
 * FaqRail — questions on the right, a sticky rail on the left with the
 * heading and a "Still have a question?" card.
 *
 * Collapsed answers stay in the document (`hidden`), so the text the page's
 * FAQPage structured data marks up is all present in the rendered page, as
 * Google requires. Each question is a button inside an h3, the WAI-ARIA
 * accordion pattern.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Compass, Mail, Minus, Phone, Plus } from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';
import { PHONE_DISPLAY, PHONE_HREF } from '../siteLinks';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';

interface FaqRailProps {
  id?: string;
  index: string;
  faqs: { question: string; answer: string }[];
  lead?: string;
  quoteLink: string;
}

export function FaqRail({ id = 'faq', index, faqs, lead, quoteLink }: FaqRailProps) {
  const base = useId();
  const [open, setOpen] = useState(0);
  if (faqs.length === 0) return null;

  return (
    <section id={id} aria-label="Frequently asked questions" className="nw-sec nw-sec--paper">
      <div className="nw-wrap nw-faq">
        <div className="nw-faq-rail">
          <SectionHead
            index={index}
            kicker="FAQ"
            title="Frequently Asked Questions"
            lead={lead}
            className="nw-faq-head"
          />
          <aside className="nw-faq-help" aria-label="Talk to an adviser">
            <p className="nw-faq-help-t">Still have a question?</p>
            <p className="nw-faq-help-p">Speak to an adviser directly. There is no obligation.</p>
            <ul className="nw-faq-contact">
              <li>
                <a href={PHONE_HREF}>
                  <Phone size={17} strokeWidth={1.75} aria-hidden="true" />
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`}>
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  {COMPANY.email}
                </a>
              </li>
            </ul>
            <div className="nw-faq-actions">
              <Link className="nw-btn" to={quoteLink}>
                Get a Quote
                <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <Link className="nw-outline" to="/ask-vasco">
                <Compass size={16} strokeWidth={1.75} aria-hidden="true" />
                Ask Vasco
              </Link>
            </div>
          </aside>
        </div>
        <div className="nw-faq-list">
          {faqs.map((faq, i) => {
            const isOpen = open === i;
            const qId = `${base}-q-${i}`;
            const aId = `${base}-a-${i}`;
            return (
              <div key={faq.question} className="nw-faq-item">
                <h3>
                  <button
                    type="button"
                    id={qId}
                    className="nw-faq-q"
                    aria-expanded={isOpen}
                    aria-controls={aId}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{faq.question}</span>
                    <span className="nw-faq-icon" aria-hidden="true">
                      {isOpen ? (
                        <Minus size={16} strokeWidth={1.75} />
                      ) : (
                        <Plus size={16} strokeWidth={1.75} />
                      )}
                    </span>
                  </button>
                </h3>
                <p
                  id={aId}
                  role="region"
                  aria-labelledby={qId}
                  hidden={!isOpen}
                  className="nw-faq-a nw-in"
                >
                  {faq.answer}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
