import { describe, expect, it } from 'vitest';
import {
  SOUTH_AFRICAN_BANKS,
  ACCOUNT_TYPES,
  RELATIONSHIP_TYPES,
  GENDER_OPTIONS,
} from '../constants';

describe('profile/constants', () => {
  it('SOUTH_AFRICAN_BANKS is a non-empty array', () => {
    expect(Array.isArray(SOUTH_AFRICAN_BANKS)).toBe(true);
    expect(SOUTH_AFRICAN_BANKS.length).toBeGreaterThan(0);
  });

  it('each bank has value, label, and code', () => {
    SOUTH_AFRICAN_BANKS.forEach((bank) => {
      expect(typeof bank.value).toBe('string');
      expect(typeof bank.label).toBe('string');
      expect(typeof bank.code).toBe('string');
    });
  });

  it('SOUTH_AFRICAN_BANKS includes major South African banks', () => {
    const values = SOUTH_AFRICAN_BANKS.map((b) => b.value);
    expect(values).toContain('absa');
    expect(values).toContain('fnb');
    expect(values).toContain('standard');
    expect(values).toContain('nedbank');
    expect(values).toContain('capitec');
  });

  it('ACCOUNT_TYPES has savings and cheque entries', () => {
    const values = ACCOUNT_TYPES.map((a) => a.value);
    expect(values).toContain('savings');
    expect(values).toContain('cheque');
  });

  it('RELATIONSHIP_TYPES includes spouse and parent', () => {
    const values = RELATIONSHIP_TYPES.map((r) => r.value);
    expect(values).toContain('spouse');
    expect(values).toContain('parent');
    expect(values).toContain('child');
  });

  it('GENDER_OPTIONS has male and female', () => {
    const values = GENDER_OPTIONS.map((g) => g.value);
    expect(values).toContain('male');
    expect(values).toContain('female');
  });

  it('all constant arrays have consistent shape with value and label', () => {
    [ACCOUNT_TYPES, RELATIONSHIP_TYPES, GENDER_OPTIONS].forEach((arr) => {
      arr.forEach((item) => {
        expect(typeof item.value).toBe('string');
        expect(typeof item.label).toBe('string');
      });
    });
  });
});
