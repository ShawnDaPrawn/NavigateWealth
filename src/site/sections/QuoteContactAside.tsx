/**
 * QuoteContactAside — beside the form: the service being quoted (its summary,
 * description and topics, from quote/constants.ts), why choose the firm and
 * how the funnel works (the live page's lists), and the firm's phone and
 * WhatsApp for anyone who would rather talk.
 */
import { QuoteContactIcon } from './QuoteContactIcons';
import '../styles/sections.css';
import '../styles/quote-contact.css';

interface QuoteContactAsideProps {
  label: string;
  description: string;
  summary: string;
  topics: readonly string[];
  points: readonly string[];
  /** The funnel's steps in order; the first is done and the second current. */
  steps: readonly { step: string; text: string }[];
  phone: { href: string; display: string };
  whatsappHref: string;
}

export function QuoteContactAside({
  label,
  description,
  summary,
  topics,
  points,
  steps,
  phone,
  whatsappHref,
}: QuoteContactAsideProps) {
  return (
    <aside className="nwqc-aside" aria-label="About your quote">
      <div className="nwqc-svc nw-in">
        <div className="nw-grid-bg" aria-hidden="true" />
        <div className="nwqc-svc-inner">
          <p className="nw-eyebrow nwqc-svc-kicker">Selected service</p>
          <h3 className="nw-h nwqc-svc-title">{label}</h3>
          <p className="nwqc-svc-desc">{description}</p>
          <p className="nwqc-svc-summary">{summary}</p>
          {topics.length > 0 ? (
            <ul className="nwqc-chips">
              {topics.map((topic) => (
                <li key={topic} className="nwqc-chip">
                  {topic}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="nwqc-card">
        <h3 className="nw-h nwqc-card-title">Why Navigate Wealth?</h3>
        <ul className="nwqc-why">
          {points.map((point) => (
            <li key={point}>
              <QuoteContactIcon name="check" size={16} stroke="#0D1626" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="nwqc-card">
        <h3 className="nw-h nwqc-card-title">How it works</h3>
        <ol className="nwqc-how">
          {steps.map(({ step, text }, i) => (
            <li key={step} aria-current={i === 1 ? 'step' : undefined}>
              {i === 0 ? (
                <span className="nwqc-how-done">
                  <QuoteContactIcon name="check" size={13} />
                </span>
              ) : (
                <span
                  className={i === 1 ? 'nw-h nwqc-how-no' : 'nw-h nwqc-how-no nwqc-how-no--todo'}
                >
                  {step}
                </span>
              )}
              <span className={i === 1 ? 'nwqc-how-text nwqc-how-text--now' : 'nwqc-how-text'}>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="nwqc-talk">
        <span className="nw-h nwqc-talk-title">
          Prefer to <span className="nwqc-talk-accent">talk</span>?
        </span>
        <span className="nwqc-talk-links">
          <a
            className="nwqc-iconlink"
            href={phone.href}
            aria-label={`Call Navigate Wealth on ${phone.display}`}
          >
            <QuoteContactIcon name="phone" size={18} />
          </a>
          <a
            className="nwqc-iconlink"
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat to Navigate Wealth on WhatsApp"
          >
            <QuoteContactIcon name="message" size={18} />
          </a>
        </span>
      </div>
    </aside>
  );
}
