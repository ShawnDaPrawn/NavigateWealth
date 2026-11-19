/**
 * QuoteContactStepper — "Quote progress": the funnel's three steps, the first
 * done (and a link back to it), the second current, the third to come. The
 * rules between the steps are hidden on narrow screens, as on the board.
 */
import { Link } from 'react-router';
import { QuoteContactIcon } from './QuoteContactIcons';
import '../styles/quote-contact.css';

interface QuoteContactStepperProps {
  servicesHref: string;
}

export function QuoteContactStepper({ servicesHref }: QuoteContactStepperProps) {
  return (
    <nav aria-label="Quote progress" className="nwqc-steps">
      <ol className="nwqc-steps-list">
        <li className="nwqc-step">
          <span className="nwqc-step-done">
            <QuoteContactIcon name="check" size={14} />
          </span>
          <Link className="nwqc-step-link" to={servicesHref}>
            Service
          </Link>
        </li>
        <li className="nwqc-step" aria-current="step">
          <span aria-hidden="true" className="nwqc-step-rule nwqc-hide-md" />
          <span className="nw-h nwqc-step-no">2</span>
          <span className="nwqc-step-label">Your details</span>
        </li>
        <li className="nwqc-step">
          <span aria-hidden="true" className="nwqc-step-rule nwqc-step-rule--todo nwqc-hide-md" />
          <span className="nw-h nwqc-step-no nwqc-step-no--todo">3</span>
          <span className="nwqc-step-label nwqc-step-label--todo">Quote details</span>
        </li>
      </ol>
    </nav>
  );
}
