import { describe, expect, it } from 'vitest';
import { formatMinor, parseToMinor, statusLabel } from '../constants';

describe('treasury constants', () => {
  describe('formatMinor', () => {
    it('formats USD minor units as dollars', () => {
      expect(formatMinor(123456, 'usd')).toBe('$1,234.56');
      expect(formatMinor(0, 'usd')).toBe('$0.00');
    });

    it('falls back gracefully for invalid currency codes', () => {
      // A 2-letter code is not a valid ISO 4217 code — Intl throws, so we hit
      // the plain-number fallback.
      expect(formatMinor(5000, 'zz')).toBe('50.00 ZZ');
    });
  });

  describe('parseToMinor', () => {
    it('parses major-unit strings into integer minor units', () => {
      expect(parseToMinor('1,234.56')).toBe(123456);
      expect(parseToMinor('10')).toBe(1000);
      expect(parseToMinor('$0.99')).toBe(99);
    });

    it('rejects empty, zero and malformed inputs', () => {
      expect(parseToMinor('')).toBeNull();
      expect(parseToMinor('0')).toBeNull();
      expect(parseToMinor('abc')).toBeNull();
    });

    it('rejects signed amounts instead of stripping the minus sign', () => {
      expect(parseToMinor('-10')).toBeNull();
      expect(parseToMinor('$-0.99')).toBeNull();
      expect(parseToMinor('10-')).toBeNull();
    });

    it('rounds to the nearest cent', () => {
      expect(parseToMinor('1.004')).toBe(100);
      expect(parseToMinor('1.006')).toBe(101);
    });
  });

  describe('statusLabel', () => {
    it('humanises snake_case statuses', () => {
      expect(statusLabel('open')).toBe('Open');
      expect(statusLabel('posted_pending')).toBe('Posted Pending');
    });
  });
});
