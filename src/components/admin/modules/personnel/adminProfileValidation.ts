/** Checks for the super admin profile edit dialog. */

export interface AdminProfileValues {
  firstName: string;
  lastName: string;
  phone: string;
}

export type AdminProfileErrors = Partial<Record<keyof AdminProfileValues, string>>;

/** Digits, spaces, brackets, dashes and a leading +; 9 to 15 digits. */
export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
}

export function validateAdminProfile(values: AdminProfileValues): AdminProfileErrors {
  const errors: AdminProfileErrors = {};
  if (!values.firstName.trim()) errors.firstName = 'Enter a first name';
  if (!values.lastName.trim()) errors.lastName = 'Enter a last name';
  if (!isValidPhone(values.phone))
    errors.phone = 'Enter a valid phone number, e.g. +27 72 123 4567';
  return errors;
}
