/**
 * "Take the First Step Toward Your Financial Future" — the home page's
 * enquiry form. Sends exactly what the live form sends (first and last name,
 * email, phone and the chosen service) through submitContactEnquiry, plus the
 * endpoint's `website` honeypot. Adds what the live form lacked: errors under
 * each field, focus on the first one, the server's failure shown in the form,
 * and a link to the Privacy Notice where the details are collected.
 */
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertCircle, ArrowRight, Check, ChevronDown } from 'lucide-react';
import {
  ctaTrustPoints,
  DEFAULT_SERVICE_INTEREST,
  serviceInterestOptions,
} from '../../components/pages/homePageData';
import { submitContactEnquiry } from '../../services/contactEnquiry';
import { ContactStrip } from './HomeParts';
import {
  PRIVACY_NOTICE_PATH,
  saSpelling,
  START_FIELDS,
  validateStart,
  type StartErrors,
  type StartField,
} from './homeContent';

const EMPTY: Record<StartField, string> = { firstName: '', lastName: '', email: '', phone: '' };

const FIELD_LABELS: Record<StartField, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  email: 'Email Address',
  phone: 'Phone Number',
};

export function GetStartedSection() {
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const [values, setValues] = useState(EMPTY);
  const [service, setService] = useState(DEFAULT_SERVICE_INTEREST);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<StartErrors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ name: string; service: string } | null>(null);

  const set = (field: StartField) => (value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const found = validateStart(values);
    setErrors(found);
    setFailure('');
    const first = START_FIELDS.find((f) => found[f]);
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
      service,
      // The honeypot rides along only when a bot fills it, so a person's
      // enquiry is byte-for-byte what the live form sends.
      ...(website ? { website } : {}),
    });
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    const label = serviceInterestOptions.find((o) => o.value === service)?.label ?? service;
    setDone({ name: values.firstName.trim(), service: label });
    setValues(EMPTY);
    setService(DEFAULT_SERVICE_INTEREST);
  };

  const input = (field: StartField, type: string, autoComplete: string, placeholder: string) => (
    <div className="nwhm-field">
      <label className="nwhm-label" htmlFor={fid(field)}>
        {FIELD_LABELS[field]}
        <span aria-hidden="true"> *</span>
      </label>
      <input
        id={fid(field)}
        className="nwc-input"
        type={type}
        autoComplete={autoComplete}
        inputMode={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined}
        placeholder={placeholder}
        required
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${fid(field)}-error` : undefined}
        value={values[field]}
        onChange={(e) => set(field)(e.target.value)}
      />
      {errors[field] ? (
        <p id={`${fid(field)}-error`} className="nwc-error">
          <AlertCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          {errors[field]}
        </p>
      ) : null}
    </div>
  );

  return (
    <section id="get-started" className="nw-sec nwhm-close" aria-labelledby="nwhm-start-title">
      <div className="nw-wrap nwhm-start-grid">
        <div>
          <p className="nwhm-live">
            <span className="nwhm-live-dot" aria-hidden="true" />
            Free initial consultation
          </p>
          <h2 id="nwhm-start-title" className="nw-sec-title">
            Take the First Step Toward Your Financial Future
          </h2>
          <p className="nw-sec-lead">
            We compare solutions from the providers we work with and recommend what suits your
            goals.
          </p>
          <ul className="nwhm-points">
            {ctaTrustPoints.map(({ text, icon: Icon }) => (
              <li key={text}>
                <span className="nwhm-points-i" aria-hidden="true">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <ContactStrip />
        </div>

        <div className="nwhm-form-card">
          {done ? (
            <div className="nwc-done" role="status">
              <span className="nwc-done-icon" aria-hidden="true">
                <Check size={24} strokeWidth={2} />
              </span>
              <h3 className="nwhm-form-t">Thank you for your interest!</h3>
              <p>
                {saSpelling(
                  `Hi ${done.name}, we've received your inquiry about ${done.service}. We will contact you within 24 hours on business days to discuss your financial goals.`,
                )}
              </p>
              <button type="button" className="nw-outline" onClick={() => setDone(null)}>
                Send another enquiry
              </button>
            </div>
          ) : (
            <form
              className="nwhm-form"
              noValidate
              onSubmit={onSubmit}
              aria-labelledby={fid('title')}
            >
              <div>
                <h3 id={fid('title')} className="nwhm-form-t">
                  Get Started
                </h3>
                <p className="nwhm-form-p">
                  Fill in your details and we&apos;ll be in touch within 24 hours.
                </p>
              </div>
              {failure ? (
                <p className="nwc-alert" role="alert">
                  <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                  {failure}
                </p>
              ) : null}
              <div className="nwhm-form-row">
                {input('firstName', 'text', 'given-name', 'First Name')}
                {input('lastName', 'text', 'family-name', 'Last Name')}
              </div>
              {input('email', 'email', 'email', 'your.email@example.com')}
              <div className="nwhm-form-row">
                {input('phone', 'tel', 'tel', '+27 12 345 6789')}
                <div className="nwhm-field">
                  <label className="nwhm-label" htmlFor={fid('service')}>
                    Service of Interest
                  </label>
                  <div className="nwc-select">
                    <select
                      id={fid('service')}
                      className="nwc-input"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                    >
                      {serviceInterestOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
                  </div>
                </div>
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
              <button type="submit" className="nw-btn nwhm-submit" disabled={sending}>
                {sending ? 'Submitting…' : 'Get Started Today'}
                {sending ? null : <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />}
              </button>
              <p className="nwhm-form-note">
                By submitting, you agree to be contacted by Navigate Wealth. We use your details
                only to respond to your enquiry, in line with POPIA and our{' '}
                <Link to={PRIVACY_NOTICE_PATH}>Privacy Notice</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
