/**
 * ProductQuoteContact — "Contact details": the name, email and number the
 * quote is sent with. They arrive filled in from the "your details" step
 * (the router state), which the badge says; on a page reached directly they
 * start empty, and the quote form waits until all four are filled, as on the
 * live page.
 */
import type { QuoteContactDetails } from '../../components/pages/quote/types';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

type ContactField = keyof QuoteContactDetails;

const FIELDS: {
  name: ContactField;
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel';
  autoComplete: string;
  inputMode?: 'email' | 'tel';
  placeholder: string;
}[] = [
  {
    name: 'firstName',
    id: 'nwpq-first',
    label: 'First Name',
    type: 'text',
    autoComplete: 'given-name',
    placeholder: 'e.g. John',
  },
  {
    name: 'lastName',
    id: 'nwpq-last',
    label: 'Last Name',
    type: 'text',
    autoComplete: 'family-name',
    placeholder: 'e.g. Smith',
  },
  {
    name: 'email',
    id: 'nwpq-email',
    label: 'Email',
    type: 'email',
    autoComplete: 'email',
    inputMode: 'email',
    placeholder: 'e.g. john@email.co.za',
  },
  {
    name: 'phone',
    id: 'nwpq-phone',
    label: 'Phone',
    type: 'tel',
    autoComplete: 'tel',
    inputMode: 'tel',
    placeholder: 'e.g. 082 345 6789',
  },
];

interface ProductQuoteContactProps {
  values: QuoteContactDetails;
  onChange: (field: ContactField, value: string) => void;
  /** Whether the details came from the previous step. */
  prefilled: boolean;
}

export function ProductQuoteContact({ values, onChange, prefilled }: ProductQuoteContactProps) {
  return (
    <div className="nwpq-card nwpq-contact">
      <div className="nwpq-contact-head">
        <h2 className="nw-h nwpq-contact-title">Contact details</h2>
        {prefilled ? (
          <span className="nwpq-badge">
            <ProductQuoteIcon name="check" size={12} stroke="#0D1626" />
            Pre-filled from your previous step
          </span>
        ) : null}
      </div>
      <div className="nwpq-contact-fields">
        {FIELDS.map((f) => (
          <div key={f.name} className="nwpq-field">
            <label htmlFor={f.id} className="nwpq-contact-label">
              {f.label}
            </label>
            <input
              id={f.id}
              className="nwpq-input nwpq-input--46"
              type={f.type}
              autoComplete={f.autoComplete}
              inputMode={f.inputMode}
              placeholder={f.placeholder}
              required
              aria-required="true"
              value={values[f.name]}
              onChange={(e) => onChange(f.name, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
