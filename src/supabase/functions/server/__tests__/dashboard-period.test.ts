/** The dashboard's period windows: This month, Last 30 days, This year. */
import { describe, expect, it } from 'vitest';
import { countInPeriod, parseDashboardPeriod, periodWindow } from '../dashboard-period.ts';

const now = new Date(2026, 10, 13, 12); // 13 Nov 2026

describe('periodWindow + countInPeriod', () => {
  const dates = [
    new Date(2026, 10, 2).toISOString(), // this month
    new Date(2026, 9, 20).toISOString(), // last month, within 30 days
    new Date(2026, 9, 1).toISOString(), // last month, 43 days ago
    new Date(2026, 1, 1).toISOString(), // this year
    new Date(2025, 5, 1).toISOString(), // last year, before 13 Nov
    new Date(2025, 11, 1).toISOString(), // last year, after 13 Nov
    'not a date',
    undefined,
  ];

  it('this month compares with last month', () => {
    expect(countInPeriod(dates, periodWindow('month', now))).toEqual({ current: 1, previous: 2 });
  });

  it('last 30 days compares with the 30 before', () => {
    expect(countInPeriod(dates, periodWindow('30d', now))).toEqual({ current: 2, previous: 1 });
  });

  it('this year compares with last year to the same date', () => {
    expect(countInPeriod(dates, periodWindow('year', now))).toEqual({ current: 4, previous: 1 });
  });
});

describe('parseDashboardPeriod', () => {
  it('defaults to month and rejects anything else', () => {
    expect(parseDashboardPeriod(undefined)).toBe('month');
    expect(parseDashboardPeriod('year')).toBe('year');
    expect(parseDashboardPeriod('decade')).toBeNull();
  });
});
