/**
 * NavigatorVerificationSuccessPage — /verification-success in the Navigator
 * design.
 *
 * A standalone route (no site header or footer). Presentation only: the
 * destination (login, or for a signed-in person the application or the
 * dashboard) and the five-second automatic redirect are
 * useVerificationRedirect, the hook the live VerificationSuccessPage runs.
 */
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import {
  VERIFICATION_REDIRECT_SECONDS,
  useVerificationRedirect,
} from '../../components/pages/auth/useVerificationRedirect';
import { AccountSolo } from '../account/AccountLayout';
import '../styles/navigator.css';
import '../styles/sections.css';
import '../styles/account.css';
import '../styles/account-standalone.css';

const PAGE_CLASS = 'nwx-verification-success';

/** A tick drawn inside a dotted ring. */
function SuccessMark() {
  return (
    <div className="nwac-pop" aria-hidden="true">
      <svg width="84" height="84" viewBox="0 0 84 84" focusable="false">
        <circle cx="42" cy="42" r="40" fill="#F0FDF4" stroke="#BBF7D0" />
        <circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke="#4ADE80"
          strokeWidth="5"
          strokeDasharray="1 8.97"
        />
        <path
          className="nwac-draw"
          d="M30 43 l8 8 l16 -18"
          fill="none"
          stroke="#15803D"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function NavigatorVerificationSuccessPage() {
  const { countdown, ctaPath, ctaText } = useVerificationRedirect();
  const elapsed =
    ((VERIFICATION_REDIRECT_SECONDS - countdown) / VERIFICATION_REDIRECT_SECONDS) * 100;

  return (
    <AccountSolo
      pageClass={PAGE_CLASS}
      rule="success"
      below={
        <Link to="/" className="nwac-quiet">
          <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" />
          Back to Home
        </Link>
      }
    >
      <div className="nwac-centre">
        <SuccessMark />
        <h1 className="nwac-title">Email Verified Successfully!</h1>
        <p className="nwac-copy">
          Your email has been successfully verified. You can now log in to access your Navigate
          Wealth account.
        </p>

        <div className="nwac-divider" aria-hidden="true" />

        <Link to={ctaPath} className="nw-btn nw-btn--lg nwac-cta">
          {ctaText}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>

        <div className="nwac-countdown">
          <div className="nwac-countdown-bar" aria-hidden="true">
            <span style={{ width: `${elapsed}%` }} />
          </div>
          <p aria-live="polite">
            Redirecting automatically in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </div>

        <div className="nwac-help">
          <p>Need help getting started?</p>
          <p className="nwac-help-links">
            <Link to="/contact" className="nwac-link">
              Contact Us
            </Link>
            <span className="nwac-dot" aria-hidden="true">
              •
            </span>
            <Link to="/contact" className="nwac-link">
              Contact Support
            </Link>
          </p>
        </div>

        <p className="nwac-note nwac-note--left">
          <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>
            Your account is now active and secured. For your security, please use a strong password
            and enable two-factor authentication in your account settings.
          </span>
        </p>
      </div>
    </AccountSolo>
  );
}
