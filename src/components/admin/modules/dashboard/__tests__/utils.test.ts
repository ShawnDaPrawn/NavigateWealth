/**
 * dashboard/utils — unit tests (Phase 4 coverage push).
 *
 * The dashboard's pure helpers: KPI value formatting, growth/percentage maths,
 * trend + task-priority mapping, relative-time rendering, and the date/grouping
 * utilities. Time-based helpers use offsets from now so they stay deterministic.
 */
import { describe, expect, it } from 'vitest';
import {
  formatKPIValue,
  calculateGrowth,
  calculatePercentageOfTotal,
  getTrendDirection,
  getPriorityVariant,
  getPriorityLabel,
  getRelativeTime,
  isToday,
  isOverdue,
  isTaskOverdue,
  groupBy,
  sortByPriority,
  isHighPriority,
} from '../utils';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

describe('formatKPIValue', () => {
  it('returns the raw value when not numeric', () => {
    expect(formatKPIValue('abc', 'number')).toBe('abc');
  });
  it('formats by the requested kind', () => {
    expect(typeof formatKPIValue(1234, 'number')).toBe('string');
    expect(formatKPIValue(1234, 'currency')).toMatch(/R|1/);
    expect(formatKPIValue(50, 'percentage')).toMatch(/%/);
  });
});

describe('growth + percentage', () => {
  it('calculateGrowth handles a normal change and zero-base cases', () => {
    expect(calculateGrowth(150, 100)).toBe(50);
    expect(calculateGrowth(5, 0)).toBe(100);
    expect(calculateGrowth(0, 0)).toBe(0);
  });
  it('calculatePercentageOfTotal guards divide-by-zero', () => {
    expect(calculatePercentageOfTotal(25, 200)).toBe(12.5);
    expect(calculatePercentageOfTotal(25, 0)).toBe(0);
  });
});

describe('trend + priority helpers', () => {
  it('getTrendDirection maps the sign to up/down/neutral', () => {
    expect(getTrendDirection(5)).toBe('up');
    expect(getTrendDirection(-5)).toBe('down');
    expect(getTrendDirection(0)).toBe('neutral');
  });
  it('getPriorityVariant maps priorities to badge variants', () => {
    expect(getPriorityVariant('critical')).toBe('destructive');
    expect(getPriorityVariant('high')).toBe('default');
    expect(getPriorityVariant('medium')).toBe('secondary');
    expect(getPriorityVariant('low')).toBe('secondary');
  });
  it('getPriorityLabel capitalizes the priority', () => {
    expect(getPriorityLabel('high')).toBe('High');
  });
  it('isHighPriority is true only for high/critical', () => {
    expect(isHighPriority('high')).toBe(true);
    expect(isHighPriority('critical')).toBe(true);
    expect(isHighPriority('low')).toBe(false);
  });
  it('sortByPriority orders critical < high < medium < low', () => {
    const sorted = sortByPriority([
      { priority: 'low' as const },
      { priority: 'critical' as const },
      { priority: 'medium' as const },
      { priority: 'high' as const },
    ]);
    expect(sorted.map((t) => t.priority)).toEqual(['critical', 'high', 'medium', 'low']);
  });
});

describe('date helpers', () => {
  it('getRelativeTime renders just-now / minutes / hours / days', () => {
    expect(getRelativeTime(ago(10 * 1000))).toBe('just now');
    expect(getRelativeTime(ago(5 * 60 * 1000))).toBe('5 minutes ago');
    expect(getRelativeTime(ago(3 * 60 * 60 * 1000))).toBe('3 hours ago');
    expect(getRelativeTime(ago(2 * 24 * 60 * 60 * 1000))).toBe('2 days ago');
  });
  it('getRelativeTime falls back to an absolute date past a week', () => {
    expect(getRelativeTime(ago(10 * 24 * 60 * 60 * 1000))).not.toMatch(/ago|just now/);
  });
  it('getRelativeTime supports future times', () => {
    expect(getRelativeTime(new Date(Date.now() + 5 * 60 * 1000).toISOString())).toMatch(
      /^in \d+ minutes?$/,
    );
  });
  it('isToday is true for now and false for yesterday', () => {
    expect(isToday(new Date())).toBe(true);
    expect(isToday(ago(24 * 60 * 60 * 1000))).toBe(false);
  });
  it('isOverdue reflects the due date and ignores completed tasks', () => {
    expect(isOverdue(ago(60 * 1000))).toBe(true);
    expect(isOverdue(new Date(Date.now() + 60 * 1000))).toBe(false);
    expect(isOverdue(ago(60 * 1000), 'completed')).toBe(false);
  });
  it('isTaskOverdue delegates to the task fields', () => {
    expect(isTaskOverdue({ due_date: ago(60 * 1000), status: 'open' } as never)).toBe(true);
  });
});

describe('groupBy', () => {
  it('groups items by the key function', () => {
    const g = groupBy([{ t: 'a' }, { t: 'b' }, { t: 'a' }], (x) => x.t);
    expect(g.get('a')?.length).toBe(2);
    expect(g.get('b')?.length).toBe(1);
  });
});
