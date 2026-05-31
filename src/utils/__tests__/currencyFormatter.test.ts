import { describe, expect, it } from 'vitest';
import {
  cleanCurrencyInput,
  formatCurrency,
  formatCurrencyDisplay,
  formatCurrencyInput,
  formatCurrencyWhole,
  parseCurrency,
} from '../currencyFormatter';

describe('formatCurrency', () => {
  it('formats with thousand separators and 2 decimals', () => {
    expect(formatCurrency(1234567.89)).toBe('R1,234,567.89');
    expect(formatCurrency(0)).toBe('R0.00');
    expect(formatCurrency(1234.5)).toBe('R1,234.50');
  });

  it('prefixes a minus sign for negatives', () => {
    expect(formatCurrency(-1234.5)).toBe('-R1,234.50');
  });

  it('returns R0.00 for NaN / null / undefined', () => {
    expect(formatCurrency(NaN)).toBe('R0.00');
    expect(formatCurrency(undefined as unknown as number)).toBe('R0.00');
    expect(formatCurrency(null as unknown as number)).toBe('R0.00');
  });
});

describe('formatCurrencyWhole', () => {
  it('rounds to whole rands with separators and no decimals', () => {
    expect(formatCurrencyWhole(1234567)).toBe('R1,234,567');
    expect(formatCurrencyWhole(1234.6)).toBe('R1,235');
    expect(formatCurrencyWhole(-1000)).toBe('-R1,000');
  });

  it('returns R0 for invalid input', () => {
    expect(formatCurrencyWhole(NaN)).toBe('R0');
  });
});

describe('parseCurrency', () => {
  it('strips R, spaces and commas', () => {
    expect(parseCurrency('R1,234.56')).toBeCloseTo(1234.56, 2);
    expect(parseCurrency('1 234.56')).toBeCloseTo(1234.56, 2);
    expect(parseCurrency('1234')).toBe(1234);
  });

  it('passes numbers through and guards NaN/empty/nullish', () => {
    expect(parseCurrency(42)).toBe(42);
    expect(parseCurrency(NaN)).toBe(0);
    expect(parseCurrency('')).toBe(0);
    expect(parseCurrency(undefined)).toBe(0);
    expect(parseCurrency(null)).toBe(0);
    expect(parseCurrency('not money')).toBe(0);
  });
});

describe('formatCurrencyDisplay', () => {
  it('formats without the R prefix and blanks zero/empty', () => {
    expect(formatCurrencyDisplay(1234567.89)).toBe('1,234,567.89');
    expect(formatCurrencyDisplay('1234.5')).toBe('1,234.50');
    expect(formatCurrencyDisplay(0)).toBe('');
    expect(formatCurrencyDisplay(undefined)).toBe('');
    expect(formatCurrencyDisplay('abc')).toBe('');
  });
});

describe('formatCurrencyInput', () => {
  it('adds separators and clamps to 2 decimals', () => {
    expect(formatCurrencyInput('1234567.89')).toBe('1,234,567.89');
    expect(formatCurrencyInput('1234')).toBe('1,234');
    expect(formatCurrencyInput('1.999')).toBe('1.99');
    expect(formatCurrencyInput(1234)).toBe('1,234');
  });

  it('keeps only the first decimal point and supports a trailing dot', () => {
    expect(formatCurrencyInput('1.2.3')).toBe('1.23');
    expect(formatCurrencyInput('1234.')).toBe('1,234.');
  });

  it('returns empty string for empty/nullish input', () => {
    expect(formatCurrencyInput('')).toBe('');
    expect(formatCurrencyInput(undefined)).toBe('');
    expect(formatCurrencyInput(null)).toBe('');
  });
});

describe('cleanCurrencyInput', () => {
  it('strips formatting to a parseable numeric string', () => {
    expect(cleanCurrencyInput('1,234,567.89')).toBe('1234567.89');
    expect(cleanCurrencyInput(1234.56)).toBe('1234.56');
  });

  it('returns "0" for empty/nullish input', () => {
    expect(cleanCurrencyInput('')).toBe('0');
    expect(cleanCurrencyInput(undefined)).toBe('0');
    expect(cleanCurrencyInput(null)).toBe('0');
  });
});
