/**
 * ProductQuoteCard — the card the quote is answered in: its heading, the
 * "Quoting for" switch to another service, and the service's form (a wizard,
 * or the one-step details form).
 *
 * Choosing another service goes back to that service's "your details" step,
 * the funnel's way in to every quote, with the contact details carried over
 * so they need not be typed again. The live page has no such switch; the
 * board draws one.
 */
import type { ReactNode } from 'react';
import type { QuoteServiceConfig, QuoteServiceId } from '../../components/pages/quote/types';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

interface ProductQuoteCardProps {
  service: QuoteServiceConfig;
  services: readonly Pick<QuoteServiceConfig, 'id' | 'label'>[];
  onServiceChange: (id: QuoteServiceId) => void;
  /** "Quote wizard", or "Your quote details" for the one-step form (the live page's words). */
  eyebrow: string;
  children: ReactNode;
}

export function ProductQuoteCard({
  service,
  services,
  onServiceChange,
  eyebrow,
  children,
}: ProductQuoteCardProps) {
  return (
    <div className="nwpq-card nwpq-quote">
      <div className="nwpq-quote-head">
        <div>
          <p className="nw-eyebrow nwpq-quote-eyebrow">{eyebrow}</p>
          <h2 className="nw-h nwpq-quote-title">
            {service.label} <span className="nwpq-italic">details</span>
          </h2>
        </div>
        <div className="nwpq-pick">
          <label htmlFor="nwpq-service" className="nwpq-pick-label">
            Quoting for
          </label>
          <div className="nwpq-select-box">
            <select
              id="nwpq-service"
              className="nwpq-input nwpq-select nwpq-pick-select"
              value={service.id}
              onChange={(e) => onServiceChange(e.target.value as QuoteServiceId)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ProductQuoteIcon
              name="chevronDown"
              size={16}
              stroke="#0D1626"
              className="nwpq-chev nwpq-pick-chev"
            />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
