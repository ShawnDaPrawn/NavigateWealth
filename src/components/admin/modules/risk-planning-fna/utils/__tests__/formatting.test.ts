import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercentage } from '../formatting';

describe('risk-planning formatting.formatCurrency', () => {
  it('formats whole rands with comma separators and no decimals', () => {
    expect(formatCurrency(1234567)).toBe('R1,234,567');
    expect(formatCurrency(0)).toBe('R0');
  });

  it('rounds to the nearest rand', () => {
    expect(formatCurrency(1234.6)).toBe('R1,235');
  });

  it('prefixes a minus sign for negatives', () => {
    expect(formatCurrency(-1000)).toBe('-R1,000');
  });

  it('returns R0 for NaN / null / undefined', () => {
    expect(formatCurrency(NaN)).toBe('R0');
    expect(formatCurrency(undefined as unknown as number)).toBe('R0');
    expect(formatCurrency(null as unknown as number)).toBe('R0');
  });
});

describe('risk-planning formatting.formatPercentage', () => {
  it('formats with one decimal by default', () => {
    expect(formatPercentage(5)).toBe('5.0%');
  });

  it('honours a custom precision and rounds', () => {
    expect(formatPercentage(12.345, 2)).toBe('12.35%');
    expect(formatPercentage(7, 0)).toBe('7%');
  });
});
