/**
 * Validation guards and normalizers for quality issues: raw KV payloads to
 * typed issues, snapshots, security-feed entries, workflow maps/updates,
 * and automation runs — plus the KV keys and size caps. Moved verbatim
 * from quality-issues-routes.ts.
 */
import {
  createQualityIssueFingerprint,
  summarizeQualityIssues,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  type QualityIssueAlert,
  type QualityIssueAutomationRun,
  type QualityIssue,
  type QualityIssueCategory,
  type QualityIssuePriority,
  type QualityIssueSeverity,
  type QualityIssueSnapshot,
  type QualityIssueSource,
  type QualityIssueStatus,
  type QualityIssueWorkflowState,
  type QualityIssueWorkflowUpdate,
} from '../../../shared/quality/qualityIssues.ts';

export const LATEST_SNAPSHOT_KEY = 'quality_issues:latest_snapshot';
export const RUNTIME_CLIENT_ISSUES_KEY = 'quality_issues:runtime_client';
export const SECURITY_FEED_ISSUES_KEY = 'quality_issues:security_feed';
/**
 * CSP violations reported by visitors' browsers (csp-report-routes.ts).
 *
 * ONE ROW PER FINGERPRINT, not one array under one key. The first version kept
 * a single array and did read-modify-write on it, which loses reports under
 * exactly the traffic this endpoint sees: a policy change lands and every
 * visitor's browser reports at once, two handlers read the same array, and the
 * later `set` discards the other's violation entirely. Per-fingerprint rows
 * narrow the contention to reports of the SAME violation, where the worst case
 * is a missed increment on a counter rather than a lost finding.
 *
 * Separate from the security feed because the feed is written by a trusted
 * scheduled job and this by an unauthenticated public endpoint; a burst here
 * must not evict advisory findings. They are merged for display in
 * loadQualityIssueState.
 *
 * `kv.getByPrefix` is an index range scan (`>= prefix`, `< upperBound`), not a
 * LIKE, so the underscores in this prefix are literal.
 */
export const CSP_VIOLATION_KEY_PREFIX = 'quality_issues:csp_violation:';
export const ISSUE_WORKFLOW_KEY = 'quality_issues:workflow';
export const AUTOMATION_STATE_KEY = 'quality_issues:automation:last_run';
export const MAX_RUNTIME_ISSUES = 100;
export const MAX_SECURITY_FEED_ISSUES = 250;
export const MAX_CSP_VIOLATION_ISSUES = 250;
export const MAX_WORKFLOW_NOTE_LENGTH = 2000;
export const MAX_RESOLUTION_EVIDENCE_LENGTH = 3000;

export function isValidSource(source: unknown): source is QualityIssueSource {
  return ['build', 'test', 'audit', 'accessibility', 'runtime-client', 'runtime-server'].includes(
    String(source),
  );
}

export function isValidSeverity(severity: unknown): severity is QualityIssueSeverity {
  return ['error', 'warning', 'info'].includes(String(severity));
}

export function isValidStatus(status: unknown): status is QualityIssueStatus {
  return ['open', 'acknowledged', 'resolved'].includes(String(status));
}

export function isValidCategory(category: unknown): category is QualityIssueCategory {
  return [
    'build',
    'test',
    'security',
    'accessibility',
    'runtime',
    'configuration',
    'unknown',
  ].includes(String(category));
}

export function isValidPriority(priority: unknown): priority is QualityIssuePriority {
  return ['critical', 'high', 'medium', 'low'].includes(String(priority));
}

export function normalizeIssue(
  rawIssue: Record<string, unknown>,
  index: number,
  now: string,
): QualityIssue {
  const source = isValidSource(rawIssue.source) ? rawIssue.source : 'build';
  const severity = isValidSeverity(rawIssue.severity) ? rawIssue.severity : 'error';
  const status = isValidStatus(rawIssue.status) ? rawIssue.status : 'open';
  const title =
    typeof rawIssue.title === 'string' && rawIssue.title.trim()
      ? rawIssue.title.trim()
      : `${source} issue`;
  const message =
    typeof rawIssue.message === 'string' && rawIssue.message.trim()
      ? rawIssue.message.trim()
      : title;
  const filePath =
    typeof rawIssue.filePath === 'string' && rawIssue.filePath.trim()
      ? rawIssue.filePath.trim()
      : undefined;
  const ruleId =
    typeof rawIssue.ruleId === 'string' && rawIssue.ruleId.trim()
      ? rawIssue.ruleId.trim()
      : undefined;
  const category = isValidCategory(rawIssue.category)
    ? rawIssue.category
    : inferQualityIssueCategory(source, ruleId);
  const component =
    typeof rawIssue.component === 'string' && rawIssue.component.trim()
      ? rawIssue.component.trim()
      : undefined;
  const environment =
    typeof rawIssue.environment === 'string' && rawIssue.environment.trim()
      ? rawIssue.environment.trim()
      : undefined;
  const detectedBy =
    typeof rawIssue.detectedBy === 'string' && rawIssue.detectedBy.trim()
      ? rawIssue.detectedBy.trim()
      : undefined;
  const packageName =
    typeof rawIssue.packageName === 'string' && rawIssue.packageName.trim()
      ? rawIssue.packageName.trim()
      : undefined;
  const packageVersion =
    typeof rawIssue.packageVersion === 'string' && rawIssue.packageVersion.trim()
      ? rawIssue.packageVersion.trim()
      : undefined;
  const vulnerableRange =
    typeof rawIssue.vulnerableRange === 'string' && rawIssue.vulnerableRange.trim()
      ? rawIssue.vulnerableRange.trim()
      : undefined;
  const fixVersion =
    typeof rawIssue.fixVersion === 'string' && rawIssue.fixVersion.trim()
      ? rawIssue.fixVersion.trim()
      : undefined;
  const advisoryId =
    typeof rawIssue.advisoryId === 'string' && rawIssue.advisoryId.trim()
      ? rawIssue.advisoryId.trim()
      : undefined;
  const cve =
    typeof rawIssue.cve === 'string' && rawIssue.cve.trim() ? rawIssue.cve.trim() : undefined;
  const cvssScore =
    typeof rawIssue.cvssScore === 'number' && Number.isFinite(rawIssue.cvssScore)
      ? rawIssue.cvssScore
      : undefined;
  const referenceUrl =
    typeof rawIssue.referenceUrl === 'string' && rawIssue.referenceUrl.trim()
      ? rawIssue.referenceUrl.trim()
      : undefined;
  const fixAvailable =
    typeof rawIssue.fixAvailable === 'boolean' ? rawIssue.fixAvailable : undefined;

  const issue = {
    id:
      typeof rawIssue.id === 'string' && rawIssue.id.trim()
        ? rawIssue.id.trim()
        : `${source}:${ruleId || title}:${filePath || 'repo'}:${index}`,
    source,
    category,
    priority: isValidPriority(rawIssue.priority)
      ? rawIssue.priority
      : inferQualityIssuePriority({ source, severity, category, cvssScore }),
    fingerprint: '',
    severity,
    status,
    title,
    message,
    component,
    environment,
    detectedBy,
    packageName,
    packageVersion,
    vulnerableRange,
    fixVersion,
    advisoryId,
    cve,
    cvssScore,
    referenceUrl,
    fixAvailable,
    filePath,
    line: typeof rawIssue.line === 'number' ? rawIssue.line : undefined,
    column: typeof rawIssue.column === 'number' ? rawIssue.column : undefined,
    ruleId,
    firstSeenAt: typeof rawIssue.firstSeenAt === 'string' ? rawIssue.firstSeenAt : now,
    lastSeenAt: typeof rawIssue.lastSeenAt === 'string' ? rawIssue.lastSeenAt : now,
    occurrences:
      typeof rawIssue.occurrences === 'number' && rawIssue.occurrences > 0
        ? Math.floor(rawIssue.occurrences)
        : 1,
    runUrl: typeof rawIssue.runUrl === 'string' ? rawIssue.runUrl : undefined,
  };

  return {
    ...issue,
    fingerprint:
      typeof rawIssue.fingerprint === 'string' && rawIssue.fingerprint.trim()
        ? rawIssue.fingerprint.trim()
        : createQualityIssueFingerprint(issue),
  };
}

export function normalizeSnapshot(rawSnapshot: Record<string, unknown>): QualityIssueSnapshot {
  const now = new Date().toISOString();
  const rawIssues = Array.isArray(rawSnapshot.issues) ? rawSnapshot.issues : [];
  const issues = rawIssues
    .filter(
      (issue): issue is Record<string, unknown> => issue !== null && typeof issue === 'object',
    )
    .map((issue, index) => normalizeIssue(issue, index, now));

  return {
    generatedAt: typeof rawSnapshot.generatedAt === 'string' ? rawSnapshot.generatedAt : now,
    runId: typeof rawSnapshot.runId === 'string' ? rawSnapshot.runId : undefined,
    runUrl: typeof rawSnapshot.runUrl === 'string' ? rawSnapshot.runUrl : undefined,
    branch: typeof rawSnapshot.branch === 'string' ? rawSnapshot.branch : undefined,
    commitSha: typeof rawSnapshot.commitSha === 'string' ? rawSnapshot.commitSha : undefined,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

export function normalizeSecurityFeed(rawPayload: Record<string, unknown>): QualityIssue[] {
  const now = new Date().toISOString();
  const detectedBy =
    typeof rawPayload.detectedBy === 'string' && rawPayload.detectedBy.trim()
      ? rawPayload.detectedBy.trim()
      : typeof rawPayload.tool === 'string' && rawPayload.tool.trim()
        ? rawPayload.tool.trim()
        : 'security-feed';
  const environment =
    typeof rawPayload.environment === 'string' && rawPayload.environment.trim()
      ? rawPayload.environment.trim()
      : typeof rawPayload.branch === 'string' && rawPayload.branch.trim()
        ? rawPayload.branch.trim()
        : undefined;
  const rawIssues = Array.isArray(rawPayload.issues) ? rawPayload.issues : [];

  return rawIssues
    .filter(
      (issue): issue is Record<string, unknown> => issue !== null && typeof issue === 'object',
    )
    .map((issue, index) =>
      normalizeIssue(
        {
          source: 'audit',
          category: 'security',
          detectedBy,
          environment,
          ...issue,
        },
        index,
        now,
      ),
    );
}

export function issueId(parts: unknown[]): string {
  return parts
    .filter(Boolean)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .slice(0, 180);
}

export function asTrimmedString(value: unknown, fallback = '', maxLength = 1600): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function asOptionalString(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

export function normalizeWorkflowMap(rawValue: unknown): Record<string, QualityIssueWorkflowState> {
  if (!rawValue || typeof rawValue !== 'object') {
    return {};
  }

  const now = new Date().toISOString();
  const entries = Object.entries(rawValue as Record<string, unknown>);

  return entries.reduce<Record<string, QualityIssueWorkflowState>>(
    (acc, [fingerprint, workflow]) => {
      if (!workflow || typeof workflow !== 'object') {
        return acc;
      }

      const record = workflow as Record<string, unknown>;
      const normalizedFingerprint = asOptionalString(record.fingerprint) || fingerprint;
      if (!normalizedFingerprint) {
        return acc;
      }

      acc[normalizedFingerprint] = {
        fingerprint: normalizedFingerprint,
        status: isValidStatus(record.status) ? record.status : 'open',
        ownerName: asOptionalString(record.ownerName),
        statusNote: asOptionalString(record.statusNote, MAX_WORKFLOW_NOTE_LENGTH),
        resolutionEvidence: asOptionalString(
          record.resolutionEvidence,
          MAX_RESOLUTION_EVIDENCE_LENGTH,
        ),
        linkedTaskId: asOptionalString(record.linkedTaskId),
        linkedTaskTitle: asOptionalString(record.linkedTaskTitle, 500),
        workflowUpdatedAt: asOptionalString(record.workflowUpdatedAt) || now,
        workflowUpdatedBy: asOptionalString(record.workflowUpdatedBy),
        acknowledgedAt: asOptionalString(record.acknowledgedAt),
        resolvedAt: asOptionalString(record.resolvedAt),
        reopenedAt: asOptionalString(record.reopenedAt),
        reopenedFromResolvedAt: asOptionalString(record.reopenedFromResolvedAt),
        regressionCount:
          typeof record.regressionCount === 'number' && record.regressionCount > 0
            ? Math.floor(record.regressionCount)
            : undefined,
      };

      return acc;
    },
    {},
  );
}

export function normalizeWorkflowUpdate(rawValue: unknown): QualityIssueWorkflowUpdate | null {
  if (!rawValue || typeof rawValue !== 'object') {
    return null;
  }

  const payload = rawValue as Record<string, unknown>;
  const fingerprint = asOptionalString(payload.fingerprint);
  if (!fingerprint) {
    return null;
  }

  return {
    fingerprint,
    status: isValidStatus(payload.status) ? payload.status : undefined,
    ownerName: payload.ownerName === null ? null : asOptionalString(payload.ownerName, 160),
    statusNote:
      payload.statusNote === null
        ? null
        : asOptionalString(payload.statusNote, MAX_WORKFLOW_NOTE_LENGTH),
    resolutionEvidence:
      payload.resolutionEvidence === null
        ? null
        : asOptionalString(payload.resolutionEvidence, MAX_RESOLUTION_EVIDENCE_LENGTH),
    linkedTaskId: payload.linkedTaskId === null ? null : asOptionalString(payload.linkedTaskId),
    linkedTaskTitle:
      payload.linkedTaskTitle === null ? null : asOptionalString(payload.linkedTaskTitle, 500),
  };
}

export function normalizeAutomationRun(rawValue: unknown): QualityIssueAutomationRun | undefined {
  if (!rawValue || typeof rawValue !== 'object') {
    return undefined;
  }

  const record = rawValue as Record<string, unknown>;
  const rawAlerts = Array.isArray(record.alerts) ? record.alerts : [];
  const alerts = rawAlerts.filter((alert): alert is QualityIssueAlert =>
    Boolean(
      alert &&
      typeof alert === 'object' &&
      typeof (alert as Record<string, unknown>).id === 'string' &&
      typeof (alert as Record<string, unknown>).fingerprint === 'string',
    ),
  );

  return {
    runAt: asOptionalString(record.runAt) || new Date().toISOString(),
    runBy: asOptionalString(record.runBy) || 'quality-automation',
    activeAlerts:
      typeof record.activeAlerts === 'number'
        ? Math.max(0, Math.floor(record.activeAlerts))
        : alerts.length,
    criticalAlerts:
      typeof record.criticalAlerts === 'number'
        ? Math.max(0, Math.floor(record.criticalAlerts))
        : alerts.filter((alert) => alert.severity === 'critical').length,
    tasksCreated:
      typeof record.tasksCreated === 'number' ? Math.max(0, Math.floor(record.tasksCreated)) : 0,
    tasksLinked:
      typeof record.tasksLinked === 'number' ? Math.max(0, Math.floor(record.tasksLinked)) : 0,
    alerts,
  };
}
