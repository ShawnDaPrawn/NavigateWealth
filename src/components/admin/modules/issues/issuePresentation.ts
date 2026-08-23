/**
 * Presentation vocabulary for the Issues module: severity/priority/status
 * tones, human labels, date/age formatting, and the pure snapshot merge
 * applied after a workflow save. No React, no state — plain functions and
 * lookup tables shared by IssuesModule and its panel components.
 */
import {
  applyQualityIssueWorkflow,
  summarizeQualityIssues,
} from '../../../../shared/quality/qualityIssues';
import type {
  QualityIssueAlert,
  QualityIssueCategory,
  QualityIssuePriority,
  QualityIssueSeverity,
  QualityIssueSnapshot,
  QualityIssueSource,
  QualityIssueStatus,
  QualityIssueWorkflowState,
} from './types';

export const severityTone: Record<QualityIssueSeverity, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const priorityTone: Record<QualityIssuePriority, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const statusTone: Record<QualityIssueStatus, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const sourceLabels: Record<QualityIssueSource, string> = {
  build: 'Build',
  test: 'Tests',
  audit: 'Security Audit',
  accessibility: 'Accessibility',
  'runtime-client': 'Client Runtime',
  'runtime-server': 'Server Runtime',
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

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const STALE_FEED_MS = 36 * ONE_HOUR_MS;

export function formatDate(value?: string) {
  if (!value) return 'Not run yet';
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function getAgeLabel(value?: string) {
  if (!value) return 'No data yet';

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown age';

  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < ONE_HOUR_MS) return 'Updated less than 1 hour ago';
  if (diff < ONE_DAY_MS) {
    const hours = Math.floor(diff / ONE_HOUR_MS);
    return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(diff / ONE_DAY_MS);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago`;
}

export function isStale(value?: string) {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return !Number.isFinite(timestamp) || Date.now() - timestamp > STALE_FEED_MS;
}

export function formatCvssScore(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : null;
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

export function alertSeverityTone(alert: QualityIssueAlert) {
  return alert.severity === 'critical'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';
}
