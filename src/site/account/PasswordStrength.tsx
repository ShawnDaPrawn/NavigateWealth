/**
 * Password strength meter, requirement checklist and confirmation match note.
 *
 * Every verdict comes from validatePassword (src/utils/auth/passwordValidation),
 * the client mirror of the server's rules, so the meter can never show a
 * password as acceptable that the server would refuse. The copy is the live
 * pages' own: signup and reset word the character-mix rule differently.
 */
import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import {
  getPasswordStrengthLabel,
  type PasswordStrength,
} from '../../utils/auth/passwordValidation';
import { strengthTone } from './accountUi';

const COPY = {
  signup: {
    meter: 'Password Strength',
    intro: null,
    mix: 'Mix of uppercase, lowercase, numbers & symbols',
  },
  reset: {
    meter: 'Password Strength:',
    intro: 'Password must have:',
    mix: 'At least 3 of: uppercase, lowercase, numbers, special characters',
  },
} as const;

interface PasswordStrengthPanelProps {
  strength: PasswordStrength;
  /** Signup always shows the meter; reset shows it once something is typed. */
  showMeter: boolean;
  variant: keyof typeof COPY;
  /** The id of the checklist, referenced by the input's aria-describedby. */
  requirementsId: string;
}

export function PasswordStrengthPanel({
  strength,
  showMeter,
  variant,
  requirementsId,
}: PasswordStrengthPanelProps) {
  const copy = COPY[variant];
  const { requirements, score } = strength;
  const tone = strengthTone(score);
  const rules = [
    { text: 'At least 12 characters', met: requirements.minLength },
    { text: copy.mix, met: requirements.characterTypes >= 3 },
    {
      text: 'Not a common or predictable password',
      met: requirements.notCommon && requirements.notPredictable,
    },
  ];

  return (
    <div className="nwac-meter" data-tone={tone}>
      {showMeter ? (
        <>
          <div className="nwac-meter-row">
            <span>{copy.meter}</span>
            <span className="nwac-meter-label nw-mono">{getPasswordStrengthLabel(score)}</span>
          </div>
          <div className="nwac-segs" aria-hidden="true">
            {[0, 1, 2, 3].map((n) => (
              <span key={n} className={n < score ? 'nwac-seg is-on' : 'nwac-seg'} />
            ))}
          </div>
        </>
      ) : null}
      {copy.intro ? <p className="nwac-meter-intro">{copy.intro}</p> : null}
      <ul className="nwac-reqs" id={requirementsId}>
        {rules.map((rule) => (
          <li key={rule.text} className={rule.met ? 'nwac-req is-met' : 'nwac-req'}>
            {rule.met ? (
              <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Circle size={14} strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className="nw-sr-only">{rule.met ? 'Met: ' : 'Not yet met: '}</span>
            {rule.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PasswordMatchNoteProps {
  /** Nothing is shown until the confirmation has been typed into. */
  visible: boolean;
  matches: boolean;
}

/** "Passwords match / do not match" under the confirmation field. */
export function PasswordMatchNote({ visible, matches }: PasswordMatchNoteProps) {
  return (
    <p className="nwac-match" aria-live="polite" data-ok={visible ? String(matches) : undefined}>
      {visible ? (
        <>
          {matches ? (
            <CheckCircle2 size={14} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <XCircle size={14} strokeWidth={1.75} aria-hidden="true" />
          )}
          {matches ? 'Passwords match' : 'Passwords do not match'}
        </>
      ) : null}
    </p>
  );
}
