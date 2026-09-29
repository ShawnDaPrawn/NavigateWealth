/**
 * Presentation vocabulary for the Issues module: severity/priority/status
 * tones, human labels, date/age formatting, and the pure snapshot merge
 * applied after a workflow save. No React, no state — plain functions and
 * lookup tables shared by IssuesModule and its components.
 */
import { CheckCircle2, CircleDot, Clock, UserX, type LucideIcon } from 'lucide-react';
import {
  applyQualityIssueWorkflow,
  QUALITY_ISSUE_PRIORITIES,
  QUALITY_ISSUE_RESPONSE_SLA_HOURS,
  summarizeQualityIssues,
} from '../../../../shared/quality/qualityIssues';
import type { IssueView } from './issueViews';
import type {
  QualityIssue,
  QualityIssueCategory,
  QualityIssuePriority,
  QualityIssueSeverity,
  QualityIssueSnapshot,
  QualityIssueSource,
  QualityIssueStatus,
  QualityIssueWorkflowState,
} from './types';

export const priorityTone: Record<QualityIssuePriority, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const statusTone: Record<QualityIssueStatus, string> = {
  open: 'bg-slate-50 text-slate-700 border-slate-200',
  acknowledged: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Where the issue came from, in words an admin recognises. */
export const sourceLabels: Record<QualityIssueSource, string> = {
  build: 'Build',
  test: 'Tests',
  audit: 'Security audit',
  accessibility: 'Accessibility',
  'runtime-client': 'Browser',
  'runtime-server': 'Server',
};

export const categoryLabels: Record<QualityIssueCategory, string> = {
  build: 'Build',
  test: 'Test',
  security: 'Security',
  accessibility: 'Accessibility',
  runtime: 'Runtime',
  configuration: 'Configuration',
  unknown: 'Unknown',
};

export const severityLabels: Record<QualityIssueSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

export const priorityLabels: Record<QualityIssuePriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const statusLabels: Record<QualityIssueStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

/** The summary cards that double as the list's view switcher. */
export const issueViewConfig: Record<
  IssueView,
  {
    label: string;
    listTitle: string;
    description: string;
    emptyTitle: string;
    emptyText: string;
    icon: LucideIcon;
    iconTone: string;
  }
> = {
  unresolved: {
    label: 'Unresolved',
    listTitle: 'Unresolved issues',
    description: 'Open or acknowledged',
    emptyTitle: 'Nothing unresolved',
    emptyText: 'New errors and failed checks will appear here automatically.',
    icon: CircleDot,
    iconTone: 'bg-purple-50 text-purple-600',
  },
  unassigned: {
    label: 'Unassigned',
    listTitle: 'Unassigned issues',
    description: 'Unresolved with no owner',
    emptyTitle: 'Every issue has an owner',
    emptyText: 'Unresolved issues without an owner will appear here.',
    icon: UserX,
    iconTone: 'bg-amber-50 text-amber-600',
  },
  overdue: {
    label: 'Overdue',
    listTitle: 'Overdue issues',
    description: 'Past their response target',
    emptyTitle: 'Nothing is overdue',
    emptyText: `Every unresolved issue is within its response target (${describeResponseTargets()}).`,
    icon: Clock,
    iconTone: 'bg-red-50 text-red-600',
  },
  resolved: {
    label: 'Resolved',
    listTitle: 'Resolved issues',
    description: 'Fixed and closed',
    emptyTitle: 'Nothing resolved yet',
    emptyText: 'Issues you mark as resolved will appear here.',
    icon: CheckCircle2,
    iconTone: 'bg-green-50 text-green-600',
  },
};

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const STALE_FEED_MS = 36 * ONE_HOUR_MS;

export function formatDate(value?: string) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago"; a date past a month. */
export function formatRelativeTime(value?: string, now = Date.now()) {
  if (!value) return 'Never';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown';

  const diff = Math.max(0, now - timestamp);
  if (diff < ONE_MINUTE_MS) return 'just now';
  if (diff < ONE_HOUR_MS) return `${Math.floor(diff / ONE_MINUTE_MS)} min ago`;
  if (diff < ONE_DAY_MS) {
    const hours = Math.floor(diff / ONE_HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diff < 30 * ONE_DAY_MS) {
    const days = Math.floor(diff / ONE_DAY_MS);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(new Date(value));
}

export function formatHours(hours: number) {
  if (hours % 24 === 0 && hours > 48) return `${hours / 24} days`;
  return `${hours} hours`;
}

/** "critical 24 hours, high 48 hours, medium 5 days, low 10 days" */
export function describeResponseTargets() {
  return QUALITY_ISSUE_PRIORITIES.map(
    (priority) => `${priority} ${formatHours(QUALITY_ISSUE_RESPONSE_SLA_HOURS[priority])}`,
  ).join(', ');
}

export function isStale(value?: string) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_FEED_MS;
}

/**
 * GitHub names a pull request's CI checkout `<number>/merge`, which reads as
 * noise on the page; show it as the pull request it is.
 */
export function describeReportSource(branch?: string) {
  if (!branch) return null;
  const pullRequest = branch.match(/^(\d+)\/merge$/);
  return pullRequest ? `PR #${pullRequest[1]}` : branch;
}

export function formatIssueLocation(issue: Pick<QualityIssue, 'filePath' | 'line' | 'column'>) {
  if (!issue.filePath) return null;
  const position = [issue.line, issue.column].filter((part) => typeof part === 'number').join(':');
  return position ? `${issue.filePath}:${position}` : issue.filePath;
}

export function formatCvssScore(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : null;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count.toLocaleString('en-ZA')} ${count === 1 ? singular : plural}`;
}

export function mergeWorkflowIntoSnapshot(
  snapshot: QualityIssueSnapshot | null,
  workflow: QualityIssueWorkflowState,
): QualityIssueSnapshot | null {
  if (!snapshot) return snapshot;

  const issues = snapshot.issues.map((issue) =>
    issue.fingerprint === workflow.fingerprint ? applyQualityIssueWorkflow(issue, workflow) : issue,
  );

  return {
    ...snapshot,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}
