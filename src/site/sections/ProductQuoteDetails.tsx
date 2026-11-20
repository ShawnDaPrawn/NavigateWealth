/**
 * ProductQuoteDetails — the board's one-step details form, for a service the
 * live page quotes without a wizard (estate planning). The fields are the
 * service's productFields in quote/constants.ts; the page owns their values
 * (kept in session storage, as on the live page) and the request.
 */
import { useEffect, useRef, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { QuoteFormField } from '../../components/pages/quote/types';
import { Field, MoneyInput, NumberInput, SelectInput, TextInput } from './ProductQuoteFields';
import { ProductQuoteIcon } from './ProductQuoteIcons';
import '../styles/product-quote.css';

interface ProductQuoteDetailsProps {
  fields: readonly QuoteFormField[];
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  /** The live page's check: the contact details and every required field filled. */
  valid: boolean;
  submitting: boolean;
  failure: string;
  onSubmit: () => void;
  shortLabel: string;
  backHref: string;
}

export function ProductQuoteDetails({
  fields,
  values,
  onChange,
  valid,
  submitting,
  failure,
  onSubmit,
  shortLabel,
  backHref,
}: ProductQuoteDetailsProps) {
  const failureRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failure) failureRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [failure]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid || submitting) return;
    onSubmit();
  };

  return (
    <form className="nwpq-details nw-in" noValidate onSubmit={submit} aria-label="Quote details">
      <p className="nwpq-details-lead">
        Help us understand your specific needs so we can match you with the right solution.
      </p>
      <div className="nwpq-grid">
        {fields.map((field) => (
          <Field key={field.id} label={field.label} required={field.required}>
            {(id) =>
              field.type === 'select' ? (
                <SelectInput
                  id={id}
                  required={field.required}
                  placeholder="Select..."
                  options={field.options ?? []}
                  value={values[field.id] || ''}
                  onChange={(v) => onChange(field.id, v)}
                />
              ) : field.type === 'currency' ? (
                <MoneyInput
                  id={id}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ''}
                  onChange={(v) => onChange(field.id, v)}
                />
              ) : field.type === 'number' ? (
                <NumberInput
                  id={id}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ''}
                  onChange={(v) => onChange(field.id, v)}
                />
              ) : (
                <TextInput
                  id={id}
                  type={field.type === 'email' || field.type === 'tel' ? field.type : 'text'}
                  required={field.required}
                  placeholder={field.placeholder}
                  value={values[field.id] || ''}
                  onChange={(v) => onChange(field.id, v)}
                />
              )
            }
          </Field>
        ))}
      </div>
      {failure ? (
        <div ref={failureRef} className="nwpq-alert nw-in" role="alert">
          <ProductQuoteIcon name="alert" size={14} />
          <span>{failure}</span>
        </div>
      ) : null}
      <div className="nwpq-details-actions">
        <Link className="nw-outline nwpq-back" to={backHref}>
          <ProductQuoteIcon name="arrowLeft" size={16} />
          Back
        </Link>
        <button
          type="submit"
          className="nw-btn nwpq-details-submit"
          disabled={!valid || submitting}
        >
          {submitting ? (
            'Submitting...'
          ) : (
            <>
              {/* The board's runtime sets the service in its own span, so the
                  button's gap spaces the three parts; drawn the same here. */}
              Get My <span>{shortLabel}</span> Quote{' '}
              <ProductQuoteIcon name="arrowRight" size={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
