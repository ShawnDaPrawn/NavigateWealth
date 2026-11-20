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
import { ArrowRight, Minus, Plus } from 'lucide-react';

/*
 * The boards draw these three with their own paths; the installed lucide has
 * since redrawn its phone, mail and compass, so they are inlined as drawn.
 */
const ICON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...ICON}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...ICON}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" {...ICON}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}
import { COMPANY } from '../../config/companyFacts';
import { PHONE_DISPLAY, PHONE_HREF } from '../siteLinks';
import { SectionHead } from './SectionHead';
import '../styles/sections.css';

interface FaqRailProps {
  id?: string;
  /** Omit for an unnumbered kicker. */
  index?: string;
  /** The kicker after the number; "FAQ" unless a board says otherwise. */
  kicker?: string;
  faqs: readonly { question: string; answer: string }[];
  lead?: string;
  /**
   * The help card's main action. A service page sends visitors to its quote,
   * or with `href` to a spot on the same page (its call-back form).
   */
  action: { label: string; arrow?: boolean } & ({ to: string } | { href: string });
}

export function FaqRail({ id = 'faq', index, kicker = 'FAQ', faqs, lead, action }: FaqRailProps) {
  const base = useId();
  const [open, setOpen] = useState(0);
  if (faqs.length === 0) return null;

  return (
    <section id={id} aria-label="Frequently asked questions" className="nw-sec nw-sec--paper">
      <div className="nw-wrap nw-faq">
        <div className="nw-faq-rail">
          <SectionHead
            index={index}
            kicker={kicker}
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
                  <PhoneIcon />
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a href={`mailto:${COMPANY.email}`}>
                  <MailIcon />
                  {COMPANY.email}
                </a>
              </li>
            </ul>
            <div className="nw-faq-actions">
              {'href' in action ? (
                <a className="nw-btn" href={action.href}>
                  {action.label}
                  {action.arrow === false ? null : (
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </a>
              ) : (
                <Link className="nw-btn" to={action.to}>
                  {action.label}
                  {action.arrow === false ? null : (
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  )}
                </Link>
              )}
              <Link className="nw-outline" to="/ask-vasco">
                <CompassIcon />
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
