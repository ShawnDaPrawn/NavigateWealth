/**
 * CareersCvDialog — "Submit Your CV", the Careers page's application form.
 *
 * It sends exactly what the live page's CVUploadModal sends (the name split
 * into first and last, email, phone, the message, service "Careers", client
 * type "job application") through submitContactEnquiry, so applications land
 * in the same place whichever design is live. There is no CV storage behind
 * the site, so, as on the live page, the CV itself is asked for by email.
 *
 * Like the other Navigator forms it adds the server's honeypot field, errors
 * beside each field with focus on the first, a failed send shown in the form,
 * and the confirmation shown in place, as the board draws it.
 *
 * The dialog is Radix: focus moves to the first field, is trapped while open,
 * and returns to whichever button opened it. Radix portals it to <body>,
 * outside the page's `.nw-site` wrapper, so the portal carries its own
 * `nw-site` class for the scoped styles to apply.
 */
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type RefObject,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, CheckCircle, File, Mail, Send, X } from 'lucide-react';
import { COMPANY } from '../../config/companyFacts';
import { splitFullName, submitContactEnquiry } from '../../services/contactEnquiry';
import { emailError, phoneError } from './formRules';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/careers.css';

interface CareersCvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The button that opened the dialog; focus goes back to it on close. */
  returnFocusTo: RefObject<HTMLElement | null>;
}

type Field = 'name' | 'email' | 'phone';
type Errors = Partial<Record<Field, string>>;
const FIELD_ORDER: Field[] = ['name', 'email', 'phone'];
const EMPTY = { name: '', email: '', phone: '', message: '' };

function validate(values: typeof EMPTY): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = 'Enter your full name';
  const emailProblem = emailError(values.email);
  if (emailProblem) errors.email = emailProblem;
  const phoneProblem = phoneError(values.phone);
  if (phoneProblem) errors.phone = phoneProblem;
  return errors;
}

/** The same address and subject line the live form's link uses. */
function cvMailto(name: string): string {
  return `mailto:${COMPANY.email}?subject=${encodeURIComponent(
    `CV – ${name.trim() || 'Application'}`,
  )}`;
}

export function CareersCvDialog({ open, onOpenChange, returnFocusTo }: CareersCvDialogProps) {
  const base = useId();
  const fid = (name: string) => `${base}-${name}`;
  const [values, setValues] = useState(EMPTY);
  const [website, setWebsite] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState('');
  const [sending, setSending] = useState(false);
  const [sentName, setSentName] = useState<string | null>(null);
  const doneTitle = useRef<HTMLHeadingElement>(null);

  const change =
    (field: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSentName(null);
      setErrors({});
      setFailure('');
    }
    onOpenChange(next);
  };

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
      ...splitFullName(values.name),
      email: values.email.trim(),
      phone: values.phone.trim(),
      service: 'Careers',
      message: values.message.trim(),
      clientType: 'job application',
      website,
    });
    setSending(false);
    if (!result.ok) {
      setFailure(result.error);
      return;
    }
    setSentName(values.name);
    setValues(EMPTY);
    // The form is gone; put focus on the confirmation that replaced it.
    requestAnimationFrame(() => doneTitle.current?.focus());
  };

  const input = (field: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <div className="nwcr-field">
      <label className="nwcr-label" htmlFor={fid(field)}>
        {label}
      </label>
      <input
        id={fid(field)}
        className="nwcr-input"
        required
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={errors[field] ? `${fid(field)}-error` : undefined}
        value={values[field]}
        onChange={change(field)}
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
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <div className="nw-site nwcr-portal">
          <Dialog.Overlay className="nwcr-overlay">
            <Dialog.Content
              className="nwcr-dlg"
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                document.getElementById(fid('name'))?.focus();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                returnFocusTo.current?.focus();
              }}
            >
              <Dialog.Close className="nwcr-x" aria-label="Close">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>

              {sentName !== null ? (
                <div className="nwcr-done">
                  <span className="nwcr-done-icon" aria-hidden="true">
                    <CheckCircle size={30} strokeWidth={1.75} />
                  </span>
                  <Dialog.Title ref={doneTitle} tabIndex={-1} className="nw-h nwcr-done-title">
                    Thank you — we have your details.
                  </Dialog.Title>
                  <Dialog.Description className="nwcr-done-p">
                    Please email your CV to {COMPANY.email}.
                  </Dialog.Description>
                  <div className="nwcr-done-actions">
                    <a className="nw-btn" href={cvMailto(sentName)}>
                      <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                      Email your CV
                    </a>
                    <Dialog.Close className="nw-outline">Close</Dialog.Close>
                  </div>
                </div>
              ) : (
                <form className="nwcr-form" noValidate onSubmit={onSubmit}>
                  <div className="nwcr-form-head">
                    <span className="nwcr-form-icon" aria-hidden="true">
                      <Send size={24} strokeWidth={1.75} />
                    </span>
                    <Dialog.Title className="nw-h nwcr-dlg-title">Submit Your CV</Dialog.Title>
                    <Dialog.Description className="nwcr-dlg-sub">
                      Send us your details below, then email your CV to {COMPANY.email}.
                    </Dialog.Description>
                  </div>
                  <h3 className="nw-mono nwcr-form-h3">Contact Information</h3>
                  {failure ? (
                    <p className="nwc-alert" role="alert">
                      <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
                      {failure}
                    </p>
                  ) : null}
                  {input('name', 'Full Name *', {
                    type: 'text',
                    autoComplete: 'name',
                    placeholder: 'Your full name',
                  })}
                  <div className="nwcr-row">
                    {input('email', 'Email Address *', {
                      type: 'email',
                      autoComplete: 'email',
                      inputMode: 'email',
                      placeholder: 'your.email@example.com',
                    })}
                    {input('phone', 'Phone Number *', {
                      type: 'tel',
                      autoComplete: 'tel',
                      inputMode: 'tel',
                      placeholder: '+27 12 345 6789',
                    })}
                  </div>
                  <div className="nwcr-field">
                    <label className="nwcr-label" htmlFor={fid('message')}>
                      Tell us about yourself
                    </label>
                    <textarea
                      id={fid('message')}
                      className="nwcr-input nwcr-textarea"
                      rows={4}
                      placeholder="Tell us about your experience, what role you're interested in, or why you'd like to work with Navigate Wealth..."
                      value={values.message}
                      onChange={change('message')}
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
                  <div className="nwcr-note">
                    <File size={20} strokeWidth={1.75} aria-hidden="true" />
                    <div className="nwcr-note-body">
                      <p className="nwcr-note-t">Your CV</p>
                      <p className="nwcr-note-p">
                        Please email your CV (PDF or Word) to{' '}
                        <a className="nwcr-note-link" href={cvMailto(values.name)}>
                          {COMPANY.email}
                        </a>{' '}
                        with your name in the subject line.
                      </p>
                    </div>
                  </div>
                  <div className="nwcr-form-actions">
                    <button type="submit" className="nw-btn nwcr-send" disabled={sending}>
                      {sending ? 'Sending…' : 'Send My Details'}
                    </button>
                    <Dialog.Close className="nw-outline nwcr-cancel" disabled={sending}>
                      Cancel
                    </Dialog.Close>
                  </div>
                </form>
              )}
            </Dialog.Content>
          </Dialog.Overlay>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
