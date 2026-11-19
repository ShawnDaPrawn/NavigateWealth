/**
 * LoginForm — "Log in", the form on the "Login" board.
 *
 * Every value and handler comes from useLoginForm, the hook the legacy page
 * runs too, so submitting here checks, signs in, challenges and redirects
 * exactly as the live page does, with its messages word for word. What this
 * adds is presentation: the board's fields, the live page's alerts in the
 * design system's style, and, when the live check refuses the email or the
 * password, that field marked invalid and focused.
 *
 * "Keep me signed in" holds its state the way the live page's checkbox does;
 * the live sign-in does not read it either.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { useLoginForm } from '../../components/pages/auth/useLoginForm';
import { LoginAlert, LoginPasswordInput, LoginSpinner } from './LoginFields';
import { LoginIcon } from './LoginIcons';
import '../styles/login.css';

type LoginFormState = ReturnType<typeof useLoginForm>;
type Field = 'email' | 'password';

const FIELD_IDS: Record<Field, string> = {
  email: 'nwli-email',
  password: 'nwli-password',
};

/** The live page's two pre-submit checks, and the field each one is about. */
const LOGIN_FIELD_ERRORS: Record<string, Field> = {
  'Please enter a valid email address': 'email',
  'Password must be at least 8 characters': 'password',
};

const ERROR_ID = 'nwli-error';

export function LoginForm({ form }: { form: LoginFormState }) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    rememberMe,
    setRememberMe,
    isSubmitting,
    error,
    verificationEmailSent,
    successMessage,
    handleResendVerification,
    handleSubmit,
  } = form;
  // Counts submits, so a repeated refusal moves focus back to its field even
  // when the message has not changed.
  const [attempt, setAttempt] = useState(0);
  const invalid: Field | undefined = LOGIN_FIELD_ERRORS[error];

  useEffect(() => {
    if (invalid) document.getElementById(FIELD_IDS[invalid])?.focus();
  }, [invalid, error, attempt]);

  return (
    <form
      className="nwli-form"
      onSubmit={(event) => {
        setAttempt((n) => n + 1);
        void handleSubmit(event);
      }}
      aria-describedby={error ? ERROR_ID : undefined}
    >
      <div className="nwli-head">
        <h1 className="nwli-title">Log in</h1>
        <p className="nwli-sub">Enter your details to access your account.</p>
        <div className="nwli-status" aria-live="polite">
          {successMessage && <LoginAlert tone="success">{successMessage}</LoginAlert>}
          {verificationEmailSent && (
            <LoginAlert tone="info">Verification email sent! Please check your inbox.</LoginAlert>
          )}
        </div>
        {error && (
          <LoginAlert tone="danger" id={ERROR_ID}>
            {error}
            {error.includes('verify your email') && (
              <button
                type="button"
                onClick={handleResendVerification}
                className="nwli-alert-action"
              >
                Resend verification email
              </button>
            )}
          </LoginAlert>
        )}
      </div>

      <div className="nwli-field">
        <label htmlFor={FIELD_IDS.email} className="nwli-label">
          Email Address
        </label>
        <input
          id={FIELD_IDS.email}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your.email@example.com"
          disabled={isSubmitting}
          aria-invalid={invalid === 'email' || undefined}
          aria-describedby={invalid === 'email' ? ERROR_ID : undefined}
          className="nwli-input"
        />
      </div>

      <div className="nwli-field">
        <div className="nwli-label-row">
          <label htmlFor={FIELD_IDS.password} className="nwli-label">
            Password
          </label>
          <Link to="/forgot-password" className="nwli-link nwli-forgot">
            Forgot?
          </Link>
        </div>
        <LoginPasswordInput
          id={FIELD_IDS.password}
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          shown={showPassword}
          onToggle={() => setShowPassword(!showPassword)}
          showLabel="Show password"
          hideLabel="Hide password"
          placeholder="••••••••"
          autoComplete="current-password"
          disabled={isSubmitting}
          invalid={invalid === 'password'}
          describedBy={invalid === 'password' ? ERROR_ID : undefined}
        />
      </div>

      <label htmlFor="nwli-keep" className="nwli-keep">
        <input
          id="nwli-keep"
          type="checkbox"
          className="nwli-check"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        Keep me signed in
      </label>

      <button type="submit" className="nw-btn nwli-submit" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoginSpinner />
            Signing in...
          </>
        ) : (
          <>
            Log In
            <LoginIcon name="arrowRight" size={16} />
          </>
        )}
      </button>

      <p className="nwli-alt">
        New to Navigate Wealth?{' '}
        <Link to="/signup" className="nwli-link">
          Get started
        </Link>
      </p>
    </form>
  );
}
