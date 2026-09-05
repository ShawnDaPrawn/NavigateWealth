import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatNumber,
  formatRate,
  formatRelative,
  initials,
  parseEmailList,
  pluralize,
  ratePercent,
  subjectLengthHint,
  toDatetimeLocalValue,
} from '../format';

const NOW = new Date('2026-09-05T10:00:00.000Z').getTime();

describe('formatRelative', () => {
  it('reads naturally in both directions', () => {
    expect(formatRelative('2026-09-05T09:59:50.000Z', NOW)).toBe('just now');
    expect(formatRelative('2026-09-05T09:56:00.000Z', NOW)).toBe('4 min ago');
    expect(formatRelative('2026-09-05T07:00:00.000Z', NOW)).toBe('3 h ago');
    expect(formatRelative('2026-09-04T09:00:00.000Z', NOW)).toBe('yesterday');
    expect(formatRelative('2026-09-02T10:00:00.000Z', NOW)).toBe('3 days ago');
    expect(formatRelative('2026-09-05T12:00:00.000Z', NOW)).toBe('in 2 h');
    expect(formatRelative('2026-09-06T11:00:00.000Z', NOW)).toBe('tomorrow');
  });

  it('falls back to the absolute date beyond a week and to a label when empty', () => {
    expect(formatRelative('2026-08-01T10:00:00.000Z', NOW)).toBe(formatDate('2026-08-01'));
    expect(formatRelative(null, NOW)).toBe('never');
    expect(formatRelative('garbage', NOW, '—')).toBe('—');
  });
});

describe('rates and counts', () => {
  it('never divides by zero', () => {
    expect(formatRate(5, 0)).toBe('—');
    expect(ratePercent(5, 0)).toBe(0);
  });

  it('formats rates without trailing zeros and clamps percentages', () => {
    expect(formatRate(1, 4)).toBe('25%');
    expect(formatRate(1, 3)).toBe('33.3%');
    expect(ratePercent(7, 5)).toBe(100);
  });

  it('pluralises with grouped numbers', () => {
    expect(pluralize(1, 'subscriber')).toBe('1 subscriber');
    expect(pluralize(2, 'subscriber')).toBe('2 subscribers');
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString('en-ZA'));
    expect(formatNumber(null)).toBe('0');
  });
});

describe('composer helpers', () => {
  it('advises on subject length', () => {
    expect(subjectLengthHint('').tone).toBe('empty');
    expect(subjectLengthHint('Your September update').tone).toBe('ok');
    expect(subjectLengthHint('x'.repeat(61)).tone).toBe('warn');
  });

  it('derives initials', () => {
    expect(initials('Navigate Wealth')).toBe('NW');
    expect(initials('  ')).toBe('?');
  });

  it('parses and de-duplicates a free-text address list', () => {
    const parsed = parseEmailList('A@x.co, b@x.co; a@x.co not-an-email');
    expect(parsed.valid).toEqual(['a@x.co', 'b@x.co']);
    expect(parsed.invalid).toEqual(['not-an-email']);
  });

  it('produces datetime-local values in local time', () => {
    const date = new Date(2026, 8, 5, 8, 30);
    expect(toDatetimeLocalValue(date)).toBe('2026-09-05T08:30');
  });
});
