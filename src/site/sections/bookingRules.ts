/**
 * The booking form's rules, shared by its sections: what each detail field
 * accepts (matching what POST /consultation/request accepts, so the form never
 * sends something the server will refuse) and how the arrow keys move through
 * a radio group.
 */
export type DetailsField = 'name' | 'email' | 'phone' | 'notes';
export type DetailsValues = Record<DetailsField, string>;
export type DetailsErrors = Partial<Record<Exclude<DetailsField, 'notes'>, string>>;

export const DETAILS_ORDER = ['name', 'email', 'phone'] as const;

/** The fields' element ids, so the page can move focus to the first error. */
export const fieldId = (field: DetailsField) => `nwbk-${field}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** POST /consultation/request's own phone rule (consultation-validation.ts). */
const PHONE_PATTERN = /^[\d\s\-+()]{7,}$/;
/** The longest values the endpoint accepts. */
export const MAX_LENGTH: Record<DetailsField, number | undefined> = {
  name: 200,
  email: undefined,
  phone: 30,
  notes: 5000,
};

/** What is wrong with each required field, if anything. */
export function validateDetails(values: DetailsValues): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!values.name.trim()) errors.name = 'Please enter your full name.';
  if (!values.email.trim()) errors.email = 'Please enter your email address.';
  else if (!EMAIL_PATTERN.test(values.email.trim()))
    errors.email = 'Please enter a valid email address.';
  if (!values.phone.trim()) errors.phone = 'Please enter your contact number.';
  else if (!PHONE_PATTERN.test(values.phone)) errors.phone = 'Please enter a valid contact number.';
  return errors;
}

/** The index the key moves to in a group of `count`, or null for other keys. */
export function radioStep(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
