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
export const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
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
  const year = parseInt(idNumber.substring(0, 2));
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
  return phone.replace(/[\s\-]/g, '');
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
export function formatZodError(error: ZodError): { message: string; errors: Record<string, string[]> } {
  const formattedErrors: Record<string, string[]> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formattedErrors[path]) {
      formattedErrors[path] = [];
    }
    formattedErrors[path].push(err.message);
  });
  
  return {
    message: 'Validation failed',
    errors: formattedErrors,
  };
}
