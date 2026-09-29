/**
 * issueViews — the view, filter, sort and escalation logic behind the Issue
 * Manager list. The cards' counts and the rows under them come from the same
 * functions, so these tests pin what each view means.
 */
import { describe, expect, it } from 'vitest';
import {
  countIssuesBy,
  countIssueViews,
  EMPTY_ISSUE_FILTERS,
  filterIssues,
  hasActiveIssueFilters,
  matchesIssueSearch,
  matchesIssueView,
  sortIssuesByUrgency,
  summarizeIssueEscalations,
} from '../issueViews';
import type { QualityIssue } from '../types';

const NOW = new Date('2026-09-28T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

let sequence = 0;
function makeIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  sequence += 1;
  return {
    id: `issue-${sequence}`,
    fingerprint: `fp-${sequence}`,
    source: 'runtime-client',
    category: 'runtime',
    priority: 'medium',
    severity: 'error',
    status: 'open',
    title: `Issue ${sequence}`,
    message: 'Something failed',
    firstSeenAt: hoursAgo(1),
    lastSeenAt: hoursAgo(1),
    occurrences: 1,
    ...overrides,
  };
}

describe('matchesIssueView / countIssueViews', () => {
  const open = makeIssue();
  const owned = makeIssue({ status: 'acknowledged', ownerName: 'Shawn' });
  const ackUnowned = makeIssue({ status: 'acknowledged' });
  const overdue = makeIssue({ priority: 'critical', firstSeenAt: hoursAgo(30) });
  const resolved = makeIssue({ status: 'resolved', firstSeenAt: hoursAgo(500) });
  const issues = [open, owned, ackUnowned, overdue, resolved];

  it('treats open and acknowledged as unresolved', () => {
    expect(issues.filter((issue) => matchesIssueView(issue, 'unresolved', NOW))).toEqual([
      open,
      owned,
      ackUnowned,
      overdue,
    ]);
  });

  it('counts an acknowledged issue with no owner as unassigned', () => {
    expect(matchesIssueView(ackUnowned, 'unassigned', NOW)).toBe(true);
    expect(matchesIssueView(owned, 'unassigned', NOW)).toBe(false);
  });

  it('never counts a resolved issue as unassigned or overdue', () => {
    expect(matchesIssueView(resolved, 'unassigned', NOW)).toBe(false);
    expect(matchesIssueView(resolved, 'overdue', NOW)).toBe(false);
    expect(matchesIssueView(resolved, 'resolved', NOW)).toBe(true);
  });

  it('marks issues past their priority response target as overdue', () => {
    expect(matchesIssueView(overdue, 'overdue', NOW)).toBe(true);
    expect(matchesIssueView(open, 'overdue', NOW)).toBe(false);
  });

  it('counts every view in one pass, with the unresolved views nested', () => {
    expect(countIssueViews(issues, NOW)).toEqual({
      unresolved: 4,
      unassigned: 3,
      overdue: 1,
      resolved: 1,
    });
  });
});

describe('matchesIssueSearch', () => {
  const issue = makeIssue({
    title: 'TypeError',
    summary: 'The Clients page crashed while showing policies.',
    area: 'Admin · Clients',
    filePath: 'src/components/PolicyList.tsx',
    packageName: 'axios',
    ownerName: 'Shawn',
  });

  it('matches everything when the query is blank', () => {
    expect(matchesIssueSearch(issue, '   ')).toBe(true);
  });

  it('matches title, summary, area, file, package and owner case-insensitively', () => {
    for (const query of ['typeerror', 'CRASHED', 'clients', 'PolicyList', 'axios', 'shawn']) {
      expect(matchesIssueSearch(issue, query)).toBe(true);
    }
  });

  it('rejects a query that appears nowhere', () => {
    expect(matchesIssueSearch(issue, 'calendar')).toBe(false);
  });
});

describe('filterIssues', () => {
  const browserHigh = makeIssue({ source: 'runtime-client', priority: 'high', title: 'Alpha' });
  const serverHigh = makeIssue({ source: 'runtime-server', priority: 'high', title: 'Beta' });
  const serverLow = makeIssue({ source: 'runtime-server', priority: 'low', title: 'Gamma' });
  const issues = [browserHigh, serverHigh, serverLow];

  it('returns everything with no filters set', () => {
    expect(filterIssues(issues, EMPTY_ISSUE_FILTERS)).toEqual(issues);
    expect(hasActiveIssueFilters(EMPTY_ISSUE_FILTERS)).toBe(false);
  });

  it('combines source, priority and search', () => {
    const filters = { search: 'beta', source: 'runtime-server', priority: 'high' } as const;
    expect(filterIssues(issues, filters)).toEqual([serverHigh]);
    expect(hasActiveIssueFilters(filters)).toBe(true);
  });

  it('can leave one dropdown out, so each dropdown counts its own options', () => {
    const filters = { search: '', source: 'runtime-server', priority: 'high' } as const;
    expect(countIssuesBy(filterIssues(issues, filters, 'source'), 'source')).toEqual({
      'runtime-client': 1,
      'runtime-server': 1,
    });
    expect(countIssuesBy(filterIssues(issues, filters, 'priority'), 'priority')).toEqual({
      high: 1,
      low: 1,
    });
  });
});

describe('sortIssuesByUrgency', () => {
  it('puts escalated issues first, then priority, then most recently seen', () => {
    const lowRecent = makeIssue({ priority: 'low', lastSeenAt: hoursAgo(1) });
    const highOld = makeIssue({ priority: 'high', lastSeenAt: hoursAgo(10) });
    const highRecent = makeIssue({ priority: 'high', lastSeenAt: hoursAgo(2) });
    const reopenedMedium = makeIssue({ priority: 'medium', reopenedAt: hoursAgo(3) });

    const sorted = sortIssuesByUrgency([lowRecent, highOld, highRecent, reopenedMedium], NOW);
    expect(sorted).toEqual([reopenedMedium, highRecent, highOld, lowRecent]);
  });

  it('does not reorder the array it was given', () => {
    const issues = [makeIssue({ priority: 'low' }), makeIssue({ priority: 'critical' })];
    const original = [...issues];
    sortIssuesByUrgency(issues, NOW);
    expect(issues).toEqual(original);
  });
});

describe('summarizeIssueEscalations', () => {
  it('reports nothing when no issue raises an alert', () => {
    expect(summarizeIssueEscalations([makeIssue(), makeIssue()], NOW)).toMatchObject({
      issues: 0,
      withoutTask: 0,
      hasCritical: false,
    });
  });

  it('counts each reason and the escalated issues still missing a task', () => {
    const critical = makeIssue({ priority: 'critical' });
    const reopened = makeIssue({ reopenedAt: hoursAgo(1), linkedTaskId: 'task-1' });
    const fixable = makeIssue({
      source: 'audit',
      category: 'security',
      priority: 'medium',
      fixAvailable: true,
    });
    const overdueLow = makeIssue({ priority: 'low', firstSeenAt: hoursAgo(300) });
    const resolved = makeIssue({ status: 'resolved', priority: 'critical' });

    expect(
      summarizeIssueEscalations([critical, reopened, fixable, overdueLow, resolved], NOW),
    ).toEqual({
      issues: 4,
      critical: 1,
      overdue: 1,
      reopened: 1,
      fixAvailable: 1,
      withoutTask: 3,
      hasCritical: true,
    });
  });

  it('is not critical when only warning-level alerts are raised', () => {
    const overdueLow = makeIssue({ priority: 'low', firstSeenAt: hoursAgo(300) });
    expect(summarizeIssueEscalations([overdueLow], NOW).hasCritical).toBe(false);
  });
});
