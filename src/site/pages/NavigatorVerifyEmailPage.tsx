/**
 * NavigatorVerifyEmailPage — /verify-email in the Navigator design.
 *
 * A standalone route (no site header or footer). Presentation only: which
 * address the link went to, the already-verified redirect and the resend —
 * the recovery path when the first confirmation mail never left — are
 * useVerifyEmailFlow, the hook the live VerifyEmailPage runs.
 *
 * The board's "Open Gmail / Open Outlook" shortcuts are not carried over:
 * they would add external destinations the live page does not link to.
 */
import { Link } from 'react-router';
import { ArrowLeft, Check, Clock, Mail, RefreshCw } from 'lucide-react';
import { useVerifyEmailFlow } from '../../components/pages/auth/useVerifyEmailFlow';
import { COMPANY } from '../../config/companyFacts';
import { AccountAlert } from '../account/AccountAlert';
import { AccountSolo } from '../account/AccountLayout';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';
import '../styles/account-standalone.css';

const PAGE_CLASS = 'nwx-verify-email';

/** Where this screen sits in signing up: created → verify → application. */
function SetupSteps({ verified }: { verified: boolean }) {
  return (
    <ol className="nwac-steps" aria-label="Account setup progress">
      <li className="nwac-step is-done">
        <span className="nwac-step-n" aria-hidden="true">
          <Check size={12} strokeWidth={2} />
        </span>
        Account created
        <span className="nw-sr-only"> (complete)</span>
      </li>
      <li
        className={verified ? 'nwac-step is-done' : 'nwac-step is-current'}
        aria-current={verified ? undefined : 'step'}
      >
        <span className="nwac-step-n" aria-hidden="true">
          {verified ? <Check size={12} strokeWidth={2} /> : '2'}
        </span>
        Verify email
        {verified ? <span className="nw-sr-only"> (complete)</span> : null}
      </li>
      <li className="nwac-step">
        <span className="nwac-step-n" aria-hidden="true">
          3
        </span>
        Application
      </li>
    </ol>
  );
}

export function NavigatorVerifyEmailPage() {
  const { email, isVerified, success, resendState, resendError, handleResend } =
    useVerifyEmailFlow();
  const verified = isVerified || Boolean(success);

  return (
    <AccountSolo
      pageClass={PAGE_CLASS}
      above={<SetupSteps verified={verified} />}
      below={
        verified ? null : (
          <p className="nwac-expiry nw-mono">
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            The verification link will expire in 24 hours
          </p>
        )
      }
    >
      {verified ? (
        <div className="nwac-centre nw-in">
          <h1 className="nw-sr-only">Email verified</h1>
          <span className="nwac-disc nwac-disc--ok" aria-hidden="true">
            <Check size={32} strokeWidth={1.75} />
          </span>
          <div className="nwac-alert nwac-alert--success nwac-alert--centre" role="status">
            <span className="nwac-spin nwac-spin--sm" aria-hidden="true" />
            <span>{success || 'Email verified successfully! Redirecting to dashboard...'}</span>
          </div>
        </div>
      ) : (
        <div className="nwac-stack">
          <div className="nwac-centre">
            <div className="nwac-ripple nwac-ripple--lg" aria-hidden="true">
              <span className="nwac-ripple-ring" />
              <span className="nwac-ripple-ring nwac-ripple-ring--late" />
              <span className="nwac-ripple-core">
                <Mail size={34} strokeWidth={1.75} />
              </span>
            </div>
            <h1 className="nwac-title">Check Your Email</h1>
            <p className="nwac-copy">We&apos;ve sent a verification link to</p>
            <p className="nwac-email">{email || 'your email address'}</p>
          </div>

          <div className="nwac-box">
            <p>
              Click the verification link in your email to complete your registration.
              <br />
              Don&apos;t forget to check your spam folder if you don&apos;t see it.
            </p>
          </div>

          {resendState === 'sent' ? (
            <AccountAlert tone="success">
              Verification email sent. Check your inbox, and your spam folder.
            </AccountAlert>
          ) : (
            <button
              type="button"
              className="nw-btn"
              onClick={handleResend}
              disabled={resendState === 'sending'}
              aria-busy={resendState === 'sending' || undefined}
            >
              <RefreshCw
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className={resendState === 'sending' ? 'nwac-rotate' : undefined}
              />
              {resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
            </button>
          )}

          {resendError ? <AccountAlert tone="error">{resendError}</AccountAlert> : null}

          <Link to="/login" className="nw-outline">
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            Back to Sign In
          </Link>

          <p className="nwac-alt">
            Need help?{' '}
            <a href={`mailto:${COMPANY.email}`} className="nwac-link">
              Contact support
            </a>
          </p>
        </div>
      )}
    </AccountSolo>
  );
}
