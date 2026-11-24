/**
 * SignupForm — "Create your account", the form on the "Signup" board.
 *
 * Every value and handler comes from useSignupForm, the hook the legacy page
 * runs too, so submitting here checks the same fields in the same order,
 * sends the same POST to /auth-signup/signup and hands off to /verify-email
 * exactly as the live page does, with its messages word for word. The submit
 * button waits, as it does there, until every field is filled and the
 * password passes and matches.
 *
 * What this adds is presentation: the board's fields, the live page's alerts
 * in the design system's style, and, when a live check refuses a field, that
 * field marked invalid and focused. The Terms of Service and Privacy Policy
 * are real links to their pages; a plain click opens them over the form in
 * the live page's document viewer instead, so nothing typed is lost.
 */
import { useEffect, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import type { useSignupForm } from '../../components/pages/auth/useSignupForm';
import { LoginAlert, LoginPasswordInput, LoginSpinner } from './LoginFields';
import { LoginIcon } from './LoginIcons';
import { SignupCountryCode } from './SignupCountryCode';
import { SignupStrength } from './SignupStrength';
import '../styles/login.css';
import '../styles/signup.css';

type SignupFormState = ReturnType<typeof useSignupForm>;
type Field = 'firstName' | 'surname' | 'email' | 'cellphone' | 'password' | 'confirmPassword';

const FIELD_IDS: Record<Field, string> = {
  firstName: 'nwsu-first',
  surname: 'nwsu-surname',
  email: 'nwsu-email',
  cellphone: 'nwsu-cell',
  password: 'nwsu-password',
  confirmPassword: 'nwsu-confirm',
};

/** The live page's pre-submit checks, and the field each one is about. */
const SIGNUP_FIELD_ERRORS: Record<string, Field> = {
  'Please enter your first name': 'firstName',
  'Please enter your surname': 'surname',
  'Please enter your cellphone number': 'cellphone',
  'Please enter a valid email address': 'email',
  'Password does not meet security requirements. Please check the requirements below.': 'password',
  'Passwords do not match': 'confirmPassword',
};

const ERROR_ID = 'nwsu-error';
const HINTS_ID = 'nwsu-password-requirements';
const MATCH_ID = 'nwsu-password-match';

/** The two legal documents the consent line names, by their /legal/ slug. */
const LEGAL_LINKS = [
  { slug: 'terms-of-use', label: 'Terms of Service' },
  { slug: 'privacy-notice', label: 'Privacy Policy' },
] as const;

interface SignupFormProps {
  form: SignupFormState;
  /** The live page's legal-document viewer. */
  openDocument: (slug: string) => void;
  loadingSlug: string | null;
  /** The installed app has a Log in / Sign up switch above the card instead. */
  showSwitchLink?: boolean;
}

export function SignupForm({
  form,
  openDocument,
  loadingSlug,
  showSwitchLink = true,
}: SignupFormProps) {
  const {
    firstName,
    setFirstName,
    surname,
    setSurname,
    email,
    setEmail,
    countryCode,
    setCountryCode,
    cellphone,
    setCellphone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    isLoading,
    error,
    setError,
    success,
    showLocalhostWarning,
    setPasswordFocused,
    passwordStrength,
    passwordsMatch,
    handleSubmit,
    showPasswordHints,
    submitDisabled,
  } = form;
  // Counts submits, so a repeated refusal moves focus back to its field even
  // when the message has not changed.
  const [attempt, setAttempt] = useState(0);
  const invalid: Field | undefined = SIGNUP_FIELD_ERRORS[error];

  useEffect(() => {
    if (invalid) document.getElementById(FIELD_IDS[invalid])?.focus();
  }, [invalid, error, attempt]);

  const fieldProps = (field: Field) => ({
    id: FIELD_IDS[field],
    disabled: isLoading,
    'aria-invalid': invalid === field || undefined,
    'aria-describedby': invalid === field ? ERROR_ID : undefined,
  });

  const openLegal = (event: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // A new-tab or new-window click goes to the page itself.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    if (loadingSlug === slug) return;
    void openDocument(slug);
  };

  const describedBy = (...ids: Array<string | false | undefined>) =>
    ids.filter(Boolean).join(' ') || undefined;

  return (
    <form
      className="nwli-form nwsu-form"
      onSubmit={(event) => {
        setAttempt((n) => n + 1);
        void handleSubmit(event);
      }}
      aria-describedby={error ? ERROR_ID : undefined}
    >
      <div className="nwli-head">
        <h1 className="nwli-title">Create your account</h1>
        <p className="nwli-sub">Enter your details to start your wealth journey.</p>
        <div className="nwli-status" aria-live="polite">
          {showLocalhostWarning && (
            <LoginAlert tone="warn">
              <strong>Development Mode Detected</strong>
              <br />
              You&apos;re testing on localhost. Verification emails may redirect to localhost.
              <br />
              <strong>For production:</strong> Ensure Supabase Site URL is set to your production
              domain.
            </LoginAlert>
          )}
          {success && <LoginAlert tone="success">{success}</LoginAlert>}
        </div>
        {error && (
          <LoginAlert
            tone="danger"
            id={ERROR_ID}
            onClose={() => setError('')}
            closeLabel="Close error message"
          >
            {error}
          </LoginAlert>
        )}
      </div>

      <fieldset className="nwsu-fieldset">
        <legend className="nw-mono nwsu-legend">Personal Details</legend>
        <div className="nwsu-names">
          <div className="nwli-field">
            <label htmlFor={FIELD_IDS.firstName} className="nwli-label">
              First Name
            </label>
            <input
              {...fieldProps('firstName')}
              name="firstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              className="nwli-input nwli-input--compact"
            />
          </div>
          <div className="nwli-field">
            <label htmlFor={FIELD_IDS.surname} className="nwli-label">
              Surname
            </label>
            <input
              {...fieldProps('surname')}
              name="surname"
              type="text"
              required
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Doe"
              className="nwli-input nwli-input--compact"
            />
          </div>
        </div>

        <div className="nwli-field">
          <label htmlFor={FIELD_IDS.email} className="nwli-label">
            Email Address
          </label>
          <input
            {...fieldProps('email')}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="nwli-input nwli-input--compact"
          />
        </div>

        <div className="nwli-field">
          <label htmlFor={FIELD_IDS.cellphone} className="nwli-label">
            Cellphone Number
          </label>
          <div className="nwsu-phone">
            <SignupCountryCode value={countryCode} onChange={setCountryCode} disabled={isLoading} />
            <input
              {...fieldProps('cellphone')}
              name="cellphone"
              type="tel"
              required
              value={cellphone}
              onChange={(e) => setCellphone(e.target.value)}
              placeholder="82 123 4567"
              className="nwli-input nwli-input--compact nwsu-tel"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="nwsu-fieldset">
        <legend className="nw-mono nwsu-legend">Create Password</legend>
        <div className="nwli-field">
          <label htmlFor={FIELD_IDS.password} className="nwli-label">
            Password
          </label>
          <LoginPasswordInput
            id={FIELD_IDS.password}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            shown={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
            showLabel="Show password"
            hideLabel="Hide password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            disabled={isLoading}
            invalid={invalid === 'password'}
            describedBy={describedBy(
              showPasswordHints && HINTS_ID,
              invalid === 'password' && ERROR_ID,
            )}
            compact
          />
          {showPasswordHints && (
            <SignupStrength id={HINTS_ID} password={password} strength={passwordStrength} />
          )}
        </div>

        <div className="nwli-field">
          <label htmlFor={FIELD_IDS.confirmPassword} className="nwli-label">
            Confirm Password
          </label>
          <LoginPasswordInput
            id={FIELD_IDS.confirmPassword}
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            shown={showConfirmPassword}
            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            showLabel="Show password confirmation"
            hideLabel="Hide password confirmation"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            disabled={isLoading}
            invalid={invalid === 'confirmPassword'}
            describedBy={describedBy(
              confirmPassword.length > 0 && MATCH_ID,
              invalid === 'confirmPassword' && ERROR_ID,
            )}
            compact
          />
          {confirmPassword.length > 0 && (
            <span id={MATCH_ID} className="nwsu-match" data-ok={passwordsMatch}>
              {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
            </span>
          )}
        </div>
      </fieldset>

      <p className="nwsu-terms">
        By creating an account, you agree to Navigate Wealth&apos;s{' '}
        {LEGAL_LINKS.map(({ slug, label }, i) => (
          <span key={slug}>
            {i > 0 && ' and '}
            <a
              href={`/legal/${slug}`}
              className="nwli-link"
              onClick={(event) => openLegal(event, slug)}
              aria-disabled={loadingSlug === slug || undefined}
            >
              {loadingSlug === slug ? 'Loading...' : label}
            </a>
          </span>
        ))}
        . Your data is protected under POPIA.
      </p>

      <button type="submit" className="nw-btn nwli-submit" disabled={submitDisabled}>
        {isLoading ? (
          <>
            <LoginSpinner />
            Creating account...
          </>
        ) : (
          <>
            Create account
            <LoginIcon name="arrowRight" size={16} />
          </>
        )}
      </button>

      {showSwitchLink && (
        <p className="nwli-alt">
          Already have an account?{' '}
          <Link to="/login" className="nwli-link">
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
