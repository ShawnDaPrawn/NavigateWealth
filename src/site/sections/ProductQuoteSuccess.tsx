/**
 * ProductQuoteSuccess — "Quote request received", in place of the forms once
 * the quote is sent, with the live page's words and its two ways on: another
 * quote (/get-quote) or home. Its heading takes focus, which also brings it
 * into view, since the visitor pressed submit at the bottom of the form.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

interface ProductQuoteSuccessProps {
  serviceName: string;
  servicesHref: string;
}

export function ProductQuoteSuccess({ serviceName, servicesHref }: ProductQuoteSuccessProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="nwpq-card nwpq-done nw-in" role="status">
      <span className="nwpq-done-mark">
        <ProductQuoteIcon name="check" size={26} />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="nw-h nwpq-done-title">
        Quote request <span className="nwpq-italic">received</span>
      </h2>
      <p className="nwpq-done-text">
        Thank you for your {serviceName.toLowerCase()} quote request. We will be in touch within{' '}
        <strong>24 hours on business days</strong> with a personalised, no-obligation quote.
      </p>
      <div className="nwpq-done-actions">
        <Link className="nw-btn nwpq-done-btn" to={servicesHref}>
          Request Another Quote
        </Link>
        <Link className="nw-outline nwpq-done-btn nwpq-done-btn--outline" to="/">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
