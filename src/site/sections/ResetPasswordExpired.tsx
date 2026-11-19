/**
 * ResetPasswordExpired — the card when the reset link cannot be used: expired,
 * already used, or refused by the auth server. The live page's words and its
 * three ways onward, as links.
 *
 * The live page also shows, in this state, a yellow box addressed to whoever
 * runs the Supabase project ("Most Common Issue: URLs Not Whitelisted", with
 * redirect URLs to copy). The board leaves it out, and so does this: it is
 * set-up advice for the operator, not something a client can act on.
 */
import { Link } from 'react-router';
import { ResetPasswordIcon } from './ResetPasswordIcons';
import '../styles/reset-password.css';

export function ResetPasswordExpired() {
  return (
    <div className="nwrp-stack nw-in">
      <div className="nwrp-expired-head">
        <span className="nwrp-expired-icon" aria-hidden="true">
          <ResetPasswordIcon name="clock" size={28} />
        </span>
        <h1 className="nwrp-title nwrp-expired-title">Reset Link Expired</h1>
        <p className="nwrp-expired-text">
          This password reset link has expired or has already been used.
        </p>
      </div>
      <div className="nwrp-warn">
        <p className="nwrp-warn-lead">
          Password reset links expire after 24 hours for security reasons.
        </p>
        <p className="nwrp-warn-text">Each link can only be used once and becomes invalid after:</p>
        <ul className="nwrp-warn-list">
          <li>24 hours from when it was sent</li>
          <li>Being used to reset your password</li>
          <li>A new reset link is requested</li>
        </ul>
      </div>
      <div className="nwrp-actions">
        <Link to="/forgot-password" className="nw-btn nwrp-action">
          Request New Reset Link
        </Link>
        <Link to="/login" className="nw-outline nwrp-action">
          Back to Sign In
        </Link>
      </div>
      <p className="nwrp-help">
        Need help?{' '}
        <Link to="/contact" className="nwrp-link">
          Contact support
        </Link>
      </p>
    </div>
  );
}
