/**
 * QuoteContactForm — "Your details", the quote funnel's contact form: the
 * service being quoted (and a switch to another), name, email and number, the
 * estate-planning choice between a consultation and drafting a will, and the
 * providers the quote compares.
 *
 * The page owns the values (they outlive the form while a will is drafted)
 * and what happens on continue; this form checks the fields first. Like the
 * other Navigator forms it says beside each field what is wrong and moves
 * focus to the first such field, and a failed send is shown in the form
 * rather than in a passing toast. The checks match what
 * POST /quote-request/submit accepts, so the form never sends what the server
 * would refuse.
 */
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router';
import type {
  QuoteContactDetails,
  QuoteServiceConfig,
  QuoteServiceId,
} from '../../components/pages/quote/types';
import { emailError, phoneError } from './formRules';
import { QuoteContactIcon } from './QuoteContactIcons';
import { QuoteContactPartners } from './QuoteContactPartners';
import '../styles/sections.css';
import '../styles/quote-contact.css';

export type EstateChoice = 'consultation' | 'will';
type Field = keyof QuoteContactDetails;
type Errors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ['firstName', 'lastName', 'email', 'phone'];
const FIELD_ID: Record<Field, string> = {
  firstName: 'nwqc-first',
  lastName: 'nwqc-last',
  email: 'nwqc-email',
  phone: 'nwqc-phone',
};
/** The longest values POST /quote-request/submit accepts. */
const MAX_LENGTH: Record<Field, number | undefined> = {
  firstName: 100,
  lastName: 100,
  email: undefined,
  phone: 30,
};

function validate(values: QuoteContactDetails): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = 'Please enter your first name.';
  if (!values.lastName.trim()) errors.lastName = 'Please enter your surname.';
  if (emailError(values.email)) {
    errors.email = values.email.trim()
      ? 'That email address looks incomplete — check the part after the @.'
      : 'Please enter your email address.';
  }
  if (phoneError(values.phone)) {
    errors.phone = values.phone.trim()
      ? 'Please enter a valid contact number.'
      : 'Please enter your contact number.';
  }
  return errors;
}

interface QuoteContactFormProps {
  service: QuoteServiceConfig;
  services: readonly Pick<QuoteServiceConfig, 'id' | 'label'>[];
  onServiceChange: (id: QuoteServiceId) => void;
  values: QuoteContactDetails;
  onValueChange: (field: Field, value: string) => void;
  /** The honeypot: real visitors leave it empty. */
  website: string;
  onWebsiteChange: (value: string) => void;
  /** Estate planning only: a consultation, or drafting a will now. */
  estateChoice: EstateChoice | null;
  onEstateChoice: (choice: EstateChoice) => void;
  continueLabel: string;
  /** Runs once the fields pass; resolves with a message when it failed. */
  onContinue: () => Promise<string | null>;
  servicesHref: string;
  privacyHref: string;
}

export function QuoteContactForm({
  service,
  services,
  onServiceChange,
  values,
  onValueChange,
  website,
  onWebsiteChange,
  estateChoice,
  onEstateChoice,
  continueLabel,
  onContinue,
  servicesHref,
  privacyHref,
}: QuoteContactFormProps) {
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const failureRef = useRef<HTMLDivElement>(null);

  // A failed send is reported at the top of the form, which on a phone is
  // well above the button just pressed: bring it into view.
  useEffect(() => {
    if (failure) failureRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [failure]);

  // Once a send has been tried, the errors follow the fields as they change.
  const errors = tried ? validate(values) : {};
  const errorCount = Object.keys(errors).length;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setTried(true);
    setFailure('');
    const found = validate(values);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    setSending(true);
    const problem = await onContinue();
    setSending(false);
    if (problem) setFailure(problem);
  };

  const field = (name: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => {
    const id = FIELD_ID[name];
    const error = errors[name];
    return (
      <div className="nwqc-field">
        <label className="nwqc-label" htmlFor={id}>
          {label}{' '}
          <span className="nwqc-req" aria-hidden="true">
            *
          </span>
        </label>
        <input
          {...props}
          id={id}
          className="nwqc-input"
          required
          maxLength={MAX_LENGTH[name]}
          value={values[name]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onValueChange(name, e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {error ? (
          <p id={`${id}-error`} className="nwqc-error">
            <QuoteContactIcon name="alert" size={14} />
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const option = (choice: EstateChoice, title: ReactNode, text: string) => {
    const on = estateChoice === choice;
    return (
      <button
        type="button"
        className="nwqc-opt"
        aria-pressed={on}
        onClick={() => onEstateChoice(choice)}
      >
        <span className="nwqc-radio">{on ? <span className="nwqc-radio-dot" /> : null}</span>
        <span>
          {title}
          <span className="nwqc-opt-text">{text}</span>
        </span>
      </button>
    );
  };

  return (
    <form className="nwqc-form" noValidate onSubmit={onSubmit} aria-labelledby="nwqc-form-title">
      <div className="nwqc-form-head">
        <div className="nwqc-form-intro">
          <h2 id="nwqc-form-title" className="nw-h nwqc-form-title">
            Your details
          </h2>
          <p className="nwqc-form-lead">
            Tell us who you are so we can prepare your personalised {service.label.toLowerCase()}{' '}
            quote.
          </p>
        </div>
        <div className="nwqc-pick">
          <label htmlFor="nwqc-service" className="nwqc-pick-label">
            Quoting for
          </label>
          <div className="nwqc-pick-box">
            <select
              id="nwqc-service"
              className="nwqc-select"
              value={service.id}
              onChange={(e) => onServiceChange(e.target.value as QuoteServiceId)}
            >
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <QuoteContactIcon
              name="chevronDown"
              size={16}
              stroke="#0D1626"
              className="nwqc-select-chev"
            />
          </div>
        </div>
      </div>

      {errorCount > 0 ? (
        <div className="nwqc-alert nw-in" role="alert">
          <QuoteContactIcon name="alert" size={14} />
          <span>
            {errorCount === 1
              ? 'One field needs your attention before we can continue.'
              : `${errorCount} fields need your attention before we can continue.`}
          </span>
        </div>
      ) : null}
      {failure ? (
        <div ref={failureRef} className="nwqc-alert nw-in" role="alert">
          <QuoteContactIcon name="alert" size={14} />
          <span>{failure}</span>
        </div>
      ) : null}

      <div className="nwqc-fields">
        {field('firstName', 'First name', {
          type: 'text',
          autoComplete: 'given-name',
          placeholder: 'e.g. John',
        })}
        {field('lastName', 'Surname', {
          type: 'text',
          autoComplete: 'family-name',
          placeholder: 'e.g. Smith',
        })}
        {field('email', 'Email address', {
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: 'e.g. john@email.co.za',
        })}
        {field('phone', 'Contact number', {
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
          placeholder: 'e.g. 082 345 6789',
        })}
      </div>
      <div className="nwqc-sr" aria-hidden="true">
        <label htmlFor="nwqc-website">Website</label>
        <input
          id="nwqc-website"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
          value={website}
          onChange={(e) => onWebsiteChange(e.target.value)}
        />
      </div>

      {estateChoice ? (
        <fieldset className="nwqc-choice nw-in">
          <legend className="nwqc-choice-legend">What would you like to do?</legend>
          <div className="nwqc-opts">
            {option(
              'consultation',
              <span className="nwqc-opt-title">Estate Planning Consultation</span>,
              'Trusts, succession, estate duty',
            )}
            {option(
              'will',
              <span className="nwqc-opt-title nwqc-opt-title--badge">
                Draft My Will <span className="nwqc-opt-badge">AI-Assisted</span>
              </span>,
              'Start your will drafting now',
            )}
          </div>
        </fieldset>
      ) : null}

      <div className="nwqc-actions">
        <Link className="nw-outline nwqc-back" to={servicesHref}>
          <QuoteContactIcon name="arrowLeft" size={16} />
          Back to services
        </Link>
        <button type="submit" className="nw-btn nwqc-submit" disabled={sending}>
          {sending ? 'Submitting…' : continueLabel} <QuoteContactIcon name="arrowRight" size={18} />
        </button>
      </div>
      <p className="nwqc-note">
        <QuoteContactIcon name="lock" size={14} stroke="#0D1626" />
        <span>
          By submitting, you agree to our <Link to={privacyHref}>Privacy Policy</Link>. Your
          information is secure and will only be used to prepare your quote.
        </span>
      </p>

      <QuoteContactPartners providers={service.providers} />
    </form>
  );
}
