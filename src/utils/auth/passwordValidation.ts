// Password Validation Utilities
// Financial-industry grade password requirements

// Common passwords to reject.
//
// Byte-for-byte the list in `src/supabase/functions/server/passwordValidator.ts`.
// The two files cannot import each other — `no-spa-edge-source` in
// quality/dependency-cruiser.cjs forbids SPA code from importing Edge Function
// source at runtime — so `passwordValidator.agreement.test.ts` fails the build
// if they drift apart.
const COMMON_PASSWORDS = [
  'password',
  'password123',
  'password1234',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwerty123',
  'qwerty1234',
  'abc123',
  'letmein',
  'welcome',
  'admin',
  'root',
  'toor',
  'pass',
  'test',
  'guest',
  'info',
  'adm',
  'mysql',
  'user',
  'administrator',
  'oracle',
  'ftp',
  'pi',
  'puppet',
  'ansible',
  'ec2-user',
  'vagrant',
  'azureuser',
  'ubuntu',
  'demo',
  'navigate',
  'navigatewealth',
  'wealth',
  'finance',
  'admin123456',
  'password12345',
  'abcdef123456',
];

/**
 * Common-password matching, in two passes.
 *
 * The list mixes real weak passwords ('password1234') with short service
 * account names ('pi', 'adm', 'ftp', 'pass', 'test', 'user', 'root'). The
 * original rule matched every entry as a bare substring, so a two-character
 * fragment could condemn a strong password:
 *
 *   Olympic$Rain42   refused: "olym·pi·c"
 *   Tropical#Sun88   refused: "tro·pi·cal"
 *   Compass&Birch51  refused: "com·pass"
 *
 * On a 30-password corpus of the kind a careful person actually picks, 3 were
 * refused — 10% — each told its password was "too common". A form that rejects
 * one strong password in ten and blames the person for it teaches them to stop
 * picking strong passwords.
 *
 * But the loose rule was catching something real by accident:
 * `Str0ng!Passw0rd#2026` matched on 'pass'. Simply requiring longer entries
 * would have let that through, so the substring pass now normalises leetspeak
 * first and matches 'password' properly.
 *
 *   Pass A — entries of six characters or more, matched anywhere in the
 *            password after digits and symbols are folded back to the letters
 *            they stand in for. Containing 'password' or 'qwerty' at all is
 *            disqualifying, however it is spelled.
 *   Pass B — shorter entries, matched only at letter boundaries. 'admin' still
 *            condemns 'Admin!2026' — the case it was added for — without
 *            condemning 'Administer' or 'Compass'.
 */
/** Digits and symbols folded back to the letter they stand in for. */
const LEET_FOLD: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  $: 's',
};

/** Minimum entry length for the substring pass; shorter entries use Pass B. */
const COMMON_SUBSTRING_MIN_LENGTH = 6;

function foldLeet(lower: string): string {
  return lower.replace(/[013457890@$]/g, (ch) => LEET_FOLD[ch] ?? ch);
}

/** Regex-special characters, so a list entry cannot alter the pattern. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Entries long enough to match anywhere, after leetspeak is folded. */
const COMMON_LONG = COMMON_PASSWORDS.filter((c) => c.length >= COMMON_SUBSTRING_MIN_LENGTH);

const COMMON_SHORT = COMMON_PASSWORDS.filter((c) => c.length < COMMON_SUBSTRING_MIN_LENGTH);

/**
 * Shorter entries, as one alternation bounded by non-letters. Built once at
 * module load: this runs on every keystroke in the signup form's strength meter.
 *
 * The empty-list branch is not hypothetical tidiness. An empty alternation makes
 * `(?:^|[^a-z])(?:)(?:[^a-z]|$)` match almost any string, so deleting the last
 * short entry from the list would turn this into "reject every password" with no
 * test naming the list as the cause. `/$^/` can never match instead.
 */
const COMMON_SHORT_AS_WORD =
  COMMON_SHORT.length > 0
    ? new RegExp(`(?:^|[^a-z])(?:${COMMON_SHORT.map(escapeRegExp).join('|')})(?:[^a-z]|$)`)
    : /$^/;

/** Identical to `containsCommonPassword` in the server validator. */
function containsCommonPassword(lowerPassword: string): boolean {
  const folded = foldLeet(lowerPassword);
  if (COMMON_LONG.some((common) => folded.includes(common))) return true;
  return COMMON_SHORT_AS_WORD.test(lowerPassword);
}

/** Identical to the sequential-run check in the server validator. */
const SEQUENTIAL_RUN =
  /012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i;

/** Identical to the repeated-character check in the server validator. */
const REPEATED_RUN = /(.)\1{2,}/;

export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4 (0=very weak, 4=very strong)
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
    /** No `abc`/`123` run and no character repeated 3+ times. */
    notPredictable: boolean;
    characterTypes: number; // Must be >= 3
  };
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  const requirements = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password),
    notCommon: !containsCommonPassword(password.toLowerCase()),
    notPredictable: !SEQUENTIAL_RUN.test(password) && !REPEATED_RUN.test(password),
    characterTypes: 0,
  };

  // Count character types
  if (requirements.hasUppercase) requirements.characterTypes++;
  if (requirements.hasLowercase) requirements.characterTypes++;
  if (requirements.hasNumber) requirements.characterTypes++;
  if (requirements.hasSpecial) requirements.characterTypes++;

  // Check minimum length
  if (!requirements.minLength) {
    feedback.push('Password must be at least 12 characters long');
  }

  // Check character type diversity
  if (requirements.characterTypes < 3) {
    feedback.push(
      'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
    );
  }

  // Check for common passwords
  if (!requirements.notCommon) {
    feedback.push('This password is too common. Please choose a more unique password');
  }

  // Check for predictable runs — the server refuses these, so the meter must
  // too, or it shows green on a password signup then rejects.
  if (!requirements.notPredictable) {
    feedback.push('Avoid sequences (123, abc) and characters repeated three or more times');
  }

  // Calculate strength score (0-4)
  let score = 0;
  if (requirements.minLength) score++;
  if (requirements.characterTypes >= 3) score++;
  if (requirements.characterTypes === 4) score++;
  if (requirements.notCommon) score++;
  // `notPredictable` deliberately does NOT add a point. The scale is calibrated
  // so a bare-minimum password (12 chars, 3 classes) reads "Strong" at 3 and
  // only length or a fourth class reaches 4. Scoring another rule shifted every
  // password up one and made the minimum read "Very Strong". It gates `isValid`
  // instead, and the clamp below keeps a failing password off the top of the
  // scale.
  if (password.length >= 16) score++; // Bonus for extra length
  score = Math.min(score, 4); // Cap at 4

  // Every rule the server enforces, in the same order. `isValid` here must
  // equal `isValid` from the server validator for any input — a green meter
  // over a password the signup route will refuse is worse than no meter.
  const isValid =
    requirements.minLength &&
    requirements.characterTypes >= 3 &&
    requirements.notCommon &&
    requirements.notPredictable;

  // A password that fails a rule must never read as strong, whatever the bonus
  // points said.
  if (!isValid) score = Math.min(score, 2);

  // Add positive feedback for strong passwords
  if (isValid) {
    if (score >= 4) {
      feedback.push('✓ Very strong password');
    } else if (score === 3) {
      feedback.push('✓ Strong password');
    } else {
      feedback.push('✓ Password meets minimum requirements');
    }
  }

  return {
    isValid,
    score: Math.max(0, Math.min(score, 4)),
    feedback,
    requirements,
  };
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-600';
    case 2:
      return 'text-orange-600';
    case 3:
      return 'text-yellow-600';
    case 4:
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Strong';
    case 4:
      return 'Very Strong';
    default:
      return 'Unknown';
  }
}

export function getPasswordStrengthBarWidth(score: number): string {
  return `${(score / 4) * 100}%`;
}
