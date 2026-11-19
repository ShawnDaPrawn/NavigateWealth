/**
 * Field rules shared by the Navigator lead forms. They match what
 * POST /contact-form/submit accepts, so a form never sends something the
 * server will refuse and the visitor learns what is wrong beside the field.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s\-+()]+$/;

/** An error message, or undefined when the value is acceptable. */
export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email address';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address';
  return undefined;
}

/** The endpoint accepts digits, spaces, + - and brackets; a real number has 9+ digits. */
export function phoneError(phone: string): string | undefined {
  if (!phone.trim()) return 'Enter your phone number';
  if (!PHONE_PATTERN.test(phone.trim()) || phone.replace(/\D/g, '').length < 9)
    return 'Enter a valid phone number';
  return undefined;
}
