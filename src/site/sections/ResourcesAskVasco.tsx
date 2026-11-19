/**
 * ResourcesAskVasco — the band under every Resources section: Ask Vasco, then
 * the way to a person.
 *
 * Its facts are checkable ones: Vasco's free allowance is the visitor limit
 * the server enforces (vasco-guardrails.ts, ten a day) and is what the Ask
 * Vasco page itself says; the office city and the languages come from
 * companyFacts.ts. The suggested questions link to the Ask Vasco page, as the
 * board's do; that page has no way to receive a question in its address.
 */
import { Link } from 'react-router';
import { COMPANY } from '../../config/companyFacts';
import { ResourcesIcon } from './ResourcesIcons';

const PROMPTS = [
  'How much life cover do I need?',
  'Explain retirement annuities',
  'How does estate duty work in SA?',
];

function languages(list: readonly string[]): string {
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}` : list[0];
}

export function ResourcesAskVasco() {
  return (
    <section className="nwrs-help" aria-labelledby="nwrs-vasco-title">
      <div className="nw-wrap nwrs-help-row">
        <div className="nwrs-vasco">
          <div className="nwrs-vasco-copy">
            <p className="nw-eyebrow nwrs-vasco-eyebrow">AI financial navigator</p>
            <h2 id="nwrs-vasco-title" className="nwrs-vasco-h">
              Ask <span className="nw-accent">Vasco</span>
            </h2>
            <p className="nwrs-vasco-p">
              Have a question an article doesn&apos;t answer? Your AI-powered financial navigator —
              explore South African finance with no login required.
            </p>
            <p className="nwrs-vasco-small">
              10 free questions daily · General information only — not personal financial advice
            </p>
          </div>
          <div className="nwrs-vasco-try">
            <p className="nwrs-label nwrs-vasco-trylabel">Try asking</p>
            {PROMPTS.map((prompt) => (
              <Link key={prompt} className="nwrs-prompt" to="/ask-vasco">
                {prompt}
                <ResourcesIcon name="arrowRight" stroke="#C5CAD3" />
              </Link>
            ))}
          </div>
        </div>
        <div className="nwrs-advice">
          <div>
            <p className="nw-eyebrow nwrs-advice-eyebrow">Free initial consultation</p>
            <h3 className="nw-h nwrs-advice-h">
              Want <span className="nwrs-accent-l">personalised</span> advice?
            </h3>
            <p className="nwrs-advice-p">
              Talk to a qualified adviser — in person at our {COMPANY.address.city} office or
              online, in {languages(COMPANY.languages)}.
            </p>
          </div>
          <div className="nwrs-advice-actions">
            <Link className="nw-btn nwrs-advice-btn" to="/schedule-consultation">
              Book a Free Consultation
            </Link>
            <Link className="nw-outline nwrs-advice-btn" to="/get-quote">
              Get a Quote
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
