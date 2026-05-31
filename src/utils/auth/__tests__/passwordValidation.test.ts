import { describe, expect, it } from 'vitest';
import {
  getPasswordStrengthBarWidth,
  getPasswordStrengthColor,
  getPasswordStrengthLabel,
  validatePassword,
} from '../passwordValidation';

describe('validatePassword', () => {
  it('rejects a short password and reports the length requirement', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.requirements.minLength).toBe(false);
    expect(result.feedback).toContain('Password must be at least 12 characters long');
  });

  it('accepts a long password with all four character types as very strong', () => {
    const result = validatePassword('Ab1!Ab1!Ab1!'); // 12 chars, 4 types
    expect(result.isValid).toBe(true);
    expect(result.requirements.characterTypes).toBe(4);
    expect(result.score).toBe(4);
    expect(result.feedback).toContain('✓ Very strong password');
  });

  it('requires at least 3 character types even when long enough', () => {
    const result = validatePassword('abcdefghijkl'); // 12 lowercase only
    expect(result.isValid).toBe(false);
    expect(result.requirements.characterTypes).toBe(1);
    expect(result.feedback).toContain(
      'Password must contain at least 3 of: uppercase, lowercase, numbers, special characters',
    );
  });

  it('rejects common passwords case-insensitively', () => {
    const result = validatePassword('NavigateWealth'); // matches "navigatewealth"
    expect(result.requirements.notCommon).toBe(false);
    expect(result.feedback).toContain(
      'This password is too common. Please choose a more unique password',
    );
  });

  it('scores a 3-type valid password as strong (score 3)', () => {
    const result = validatePassword('Abcdefghijk1'); // upper+lower+number, 12 chars
    expect(result.isValid).toBe(true);
    expect(result.requirements.characterTypes).toBe(3);
    expect(result.score).toBe(3);
    expect(result.feedback).toContain('✓ Strong password');
  });

  it('caps the score at 4 and awards the length bonus', () => {
    const result = validatePassword('Abcdefghij123456'); // 16 chars, 3 types
    expect(result.score).toBe(4);
    expect(result.requirements.minLength).toBe(true);
  });
});

describe('password strength display helpers', () => {
  it('maps score to a colour class', () => {
    expect(getPasswordStrengthColor(0)).toBe('text-red-600');
    expect(getPasswordStrengthColor(1)).toBe('text-red-600');
    expect(getPasswordStrengthColor(2)).toBe('text-orange-600');
    expect(getPasswordStrengthColor(3)).toBe('text-yellow-600');
    expect(getPasswordStrengthColor(4)).toBe('text-green-600');
    expect(getPasswordStrengthColor(99)).toBe('text-gray-600');
  });

  it('maps score to a label', () => {
    expect(getPasswordStrengthLabel(0)).toBe('Very Weak');
    expect(getPasswordStrengthLabel(1)).toBe('Weak');
    expect(getPasswordStrengthLabel(2)).toBe('Fair');
    expect(getPasswordStrengthLabel(3)).toBe('Strong');
    expect(getPasswordStrengthLabel(4)).toBe('Very Strong');
    expect(getPasswordStrengthLabel(99)).toBe('Unknown');
  });

  it('computes the progress bar width', () => {
    expect(getPasswordStrengthBarWidth(0)).toBe('0%');
    expect(getPasswordStrengthBarWidth(2)).toBe('50%');
    expect(getPasswordStrengthBarWidth(4)).toBe('100%');
  });
});
