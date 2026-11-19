/**
 * The verification-success card, as the "VerificationSuccess" board draws it:
 * the badge, the headline, the way on, the countdown with its progress bar,
 * the help links and the security note.
 *
 * Presentation only. The page owns where "Continue" goes, its label and the
 * countdown, all worked out exactly as the live page (VerificationSuccessPage
 * .tsx) works them out; this section draws them. The words are the live
 * page's, which the board repeats; the bar and the "Redirecting..." line for
 * the last moment are the board's.
 */
import { Link } from 'react-router';
import { VerificationSuccessBadge, VerificationSuccessIcon } from './VerificationSuccessIcons';

interface VerificationSuccessCardProps {
  /** Where "Continue" goes: the same path the countdown sends the person to. */
  ctaHref: string;
  ctaText: string;
  /** Seconds left before the automatic redirect. */
  countdown: number;
  /** The seconds the countdown started from, for the progress bar. */
  countdownFrom: number;
  contactHref: string;
}

export function VerificationSuccessCard({
  ctaHref,
  ctaText,
  countdown,
  countdownFrom,
  contactHref,
}: VerificationSuccessCardProps) {
  const progress = Math.round(((countdownFrom - countdown) / countdownFrom) * 100);
  const countdownText =
    countdown > 0
      ? `Redirecting automatically in ${countdown} second${countdown !== 1 ? 's' : ''}...`
      : 'Redirecting...';

  return (
    <div className="nwvs-card">
      <div className="nwvs-card-bar" aria-hidden="true" />
      <div className="nwvs-card-body">
        <div className="nwvs-badge nwvs-pop">
          <VerificationSuccessBadge />
        </div>
        <h1 className="nwvs-title">Email Verified Successfully!</h1>
        <p className="nwvs-lead">
          Your email has been successfully verified. You can now log in to access your Navigate
          Wealth account.
        </p>

        <div className="nwvs-rule" aria-hidden="true" />

        <Link className="nw-btn nwvs-cta" to={ctaHref}>
          {ctaText} <VerificationSuccessIcon name="arrowRight" size={16} />
        </Link>

        <div className="nwvs-countdown" aria-live="polite">
          <div className="nwvs-track" aria-hidden="true">
            <div className="nwvs-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="nwvs-count">{countdownText}</p>
        </div>

        <div className="nwvs-help">
          <span className="nwvs-help-label">Need help getting started?</span>
          <Link className="nwvs-link" to={contactHref}>
            Contact Us
          </Link>
          <span className="nwvs-dot" aria-hidden="true">
            •
          </span>
          <Link className="nwvs-link" to={contactHref}>
            Contact Support
          </Link>
        </div>

        <div className="nwvs-note">
          <VerificationSuccessIcon
            name="lock"
            size={16}
            stroke="#0D1626"
            className="nwvs-note-icon"
          />
          <span>
            Your account is now active and secured. For your security, please use a strong password
            and enable two-factor authentication in your account settings.
          </span>
        </div>
      </div>
    </div>
  );
}
