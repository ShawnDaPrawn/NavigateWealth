/**
 * ContactForm — "Send us a message", the contact page's enquiry form, and the
 * confirmation that takes its place once the enquiry is sent.
 *
 * It sends exactly what the live contact page sends (first and last name,
 * email, phone, an empty service, the message and the audience as clientType,
 * plus the server's honeypot field) through submitContactEnquiry, so leads
 * land in the same place whichever design is live. Like the other Navigator
 * forms it says beside each field what is wrong and moves focus to the first
 * such field, shows a failed send in the form rather than a passing toast, and
 * confirms in place.
 *
 * The board marks the phone number optional; POST /contact-form/submit
 * refuses an enquiry without one, so here it is required, as on the live page.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
} from 'react';
import { Link } from 'react-router';
import { submitContactEnquiry } from '../../services/contactEnquiry';
import { ContactIcon } from './ContactIcons';
import { emailError, phoneError } from './formRules';
import '../styles/sections.css';
import '../styles/contact.css';

type Field = 'firstName' | 'lastName' | 'email' | 'phone' | 'message';
type Values = Record<Field, string>;
type Errors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ['firstName', 'lastName', 'email', 'phone', 'message'];
const EMPTY: Values = { firstName: '', lastName: '', email: '', phone: '', message: '' };
/** The longest values POST /contact-form/submit accepts. */
const MAX_LENGTH: Record<Field, number | undefined> = {
  firstName: 100,
  lastName: 100,
  email: undefined,
  phone: 30,
  message: 5000,
};

/** The board's messages; the checks behind them match what the endpoint accepts. */
function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = 'Please enter your first name.';
  if (!values.lastName.trim()) errors.lastName = 'Please enter your last name.';
  if (emailError(values.email)) {
    errors.email = values.email.trim()
      ? 'That email address looks incomplete — check the part after the @.'
      : 'Please enter your email address.';
  }
  if (phoneError(values.phone)) {
    errors.phone = values.phone.trim()
      ? 'Please enter a valid phone number.'
      : 'Please enter your phone number.';
  }
  if (values.message.trim().length < 10) {
    errors.message = 'Tell us a little about what you need (at least 10 characters).';
  }
  return errors;
}

interface ContactFormProps {
  /** The audience's key, sent as the enquiry's clientType. */
  clientType: string;
  /** The audience's name, shown beside the form's title. */
  typeLabel: string;
  messagePlaceholder: string;
  /** Where "Book a Free Consultation" leads once the message is sent. */
  consultationHref: string;
}

export function ContactForm({
  clientType,
  typeLabel,
  messagePlaceholder,
  consultationHref,
}: ContactFormProps) {
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const [values, setValues] = useState<Values>(EMPTY);
  const [website, setWebsite] = useState('');
  const [tried, setTried] = useState(false);
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ firstName: string; email: string } | null>(null);
  const doneTitle = useRef<HTMLHeadingElement>(null);
  const reopened = useRef(false);

  // Once a send has been tried, the errors follow the fields as they change.
  const errors = tried ? validate(values) : {};
  const errorCount = Object.keys(errors).length;

  // The form and its confirmation swap places, so focus follows: to the
  // confirmation's heading once sent, back to the first field on "Send another".
  const firstFieldId = fid('firstName');
  useEffect(() => {
    if (sent) {
      doneTitle.current?.focus();
    } else if (reopened.current) {
      reopened.current = false;
      document.getElementById(firstFieldId)?.focus();
    }
  }, [sent, firstFieldId]);

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setTried(true);
    setFailure('');
    const found = validate(values);
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    setSending(true);
    const result = await submitContactEnquiry({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      service: '',
      message: values.message.trim(),
      clientType,
      website,
    });
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSent({ firstName: values.firstName.trim(), email: values.email.trim() });
    setValues(EMPTY);
    setWebsite('');
    setTried(false);
  };

  const sendAnother = () => {
    reopened.current = true;
    setSent(null);
  };

  if (sent) {
    return (
      <div className="nwct-done nw-in" role="status">
        <span className="nwct-done-icon" aria-hidden="true">
          <ContactIcon name="check" size={22} />
        </span>
        <div>
          <h3 ref={doneTitle} tabIndex={-1} className="nwct-done-title">
            Thank you, {sent.firstName}. Your message is with us.
          </h3>
          <p className="nwct-done-text">
            A confirmation has been sent to {sent.email}. Here&apos;s what happens next:
          </p>
        </div>
        <ol className="nwct-steps">
          <li>
            <span className="nwct-step-no nw-mono">01</span>
            <span className="nwct-step-text">
              <strong>Within 24 hours on business days</strong> — an adviser reads your message and
              replies personally.
            </span>
          </li>
          <li>
            <span className="nwct-step-no nw-mono">02</span>
            <span className="nwct-step-text">
              <strong>A short call</strong> to understand what you need — no obligation.
            </span>
          </li>
          <li>
            <span className="nwct-step-no nw-mono">03</span>
            <span className="nwct-step-text">
              <strong>A free first consultation</strong> — in person in Pretoria or online.
            </span>
          </li>
        </ol>
        <div className="nwct-done-actions">
          <Link className="nw-btn" to={consultationHref}>
            Book a Free Consultation <ContactIcon name="arrowRight" size={16} />
          </Link>
          <button type="button" className="nw-outline" onClick={sendAnother}>
            Send another message
          </button>
        </div>
      </div>
    );
  }

  const field = (
    name: Field,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> & { multiline?: boolean },
  ) => {
    const { multiline, ...inputProps } = props;
    const error = errors[name];
    const shared = {
      id: fid(name),
      className: 'nwct-input',
      required: true,
      maxLength: MAX_LENGTH[name],
      value: values[name],
      onChange: set(name),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${fid(name)}-error` : undefined,
    };
    return (
      <div className={multiline ? 'nwct-field nwct-field--grow' : 'nwct-field'}>
        <label className="nwct-label" htmlFor={fid(name)}>
          {label}{' '}
          <span className="nwct-req" aria-hidden="true">
            *
          </span>
        </label>
        {multiline ? (
          <textarea {...shared} rows={6} placeholder={inputProps.placeholder} />
        ) : (
          <input {...shared} {...inputProps} />
        )}
        {error ? (
          <p id={`${fid(name)}-error`} className="nwct-error">
            <ContactIcon name="alert" size={14} />
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <form className="nwct-form" noValidate onSubmit={onSubmit} aria-labelledby={fid('title')}>
      <div className="nwct-form-head">
        <h3 id={fid('title')} className="nwct-form-title">
          Send us a message
        </h3>
        <span className="nwct-badge nw-mono">{typeLabel}</span>
      </div>
      {errorCount > 0 ? (
        <div className="nwct-alert nw-in" role="alert">
          <ContactIcon name="alert" size={14} />
          <span>
            {errorCount === 1
              ? 'One field needs your attention before we can send this.'
              : `${errorCount} fields need your attention before we can send this.`}
          </span>
        </div>
      ) : null}
      {failure ? (
        <div className="nwct-alert nw-in" role="alert">
          <ContactIcon name="alert" size={14} />
          <span>{failure}</span>
        </div>
      ) : null}
      <div className="nwct-row">
        {field('firstName', 'First Name', {
          type: 'text',
          autoComplete: 'given-name',
          placeholder: 'Enter your first name',
        })}
        {field('lastName', 'Last Name', {
          type: 'text',
          autoComplete: 'family-name',
          placeholder: 'Enter your last name',
        })}
      </div>
      <div className="nwct-row">
        {field('email', 'Email Address', {
          type: 'email',
          autoComplete: 'email',
          inputMode: 'email',
          placeholder: 'name@example.com',
        })}
        {field('phone', 'Phone Number', {
          type: 'tel',
          autoComplete: 'tel',
          inputMode: 'tel',
          placeholder: '012 345 6789',
        })}
      </div>
      {field('message', 'Message', { multiline: true, placeholder: messagePlaceholder })}
      <div className="nwc-hp" aria-hidden="true">
        <label htmlFor={fid('website')}>Website</label>
        <input
          id={fid('website')}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <button type="submit" className="nw-btn nwct-submit" disabled={sending}>
        {sending ? 'Sending…' : 'Send Enquiry'} <ContactIcon name="send" size={16} />
      </button>
      <p className="nwct-note">
        We respond within 24 hours on business days. Your details are used only to respond to you,
        in line with POPIA and our <Link to="/legal/privacy-notice">Privacy Notice</Link>.
      </p>
    </form>
  );
}
