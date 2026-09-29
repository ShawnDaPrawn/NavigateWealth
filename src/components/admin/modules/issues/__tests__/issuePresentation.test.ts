import { describe, expect, it } from 'vitest';
import {
  describeReportSource,
  describeResponseTargets,
  formatHours,
  formatIssueLocation,
  formatRelativeTime,
  isStale,
  pluralize,
} from '../issuePresentation';

const NOW = new Date('2026-09-28T12:00:00.000Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('reads naturally from seconds to weeks', () => {
    expect(formatRelativeTime(ago(20_000), NOW)).toBe('just now');
    expect(formatRelativeTime(ago(5 * MINUTE), NOW)).toBe('5 min ago');
    expect(formatRelativeTime(ago(HOUR), NOW)).toBe('1 hour ago');
    expect(formatRelativeTime(ago(3 * HOUR), NOW)).toBe('3 hours ago');
    expect(formatRelativeTime(ago(DAY), NOW)).toBe('1 day ago');
    expect(formatRelativeTime(ago(12 * DAY), NOW)).toBe('12 days ago');
  });

  it('falls back to a date after a month', () => {
    expect(formatRelativeTime(ago(45 * DAY), NOW)).toMatch(/2026/);
  });

  it('handles missing and invalid values', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('Never');
    expect(formatRelativeTime('not a date', NOW)).toBe('Unknown');
  });
});

describe('isStale', () => {
  it('flags a missing or unparseable report time', () => {
    expect(isStale(undefined)).toBe(true);
    expect(isStale('not a date')).toBe(true);
  });

  it('treats a report from the last day and a half as fresh', () => {
    expect(isStale(new Date(Date.now() - HOUR).toISOString())).toBe(false);
    expect(isStale(new Date(Date.now() - 2 * DAY).toISOString())).toBe(true);
  });
});

describe('describeReportSource', () => {
  it('shows a pull request checkout as the pull request', () => {
    expect(describeReportSource('368/merge')).toBe('PR #368');
  });

  it('keeps a branch name as it is', () => {
    expect(describeReportSource('main')).toBe('main');
    expect(describeReportSource(undefined)).toBeNull();
  });
});

describe('formatIssueLocation', () => {
  it('joins file, line and column', () => {
    expect(formatIssueLocation({ filePath: 'src/a.tsx', line: 12, column: 4 })).toBe(
      'src/a.tsx:12:4',
    );
    expect(formatIssueLocation({ filePath: 'src/a.tsx', line: 12 })).toBe('src/a.tsx:12');
    expect(formatIssueLocation({ filePath: 'src/a.tsx' })).toBe('src/a.tsx');
  });

  it('returns null without a file', () => {
    expect(formatIssueLocation({})).toBeNull();
  });
});

describe('response targets', () => {
  it('shows short targets in hours and long ones in days', () => {
    expect(formatHours(24)).toBe('24 hours');
    expect(formatHours(48)).toBe('48 hours');
    expect(formatHours(120)).toBe('5 days');
  });

  it('describes every priority from the shared table', () => {
    expect(describeResponseTargets()).toBe(
      'critical 24 hours, high 48 hours, medium 5 days, low 10 days',
    );
  });
});

describe('pluralize', () => {
  it('picks the right form and formats the count', () => {
    expect(pluralize(1, 'task')).toBe('1 task');
    expect(pluralize(3, 'task')).toBe('3 tasks');
    expect(pluralize(1200, 'time')).toMatch(/^1.200 times$/);
  });
});
