import { describe, expect, it } from 'vitest';
import {
  formatNumber,
  formatCurrency,
  formatCurrencyCompact,
  formatPercentage,
  formatDate,
  formatTime,
  formatDateTime,
  formatFileSize,
} from '../format';

describe('formatNumber', () => {
  it('adds comma thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(999)).toBe('999');
  });
  it('preserves a decimal part and handles negatives + NaN', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
    expect(formatNumber(-12345)).toBe('-12,345');
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatCurrency', () => {
  it('formats ZAR with the R symbol, commas and 2 decimals', () => {
    expect(formatCurrency(1234567.5)).toBe('R1,234,567.50');
    expect(formatCurrency(0)).toBe('R0.00');
    expect(formatCurrency(99.9)).toBe('R99.90');
  });
  it('handles negatives, NaN and a non-ZAR currency code', () => {
    expect(formatCurrency(-2500)).toBe('-R2,500.00');
    expect(formatCurrency(NaN)).toBe('R0.00');
    expect(formatCurrency(1000, 'USD')).toBe('USD1,000.00');
  });
});

describe('formatCurrencyCompact', () => {
  it('compacts into K / M / B with one decimal', () => {
    expect(formatCurrencyCompact(1500)).toBe('R1.5K');
    expect(formatCurrencyCompact(3_400_000)).toBe('R3.4M');
    expect(formatCurrencyCompact(5_600_000_000)).toBe('R5.6B');
    expect(formatCurrencyCompact(950)).toBe('R950');
  });
  it('handles negatives', () => {
    expect(formatCurrencyCompact(-2_000_000)).toBe('-R2.0M');
  });
});

describe('formatPercentage', () => {
  it('defaults to one decimal and respects an explicit precision', () => {
    expect(formatPercentage(12.34)).toBe('12.3%');
    expect(formatPercentage(50)).toBe('50.0%');
    expect(formatPercentage(12.345, 2)).toBe('12.35%');
    expect(formatPercentage(7, 0)).toBe('7%');
  });
});

describe('date helpers', () => {
  const d = new Date('2026-06-01T09:05:00Z');

  it('formatDate accepts a Date or an ISO string and returns a non-empty string', () => {
    expect(typeof formatDate(d)).toBe('string');
    expect(formatDate(d).length).toBeGreaterThan(0);
    // string and Date inputs for the same instant agree
    expect(formatDate('2026-06-01T09:05:00Z')).toBe(formatDate(d));
  });

  it('formatDate forwards Intl options', () => {
    const out = formatDate(d, { year: 'numeric', month: 'long', day: 'numeric' });
    expect(out).toMatch(/2026/);
  });

  it('formatTime returns a 2-digit hour:minute string by default', () => {
    expect(formatTime(d)).toMatch(/\d{2}:\d{2}/);
  });

  it('formatDateTime joins date and time with a space', () => {
    const out = formatDateTime(d);
    expect(out).toBe(`${formatDate(d)} ${formatTime(d)}`);
    expect(out).toContain(' ');
  });
});

describe('formatFileSize', () => {
  it('picks the largest fitting unit', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(512)).toBe('512 Bytes');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(2.34 * 1024 * 1024)).toBe('2.34 MB');
    expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe('3 GB');
  });
});
