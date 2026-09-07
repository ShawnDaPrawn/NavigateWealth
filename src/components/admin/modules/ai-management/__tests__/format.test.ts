import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, plural } from '../format';
import { importanceFromPriority, priorityFromImportance } from '../constants';

describe('format helpers', () => {
  it('formats a valid ISO date and falls back to a dash otherwise', () => {
    expect(formatDate('2026-03-05T10:00:00Z')).toMatch(/2026/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('2026-03-05T10:00:00Z')).toMatch(/2026/);
  });

  it('pluralises with an optional irregular form', () => {
    expect(plural(1, 'entry', 'entries')).toBe('1 entry');
    expect(plural(2, 'entry', 'entries')).toBe('2 entries');
    expect(plural(0, 'source')).toBe('0 sources');
  });
});

describe('importance <-> priority', () => {
  it('round-trips the four named levels', () => {
    for (const level of ['low', 'normal', 'high', 'essential'] as const) {
      expect(importanceFromPriority(priorityFromImportance(level))).toBe(level);
    }
  });

  it('buckets arbitrary stored priorities sensibly', () => {
    expect(importanceFromPriority(undefined)).toBe('normal');
    expect(importanceFromPriority(1)).toBe('low');
    expect(importanceFromPriority(4)).toBe('normal');
    expect(importanceFromPriority(7)).toBe('normal');
    expect(importanceFromPriority(9)).toBe('high');
    expect(importanceFromPriority(10)).toBe('essential');
  });
});
