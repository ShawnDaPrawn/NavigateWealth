/**
 * EnquiryPanel — "Take the first step": the reasons to get in touch, the
 * firm's contact details, and the home page's lead form.
 *
 * The form sends exactly what the live home page sends (first and last name,
 * email, phone, service) through submitContactEnquiry, so leads land in the
 * same place either way. Like the service pages' call-back form, it adds
 * field-level errors with focus on the first, a failure message in the form
 * rather than a passing toast, the server's honeypot field, a Privacy Notice
 * link at the point of collection, and the confirmation shown in place.
 */
import { useId, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';
import { submitContactEnquiry } from '../../services/contactEnquiry';
import { emailError, phoneError } from './formRules';
import '../styles/sections.css';
import '../styles/home.css';

export interface EnquiryOption {
  value: string;
  label: string;
}

interface EnquiryPanelProps {
  options: readonly EnquiryOption[];
  /** Pre-selected service; must be one of the options' values. */
  defaultService: string;
}

type Field = 'firstName' | 'lastName' | 'email' | 'phone';
type Errors = Partial<Record<Field, string>>;
const FIELD_ORDER: Field[] = ['firstName', 'lastName', 'email', 'phone'];

const POINTS: { text: string; icon: LucideIcon }[] = [
  { text: 'Personalised financial advice', icon: Target },
  { text: 'Independent & unbiased', icon: ShieldCheck },
  { text: 'No-obligation consultation', icon: CircleCheck },
  { text: 'Response within 24 hours', icon: Zap },
];

function validate(values: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = 'Enter your first name';
  if (!values.lastName.trim()) errors.lastName = 'Enter your last name';
  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;
  const phoneProblem = phoneError(values.phone);
  if (phoneProblem) errors.phone = phoneProblem;
  return errors;
}

export function EnquiryPanel({ options, defaultService }: EnquiryPanelProps) {
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const empty: Record<Field, string> = { firstName: '', lastName: '', email: '', phone: '' };
  const [values, setValues] = useState(empty);
  const [service, setService] = useState(defaultService);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const set = (field: Field) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const found = validate(values);
    setErrors(found);
    setFailure('');
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
      service,
      website,
    });
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSentTo(values.firstName.trim());
    setValues(empty);
    setService(defaultService);
  };

  const input = (field: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <div className="nwc-field">
      <label className="nwc-label" htmlFor={fid(field)}>
        {label}
      </label>
      <input
        id={fid(field)}
        className="nwc-input"
        required
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${fid(field)}-error` : undefined}
        value={values[field]}
        onChange={set(field)}
        {...props}
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
    <section id="get-started" className="nwen" aria-labelledby="nwen-title">
      <div className="nw-wrap nwen-grid">
        <div>
          <p className="nwen-badge">
            <span className="nwen-dot" aria-hidden="true" />
            Free initial consultation
          </p>
          <h2 id="nwen-title" className="nwen-title">
            Take the First Step Toward Your Financial Future
          </h2>
          <p className="nwen-lead">
            We compare solutions from the providers we work with and recommend what suits your
            goals.
          </p>
          <ul className="nwen-points">
            {POINTS.map(({ text, icon: Icon }) => (
              <li key={text}>
                <span className="nwen-point-icon" aria-hidden="true">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <ul className="nwen-contact">
            <li>
              <a href={COMPANY.phone.tel}>
                <span className="nwen-contact-icon" aria-hidden="true">
                  <Phone size={17} strokeWidth={1.75} />
                </span>
                <span>
                  <span className="nwen-contact-l nw-mono">Call us</span>
                  <span className="nwen-contact-v">{COMPANY.phone.display}</span>
                </span>
              </a>
            </li>
            <li>
              <a href={`mailto:${COMPANY.email}`}>
                <span className="nwen-contact-icon" aria-hidden="true">
                  <Mail size={17} strokeWidth={1.75} />
                </span>
                <span>
                  <span className="nwen-contact-l nw-mono">Email us</span>
                  <span className="nwen-contact-v">{COMPANY.email}</span>
                </span>
              </a>
            </li>
            <li className="nwen-contact-item">
              <span className="nwen-contact-icon" aria-hidden="true">
                <MapPin size={17} strokeWidth={1.75} />
              </span>
              <span>
                <span className="nwen-contact-l nw-mono">Visit us</span>
                <span className="nwen-contact-v">{COMPANY.address.city}</span>
              </span>
            </li>
          </ul>
        </div>

        {sentTo !== null ? (
          <div className="nwen-form nwc-done" role="status">
            <span className="nwc-done-icon" aria-hidden="true">
              <Check size={24} strokeWidth={2} />
            </span>
            <h3 className="nwen-form-title">{sentTo ? `Thank you, ${sentTo}.` : 'Thank you.'}</h3>
            <p>
              We have received your enquiry and will contact you within 24 hours on business days to
              discuss your financial goals.
            </p>
            <button type="button" className="nw-outline" onClick={() => setSentTo(null)}>
              Send another enquiry
            </button>
          </div>
        ) : (
          <form className="nwen-form" noValidate onSubmit={onSubmit} aria-labelledby={fid('title')}>
            <div>
              <h3 id={fid('title')} className="nwen-form-title">
                Get Started
              </h3>
              <p className="nwen-form-sub">
                Fill in your details and we&apos;ll be in touch within 24 hours.
              </p>
            </div>
            {failure ? (
              <p className="nwc-alert" role="alert">
                <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                {failure}
              </p>
            ) : null}
            <div className="nwc-row">
              {input('firstName', 'First name', {
                type: 'text',
                autoComplete: 'given-name',
                placeholder: 'First name',
              })}
              {input('lastName', 'Last name', {
                type: 'text',
                autoComplete: 'family-name',
                placeholder: 'Last name',
              })}
            </div>
            {input('email', 'Email address', {
              type: 'email',
              autoComplete: 'email',
              inputMode: 'email',
              placeholder: 'your.email@example.com',
            })}
            <div className="nwc-row">
              {input('phone', 'Phone number', {
                type: 'tel',
                autoComplete: 'tel',
                inputMode: 'tel',
                placeholder: '+27 12 345 6789',
              })}
              <div className="nwc-field">
                <label className="nwc-label" htmlFor={fid('service')}>
                  Service of interest
                </label>
                <div className="nwc-select">
                  <select
                    id={fid('service')}
                    className="nwc-input"
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    {options.map((o) => (
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
            <button type="submit" className="nw-btn nw-btn--lg nwc-submit" disabled={sending}>
              {sending ? 'Sending…' : 'Request a Free Consultation'}
              {sending ? null : <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
            <p className="nwc-note">
              By submitting, you agree to be contacted by Navigate Wealth. We use your details only
              to respond to your enquiry, in line with POPIA and our{' '}
              <Link to="/legal/privacy-notice">Privacy Notice</Link>.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
