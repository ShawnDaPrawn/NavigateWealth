export type QualityIssueSeverity = 'error' | 'warning' | 'info';

export type QualityIssueCategory =
  | 'build'
  | 'test'
  | 'security'
  | 'accessibility'
  | 'runtime'
  | 'configuration'
  | 'unknown';

export type QualityIssuePriority = 'critical' | 'high' | 'medium' | 'low';

export type QualityIssueSource =
  | 'build'
  | 'test'
  | 'audit'
  | 'accessibility'
  | 'runtime-client'
  | 'runtime-server';

export type QualityIssueStatus = 'open' | 'acknowledged' | 'resolved';

export type QualityIssueAlertType =
  | 'critical-open'
  | 'past-response-target'
  | 'reopened-regression'
  | 'security-fix-available';

export type QualityIssueAlertSeverity = 'critical' | 'warning';

export interface QualityIssueAlert {
  id: string;
  fingerprint: string;
  type: QualityIssueAlertType;
  severity: QualityIssueAlertSeverity;
  title: string;
  message: string;
  actionLabel: string;
  createdAt: string;
}

export interface QualityIssueAutomationRun {
  runAt: string;
  runBy: string;
  activeAlerts: number;
  criticalAlerts: number;
  tasksCreated: number;
  tasksLinked: number;
  alerts: QualityIssueAlert[];
}

export interface QualityIssueWorkflowState {
  fingerprint: string;
  status: QualityIssueStatus;
  ownerName?: string;
  statusNote?: string;
  resolutionEvidence?: string;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
  workflowUpdatedAt?: string;
  workflowUpdatedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  reopenedAt?: string;
  reopenedFromResolvedAt?: string;
  regressionCount?: number;
}

export interface QualityIssueWorkflowUpdate {
  fingerprint: string;
  status?: QualityIssueStatus;
  ownerName?: string | null;
  statusNote?: string | null;
  resolutionEvidence?: string | null;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
}

export interface QualityIssue {
  id: string;
  source: QualityIssueSource;
  category: QualityIssueCategory;
  priority: QualityIssuePriority;
  fingerprint: string;
  severity: QualityIssueSeverity;
  status: QualityIssueStatus;
  title: string;
  message: string;
  ownerName?: string;
  statusNote?: string;
  resolutionEvidence?: string;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
  workflowUpdatedAt?: string;
  workflowUpdatedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  reopenedAt?: string;
  reopenedFromResolvedAt?: string;
  regressionCount?: number;
  component?: string;
  environment?: string;
  detectedBy?: string;
  packageName?: string;
  packageVersion?: string;
  vulnerableRange?: string;
  fixVersion?: string;
  advisoryId?: string;
  cve?: string;
  cvssScore?: number;
  referenceUrl?: string;
  fixAvailable?: boolean;
  filePath?: string;
  line?: number;
  column?: number;
  ruleId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
  runUrl?: string;
}

export interface QualityIssueSummary {
  total: number;
  open: number;
  errors: number;
  warnings: number;
  bySource: Record<QualityIssueSource, number>;
  byCategory: Record<QualityIssueCategory, number>;
  byPriority: Record<QualityIssuePriority, number>;
}

export interface QualityIssueSnapshot {
  generatedAt: string;
  runId?: string;
  runUrl?: string;
  branch?: string;
  commitSha?: string;
  issues: QualityIssue[];
  summary: QualityIssueSummary;
  automation?: QualityIssueAutomationRun;
}

export const QUALITY_ISSUE_SOURCES: QualityIssueSource[] = [
  'build',
  'test',
  'audit',
  'accessibility',
  'runtime-client',
  'runtime-server',
];

export const QUALITY_ISSUE_CATEGORIES: QualityIssueCategory[] = [
  'build',
  'test',
  'security',
  'accessibility',
  'runtime',
  'configuration',
  'unknown',
];

export const QUALITY_ISSUE_PRIORITIES: QualityIssuePriority[] = [
  'critical',
  'high',
  'medium',
  'low',
];

export const QUALITY_ISSUE_RESPONSE_SLA_HOURS: Record<QualityIssuePriority, number> = {
  critical: 24,
  high: 48,
  medium: 120,
  low: 240,
};

function normalizeKeyPart(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inferQualityIssueCategory(
  source: QualityIssueSource,
  ruleId?: string,
): QualityIssueCategory {
  if (source === 'audit') return 'security';
  if (source === 'accessibility') return 'accessibility';
  if (source === 'runtime-client' || source === 'runtime-server') return 'runtime';
  if (source === 'test') return 'test';
  if (source === 'build') {
    const normalizedRule = normalizeKeyPart(ruleId);
    if (normalizedRule.includes('env') || normalizedRule.includes('config')) {
      return 'configuration';
    }
    return 'build';
  }

  return 'unknown';
}

export function inferQualityIssuePriority(
  issue: Pick<QualityIssue, 'source' | 'severity' | 'category'> & { cvssScore?: number },
): QualityIssuePriority {
  if (issue.category === 'security' && typeof issue.cvssScore === 'number') {
    if (issue.cvssScore >= 9) return 'critical';
    if (issue.cvssScore >= 7) return 'high';
    if (issue.cvssScore >= 4) return 'medium';
    return 'low';
  }
  if (issue.severity === 'info') return 'low';
  if (issue.category === 'security' && issue.severity === 'error') return 'critical';
  if (issue.severity === 'error') return 'high';
  if (issue.category === 'security' || issue.source === 'runtime-server') return 'high';
  return 'medium';
}

export function createQualityIssueFingerprint(
  issue: Pick<
    QualityIssue,
    | 'source'
    | 'category'
    | 'ruleId'
    | 'title'
    | 'filePath'
    | 'line'
    | 'column'
    | 'packageName'
    | 'advisoryId'
    | 'cve'
  >,
): string {
  const parts = [
    issue.source,
    issue.category,
    issue.packageName,
    issue.advisoryId,
    issue.cve,
    issue.ruleId,
    issue.filePath,
    issue.line,
    issue.column,
    issue.title,
  ]
    .map(normalizeKeyPart)
    .filter(Boolean)
    .filter((part, index, values) => values.indexOf(part) === index);

  return parts.join(':').slice(0, 220) || `${issue.source}:${issue.category}`;
}

export function createEmptyQualityIssueSummary(): QualityIssueSummary {
  return {
    total: 0,
    open: 0,
    errors: 0,
    warnings: 0,
    bySource: {
      build: 0,
      test: 0,
      audit: 0,
      accessibility: 0,
      'runtime-client': 0,
      'runtime-server': 0,
    },
    byCategory: {
      build: 0,
      test: 0,
      security: 0,
      accessibility: 0,
      runtime: 0,
      configuration: 0,
      unknown: 0,
    },
    byPriority: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  };
}

export function summarizeQualityIssues(issues: QualityIssue[]): QualityIssueSummary {
  return issues.reduce<QualityIssueSummary>((summary, issue) => {
    summary.total += 1;
    if (issue.status === 'open') summary.open += 1;
    if (issue.severity === 'error') summary.errors += 1;
    if (issue.severity === 'warning') summary.warnings += 1;
    summary.bySource[issue.source] += 1;
    summary.byCategory[issue.category] += 1;
    summary.byPriority[issue.priority] += 1;
    return summary;
  }, createEmptyQualityIssueSummary());
}

function issueTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function earliestIssueTime(left: string, right: string): string {
  return issueTime(left) <= issueTime(right) ? left : right;
}

function latestIssueTime(left: string, right: string): string {
  return issueTime(left) >= issueTime(right) ? left : right;
}

export function coalesceQualityIssuesByFingerprint(issues: QualityIssue[]): QualityIssue[] {
  const byFingerprint = new Map<string, QualityIssue>();

  for (const issue of issues) {
    const key = issue.fingerprint || issue.id;
    const existing = byFingerprint.get(key);

    if (!existing) {
      byFingerprint.set(key, issue);
      continue;
    }

    const latestIssue = issueTime(issue.lastSeenAt) >= issueTime(existing.lastSeenAt)
      ? issue
      : existing;

    byFingerprint.set(key, {
      ...latestIssue,
      fingerprint: key,
      firstSeenAt: earliestIssueTime(existing.firstSeenAt, issue.firstSeenAt),
      lastSeenAt: latestIssueTime(existing.lastSeenAt, issue.lastSeenAt),
      occurrences: Math.max(1, existing.occurrences || 1) + Math.max(1, issue.occurrences || 1),
      status: existing.status === 'open' || issue.status === 'open' ? 'open' : latestIssue.status,
    });
  }

  return [...byFingerprint.values()].sort((a, b) => issueTime(b.lastSeenAt) - issueTime(a.lastSeenAt));
}

export function applyQualityIssueWorkflow(
  issue: QualityIssue,
  workflow?: QualityIssueWorkflowState | null,
): QualityIssue {
  if (!workflow) return issue;
  const hasRecurred = hasQualityIssueRecurredAfterResolution(issue, workflow);

  return {
    ...issue,
    status: hasRecurred ? 'open' : workflow.status || issue.status,
    ownerName: workflow.ownerName,
    statusNote: workflow.statusNote,
    resolutionEvidence: workflow.resolutionEvidence,
    linkedTaskId: workflow.linkedTaskId,
    linkedTaskTitle: workflow.linkedTaskTitle,
    workflowUpdatedAt: workflow.workflowUpdatedAt,
    workflowUpdatedBy: workflow.workflowUpdatedBy,
    acknowledgedAt: hasRecurred ? undefined : workflow.acknowledgedAt,
    resolvedAt: hasRecurred ? undefined : workflow.resolvedAt,
    reopenedAt: hasRecurred ? issue.lastSeenAt : workflow.reopenedAt,
    reopenedFromResolvedAt: hasRecurred ? workflow.resolvedAt : workflow.reopenedFromResolvedAt,
    regressionCount: workflow.regressionCount,
  };
}

export function hasQualityIssueRecurredAfterResolution(
  issue: Pick<QualityIssue, 'lastSeenAt'>,
  workflow?: Pick<QualityIssueWorkflowState, 'status' | 'resolvedAt'> | null,
): boolean {
  if (!workflow || workflow.status !== 'resolved' || !workflow.resolvedAt) {
    return false;
  }

  const lastSeenAt = new Date(issue.lastSeenAt).getTime();
  const resolvedAt = new Date(workflow.resolvedAt).getTime();
  return Number.isFinite(lastSeenAt) && Number.isFinite(resolvedAt) && lastSeenAt > resolvedAt;
}

export function getQualityIssueAgeHours(issue: Pick<QualityIssue, 'firstSeenAt'>, now = new Date()): number {
  const firstSeenAt = new Date(issue.firstSeenAt).getTime();
  if (!Number.isFinite(firstSeenAt)) return 0;
  return Math.max(0, (now.getTime() - firstSeenAt) / (60 * 60 * 1000));
}

export function getQualityIssueResponseSlaHours(issue: Pick<QualityIssue, 'priority'>): number {
  return QUALITY_ISSUE_RESPONSE_SLA_HOURS[issue.priority];
}

export function isQualityIssuePastResponseSla(issue: Pick<QualityIssue, 'firstSeenAt' | 'priority' | 'status'>, now = new Date()): boolean {
  if (issue.status === 'resolved') return false;
  return getQualityIssueAgeHours(issue, now) > getQualityIssueResponseSlaHours(issue);
}

export function getQualityIssueAlerts(issue: QualityIssue, now = new Date()): QualityIssueAlert[] {
  if (issue.status === 'resolved') return [];

  const createdAt = now.toISOString();
  const alerts: QualityIssueAlert[] = [];

  if (issue.priority === 'critical') {
    alerts.push({
      id: `${issue.fingerprint}:critical-open`,
      fingerprint: issue.fingerprint,
      type: 'critical-open',
      severity: 'critical',
      title: 'Critical issue needs immediate ownership',
      message: `${issue.title} is open with critical priority.`,
      actionLabel: 'Assign an owner and start remediation now',
      createdAt,
    });
  }

  if (isQualityIssuePastResponseSla(issue, now)) {
    alerts.push({
      id: `${issue.fingerprint}:past-response-target`,
      fingerprint: issue.fingerprint,
      type: 'past-response-target',
      severity: issue.priority === 'critical' || issue.priority === 'high' ? 'critical' : 'warning',
      title: 'Issue is past its response target',
      message: `${issue.title} has exceeded the ${getQualityIssueResponseSlaHours(issue)} hour response target.`,
      actionLabel: 'Escalate the owner or create a remediation task',
      createdAt,
    });
  }

  if (issue.reopenedAt) {
    alerts.push({
      id: `${issue.fingerprint}:reopened-regression`,
      fingerprint: issue.fingerprint,
      type: 'reopened-regression',
      severity: 'critical',
      title: 'Resolved issue reopened',
      message: `${issue.title} reappeared after being marked resolved.`,
      actionLabel: 'Treat as a regression and verify the previous fix',
      createdAt,
    });
  }

  if (issue.category === 'security' && issue.fixAvailable) {
    alerts.push({
      id: `${issue.fingerprint}:security-fix-available`,
      fingerprint: issue.fingerprint,
      type: 'security-fix-available',
      severity: issue.priority === 'critical' || issue.priority === 'high' ? 'critical' : 'warning',
      title: 'Security fix is available',
      message: `${issue.packageName || 'A vulnerable dependency'} has a published fix${issue.fixVersion ? ` (${issue.fixVersion})` : ''}.`,
      actionLabel: 'Patch the dependency and rerun the security feed',
      createdAt,
    });
  }

  return alerts;
}

export function getQualityIssueAutomationAlerts(issues: QualityIssue[], now = new Date()): QualityIssueAlert[] {
  return issues.flatMap((issue) => getQualityIssueAlerts(issue, now));
}

export function recommendQualityIssueActions(issue: QualityIssue): string[] {
  const actions: string[] = [];

  if (issue.reopenedAt) {
    actions.push('Treat this as a regression because the same fingerprint appeared again after being resolved.');
  }

  if (isQualityIssuePastResponseSla(issue)) {
    actions.push('Escalate ownership because this issue is past the response target for its priority.');
  }

  if (issue.category === 'security') {
    if (issue.fixAvailable) {
      actions.push(
        `Create a remediation task to upgrade ${issue.packageName || 'the affected dependency'}${issue.fixVersion ? ` to ${issue.fixVersion}` : ''}.`,
      );
    } else {
      actions.push('Record the compensating control and monitor the advisory feed until a fix is published.');
    }

    actions.push('Confirm the vulnerable package is reachable in production paths and capture any immediate exposure.');
    actions.push('Retest with a fresh audit snapshot after the dependency change or mitigation lands.');
  } else if (issue.category === 'runtime') {
    actions.push('Reproduce the failure path with the affected screen or request flow open in the browser or logs.');
    actions.push('Capture the stack, user path, and environment so repeated reports collapse into one fix thread.');
    actions.push('Patch the failing path, then verify the same runtime signal stops reappearing.');
  } else if (issue.category === 'configuration') {
    actions.push('Check the relevant environment variables, secrets, and deploy-time configuration first.');
    actions.push('Verify the failing config path in the current environment before changing code.');
  } else if (issue.category === 'accessibility') {
    actions.push('Fix the affected control or page structure and retest with the same accessibility rule or scanner.');
    actions.push('Verify the user-visible interaction still behaves correctly after the markup change.');
  } else if (issue.category === 'test') {
    actions.push('Stabilize the failing test or its fixture, then rerun the focused suite before the full pass.');
    actions.push('Check whether the failure reflects a product regression or only a brittle assertion.');
  } else {
    actions.push('Reproduce the issue on the latest code path before changing anything broad.');
    actions.push('Land the smallest correction that removes the signal and verify with the originating feed.');
  }

  if (issue.status === 'open' && !issue.ownerName) {
    actions.unshift('Assign an owner so the issue has a clear response path.');
  }

  if (!issue.linkedTaskId) {
    actions.push('Create a linked task if this issue will take more than a quick fix to close.');
  }

  if (issue.status === 'resolved' && !issue.resolutionEvidence) {
    actions.push('Add resolution evidence so the closure can be audited later.');
  }

  return actions;
}

export function createEmptyQualityIssueSnapshot(): QualityIssueSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    issues: [],
    summary: createEmptyQualityIssueSummary(),
  };
}
