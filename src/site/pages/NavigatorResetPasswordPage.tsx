/**
 * NavigatorResetPasswordPage — /reset-password in the Navigator design.
 *
 * A standalone route (no site header or footer). Presentation only: the link
 * check (PKCE code, implicit-flow tokens or the short session retry), the
 * password rules, the updatePassword call and the redirect afterwards (/admin
 * for invited staff, /login otherwise) are useResetPasswordFlow, the hook the
 * live ResetPasswordPage runs. Three states: verifying the link, link expired,
 * and the new-password form (with its invite-flow wording).
 *
 * The live expired screen also shows Supabase redirect-URL set-up notes. They
 * are instructions for whoever configures the project, not for clients, so
 * this page shows them in development builds only.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Clock } from 'lucide-react';
import {
  useResetPasswordFlow,
  type ResetPasswordFlow,
} from '../../components/pages/auth/useResetPasswordFlow';
import { useIsStandalone } from '../../hooks/useIsStandalone';
import { copyToClipboard } from '../../utils/clipboard';
import { AccountAlert } from '../account/AccountAlert';
import { AccountField, PasswordInput } from '../account/AccountField';
import { AccountSolo } from '../account/AccountLayout';
import { PasswordMatchNote, PasswordStrengthPanel } from '../account/PasswordStrength';
import { describedBy, fieldErrorId, useFocusOnInvalid } from '../account/accountUi';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';
import '../styles/account-standalone.css';

const PAGE_CLASS = 'nwx-reset-password';
const IDS = {
  newPassword: 'nwac-rp-new',
  confirmPassword: 'nwac-rp-confirm',
  requirements: 'nwac-rp-requirements',
  error: 'nwac-rp-error',
} as const;

function Verifying({ invite }: { invite: boolean }) {
  return (
    <>
      <h1 className="nw-sr-only">{invite ? 'Set up your account' : 'Set new password'}</h1>
      <div className="nwac-verifying" role="status" aria-label="Verifying reset link">
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true" focusable="false">
          <circle cx="44" cy="44" r="40" fill="none" stroke="#EFEBE3" strokeWidth="1.5" />
          <circle
            cx="44"
            cy="44"
            r="40"
            fill="none"
            stroke="#D3CCBF"
            strokeWidth="6"
            strokeDasharray="1 9.47"
          />
          <g className="nwac-sweep">
            <path d="M44 44 L44 6 A38 38 0 0 1 71 17 Z" fill="#0D1626" fillOpacity="0.18" />
            <line x1="44" y1="44" x2="44" y2="8" stroke="#0D1626" strokeWidth="1.5" />
          </g>
          <circle cx="44" cy="44" r="4" fill="#0D1626" />
        </svg>
        <p>Verifying reset link...</p>
      </div>
    </>
  );
}

/** Supabase redirect-URL set-up notes — for developers, never shown to clients. */
function RedirectUrlSetupNotes() {
  const urls = [`${window.location.origin}/reset-password`, `${window.location.origin}/**`];
  return (
    <AccountAlert tone="warn">
      <p className="nwac-dev-h">⚠️ Most Common Issue: URLs Not Whitelisted</p>
      <p className="nwac-dev-p">Go to Supabase Dashboard and add these URLs:</p>
      <div className="nwac-dev-codes">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            className="nwac-dev-code"
            onClick={() => void copyToClipboard(url)}
            title="Click to copy"
          >
            {url}
          </button>
        ))}
      </div>
      <p className="nwac-dev-p">
        <strong>Location:</strong> Authentication → URL Configuration → Redirect URLs
      </p>
      <p className="nwac-dev-p nwac-dev-warn">
        ⚠️ After adding URLs, you MUST request a NEW password reset email!
      </p>
    </AccountAlert>
  );
}

function Expired() {
  return (
    <div className="nwac-stack nw-in">
      <div className="nwac-centre">
        <span className="nwac-disc nwac-disc--warn" aria-hidden="true">
          <Clock size={28} strokeWidth={1.75} />
        </span>
        <h1 className="nwac-title">Reset Link Expired</h1>
        <p className="nwac-copy">This password reset link has expired or has already been used.</p>
      </div>

      <div className="nwac-alert nwac-alert--warn">
        <AlertTriangle size={17} strokeWidth={1.75} aria-hidden="true" />
        <div className="nwac-alert-body">
          <p className="nwac-strong">
            Password reset links expire after 24 hours for security reasons.
          </p>
          <p>Each link can only be used once and becomes invalid after:</p>
          <ul className="nwac-bullets">
            <li>24 hours from when it was sent</li>
            <li>Being used to reset your password</li>
            <li>A new reset link is requested</li>
          </ul>
        </div>
      </div>

      {import.meta.env.DEV ? <RedirectUrlSetupNotes /> : null}

      <div className="nwac-actions">
        <Link to="/forgot-password" className="nw-btn">
          Request New Reset Link
        </Link>
        <Link to="/login" className="nw-outline">
          Back to Sign In
        </Link>
      </div>

      <p className="nwac-alt">
        Need help?{' '}
        <Link to="/contact" className="nwac-link">
          Contact support
        </Link>
      </p>
    </div>
  );
}

function NewPasswordForm({ flow }: { flow: ResetPasswordFlow }) {
  const [attempt, setAttempt] = useState(0);
  useFocusOnInvalid(attempt, flow.errorField ? IDS[flow.errorField] : null);

  const onSubmit = (e: FormEvent) => {
    setAttempt((n) => n + 1);
    void flow.handleSubmit(e);
  };

  const invite = flow.isInviteFlow;
  const newError = flow.errorField === 'newPassword' ? flow.error : null;
  const confirmError = flow.errorField === 'confirmPassword' ? flow.error : null;
  const formError = flow.error && !flow.errorField ? flow.error : '';

  return (
    <div className="nwac-stack">
      <div className="nwac-head">
        <p className="nwac-kicker">{invite ? 'Welcome aboard' : 'Account recovery'}</p>
        <h1 className="nwac-title">{invite ? 'Set up your account' : 'Set new password'}</h1>
        <p className="nwac-sub">
          {invite
            ? 'Welcome to Navigate Wealth. Create a secure password to get started.'
            : 'Choose a strong password for your account'}
        </p>
      </div>

      {flow.success ? (
        <AccountAlert tone="success">
          {invite
            ? 'Account set up successfully! Redirecting to the admin panel...'
            : 'Password reset successfully! Redirecting to sign in...'}
        </AccountAlert>
      ) : null}

      {formError ? (
        <AccountAlert tone="error" id={IDS.error}>
          {formError}
        </AccountAlert>
      ) : null}

      <form
        className="nwac-fields"
        onSubmit={onSubmit}
        noValidate
        aria-label={invite ? 'Set up your account' : 'Set new password'}
        aria-describedby={formError ? IDS.error : undefined}
      >
        <AccountField
          htmlFor={IDS.newPassword}
          label="New Password"
          error={newError}
          after={
            <PasswordStrengthPanel
              strength={flow.passwordStrength}
              showMeter={flow.newPassword.length > 0}
              variant="reset"
              requirementsId={IDS.requirements}
            />
          }
        >
          <PasswordInput
            id={IDS.newPassword}
            name="newPassword"
            autoComplete="new-password"
            required
            value={flow.newPassword}
            onChange={(e) => flow.setNewPassword(e.target.value)}
            placeholder="Enter your new password"
            shown={flow.showNewPassword}
            onToggle={flow.toggleShowNewPassword}
            aria-invalid={newError ? true : undefined}
            aria-describedby={describedBy(
              newError && fieldErrorId(IDS.newPassword),
              IDS.requirements,
            )}
          />
        </AccountField>

        <AccountField
          htmlFor={IDS.confirmPassword}
          label="Confirm New Password"
          error={confirmError}
          after={
            <PasswordMatchNote
              visible={flow.confirmPassword.length > 0}
              matches={flow.passwordsMatch}
            />
          }
        >
          <PasswordInput
            id={IDS.confirmPassword}
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={flow.confirmPassword}
            onChange={(e) => flow.setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            shown={flow.showConfirmPassword}
            onToggle={flow.toggleShowConfirmPassword}
            toggleLabels={['Show password confirmation', 'Hide password confirmation']}
            aria-invalid={confirmError ? true : undefined}
            aria-describedby={confirmError ? fieldErrorId(IDS.confirmPassword) : undefined}
          />
        </AccountField>

        <button
          type="submit"
          className="nw-btn nwac-submit"
          disabled={!flow.canSubmit}
          aria-busy={flow.isLoading || undefined}
        >
          {flow.isLoading ? <span className="nwac-spin" aria-hidden="true" /> : null}
          {flow.isLoading
            ? invite
              ? 'Setting up account...'
              : 'Resetting password...'
            : invite
              ? 'Create Account'
              : 'Reset password'}
        </button>
      </form>

      <p className="nwac-alt">
        <Link to="/login" className="nwac-link">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function NavigatorResetPasswordPage() {
  const isStandalone = useIsStandalone();
  const flow = useResetPasswordFlow();

  let body;
  if (flow.isVerifying) body = <Verifying invite={flow.isInviteFlow} />;
  else if (flow.isExpired) body = <Expired />;
  else body = <NewPasswordForm flow={flow} />;

  return (
    <AccountSolo pageClass={PAGE_CLASS} showAppIcon={isStandalone}>
      {body}
    </AccountSolo>
  );
}
