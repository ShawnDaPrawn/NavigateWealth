/**
 * Currency Formatter Tests
 *
 * These utilities are the single source of truth for ZAR currency display and
 * parsing across the app (Guidelines §5.3, §8.3). Rounding, thousand
 * separators, negative handling, and the round-trip between formatting and
 * parsing are all pinned here.
 *
 * @module utils/__tests__/currencyFormatter
 */

import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyWhole,
  parseCurrency,
  formatCurrencyDisplay,
  formatCurrencyInput,
  cleanCurrencyInput,
} from '../currencyFormatter';

describe('formatCurrency', () => {
  it('formats with thousand separators and two decimals', () => {
    expect(formatCurrency(1234567.89)).toBe('R1,234,567.89');
  });

  it('formats whole numbers with .00', () => {
    expect(formatCurrency(1000)).toBe('R1,000.00');
  });

  it('formats negatives with a leading minus before the symbol', () => {
    expect(formatCurrency(-1234.5)).toBe('-R1,234.50');
  });

  it('returns R0.00 for NaN, null, and undefined', () => {
    expect(formatCurrency(NaN)).toBe('R0.00');
    expect(formatCurrency(null as unknown as number)).toBe('R0.00');
    expect(formatCurrency(undefined as unknown as number)).toBe('R0.00');
  });

  it('rounds to two decimal places', () => {
    expect(formatCurrency(1.005)).toBe('R1.00'); // toFixed(2) banker-ish rounding
    expect(formatCurrency(1.236)).toBe('R1.24');
  });
});

describe('formatCurrencyWhole', () => {
  it('rounds to whole rands with separators', () => {
    expect(formatCurrencyWhole(1234567.89)).toBe('R1,234,568');
  });

  it('handles negatives', () => {
    expect(formatCurrencyWhole(-999.4)).toBe('-R999');
  });

  it('returns R0 for invalid input', () => {
    expect(formatCurrencyWhole(NaN)).toBe('R0');
  });
});

describe('parseCurrency', () => {
  it('strips the R symbol, spaces, and commas', () => {
    expect(parseCurrency('R1,234.56')).toBe(1234.56);
    expect(parseCurrency('1,234.56')).toBe(1234.56);
    // Commas are treated as thousand separators and removed, so a value
    // written with a comma "decimal" collapses into the integer part.
    expect(parseCurrency('R 1 234.00')).toBe(1234.0);
  });

  it('passes through plain numbers', () => {
    expect(parseCurrency(4567.89)).toBe(4567.89);
  });

  it('returns 0 for null, undefined, empty, and unparseable input', () => {
    expect(parseCurrency(null)).toBe(0);
    expect(parseCurrency(undefined)).toBe(0);
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency('abc')).toBe(0);
    expect(parseCurrency(NaN)).toBe(0);
  });

  it('round-trips with formatCurrency', () => {
    expect(parseCurrency(formatCurrency(1234567.89))).toBe(1234567.89);
  });
});

describe('formatCurrencyDisplay', () => {
  it('formats without the R prefix', () => {
    expect(formatCurrencyDisplay(1234567.89)).toBe('1,234,567.89');
  });

  it('returns an empty string for null, undefined, zero, and NaN', () => {
    expect(formatCurrencyDisplay(null)).toBe('');
    expect(formatCurrencyDisplay(undefined)).toBe('');
    expect(formatCurrencyDisplay(0)).toBe('');
    expect(formatCurrencyDisplay('not-a-number')).toBe('');
  });

  it('accepts a pre-formatted string and re-formats it', () => {
    expect(formatCurrencyDisplay('R1,234.5')).toBe('1,234.50');
  });
});

describe('formatCurrencyInput', () => {
  it('adds thousand separators to integer input', () => {
    expect(formatCurrencyInput('1234567')).toBe('1,234,567');
  });

  it('keeps a single decimal point and limits to two decimal places', () => {
    expect(formatCurrencyInput('1234567.891')).toBe('1,234,567.89');
  });

  it('collapses multiple decimal points to the first', () => {
    expect(formatCurrencyInput('1234.5.6')).toBe('1,234.56');
  });

  it('preserves a trailing decimal point while typing', () => {
    expect(formatCurrencyInput('1234.')).toBe('1,234.');
  });

  it('returns empty string for empty/null/undefined', () => {
    expect(formatCurrencyInput('')).toBe('');
    expect(formatCurrencyInput(null)).toBe('');
    expect(formatCurrencyInput(undefined)).toBe('');
  });
});

describe('cleanCurrencyInput', () => {
  it('strips R, spaces, and commas to a raw numeric string', () => {
    expect(cleanCurrencyInput('1,234,567.89')).toBe('1234567.89');
    expect(cleanCurrencyInput('R 1,000')).toBe('1000');
  });

  it('returns "0" for null and undefined', () => {
    expect(cleanCurrencyInput(null)).toBe('0');
    expect(cleanCurrencyInput(undefined)).toBe('0');
    expect(cleanCurrencyInput('')).toBe('0');
  });

  it('round-trips into parseFloat', () => {
    expect(parseFloat(cleanCurrencyInput('1,234,567.89'))).toBe(1234567.89);
  });
});
