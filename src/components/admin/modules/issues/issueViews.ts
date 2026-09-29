/**
 * What the Issue Manager list shows: the four views its summary cards switch
 * between, the search and dropdown filters, the urgency sort, and the summary
 * behind the "needs attention" banner. Pure functions over the snapshot's
 * issues, so a card's count and the rows it opens can never disagree.
 */
import {
  getQualityIssueAutomationAlerts,
  isQualityIssuePastResponseSla,
} from '../../../../shared/quality/qualityIssues';
import { describeStoredIssue } from '../../../../shared/quality/issueLabels';
import type { QualityIssue, QualityIssuePriority, QualityIssueSource } from './types';

export type IssueView = 'unresolved' | 'unassigned' | 'overdue' | 'resolved';

export const ISSUE_VIEWS: IssueView[] = ['unresolved', 'unassigned', 'overdue', 'resolved'];

export interface IssueFilters {
  search: string;
  source: 'all' | QualityIssueSource;
  priority: 'all' | QualityIssuePriority;
}

export const EMPTY_ISSUE_FILTERS: IssueFilters = { search: '', source: 'all', priority: 'all' };

/** Every view but Resolved is a subset of Unresolved, so the counts nest. */
export function matchesIssueView(issue: QualityIssue, view: IssueView, now = new Date()): boolean {
  switch (view) {
    case 'unresolved':
      return issue.status !== 'resolved';
    case 'unassigned':
      return issue.status !== 'resolved' && !issue.ownerName;
    case 'overdue':
      return isQualityIssuePastResponseSla(issue, now);
    case 'resolved':
      return issue.status === 'resolved';
  }
}

export function countIssueViews(
  issues: QualityIssue[],
  now = new Date(),
): Record<IssueView, number> {
  return {
    unresolved: issues.filter((issue) => matchesIssueView(issue, 'unresolved', now)).length,
    unassigned: issues.filter((issue) => matchesIssueView(issue, 'unassigned', now)).length,
    overdue: issues.filter((issue) => matchesIssueView(issue, 'overdue', now)).length,
    resolved: issues.filter((issue) => matchesIssueView(issue, 'resolved', now)).length,
  };
}

export function matchesIssueSearch(issue: QualityIssue, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  const labels = describeStoredIssue(issue);
  return [
    labels.title,
    labels.summary,
    labels.text,
    labels.area,
    issue.route,
    issue.filePath,
    issue.component,
    issue.ruleId,
    issue.packageName,
    issue.advisoryId,
    issue.cve,
    issue.ownerName,
    issue.linkedTaskTitle,
  ].some((value) => value?.toLowerCase().includes(needle));
}

/**
 * Applies the search and dropdown filters. `ignore` leaves one dropdown out,
 * which is how each dropdown counts its own options: the count beside
 * "Browser" answers "how many would I see if I picked it", given everything
 * else that is set.
 */
export function filterIssues(
  issues: QualityIssue[],
  filters: IssueFilters,
  ignore?: 'source' | 'priority',
): QualityIssue[] {
  return issues.filter(
    (issue) =>
      (ignore === 'source' || filters.source === 'all' || issue.source === filters.source) &&
      (ignore === 'priority' ||
        filters.priority === 'all' ||
        issue.priority === filters.priority) &&
      matchesIssueSearch(issue, filters.search),
  );
}

export function hasActiveIssueFilters(filters: IssueFilters): boolean {
  return filters.search.trim() !== '' || filters.source !== 'all' || filters.priority !== 'all';
}

export function countIssuesBy<K extends 'source' | 'priority'>(
  issues: QualityIssue[],
  key: K,
): Partial<Record<QualityIssue[K], number>> {
  const counts: Partial<Record<QualityIssue[K], number>> = {};
  for (const issue of issues) {
    counts[issue[key]] = (counts[issue[key]] ?? 0) + 1;
  }
  return counts;
}

const PRIORITY_RANK: Record<QualityIssuePriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function timeOf(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * Issues the automation would escalate come first (so the rows the banner
 * talks about sit at the top), then by priority, then most recently seen.
 */
export function sortIssuesByUrgency(issues: QualityIssue[], now = new Date()): QualityIssue[] {
  const escalated = new Set(
    getQualityIssueAutomationAlerts(issues, now).map((alert) => alert.fingerprint),
  );

  return [...issues].sort(
    (a, b) =>
      Number(escalated.has(b.fingerprint)) - Number(escalated.has(a.fingerprint)) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      timeOf(b.lastSeenAt) - timeOf(a.lastSeenAt),
  );
}

export interface IssueEscalationSummary {
  /** Distinct issues with at least one automation alert. */
  issues: number;
  critical: number;
  overdue: number;
  reopened: number;
  fixAvailable: number;
  /** Escalated issues with no remediation task yet — what "Create tasks" would act on. */
  withoutTask: number;
  /** True when any alert is critical, which colours the banner red rather than amber. */
  hasCritical: boolean;
}

/**
 * Summarises the same alerts the server-side automation acts on. Each issue
 * raises at most one alert of each type, so counting alerts by type counts
 * issues.
 */
export function summarizeIssueEscalations(
  issues: QualityIssue[],
  now = new Date(),
): IssueEscalationSummary {
  const alerts = getQualityIssueAutomationAlerts(issues, now);
  const escalated = new Set(alerts.map((alert) => alert.fingerprint));
  const countType = (type: (typeof alerts)[number]['type']) =>
    alerts.filter((alert) => alert.type === type).length;

  return {
    issues: escalated.size,
    critical: countType('critical-open'),
    overdue: countType('past-response-target'),
    reopened: countType('reopened-regression'),
    fixAvailable: countType('security-fix-available'),
    withoutTask: issues.filter((issue) => escalated.has(issue.fingerprint) && !issue.linkedTaskId)
      .length,
    hasCritical: alerts.some((alert) => alert.severity === 'critical'),
  };
}
