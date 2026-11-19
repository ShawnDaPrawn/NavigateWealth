/**
 * The account-setup progress above the verify-email card, as the
 * "VerifyEmail" board draws it: the account is created, the email is the step
 * in hand, the application comes next. Once the address is confirmed the
 * middle step turns green; it keeps its number, as the board shows.
 */
import { VerifyEmailIcon } from './VerifyEmailIcons';

interface VerifyEmailProgressProps {
  /** The address is confirmed: the board's "Verified" state. */
  verified: boolean;
}

export function VerifyEmailProgress({ verified }: VerifyEmailProgressProps) {
  return (
    <ol className="nwve-steps" aria-label="Account setup progress">
      <li className="nwve-step nwve-step--done">
        <span className="nwve-step-mark">
          <VerifyEmailIcon name="check" size={12} />
        </span>
        Account created
      </li>
      <li className="nwve-step-rule" aria-hidden="true" />
      <li
        className={`nwve-step ${verified ? 'nwve-step--verified' : 'nwve-step--current'}`}
        aria-current={verified ? undefined : 'step'}
      >
        <span className="nwve-step-mark nwve-step-num" aria-hidden="true">
          2
        </span>
        Verify email
      </li>
      <li className="nwve-step-rule" aria-hidden="true" />
      <li className="nwve-step">
        <span className="nwve-step-mark nwve-step-num" aria-hidden="true">
          3
        </span>
        Application
      </li>
    </ol>
  );
}
