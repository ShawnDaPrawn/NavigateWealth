/**
 * Shared Validation Utilities
 *
 * Common regex patterns, validation functions, and sanitization helpers.
 */

import { ZodError } from 'npm:zod';

// ============================================================================
// REGEX PATTERNS
// ============================================================================

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export const SA_PHONE_REGEX = /^(\+27|0)[6-8][0-9]{8}$/;
export const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;
export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const URL_REGEX = /^https?:\/\/.+/;
export const NAME_REGEX = /^[a-zA-Z\s\-']+$/;
export const SA_ID_NUMBER_REGEX = /^\d{13}$/;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validates a South African ID number using Luhn algorithm
 */
export function isValidSAIdNumber(idNumber: string): boolean {
  if (!SA_ID_NUMBER_REGEX.test(idNumber)) return false;

  // Luhn algorithm
  let sum = 0;
  let isSecond = false;

  for (let i = idNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(idNumber.charAt(i));

    if (isSecond) {
      digit = digit * 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isSecond = !isSecond;
  }

  if (sum % 10 !== 0) return false;

  // Date validation
  const _year = parseInt(idNumber.substring(0, 2));
  const month = parseInt(idNumber.substring(2, 4));
  const day = parseInt(idNumber.substring(4, 6));

  // Basic date checks
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}

/**
 * Refinement: Date must be in the past
 */
export function pastDateRefinement(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return date < new Date();
  } catch {
    return false;
  }
}

/**
 * Refinement: Date must be in the future
 */
export function futureDateRefinement(dateStr: string): boolean {
  try {
    const date = new Date(dateStr);
    return date > new Date();
  } catch {
    return false;
  }
}

/**
 * Refinement: Start date before end date
 */
export function dateRangeRefinement(data: { startDate: string; endDate: string }): boolean {
  try {
    return new Date(data.startDate) < new Date(data.endDate);
  } catch {
    return false;
  }
}

/**
 * Refinement: Strong password
 */
export function strongPasswordRefinement(password: string): boolean {
  // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

/**
 * Refinement: No path traversal (../)
 */
export function noPathTraversalRefinement(path: string): boolean {
  return !path.includes('..') && !path.includes('://');
}

// ============================================================================
// SANITIZATION HELPERS
// ============================================================================

/**
 * Sanitize email: lowercase and trim
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Sanitize phone: remove spaces and dashes
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

/**
 * Normalize whitespace: replace multiple spaces with single space, trim
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Recursively escape every string in a value, preserving its shape.
 *
 * SECURITY (SECURITY-AUDIT S10): the public lead-gen forms accept
 * `z.record(z.string(), z.unknown())` payloads from anonymous visitors and
 * render them into the staff notification emails. Escaping each interpolation
 * site by hand does not scale — `quote-request-routes.ts` alone has over 140 of
 * them across seven verticals, so a single missed site reintroduces the hole.
 * Escaping the whole object graph once, at the boundary where it enters an HTML
 * builder, cannot miss a site.
 *
 * Only strings are transformed. Numbers, booleans and null pass through
 * unchanged so downstream `Number()`/`formatRand()` calls still work, and the
 * plain-text, PDF and KV paths must keep using the UNESCAPED original — escaping
 * those would show `&amp;` to staff rather than protect anyone.
 *
 * Cycles are not expected (the input is parsed JSON) but are handled rather than
 * overflowing the stack, because the input is attacker-controlled.
 */
export function escapeHtmlDeep<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') {
    return escapeHtml(value) as unknown as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => escapeHtmlDeep(entry, seen)) as unknown as T;
  }

  const escaped: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    // Keys are interpolated as labels too (`id.replace(/_/g, ' ')`), so they are
    // attacker-controlled on a `z.record` payload and must be escaped as well.
    escaped[escapeHtml(key)] = escapeHtmlDeep(entry, seen);
  }
  return escaped as unknown as T;
}

/**
 * Strip HTML tags
 */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]*>?/gm, '');
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format Zod validation errors into a user-friendly object
 */
export function formatZodError(error: ZodError): {
  message: string;
  errors: Record<string, string[]>;
} {
  const formattedErrors: Record<string, string[]> = {};

  const issues: { message: string; path: (string | number)[] }[] =
    (error as unknown as { issues?: { message: string; path: (string | number)[] }[] }).issues ??
    (error as unknown as { errors?: { message: string; path: (string | number)[] }[] }).errors ??
    [];
  issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }
    formattedErrors[path].push(issue.message);
  });

  return {
    message: 'Validation failed',
    errors: formattedErrors,
  };
}
