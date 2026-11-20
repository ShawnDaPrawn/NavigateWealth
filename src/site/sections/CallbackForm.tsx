/**
 * CallbackForm — "Let us call you back", the lead form on every service page.
 *
 * Sends through the same client as the live site (submitContactEnquiry →
 * POST /contact-form/submit), so the firm and the visitor are both emailed.
 * Adds what the old form lacked: field-level validation that says what is
 * wrong, a failure message in the form rather than a passing toast, the
 * server's existing honeypot field, and a Privacy Notice link at the point of
 * collection (POPIA).
 */
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { splitFullName, submitContactEnquiry } from '../../services/contactEnquiry';
import { PHONE_HREF } from '../siteLinks';
import { emailError, phoneError } from './formRules';
import { ServiceIcon } from './serviceIcons';
import '../styles/sections.css';

/** What happens after a request, as the jump boards' confirmation lists it. */
const NEXT_STEPS = [
  {
    title: 'Initial Contact',
    text: 'We will call you within 24 hours on business days to acknowledge your request and schedule a convenient consultation time.',
  },
  {
    title: 'Needs Assessment',
    text: "We'll conduct a comprehensive review of your financial situation and what you need.",
  },
  {
    title: 'Tailored Solutions',
    text: 'Receive personalised recommendations, compared across the providers we work with, that match your needs and budget.',
  },
];

export interface CallbackOption {
  value: string;
  label: string;
}

interface CallbackFormProps {
  id?: string;
  /** The service board's layout; the jump boards add a POPIA line under the button. */
  variant?: 'standard' | 'jump' | 'risk';
  /** Lower-case topic for the intro: "medical aid". */
  topic: string;
  /** Recorded as the enquiry's service, e.g. "Medical Aid & Health Insurance". */
  serviceName: string;
  selectLabel: string;
  selectPlaceholder: string;
  options: CallbackOption[];
  messagePlaceholder: string;
}

type Field = 'name' | 'email' | 'phone';
type Errors = Partial<Record<Field, string>>;

function validate(name: string, email: string, phone: string): Errors {
  const errors: Errors = {};
  if (!name.trim()) errors.name = 'Enter your full name';
  const emailProblem = emailError(email);
  if (emailProblem) errors.email = emailProblem;
  const phoneProblem = phoneError(phone);
  if (phoneProblem) errors.phone = phoneProblem;
  return errors;
}

export function CallbackForm({
  id = 'callback',
  variant = 'standard',
  topic,
  serviceName,
  selectLabel,
  selectPlaceholder,
  options,
  messagePlaceholder,
}: CallbackFormProps) {
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [need, setNeed] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const found = validate(name, email, phone);
    setErrors(found);
    setFailure('');
    const first = (['name', 'email', 'phone'] as Field[]).find((f) => found[f]);
    if (first) {
      document.getElementById(fid(first))?.focus();
      return;
    }
    const needLabel = options.find((o) => o.value === need)?.label ?? '';
    setSending(true);
    const result = await submitContactEnquiry({
      ...splitFullName(name),
      email: email.trim(),
      phone: phone.trim(),
      service: needLabel ? `${serviceName} — ${needLabel}` : serviceName,
      message: message.trim(),
      clientType: 'call-back request',
      website,
    });
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSentTo(splitFullName(name).firstName);
    setName('');
    setEmail('');
    setPhone('');
    setNeed('');
    setMessage('');
  };

  const describedBy = (field: Field) => (errors[field] ? `${fid(field)}-error` : undefined);
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${fid(field)}-error`} className="nwc-error">
        <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
        {errors[field]}
      </p>
    ) : null;

  const intro = (
    <div className="nwc-intro">
      <div className="nw-grid-bg" aria-hidden="true" />
      <div className="nwc-glow" aria-hidden="true" />
      <div className="nwc-intro-inner">
        <span className="nwc-icon" aria-hidden="true">
          <ServiceIcon name="phone" size={22} />
        </span>
        <h2 className="nwc-title">
          Let us call
          <br />
          you back
        </h2>
        <p className="nwc-lead">
          Complete the form and we will contact you about your {topic} needs, with personalised
          options.
        </p>
        <ul className="nwc-points">
          <li>
            <span className="nwc-point-icon" aria-hidden="true">
              <ServiceIcon name="checkCircle" size={16} />
            </span>
            <span>
              <span className="nwc-point-t">Free consultation</span>
              <span className="nwc-point-s">No cost, no commitment</span>
            </span>
          </li>
          <li>
            <span className="nwc-point-icon" aria-hidden="true">
              <ServiceIcon name="shield" size={16} />
            </span>
            <span>
              <span className="nwc-point-t">Independent advice</span>
              <span className="nwc-point-s">FSCA-authorised, not tied to one provider</span>
            </span>
          </li>
          <li>
            <span className="nwc-point-icon" aria-hidden="true">
              <ServiceIcon name="chart" size={16} />
            </span>
            <span>
              <span className="nwc-point-t">Provider comparison</span>
              <span className="nwc-point-s">Options compared across our partners</span>
            </span>
          </li>
        </ul>
        <ul className="nwc-tags nw-mono" aria-label="What to expect">
          <li>Free consultation</li>
          <li>No obligation</li>
          <li>Quick response</li>
        </ul>
      </div>
    </div>
  );

  const done = (
    <div className="nwc-done nw-in" role="status">
      <span className="nwc-done-icon" aria-hidden="true">
        <ServiceIcon name="check" size={28} />
      </span>
      <div>
        <h3 className="nwc-done-title">Request Submitted Successfully</h3>
        <p className="nwc-done-p">
          Your request has been received. We will be in touch shortly to discuss what you need.
        </p>
      </div>
      <ol className="nwc-next">
        {NEXT_STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="nwc-next-no nw-mono" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <span className="nwc-next-t">{step.title}</span>
              <span className="nwc-next-d">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="nwc-eta">
        <strong>Expected Response Time.</strong> We typically contact new clients within 24 hours on
        business days. For urgent matters, please call us directly on{' '}
        <a href={PHONE_HREF}>(+27) 12-667-2505</a>.
      </p>
      <div className="nwc-done-actions">
        <button type="button" className="nwc-plain" onClick={() => setSentTo(null)}>
          Close
        </button>
        <Link className="nw-btn" to="/services">
          Browse Services
        </Link>
      </div>
    </div>
  );

  const formEl = (
    <form className="nwc-form" noValidate onSubmit={onSubmit} aria-label="Request a call back">
      <h3 className="nwc-form-title">Your details</h3>
      {failure ? (
        <p className="nwc-alert" role="alert">
          <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
          {failure}
        </p>
      ) : null}
      <div className="nwc-field">
        <label className="nwc-label" htmlFor={fid('name')}>
          Full name
        </label>
        <input
          id={fid('name')}
          className="nwc-input"
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          required
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={describedBy('name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {fieldError('name')}
      </div>
      <div className="nwc-row">
        <div className="nwc-field">
          <label className="nwc-label" htmlFor={fid('email')}>
            Email address
          </label>
          <input
            id={fid('email')}
            className="nwc-input"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="Enter your email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldError('email')}
        </div>
        <div className="nwc-field">
          <label className="nwc-label" htmlFor={fid('phone')}>
            Phone number
          </label>
          <input
            id={fid('phone')}
            className="nwc-input"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="Enter your phone number"
            required
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={describedBy('phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {fieldError('phone')}
        </div>
      </div>
      <div className="nwc-field">
        <label className="nwc-label" htmlFor={fid('need')}>
          {selectLabel}
        </label>
        <div className="nwc-select">
          <select
            id={fid('need')}
            className="nwc-input"
            value={need}
            onChange={(e) => setNeed(e.target.value)}
          >
            <option value="">{selectPlaceholder}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ServiceIcon name="chevronDown" size={16} stroke="#5E6676" />
        </div>
      </div>
      <div className="nwc-field">
        <label className="nwc-label" htmlFor={fid('message')}>
          Message
        </label>
        <textarea
          id={fid('message')}
          className="nwc-input"
          rows={4}
          placeholder={messagePlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
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
      <button type="submit" className="nw-btn nwc-submit" disabled={sending}>
        <ServiceIcon name="phone" size={16} />
        {sending ? 'Sending…' : 'Call Me Back'}
      </button>
      {variant === 'jump' ? (
        <p className="nwc-note">
          By submitting, you agree to be contacted by Navigate Wealth. We use your details only to
          respond to your enquiry, in line with POPIA and our Privacy Notice.
        </p>
      ) : null}
    </form>
  );

  return (
    <section
      id={id}
      aria-label="Request a call back"
      className={`nw-sec nw-sec--white nwc nwc--${variant}`}
    >
      <div className="nw-wrap">
        <div className="nwc-card">
          {intro}
          <div className="nwc-side">{sentTo !== null ? done : formEl}</div>
        </div>
      </div>
    </section>
  );
}
