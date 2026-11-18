/**
 * NavigatorForgotPasswordPage — /forgot-password in the Navigator design.
 *
 * Presentation only: validation and the sendPasswordResetEmail call are
 * useForgotPasswordForm, the hook the live ForgotPasswordPage runs. Two
 * states, as on the live page: the request form, and "Check Your Email" once
 * the link has been sent (the brand panel changes with it). Focus follows the
 * swap so keyboard and screen-reader users are not left on a removed button.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, KeyRound, Lock, Mail, MailCheck } from 'lucide-react';
import { FORGOT_PASSWORD_FEATURES } from '../../components/pages/auth/authConstants';
import {
  useForgotPasswordForm,
  type ForgotPasswordForm,
} from '../../components/pages/auth/useForgotPasswordForm';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { AccountAlert } from '../account/AccountAlert';
import { AccountBrandPanel, BrandFeatureList } from '../account/AccountBrandPanel';
import { AccountField } from '../account/AccountField';
import { AccountAppShell, AccountSplit } from '../account/AccountLayout';
import { fieldErrorId, useFocusOnInvalid } from '../account/accountUi';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';

const PAGE_CLASS = 'nwx-forgot-password';
const IDS = { email: 'nwac-fp-email', error: 'nwac-fp-error' } as const;

function RequestForm({ form, focusEmail }: { form: ForgotPasswordForm; focusEmail: boolean }) {
  const [attempt, setAttempt] = useState(0);
  useFocusOnInvalid(attempt, form.errorField ? IDS.email : null);

  // Back from "Send Another Link": put the cursor where the next step is.
  useEffect(() => {
    if (focusEmail) document.getElementById(IDS.email)?.focus();
  }, [focusEmail]);

  const onSubmit = (e: FormEvent) => {
    setAttempt((n) => n + 1);
    void form.handleSubmit(e);
  };

  const emailError = form.errorField ? form.error : null;
  const formError = form.error && !form.errorField ? form.error : '';

  return (
    <div className="nwac-form">
      <span className="nwac-badge" aria-hidden="true">
        <KeyRound size={24} strokeWidth={1.75} />
      </span>
      <div className="nwac-head">
        <h1 className="nwac-title">Reset your password</h1>
        <p className="nwac-sub">
          Enter your email address and we&apos;ll send you a link to reset your password
        </p>
      </div>

      {formError ? (
        <AccountAlert tone="error" id={IDS.error}>
          {formError}
        </AccountAlert>
      ) : null}

      <form
        className="nwac-fields"
        onSubmit={onSubmit}
        noValidate
        aria-label="Request a password reset link"
        aria-describedby={formError ? IDS.error : undefined}
      >
        <AccountField htmlFor={IDS.email} label="Email Address" error={emailError}>
          <input
            id={IDS.email}
            name="email"
            type="email"
            className="nwac-input"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => form.setEmail(e.target.value)}
            disabled={form.isLoading}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? fieldErrorId(IDS.email) : undefined}
          />
        </AccountField>

        <button
          type="submit"
          className="nw-btn nwac-submit"
          disabled={form.isLoading}
          aria-busy={form.isLoading || undefined}
        >
          {form.isLoading ? (
            <>
              <span className="nwac-spin" aria-hidden="true" />
              Sending Reset Link...
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>

        <Link to="/login" className="nw-outline">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to Login
        </Link>
      </form>

      <p className="nwac-alt">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="nwac-link">
          Sign up
        </Link>
      </p>

      <p className="nwac-note">
        <Lock size={15} strokeWidth={1.75} aria-hidden="true" />
        <span>
          For security reasons, we&apos;ll only send reset links to registered email addresses
        </span>
      </p>
    </div>
  );
}

function SentConfirmation({ form, onAgain }: { form: ForgotPasswordForm; onAgain: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="nwac-form nwac-sent nw-in">
      <div className="nwac-ripple" aria-hidden="true">
        <span className="nwac-ripple-ring" />
        <span className="nwac-ripple-core nwac-ripple-core--ok">
          <Mail size={32} strokeWidth={1.75} />
        </span>
      </div>
      <div className="nwac-head">
        <h1 className="nwac-title" ref={headingRef} tabIndex={-1}>
          Check Your Email
        </h1>
        <p className="nwac-copy">
          We&apos;ve sent a password reset link to <strong>{form.email}</strong>
        </p>
      </div>

      <div className="nwac-box">
        <p>Didn&apos;t receive the email? Check your spam folder or try again.</p>
        <p className="nwac-box-fine nw-mono">
          The reset link will expire in 15 minutes for security reasons.
        </p>
      </div>

      <div className="nwac-actions">
        <button type="button" className="nw-outline" onClick={onAgain}>
          Send Another Link
        </button>
        <Link to="/login" className="nw-btn">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Back to Login
        </Link>
      </div>
    </div>
  );
}

function RequestBrand() {
  return (
    <AccountBrandPanel
      quiet
      heading={
        <>
          Secure Account <span className="nw-accent">Recovery</span>
        </>
      }
      lead="We take your security seriously with industry-leading protection measures."
    >
      <BrandFeatureList items={FORGOT_PASSWORD_FEATURES} />
    </AccountBrandPanel>
  );
}

function SentBrand() {
  return (
    <AccountBrandPanel
      quiet
      badge={
        <span className="nwac-brand-ok" aria-hidden="true">
          <MailCheck size={26} strokeWidth={1.75} />
        </span>
      }
      heading={
        <>
          Reset link sent <span className="nw-accent">securely</span>
        </>
      }
      lead="Your password reset request has been processed with our highest security standards."
    >
      <div className="nwac-level">
        <p className="nwac-level-row">
          <span>Security Level</span>
          <span className="nwac-level-v nw-mono">Maximum</span>
        </p>
        <div className="nwac-level-bar" aria-hidden="true">
          <span />
        </div>
        <p className="nwac-level-note">Your account is protected with bank-level security</p>
      </div>
    </AccountBrandPanel>
  );
}

export function NavigatorForgotPasswordPage() {
  const isStandalone = useIsStandalone();
  const form = useForgotPasswordForm();
  const [returning, setReturning] = useState(false);

  const sendAnother = () => {
    setReturning(true);
    form.sendAnother();
  };

  const content = form.isSubmitted ? (
    <SentConfirmation form={form} onAgain={sendAnother} />
  ) : (
    <RequestForm form={form} focusEmail={returning} />
  );

  if (isStandalone) {
    return <AccountAppShell pageClass={PAGE_CLASS}>{content}</AccountAppShell>;
  }

  return (
    <AccountSplit
      pageClass={PAGE_CLASS}
      quiet
      brand={form.isSubmitted ? <SentBrand /> : <RequestBrand />}
    >
      {content}
    </AccountSplit>
  );
}
