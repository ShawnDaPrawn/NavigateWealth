/**
 * ForgotPasswordSent — "Check Your Email", which takes the form's place once
 * the reset link has been requested. The words are the live page's. It names
 * the address the person typed whether or not an account uses it, as the live
 * page does, so the page never reveals which addresses are registered.
 */
import type { RefObject } from 'react';
import { Link } from 'react-router';
import { ForgotPasswordIcon } from './ForgotPasswordIcons';
import '../styles/forgot-password.css';

interface ForgotPasswordSentProps {
  email: string;
  /** Back to the form, to ask for another link. */
  onSendAnother: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

export function ForgotPasswordSent({ email, onSendAnother, headingRef }: ForgotPasswordSentProps) {
  return (
    <div className="nwfp-done nw-in">
      <div className="nwfp-done-mark" aria-hidden="true">
        <span className="nwfp-ripple" />
        <span className="nwfp-done-disc">
          <ForgotPasswordIcon name="mail" size={32} />
        </span>
      </div>
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="nwfp-title">
          Check Your Email
        </h1>
        <p className="nwfp-done-text">
          We&apos;ve sent a password reset link to <strong>{email}</strong>
        </p>
      </div>
      <div className="nwfp-done-box">
        <p className="nwfp-done-hint">
          Didn&apos;t receive the email? Check your spam folder or try again.
        </p>
        <p className="nwfp-done-expiry nw-mono">
          The reset link will expire in 15 minutes for security reasons.
        </p>
      </div>
      <div className="nwfp-done-actions">
        <button type="button" className="nw-outline nwfp-again" onClick={onSendAnother}>
          Send Another Link
        </button>
        <Link to="/login" className="nw-btn nwfp-login">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
