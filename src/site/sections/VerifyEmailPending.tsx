/**
 * The verify-email card while the person still has to click the link: the
 * board's "Check email", "Resending", "Resent" and "Resend error" states.
 *
 * Presentation only. The page owns the address, the resend state and the
 * error text, and hands in the same resend handler the live page runs; this
 * section draws them as the board does. The words are the live page's
 * (VerifyEmailPage.tsx), which the board repeats.
 *
 * Two things the board does not draw, both for keyboard and screen-reader
 * users: the button is disabled while a send is in flight, as on the live
 * page (it keeps the board's violet look), and once the send is confirmed the
 * focus moves to the confirmation that replaced the button, instead of
 * falling back to the top of the document.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { VerifyEmailIcon } from './VerifyEmailIcons';

export type ResendState = 'idle' | 'sending' | 'sent';

interface VerifyEmailPendingProps {
  /** The address the link went to, or '' when the page does not know it. */
  email: string;
  resendState: ResendState;
  resendError: string;
  onResend: () => void;
  /** Where "Back to Sign In" goes. */
  signInHref: string;
  /** The mailbox behind "Contact support". */
  supportEmail: string;
}

/** The two webmail inboxes the board offers a shortcut to. */
const INBOXES = [
  { label: 'Open Gmail', href: 'https://mail.google.com' },
  { label: 'Open Outlook', href: 'https://outlook.live.com' },
];

export function VerifyEmailPending({
  email,
  resendState,
  resendError,
  onResend,
  signInHref,
  supportEmail,
}: VerifyEmailPendingProps) {
  const sentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resendState === 'sent') sentRef.current?.focus();
  }, [resendState]);

  const sending = resendState === 'sending';

  return (
    <div className="nwve-pending">
      <div className="nwve-head">
        <div className="nwve-ring">
          <span className="nwve-ripple" aria-hidden="true" />
          <span className="nwve-ripple nwve-ripple--late" aria-hidden="true" />
          <span className="nwve-ring-core">
            <VerifyEmailIcon name="mail" size={34} />
          </span>
        </div>
        <h1 className="nwve-title">Check Your Email</h1>
        <p className="nwve-lead">We&apos;ve sent a verification link to</p>
        <p className="nwve-address">{email || 'your email address'}</p>
      </div>

      <div className="nwve-note">
        Click the verification link in your email to complete your registration.
        <br />
        Don&apos;t forget to check your spam folder if you don&apos;t see it.
      </div>

      <div className="nwve-inboxes">
        {INBOXES.map((inbox) => (
          <a key={inbox.href} className="nwve-chip" href={inbox.href}>
            <VerifyEmailIcon name="external" size={15} />
            {inbox.label}
          </a>
        ))}
      </div>

      {resendState === 'sent' ? (
        <div className="nwve-sent nw-in" role="status" tabIndex={-1} ref={sentRef}>
          <VerifyEmailIcon name="checkCircle" size={17} className="nwve-msg-icon" />
          <span>Verification email sent. Check your inbox, and your spam folder.</span>
        </div>
      ) : (
        <button type="button" className="nw-btn nwve-resend" onClick={onResend} disabled={sending}>
          <VerifyEmailIcon name="refresh" size={16} className={sending ? 'nwve-spin' : undefined} />
          {sending ? 'Sending…' : 'Resend verification email'}
        </button>
      )}

      {resendError && (
        <div className="nwve-error" role="alert">
          <VerifyEmailIcon name="alert" size={17} className="nwve-msg-icon" />
          <span>{resendError}</span>
        </div>
      )}

      <Link className="nw-outline nwve-back" to={signInHref}>
        <VerifyEmailIcon name="arrowLeft" size={16} />
        Back to Sign In
      </Link>

      <p className="nwve-help">
        Need help?{' '}
        <a className="nwve-link" href={`mailto:${supportEmail}`}>
          Contact support
        </a>
      </p>
    </div>
  );
}
