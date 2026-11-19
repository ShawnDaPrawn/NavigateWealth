/**
 * SignupStrength — the password-strength panel under the password field on
 * the "Signup" board: a label, four bars and the three rules.
 *
 * The board scores passwords with a rule set of its own; this panel shows the
 * live page's instead. The score, its words ("Weak", "Fair", "Strong", "Very
 * Strong") and whether each rule is met all come from validatePassword, the
 * function the sign-up form already gates on and the server agrees with, so
 * the panel can never call a password good that the endpoint will refuse.
 * The board's colours are kept: red, amber, then green from "Strong" up. An
 * empty field reads "Not set" with nothing met, as the board draws it.
 */
import {
  getPasswordStrengthLabel,
  type PasswordStrength,
} from '../../utils/auth/passwordValidation';
import { LoginIcon, LoginRingIcon } from './LoginIcons';
import '../styles/signup.css';

/** The board's tone for each score validatePassword gives (0–4). */
const TONES = ['weak', 'weak', 'fair', 'good', 'good'] as const;

interface SignupStrengthProps {
  id: string;
  password: string;
  strength: PasswordStrength;
}

export function SignupStrength({ id, password, strength }: SignupStrengthProps) {
  const empty = password.length === 0;
  const score = empty ? 0 : strength.score;
  const { requirements } = strength;
  const rules = [
    { text: 'At least 12 characters', ok: requirements.minLength },
    {
      text: 'Mix of uppercase, lowercase, numbers & symbols',
      ok: requirements.characterTypes >= 3,
    },
    {
      text: 'Not a common or predictable password',
      ok: requirements.notCommon && requirements.notPredictable,
    },
  ].map((rule) => ({ ...rule, ok: !empty && rule.ok }));

  return (
    <div className="nwsu-hints" id={id} data-tone={empty ? 'none' : TONES[score]}>
      <div className="nwsu-hints-head">
        <span className="nwsu-hints-title">Password Strength</span>
        <span className="nw-mono nwsu-hints-level">
          {empty ? 'Not set' : getPasswordStrengthLabel(score)}
        </span>
      </div>
      <div className="nwsu-segs" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <span key={n} className="nwsu-seg" data-on={n < score} />
        ))}
      </div>
      <ul className="nwsu-rules">
        {rules.map((rule) => (
          <li key={rule.text} className="nwsu-rule" data-ok={rule.ok}>
            {rule.ok ? (
              <LoginIcon name="checkCircle" size={14} stroke="#15803D" />
            ) : (
              <LoginRingIcon size={14} />
            )}
            <span>
              {rule.text}
              <span className="nw-sr-only">{rule.ok ? ' (met)' : ' (not met)'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
