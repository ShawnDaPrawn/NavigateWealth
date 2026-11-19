/**
 * The verify-email card once the address is confirmed: the board's "Verified"
 * state, a green tick over a status line with a small spinner while the page
 * moves on. The wording is the live page's (VerifyEmailPage.tsx), passed in.
 *
 * The board draws no heading in this state. The page still needs its one H1,
 * so a visually hidden one carries the board's own name for this step.
 */
import { VerifyEmailIcon } from './VerifyEmailIcons';

interface VerifyEmailVerifiedProps {
  message: string;
}

export function VerifyEmailVerified({ message }: VerifyEmailVerifiedProps) {
  return (
    <div className="nwve-done nw-in">
      <h1 className="nw-sr-only">Verify email</h1>
      <span className="nwve-done-badge">
        <VerifyEmailIcon name="checkCircle" size={32} />
      </span>
      <div className="nwve-done-status" role="status">
        <span className="nwve-spinner nwve-spin" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}
