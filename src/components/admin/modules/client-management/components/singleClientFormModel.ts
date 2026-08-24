/**
 * Model of the single-client form: option vocabularies, validation regexes,
 * the SA ID number validator, age derivation, and the per-field validator.
 * Pure — no React. Split out of SingleClientForm.tsx.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'];
export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];
export const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Life Partner'];
export const MARITAL_REGIMES = [
  'In Community of Property',
  'Out of Community of Property (with accrual)',
  'Out of Community of Property (without accrual)',
];
export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];
export const EMPLOYMENT_STATUSES = [
  { value: 'employed', label: 'Employed' },
  { value: 'self-employed', label: 'Self-Employed' },
  { value: 'contract', label: 'Contract Worker' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
];

export const NAME_REGEX = /^[a-zA-ZÀ-ÿ' -]+$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\+?\d[\d\s()-]{7,18}$/;
export const SA_TAX_REGEX = /^\d{10}$/;
export const SA_POSTAL_REGEX = /^\d{4}$/;

// ---------------------------------------------------------------------------
// SA ID Validation — Luhn checksum + structure
// ---------------------------------------------------------------------------
export function validateSaIdNumber(id: string): {
  valid: boolean;
  error?: string;
  dob?: string;
  gender?: string;
} {
  const clean = id.replace(/\s/g, '');
  if (clean.length !== 13) return { valid: false, error: 'SA ID must be exactly 13 digits' };
  if (!/^\d{13}$/.test(clean)) return { valid: false, error: 'SA ID must contain only digits' };

  // Extract DOB (YYMMDD)
  const yy = parseInt(clean.substring(0, 2), 10);
  const mm = parseInt(clean.substring(2, 4), 10);
  const dd = parseInt(clean.substring(4, 6), 10);
  if (mm < 1 || mm > 12) return { valid: false, error: 'Invalid month in SA ID (positions 3-4)' };
  if (dd < 1 || dd > 31) return { valid: false, error: 'Invalid day in SA ID (positions 5-6)' };

  // Determine century: if yy > current 2-digit year → 1900s, else → 2000s
  const currentYY = new Date().getFullYear() % 100;
  const century = yy > currentYY ? 1900 : 2000;
  const fullYear = century + yy;
  const dateStr = `${fullYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime()) || parsed.getMonth() + 1 !== mm || parsed.getDate() !== dd) {
    return { valid: false, error: 'Invalid date of birth encoded in SA ID' };
  }

  // Gender: digit 7 (index 6). 0-4 = Female, 5-9 = Male
  const genderDigit = parseInt(clean[6], 10);
  const gender = genderDigit >= 5 ? 'Male' : 'Female';

  // Luhn checksum
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let digit = parseInt(clean[i], 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'SA ID checksum is invalid' };

  return { valid: true, dob: dateStr, gender };
}

export function computeAge(dobStr: string): number | null {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const mDiff = today.getMonth() - dob.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type FormField = string;
export type FieldErrors = Record<FormField, string | undefined>;

export function validateField(
  field: string,
  value: string,
  formData: Record<string, string>,
): string | undefined {
  const v = value.trim();

  switch (field) {
    // ── Required names ──
    case 'firstName':
      if (!v) return 'First name is required';
      if (v.length < 2) return 'Must be at least 2 characters';
      if (!NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'lastName':
      if (!v) return 'Last name is required';
      if (v.length < 2) return 'Must be at least 2 characters';
      if (!NAME_REGEX.test(v)) return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'middleName':
      if (v && !NAME_REGEX.test(v))
        return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    case 'preferredName':
      if (v && !NAME_REGEX.test(v))
        return 'Name should contain only letters, hyphens, or apostrophes';
      return undefined;

    // ── Email ──
    case 'emailAddress':
      if (!v) return 'Email address is required';
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address';
      return undefined;

    case 'alternativeEmail':
      if (!v) return undefined;
      if (!EMAIL_REGEX.test(v)) return 'Please enter a valid email address';
      if (v.toLowerCase() === formData.emailAddress?.trim().toLowerCase())
        return 'Alternative email must be different from the primary email';
      return undefined;

    // ── Phone ──
    case 'cellphoneNumber':
      if (!v) return 'Cellphone number is required';
      if (!PHONE_REGEX.test(v)) return 'Enter a valid phone number (e.g. +27 82 123 4567)';
      return undefined;

    case 'whatsappNumber':
      if (!v) return undefined;
      if (!PHONE_REGEX.test(v)) return 'Enter a valid phone number';
      return undefined;

    // ── Date of birth ──
    case 'dateOfBirth': {
      if (!v) return undefined;
      const dob = new Date(v);
      if (isNaN(dob.getTime())) return 'Invalid date';
      if (dob > new Date()) return 'Date of birth cannot be in the future';
      const age = computeAge(v);
      if (age !== null && age < 18) return 'Client must be at least 18 years old';
      if (age !== null && age > 120) return 'Please verify the date of birth';
      return undefined;
    }

    // ── SA ID / Passport ──
    case 'idNumber': {
      if (!v) return undefined;
      if (formData.idType === 'sa_id') {
        const result = validateSaIdNumber(v);
        if (!result.valid) return result.error;
        // Cross-check DOB if both are provided
        if (result.dob && formData.dateOfBirth) {
          if (result.dob !== formData.dateOfBirth)
            return 'ID number date of birth does not match the Date of Birth field';
        }
        // Cross-check gender
        if (
          result.gender &&
          formData.gender &&
          formData.gender !== 'Other' &&
          formData.gender !== 'Prefer not to say'
        ) {
          if (result.gender !== formData.gender)
            return `ID number indicates ${result.gender}, but Gender is set to ${formData.gender}`;
        }
      } else if (formData.idType === 'passport') {
        if (v.length < 5) return 'Passport number seems too short';
        if (v.length > 20) return 'Passport number seems too long';
      }
      return undefined;
    }

    // ── Tax ──
    case 'taxNumber':
      if (!v) return undefined;
      if (!SA_TAX_REGEX.test(v)) return 'SA tax number must be exactly 10 digits';
      return undefined;

    // ── Marital regime (conditionally required) ──
    case 'maritalRegime': {
      const needsRegime =
        formData.maritalStatus === 'Married' || formData.maritalStatus === 'Life Partner';
      if (needsRegime && !v)
        return 'Marital regime is required when married or in a life partnership';
      return undefined;
    }

    // ── Address ──
    case 'residentialPostalCode':
      if (!v) return undefined;
      if (formData.residentialCountry === 'South Africa' && !SA_POSTAL_REGEX.test(v))
        return 'SA postal code must be 4 digits';
      return undefined;

    default:
      return undefined;
  }
}
