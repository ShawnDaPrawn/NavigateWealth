/**
 * "Submit Your CV" — the Navigator version of the live CVUploadModal.
 *
 * Sends exactly what the live form sends, byte for byte, through the same
 * client (submitContactEnquiry → POST /contact-form/submit, service "Careers",
 * clientType "job application"); the server's `website` honeypot field is in
 * the form and is only sent when a bot has filled it in. There
 * is no CV storage behind the site, so the CV itself is asked for by email,
 * as the live form does. Adds field-level errors, a failure message inside the
 * form instead of a passing toast, and the Privacy Notice at the point of
 * collection.
 */
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, CircleCheck, FileText, Mail, Send } from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';
import {
  splitFullName,
  submitContactEnquiry,
  type ContactEnquiry,
} from '../../services/contactEnquiry';
import { CompanyDialog } from './CompanyDialog';
import '../styles/sections.css';

interface CareersApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Field = 'name' | 'email' | 'phone';
type Errors = Partial<Record<Field, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]+$/;

function validate(name: string, email: string, phone: string): Errors {
  const errors: Errors = {};
  if (!name.trim()) errors.name = 'Enter your full name';
  if (!email.trim()) errors.email = 'Enter your email address';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!phone.trim()) errors.phone = 'Enter your phone number';
  else if (!PHONE_PATTERN.test(phone.trim()) || phone.replace(/\D/g, '').length < 9)
    errors.phone = 'Enter a valid phone number';
  return errors;
}

function cvMailto(name: string): string {
  return `mailto:${COMPANY.email}?subject=${encodeURIComponent(`CV – ${name.trim() || 'Application'}`)}`;
}

export function CareersApplyDialog({ open, onOpenChange }: CareersApplyDialogProps) {
  const base = useId();
  const fid = (field: string) => `${base}-${field}`;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSentName(null);
      setFailure('');
      setErrors({});
    }
    onOpenChange(next);
  };

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
    setSending(true);
    // Byte-for-byte the live form's payload (the server's emails key off it).
    // The honeypot is only sent when something filled it in — a bot.
    const enquiry: ContactEnquiry = {
      ...splitFullName(name),
      email: email.trim(),
      phone: phone.trim(),
      service: 'Careers',
      message: message.trim(),
      clientType: 'job application',
    };
    if (website) enquiry.website = website;
    const result = await submitContactEnquiry(enquiry);
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSentName(name.trim());
    setName('');
    setEmail('');
    setPhone('');
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
    <CompanyDialog open={open} onOpenChange={handleOpenChange}>
      {sentName !== null ? (
        <div className="nwco-dialog-body nwco-dialog-done" role="status">
          <span className="nwco-done-icon" aria-hidden="true">
            <CircleCheck size={30} strokeWidth={1.75} />
          </span>
          <Dialog.Title className="nwco-dialog-title nwco-dialog-title--sm">
            Thank you — we have your details.
          </Dialog.Title>
          <Dialog.Description className="nwco-dialog-lead">
            Please email your CV to {COMPANY.email}.
          </Dialog.Description>
          <div className="nwco-dialog-actions nwco-dialog-actions--center">
            <a className="nw-btn" href={cvMailto(sentName)}>
              <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
              Email your CV
            </a>
            <Dialog.Close className="nw-outline">Close</Dialog.Close>
          </div>
        </div>
      ) : (
        <form
          className="nwco-dialog-body nwco-cv-form"
          noValidate
          onSubmit={onSubmit}
          aria-labelledby={fid('title')}
        >
          <div className="nwco-dialog-head">
            <span className="nwco-dialog-icon" aria-hidden="true">
              <Send size={24} strokeWidth={1.75} />
            </span>
            <Dialog.Title id={fid('title')} className="nwco-dialog-title">
              Submit Your CV
            </Dialog.Title>
            <Dialog.Description className="nwco-dialog-lead">
              Send us your details below, then email your CV to {COMPANY.email}.
            </Dialog.Description>
          </div>

          {failure ? (
            <p className="nwc-alert" role="alert">
              <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
              {failure}
            </p>
          ) : null}

          <h3 className="nwco-cv-legend nw-mono">Contact Information</h3>
          <div className="nwc-field">
            <label className="nwc-label" htmlFor={fid('name')}>
              Full name
            </label>
            <input
              id={fid('name')}
              className="nwc-input"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
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
                placeholder="your.email@example.com"
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
                placeholder="+27 12 345 6789"
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
            <label className="nwc-label" htmlFor={fid('message')}>
              Tell us about yourself
            </label>
            <textarea
              id={fid('message')}
              className="nwc-input"
              rows={4}
              placeholder="Tell us about your experience, what role you're interested in, or why you'd like to work with Navigate Wealth..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="nwco-cv-note">
            <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="nwco-cv-note-t">Your CV</p>
              <p>
                Please email your CV (PDF or Word) to <a href={cvMailto(name)}>{COMPANY.email}</a>{' '}
                with your name in the subject line.
              </p>
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

          <div className="nwco-dialog-actions">
            <button type="submit" className="nw-btn" disabled={sending}>
              {sending ? 'Sending…' : 'Send My Details'}
            </button>
            <Dialog.Close className="nw-outline" disabled={sending}>
              Cancel
            </Dialog.Close>
          </div>
          <p className="nwc-note">
            We use these details only to respond to your application. See our{' '}
            <Link to="/legal/privacy-notice">Privacy Notice</Link>.
          </p>
        </form>
      )}
    </CompanyDialog>
  );
}
