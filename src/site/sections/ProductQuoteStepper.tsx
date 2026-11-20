/**
 * ProductQuoteStepper — "Quote progress": the funnel's three steps, the first
 * two done (each a link back to it) and the third current. The rules between
 * the steps are hidden on narrow screens, as on the board.
 */
import { Link } from 'react-router';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

interface ProductQuoteStepperProps {
  servicesHref: string;
  contactHref: string;
}

export function ProductQuoteStepper({ servicesHref, contactHref }: ProductQuoteStepperProps) {
  return (
    <nav aria-label="Quote progress" className="nwpq-steps">
      <ol className="nwpq-steps-list">
        <li className="nwpq-step-item">
          <span className="nwpq-step-done">
            <ProductQuoteIcon name="check" size={14} />
          </span>
          <Link className="nwpq-step-link" to={servicesHref}>
            Service
          </Link>
        </li>
        <li className="nwpq-step-item">
          <span aria-hidden="true" className="nwpq-step-rule nwpq-hide-md" />
          <span className="nwpq-step-done">
            <ProductQuoteIcon name="check" size={14} />
          </span>
          <Link className="nwpq-step-link" to={contactHref}>
            Your details
          </Link>
        </li>
        <li className="nwpq-step-item" aria-current="step">
          <span aria-hidden="true" className="nwpq-step-rule nwpq-hide-md" />
          <span className="nw-h nwpq-step-no">3</span>
          <span className="nwpq-step-label">Quote details</span>
        </li>
      </ol>
    </nav>
  );
}
