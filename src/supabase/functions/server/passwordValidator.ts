// Server-side Password Validation
// Enforces strong password requirements to prevent weak passwords

// Common passwords that should be rejected
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

/**
 * Keep this byte-for-byte in step with the copy in
 * `src/utils/auth/passwordValidation.ts`. They cannot import each other —
 * `no-spa-edge-source` in quality/dependency-cruiser.cjs forbids SPA code from
 * importing Edge Function source at runtime — and
 * `passwordValidator.agreement.test.ts` fails the build if the two ever
 * disagree, on this function, the word list, or any other rule.
 */
export function containsCommonPassword(lowerPassword: string): boolean {
  const folded = foldLeet(lowerPassword);
  if (COMMON_LONG.some((common) => folded.includes(common))) return true;
  return COMMON_SHORT_AS_WORD.test(lowerPassword);
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
}

/**
 * Validate password against security requirements
 * Requirements:
 * - Minimum 12 characters
 * - At least 3 of: uppercase, lowercase, numbers, special characters
 * - Not a common password
 * - Not contain sequential characters (123, abc)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  // Check character types
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+=[\]{};':"\\|,.<>/?-]/.test(password);

  const characterTypes = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;

  if (characterTypes < 3) {
    errors.push(
      'Password must contain at least 3 of: uppercase letters, lowercase letters, numbers, special characters',
    );
  }

  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (containsCommonPassword(lowerPassword)) {
    errors.push(
      'Password is too common or contains common words. Please choose a more unique password',
    );
  }

  // Check for sequential characters
  if (
    /012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(
      password,
    )
  ) {
    errors.push('Password should not contain sequential characters (e.g., 123, abc)');
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters (e.g., aaa, 111)');
  }

  // Calculate strength
  let strengthScore = 0;
  if (password.length >= 12) strengthScore++;
  if (password.length >= 16) strengthScore++;
  if (characterTypes >= 3) strengthScore++;
  if (characterTypes === 4) strengthScore++;
  if (!COMMON_PASSWORDS.some((common) => lowerPassword.includes(common))) strengthScore++;

  const strength: PasswordValidationResult['strength'] =
    strengthScore <= 1
      ? 'very_weak'
      : strengthScore === 2
        ? 'weak'
        : strengthScore === 3
          ? 'fair'
          : strengthScore === 4
            ? 'strong'
            : 'very_strong';

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Check for suspicious patterns
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Max length check
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }

  return { isValid: true };
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(
  phoneNumber: string,
  _countryCode: string,
): { isValid: boolean; error?: string } {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove spaces and dashes
  const cleaned = phoneNumber.replace(/[\s-]/g, '');

  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Phone number should contain only digits' };
  }

  // Check reasonable length (6-15 digits)
  if (cleaned.length < 6 || cleaned.length > 15) {
    return { isValid: false, error: 'Phone number length is invalid' };
  }

  return { isValid: true };
}

/**
 * Sanitize input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove any potential script tags or dangerous characters
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
