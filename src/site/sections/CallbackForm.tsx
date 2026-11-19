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
import { AlertCircle, Check, ChevronDown, Phone, Scale, Shield } from 'lucide-react';
import { splitFullName, submitContactEnquiry } from '../../services/contactEnquiry';
import { emailError, phoneError } from './formRules';
import '../styles/sections.css';

export interface CallbackOption {
  value: string;
  label: string;
}

interface CallbackFormProps {
  id?: string;
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

  return (
    <section id={id} aria-label="Request a call back" className="nw-sec nw-sec--white">
      <div className="nw-wrap">
        <div className="nwc-card">
          <div className="nwc-intro">
            <div className="nw-grid-bg" aria-hidden="true" />
            <div className="nwc-intro-inner">
              <span className="nwc-icon" aria-hidden="true">
                <Phone size={22} strokeWidth={1.75} />
              </span>
              <h2 className="nwc-title">
                Let us call
                <br />
                you back
              </h2>
              <p className="nwc-lead">
                Complete the form and we will contact you about your {topic} needs, with
                personalised options.
              </p>
              <ul className="nwc-points">
                <li>
                  <span className="nwc-point-icon" aria-hidden="true">
                    <Check size={17} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="nwc-point-t">Free consultation</span>
                    <span className="nwc-point-s">No cost, no commitment</span>
                  </span>
                </li>
                <li>
                  <span className="nwc-point-icon" aria-hidden="true">
                    <Shield size={17} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="nwc-point-t">Independent advice</span>
                    <span className="nwc-point-s">FSCA-authorised, not tied to one provider</span>
                  </span>
                </li>
                <li>
                  <span className="nwc-point-icon" aria-hidden="true">
                    <Scale size={17} strokeWidth={1.75} />
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

          {sentTo !== null ? (
            <div className="nwc-form nwc-done" role="status">
              <span className="nwc-done-icon" aria-hidden="true">
                <Check size={24} strokeWidth={2} />
              </span>
              <h3 className="nwc-form-title">{sentTo ? `Thank you, ${sentTo}.` : 'Thank you.'}</h3>
              <p>
                Your request has been received. We will call you within 24 hours on business days to
                arrange a convenient time.
              </p>
              <button type="button" className="nw-outline" onClick={() => setSentTo(null)}>
                Send another request
              </button>
            </div>
          ) : (
            <form
              className="nwc-form"
              noValidate
              onSubmit={onSubmit}
              aria-label="Request a call back"
            >
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
                  <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
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
              <button type="submit" className="nw-btn nw-btn--lg nwc-submit" disabled={sending}>
                <Phone size={17} strokeWidth={1.75} aria-hidden="true" />
                {sending ? 'Sending…' : 'Call Me Back'}
              </button>
              <p className="nwc-note">
                We use these details only to respond to your request. See our{' '}
                <Link to="/legal/privacy-notice">Privacy Notice</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
