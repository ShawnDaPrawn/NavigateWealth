/**
 * ResetPasswordForm — "Set new password" (or "Set up your account" for an
 * invited colleague): the two password fields, the strength meter and the
 * rules, in the board's layout. It only draws; the page owns the link check,
 * the rules and the update (NavigatorResetPasswordPage), which are the live
 * page's own.
 *
 * The meter reads the live validator: its label is getPasswordStrengthLabel's
 * ("Very Weak" to "Very Strong"), its four bars fill one per point of the
 * score, as the live bar fills a quarter per point, and each rule ticks on the
 * live page's condition. Before anything is typed it reads "Not set", as the
 * board draws it (the live page hides the meter until then). The board's
 * colours stand in for the live page's: red for 0–1, amber for 2, green for
 * 3–4 (3 and up is only reachable by a valid password).
 */
import { useId, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  getPasswordStrengthLabel,
  type PasswordStrength,
} from '../../utils/auth/passwordValidation';
import { ResetPasswordIcon, ResetPasswordRing } from './ResetPasswordIcons';
import '../styles/reset-password.css';

type Tone = 'danger' | 'warn' | 'success';

function toneFor(score: number): Tone {
  if (score <= 1) return 'danger';
  if (score === 2) return 'warn';
  return 'success';
}

interface PasswordFieldProps {
  id: string;
  /** The live page's field names, so password managers see the same form. */
  name: 'newPassword' | 'confirmPassword';
  label: string;
  value: string;
  onChange: (value: string) => void;
  shown: boolean;
  onToggle: () => void;
  placeholder: string;
  describedBy?: string;
  invalid?: boolean;
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  shown,
  onToggle,
  placeholder,
  describedBy,
  invalid,
}: PasswordFieldProps) {
  return (
    <>
      <label className="nwrp-label" htmlFor={id}>
        {label}
      </label>
      <div className="nwrp-control">
        <input
          id={id}
          name={name}
          className="nwrp-input"
          type={shown ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
        />
        <button
          type="button"
          className="nwrp-toggle"
          onClick={onToggle}
          aria-label={shown ? 'Hide password' : 'Show password'}
        >
          <ResetPasswordIcon name="eye" size={17} />
        </button>
      </div>
    </>
  );
}

interface ResetPasswordFormProps {
  /** An invited colleague setting a first password, not a reset. */
  invite: boolean;
  success: boolean;
  error: string;
  newPassword: string;
  onNewPassword: (value: string) => void;
  confirmPassword: string;
  onConfirmPassword: (value: string) => void;
  showNew: boolean;
  onToggleNew: () => void;
  showConfirm: boolean;
  onToggleConfirm: () => void;
  strength: PasswordStrength;
  passwordsMatch: boolean;
  loading: boolean;
  submitDisabled: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function ResetPasswordForm({
  invite,
  success,
  error,
  newPassword,
  onNewPassword,
  confirmPassword,
  onConfirmPassword,
  showNew,
  onToggleNew,
  showConfirm,
  onToggleConfirm,
  strength,
  passwordsMatch,
  loading,
  submitDisabled,
  onSubmit,
}: ResetPasswordFormProps) {
  const base = useId();
  const titleId = `${base}-title`;
  const newId = `${base}-new`;
  const confirmId = `${base}-confirm`;
  const rulesId = `${base}-rules`;
  const matchId = `${base}-match`;

  const typed = newPassword.length > 0;
  const tone = toneFor(strength.score);
  const rules = [
    { text: 'At least 12 characters', ok: strength.requirements.minLength },
    {
      text: 'At least 3 of: uppercase, lowercase, numbers, special characters',
      ok: strength.requirements.characterTypes >= 3,
    },
    {
      text: 'Not a common or predictable password',
      ok: strength.requirements.notCommon && strength.requirements.notPredictable,
    },
  ];

  return (
    <form className="nwrp-stack" onSubmit={onSubmit} aria-labelledby={titleId}>
      <div>
        <span className="nwrp-kicker">
          <span className="nwrp-kicker-rule" aria-hidden="true" />
          {invite ? 'Welcome aboard' : 'Account recovery'}
        </span>
        <h1 id={titleId} className="nwrp-title nwrp-form-title">
          {invite ? 'Set up your account' : 'Set new password'}
        </h1>
        <p className="nwrp-subtitle">
          {invite
            ? 'Welcome to Navigate Wealth. Create a secure password to get started.'
            : 'Choose a strong password for your account'}
        </p>
      </div>

      {success ? (
        <div className="nwrp-success nw-in" role="status">
          <ResetPasswordIcon name="checkCircle" size={18} />
          <span>
            {invite
              ? 'Account set up successfully! Redirecting to the admin panel...'
              : 'Password reset successfully! Redirecting to sign in...'}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="nwrp-error" role="alert">
          <ResetPasswordIcon name="alert" size={17} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="nwrp-field">
        <PasswordField
          id={newId}
          name="newPassword"
          label="New Password"
          value={newPassword}
          onChange={onNewPassword}
          shown={showNew}
          onToggle={onToggleNew}
          placeholder="Enter your new password"
          describedBy={rulesId}
        />
        <div className="nwrp-meter">
          <div className="nwrp-meter-row">
            <span className="nwrp-meter-label">Password Strength:</span>
            <span className="nwrp-meter-value nw-mono" data-tone={typed ? tone : undefined}>
              {typed ? getPasswordStrengthLabel(strength.score) : 'Not set'}
            </span>
          </div>
          <div className="nwrp-meter-bars" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => (
              <span
                key={n}
                className="nwrp-meter-bar"
                data-tone={typed && n < strength.score ? tone : undefined}
              />
            ))}
          </div>
          <p className="nwrp-rules-lead">Password must have:</p>
          <ul id={rulesId} className="nwrp-rules">
            {rules.map((rule) => (
              <li key={rule.text} className="nwrp-rule" data-ok={rule.ok ? 'true' : 'false'}>
                {rule.ok ? (
                  <ResetPasswordIcon name="checkCircle" size={14} stroke="#15803D" />
                ) : (
                  <ResetPasswordRing />
                )}
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="nwrp-field">
        <PasswordField
          id={confirmId}
          name="confirmPassword"
          label="Confirm New Password"
          value={confirmPassword}
          onChange={onConfirmPassword}
          shown={showConfirm}
          onToggle={onToggleConfirm}
          placeholder="Re-enter your new password"
          describedBy={confirmPassword.length > 0 ? matchId : undefined}
          invalid={confirmPassword.length > 0 && !passwordsMatch}
        />
        {confirmPassword.length > 0 ? (
          <span id={matchId} className="nwrp-match" data-match={passwordsMatch ? 'true' : 'false'}>
            {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
          </span>
        ) : null}
      </div>

      <button
        type="submit"
        className="nw-btn nwrp-submit"
        disabled={submitDisabled}
        aria-busy={loading ? true : undefined}
      >
        {loading ? <span className="nwrp-spin" aria-hidden="true" /> : null}
        {loading
          ? invite
            ? 'Setting up account...'
            : 'Resetting password...'
          : invite
            ? 'Create Account'
            : 'Reset password'}
      </button>

      <p className="nwrp-back">
        <Link to="/login" className="nwrp-link">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
