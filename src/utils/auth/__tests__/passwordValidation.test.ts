/**
 * Password Validation Tests
 *
 * `validatePassword` is the only gate on user password strength (financial-grade
 * requirements: 12+ chars, 3+ character classes, not a known-common password).
 * These tests pin the rules, the common-password blocklist, and the score/label
 * helpers so regressions can't silently weaken account security.
 *
 * @module utils/auth/__tests__/passwordValidation
 */

import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
  getPasswordStrengthBarWidth,
} from '../passwordValidation';

describe('validatePassword - requirements', () => {
  it('rejects passwords shorter than 12 characters', () => {
    const result = validatePassword('Ab1!xyz'); // 7 chars, 4 types
    expect(result.requirements.minLength).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain('Password must be at least 12 characters long');
  });

  it('accepts a strong 12+ character password with 3+ character types', () => {
    const result = validatePassword('MyStr0ngPass1'); // upper, lower, number = 3 types
    expect(result.isValid).toBe(true);
    expect(result.requirements.minLength).toBe(true);
    expect(result.requirements.characterTypes).toBe(3);
    expect(result.requirements.notCommon).toBe(true);
  });

  it('rejects a long password with fewer than 3 character types', () => {
    const result = validatePassword('abcdefghijklmnop'); // 16 chars, lowercase only
    expect(result.requirements.characterTypes).toBe(1);
    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain(
      'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
    );
  });

  it('counts all four character types', () => {
    const result = validatePassword('Abcdef123!@#');
    expect(result.requirements.hasUppercase).toBe(true);
    expect(result.requirements.hasLowercase).toBe(true);
    expect(result.requirements.hasNumber).toBe(true);
    expect(result.requirements.hasSpecial).toBe(true);
    expect(result.requirements.characterTypes).toBe(4);
  });
});

describe('validatePassword - common password blocklist', () => {
  const commonPasswords = [
    'password123',
    'password1234',
    '1234567890',
    '12345678901',
    '123456789012',
    'qwerty123',
    'qwerty1234',
    'qwerty12345',
    'letmein123',
    'welcome123',
    'admin123456',
    'password12345',
    'abcdef123456',
    'navigate123',
    'navigatewealth',
  ];

  it.each(commonPasswords)('rejects the common password "%s"', (pwd) => {
    const result = validatePassword(pwd);
    expect(result.requirements.notCommon).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.feedback).toContain(
      'This password is too common. Please choose a more unique password',
    );
  });

  it('matches the blocklist case-insensitively', () => {
    const result = validatePassword('NAVIGATEWEALTH');
    expect(result.requirements.notCommon).toBe(false);
    expect(result.isValid).toBe(false);
  });
});

describe('validatePassword - score', () => {
  it('caps the score at 4 for a very strong long password', () => {
    const result = validatePassword('Abcdefgh123!@#$%'); // 16 chars, 4 types, uncommon
    // minLength + 3types + 4types + notCommon + length>=16 = 5, capped at 4.
    expect(result.score).toBe(4);
    expect(result.feedback).toContain('✓ Very strong password');
  });

  it('never returns a score below 0 or above 4', () => {
    const weak = validatePassword('');
    expect(weak.score).toBeGreaterThanOrEqual(0);
    expect(weak.score).toBeLessThanOrEqual(4);

    const strong = validatePassword('Abcdefgh123!@#$%^&*');
    expect(strong.score).toBeGreaterThanOrEqual(0);
    expect(strong.score).toBeLessThanOrEqual(4);
  });

  it('reports invalid for an empty password', () => {
    const result = validatePassword('');
    expect(result.isValid).toBe(false);
    expect(result.requirements.minLength).toBe(false);
    expect(result.requirements.characterTypes).toBe(0);
  });
});

describe('password strength display helpers', () => {
  it('maps scores to colors', () => {
    expect(getPasswordStrengthColor(0)).toBe('text-red-600');
    expect(getPasswordStrengthColor(1)).toBe('text-red-600');
    expect(getPasswordStrengthColor(2)).toBe('text-orange-600');
    expect(getPasswordStrengthColor(3)).toBe('text-yellow-600');
    expect(getPasswordStrengthColor(4)).toBe('text-green-600');
    expect(getPasswordStrengthColor(99)).toBe('text-gray-600');
  });

  it('maps scores to labels', () => {
    expect(getPasswordStrengthLabel(0)).toBe('Very Weak');
    expect(getPasswordStrengthLabel(1)).toBe('Weak');
    expect(getPasswordStrengthLabel(2)).toBe('Fair');
    expect(getPasswordStrengthLabel(3)).toBe('Strong');
    expect(getPasswordStrengthLabel(4)).toBe('Very Strong');
    expect(getPasswordStrengthLabel(99)).toBe('Unknown');
  });

  it('maps scores to bar widths', () => {
    expect(getPasswordStrengthBarWidth(0)).toBe('0%');
    expect(getPasswordStrengthBarWidth(2)).toBe('50%');
    expect(getPasswordStrengthBarWidth(4)).toBe('100%');
  });
});
