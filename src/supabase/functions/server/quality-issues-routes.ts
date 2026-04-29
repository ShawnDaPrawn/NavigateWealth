import { Hono } from 'npm:hono';
import type { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAdmin, requireAuth } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  applyQualityIssueWorkflow,
  createEmptyQualityIssueSnapshot,
  createQualityIssueFingerprint,
  getQualityIssueAutomationAlerts,
  hasQualityIssueRecurredAfterResolution,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  summarizeQualityIssues,
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
import { buildQualityIssueTaskPlan } from '../../../shared/quality/qualityIssueTasks.ts';
import type { KvTask } from './tasks-types.ts';

const app = new Hono();
const log = createModuleLogger('quality-issues');
const LATEST_SNAPSHOT_KEY = 'quality_issues:latest_snapshot';
const RUNTIME_CLIENT_ISSUES_KEY = 'quality_issues:runtime_client';
const SECURITY_FEED_ISSUES_KEY = 'quality_issues:security_feed';
const ISSUE_WORKFLOW_KEY = 'quality_issues:workflow';
const AUTOMATION_STATE_KEY = 'quality_issues:automation:last_run';
const MAX_RUNTIME_ISSUES = 100;
const MAX_SECURITY_FEED_ISSUES = 250;
const MAX_WORKFLOW_NOTE_LENGTH = 2000;
const MAX_RESOLUTION_EVIDENCE_LENGTH = 3000;

function isValidSource(source: unknown): source is QualityIssueSource {
  return [
    'build',
    'test',
    'audit',
    'accessibility',
    'runtime-client',
    'runtime-server',
  ].includes(String(source));
}

function isValidSeverity(severity: unknown): severity is QualityIssueSeverity {
  return ['error', 'warning', 'info'].includes(String(severity));
}

function isValidStatus(status: unknown): status is QualityIssueStatus {
  return ['open', 'acknowledged', 'resolved'].includes(String(status));
}

function isValidCategory(category: unknown): category is QualityIssueCategory {
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

function isValidPriority(priority: unknown): priority is QualityIssuePriority {
  return ['critical', 'high', 'medium', 'low'].includes(String(priority));
}

function normalizeIssue(rawIssue: Record<string, unknown>, index: number, now: string): QualityIssue {
  const source = isValidSource(rawIssue.source) ? rawIssue.source : 'build';
  const severity = isValidSeverity(rawIssue.severity) ? rawIssue.severity : 'error';
  const status = isValidStatus(rawIssue.status) ? rawIssue.status : 'open';
  const title = typeof rawIssue.title === 'string' && rawIssue.title.trim()
    ? rawIssue.title.trim()
    : `${source} issue`;
  const message = typeof rawIssue.message === 'string' && rawIssue.message.trim()
    ? rawIssue.message.trim()
    : title;
  const filePath = typeof rawIssue.filePath === 'string' && rawIssue.filePath.trim()
    ? rawIssue.filePath.trim()
    : undefined;
  const ruleId = typeof rawIssue.ruleId === 'string' && rawIssue.ruleId.trim()
    ? rawIssue.ruleId.trim()
    : undefined;
  const category = isValidCategory(rawIssue.category)
    ? rawIssue.category
    : inferQualityIssueCategory(source, ruleId);
  const component = typeof rawIssue.component === 'string' && rawIssue.component.trim()
    ? rawIssue.component.trim()
    : undefined;
  const environment = typeof rawIssue.environment === 'string' && rawIssue.environment.trim()
    ? rawIssue.environment.trim()
    : undefined;
  const detectedBy = typeof rawIssue.detectedBy === 'string' && rawIssue.detectedBy.trim()
    ? rawIssue.detectedBy.trim()
    : undefined;
  const packageName = typeof rawIssue.packageName === 'string' && rawIssue.packageName.trim()
    ? rawIssue.packageName.trim()
    : undefined;
  const packageVersion = typeof rawIssue.packageVersion === 'string' && rawIssue.packageVersion.trim()
    ? rawIssue.packageVersion.trim()
    : undefined;
  const vulnerableRange = typeof rawIssue.vulnerableRange === 'string' && rawIssue.vulnerableRange.trim()
    ? rawIssue.vulnerableRange.trim()
    : undefined;
  const fixVersion = typeof rawIssue.fixVersion === 'string' && rawIssue.fixVersion.trim()
    ? rawIssue.fixVersion.trim()
    : undefined;
  const advisoryId = typeof rawIssue.advisoryId === 'string' && rawIssue.advisoryId.trim()
    ? rawIssue.advisoryId.trim()
    : undefined;
  const cve = typeof rawIssue.cve === 'string' && rawIssue.cve.trim()
    ? rawIssue.cve.trim()
    : undefined;
  const cvssScore = typeof rawIssue.cvssScore === 'number' && Number.isFinite(rawIssue.cvssScore)
    ? rawIssue.cvssScore
    : undefined;
  const referenceUrl = typeof rawIssue.referenceUrl === 'string' && rawIssue.referenceUrl.trim()
    ? rawIssue.referenceUrl.trim()
    : undefined;
  const fixAvailable = typeof rawIssue.fixAvailable === 'boolean'
    ? rawIssue.fixAvailable
    : undefined;

  const issue = {
    id: typeof rawIssue.id === 'string' && rawIssue.id.trim()
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
    occurrences: typeof rawIssue.occurrences === 'number' && rawIssue.occurrences > 0
      ? Math.floor(rawIssue.occurrences)
      : 1,
    runUrl: typeof rawIssue.runUrl === 'string' ? rawIssue.runUrl : undefined,
  };

  return {
    ...issue,
    fingerprint: typeof rawIssue.fingerprint === 'string' && rawIssue.fingerprint.trim()
      ? rawIssue.fingerprint.trim()
      : createQualityIssueFingerprint(issue),
  };
}

function normalizeSnapshot(rawSnapshot: Record<string, unknown>): QualityIssueSnapshot {
  const now = new Date().toISOString();
  const rawIssues = Array.isArray(rawSnapshot.issues) ? rawSnapshot.issues : [];
  const issues = rawIssues
    .filter((issue): issue is Record<string, unknown> => issue !== null && typeof issue === 'object')
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

function normalizeSecurityFeed(rawPayload: Record<string, unknown>): QualityIssue[] {
  const now = new Date().toISOString();
  const detectedBy = typeof rawPayload.detectedBy === 'string' && rawPayload.detectedBy.trim()
    ? rawPayload.detectedBy.trim()
    : typeof rawPayload.tool === 'string' && rawPayload.tool.trim()
      ? rawPayload.tool.trim()
      : 'security-feed';
  const environment = typeof rawPayload.environment === 'string' && rawPayload.environment.trim()
    ? rawPayload.environment.trim()
    : typeof rawPayload.branch === 'string' && rawPayload.branch.trim()
      ? rawPayload.branch.trim()
      : undefined;
  const rawIssues = Array.isArray(rawPayload.issues) ? rawPayload.issues : [];

  return rawIssues
    .filter((issue): issue is Record<string, unknown> => issue !== null && typeof issue === 'object')
    .map((issue, index) => normalizeIssue({
      source: 'audit',
      category: 'security',
      detectedBy,
      environment,
      ...issue,
    }, index, now));
}

function issueId(parts: unknown[]): string {
  return parts
    .filter(Boolean)
    .join(':')
    .toLowerCase()
    .replace(/[^a-z0-9:_./-]+/g, '-')
    .slice(0, 180);
}

function asTrimmedString(value: unknown, fallback = '', maxLength = 1600): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asOptionalString(
  value: unknown,
  maxLength = 240,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function normalizeWorkflowMap(rawValue: unknown): Record<string, QualityIssueWorkflowState> {
  if (!rawValue || typeof rawValue !== 'object') {
    return {};
  }

  const now = new Date().toISOString();
  const entries = Object.entries(rawValue as Record<string, unknown>);

  return entries.reduce<Record<string, QualityIssueWorkflowState>>((acc, [fingerprint, workflow]) => {
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
      resolutionEvidence: asOptionalString(record.resolutionEvidence, MAX_RESOLUTION_EVIDENCE_LENGTH),
      linkedTaskId: asOptionalString(record.linkedTaskId),
      linkedTaskTitle: asOptionalString(record.linkedTaskTitle, 500),
      workflowUpdatedAt: asOptionalString(record.workflowUpdatedAt) || now,
      workflowUpdatedBy: asOptionalString(record.workflowUpdatedBy),
      acknowledgedAt: asOptionalString(record.acknowledgedAt),
      resolvedAt: asOptionalString(record.resolvedAt),
      reopenedAt: asOptionalString(record.reopenedAt),
      reopenedFromResolvedAt: asOptionalString(record.reopenedFromResolvedAt),
      regressionCount: typeof record.regressionCount === 'number' && record.regressionCount > 0
        ? Math.floor(record.regressionCount)
        : undefined,
    };

    return acc;
  }, {});
}

function normalizeWorkflowUpdate(
  rawValue: unknown,
): QualityIssueWorkflowUpdate | null {
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
    statusNote: payload.statusNote === null ? null : asOptionalString(payload.statusNote, MAX_WORKFLOW_NOTE_LENGTH),
    resolutionEvidence: payload.resolutionEvidence === null
      ? null
      : asOptionalString(payload.resolutionEvidence, MAX_RESOLUTION_EVIDENCE_LENGTH),
    linkedTaskId: payload.linkedTaskId === null ? null : asOptionalString(payload.linkedTaskId),
    linkedTaskTitle: payload.linkedTaskTitle === null ? null : asOptionalString(payload.linkedTaskTitle, 500),
  };
}

function normalizeAutomationRun(rawValue: unknown): QualityIssueAutomationRun | undefined {
  if (!rawValue || typeof rawValue !== 'object') {
    return undefined;
  }

  const record = rawValue as Record<string, unknown>;
  const rawAlerts = Array.isArray(record.alerts) ? record.alerts : [];
  const alerts = rawAlerts
    .filter((alert): alert is QualityIssueAlert => Boolean(
      alert &&
      typeof alert === 'object' &&
      typeof (alert as Record<string, unknown>).id === 'string' &&
      typeof (alert as Record<string, unknown>).fingerprint === 'string',
    ));

  return {
    runAt: asOptionalString(record.runAt) || new Date().toISOString(),
    runBy: asOptionalString(record.runBy) || 'quality-automation',
    activeAlerts: typeof record.activeAlerts === 'number' ? Math.max(0, Math.floor(record.activeAlerts)) : alerts.length,
    criticalAlerts: typeof record.criticalAlerts === 'number'
      ? Math.max(0, Math.floor(record.criticalAlerts))
      : alerts.filter((alert) => alert.severity === 'critical').length,
    tasksCreated: typeof record.tasksCreated === 'number' ? Math.max(0, Math.floor(record.tasksCreated)) : 0,
    tasksLinked: typeof record.tasksLinked === 'number' ? Math.max(0, Math.floor(record.tasksLinked)) : 0,
    alerts,
  };
}

function mergeWorkflowState(
  existing: QualityIssueWorkflowState | undefined,
  update: QualityIssueWorkflowUpdate,
  actorLabel: string,
): QualityIssueWorkflowState {
  const now = new Date().toISOString();
  const nextStatus = update.status || existing?.status || 'open';

  return {
    fingerprint: update.fingerprint,
    status: nextStatus,
    ownerName: update.ownerName === undefined
      ? existing?.ownerName
      : update.ownerName || undefined,
    statusNote: update.statusNote === undefined
      ? existing?.statusNote
      : update.statusNote || undefined,
    resolutionEvidence: update.resolutionEvidence === undefined
      ? existing?.resolutionEvidence
      : update.resolutionEvidence || undefined,
    linkedTaskId: update.linkedTaskId === undefined
      ? existing?.linkedTaskId
      : update.linkedTaskId || undefined,
    linkedTaskTitle: update.linkedTaskTitle === undefined
      ? existing?.linkedTaskTitle
      : update.linkedTaskTitle || undefined,
    workflowUpdatedAt: now,
    workflowUpdatedBy: actorLabel,
    acknowledgedAt: nextStatus === 'acknowledged'
      ? existing?.acknowledgedAt || now
      : nextStatus === 'resolved'
        ? existing?.acknowledgedAt || now
        : undefined,
    resolvedAt: nextStatus === 'resolved'
      ? existing?.resolvedAt || now
      : undefined,
    reopenedAt: existing?.reopenedAt,
    reopenedFromResolvedAt: existing?.reopenedFromResolvedAt,
    regressionCount: existing?.regressionCount,
  };
}

function reopenRecurringWorkflows(
  issues: QualityIssue[],
  workflowState: Record<string, QualityIssueWorkflowState>,
): { workflowState: Record<string, QualityIssueWorkflowState>; changed: boolean } {
  const now = new Date().toISOString();
  let changed = false;
  const nextWorkflowState = { ...workflowState };

  for (const issue of issues) {
    const workflow = nextWorkflowState[issue.fingerprint];
    if (!hasQualityIssueRecurredAfterResolution(issue, workflow)) {
      continue;
    }

    nextWorkflowState[issue.fingerprint] = {
      ...workflow,
      fingerprint: issue.fingerprint,
      status: 'open',
      resolvedAt: undefined,
      acknowledgedAt: undefined,
      reopenedAt: issue.lastSeenAt,
      reopenedFromResolvedAt: workflow.resolvedAt,
      regressionCount: (workflow.regressionCount || 0) + 1,
      workflowUpdatedAt: now,
      workflowUpdatedBy: 'quality-feed',
    };
    changed = true;
  }

  return { workflowState: nextWorkflowState, changed };
}

function taskKey(id: string): string {
  return `task:${id}`;
}

function taskChecklistKey(id: string): string {
  return `task_checklist:${id}`;
}

async function getNextTaskSortOrder(status = 'new'): Promise<number> {
  try {
    const allRaw = await kv.getByPrefix('task:') as Array<Record<string, unknown>> | null;
    if (!Array.isArray(allRaw)) return 0;

    return allRaw
      .filter((task) => task && task.status === status)
      .reduce((max, task) => Math.max(max, Number(task.sort_order ?? task.sortOrder ?? 0)), -1) + 1;
  } catch {
    return 0;
  }
}

function buildTaskChecklist(taskId: string, checklist: string[]) {
  return checklist.map((text, index) => ({
    id: `${taskId}-issue-step-${index + 1}`,
    text,
    completed: false,
  }));
}

function isIssueManagerTask(task: Record<string, unknown>): boolean {
  const tags = Array.isArray(task.tags) ? task.tags.map(String) : [];
  return (
    tags.includes('issue-manager')
    || task.created_by === 'issue-manager-automation'
    || String(task.title || '').startsWith('[Issue Manager]')
    || String(task.title || '').startsWith('[Security]')
  );
}

function getAutomationTaskDueDate(issue: QualityIssue, now: Date): string {
  const hoursByPriority: Record<QualityIssuePriority, number> = {
    critical: 24,
    high: 48,
    medium: 120,
    low: 240,
  };
  const due = new Date(now.getTime() + hoursByPriority[issue.priority] * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

function buildAutomationTask(
  issue: QualityIssue,
  alert: QualityIssueAlert,
  now: Date,
  sortOrder: number,
): KvTask {
  const id = crypto.randomUUID();
  const timestamp = now.toISOString();
  const plan = buildQualityIssueTaskPlan(issue, alert);

  return {
    id,
    title: plan.title,
    description: plan.description,
    status: 'new',
    priority: issue.priority,
    due_date: getAutomationTaskDueDate(issue, now),
    is_template: false,
    assignee_initials: null,
    assignee_id: null,
    created_by: 'issue-manager-automation',
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: null,
    sort_order: sortOrder,
    reminder_frequency: issue.priority === 'critical' || issue.priority === 'high' ? 'daily' : null,
    last_reminder_sent: null,
    tags: [...new Set([...plan.tags, 'automated-alert'])],
    category: 'internal',
  };
}

async function saveIssueTaskChecklist(taskId: string, issue: QualityIssue, alert: QualityIssueAlert): Promise<void> {
  const plan = buildQualityIssueTaskPlan(issue, alert);
  await kv.set(taskChecklistKey(taskId), buildTaskChecklist(taskId, plan.checklist));
}

async function refreshLinkedIssueTask(
  taskId: string,
  issue: QualityIssue,
  alert: QualityIssueAlert,
  now: Date,
): Promise<{ changed: boolean; title?: string }> {
  const existing = await kv.get(taskKey(taskId)) as Record<string, unknown> | null;
  if (!existing || !isIssueManagerTask(existing)) {
    return { changed: false };
  }

  const plan = buildQualityIssueTaskPlan(issue, alert);
  const updated = {
    ...existing,
    title: plan.title,
    description: plan.description,
    priority: issue.priority,
    due_date: existing.due_date ?? getAutomationTaskDueDate(issue, now),
    reminder_frequency: existing.reminder_frequency ?? (
      issue.priority === 'critical' || issue.priority === 'high' ? 'daily' : null
    ),
    tags: [...new Set([...(Array.isArray(existing.tags) ? existing.tags.map(String) : []), ...plan.tags, 'automated-alert'])],
    category: existing.category ?? 'internal',
    updated_at: now.toISOString(),
  };

  await kv.set(taskKey(taskId), updated);
  await kv.set(taskChecklistKey(taskId), buildTaskChecklist(taskId, plan.checklist));
  return { changed: true, title: plan.title };
}

async function runIssueAutomation(
  issues: QualityIssue[],
  workflowState: Record<string, QualityIssueWorkflowState>,
  actorLabel: string,
): Promise<{ workflowState: Record<string, QualityIssueWorkflowState>; automation: QualityIssueAutomationRun; changed: boolean }> {
  const now = new Date();
  const alerts = getQualityIssueAutomationAlerts(issues, now);
  const alertsByFingerprint = alerts.reduce<Record<string, QualityIssueAlert[]>>((acc, alert) => {
    acc[alert.fingerprint] = [...(acc[alert.fingerprint] || []), alert];
    return acc;
  }, {});
  const nextWorkflowState = { ...workflowState };
  let nextSortOrder = await getNextTaskSortOrder();
  let tasksCreated = 0;
  let tasksLinked = 0;
  let changed = false;

  for (const issue of issues) {
    const issueAlerts = alertsByFingerprint[issue.fingerprint] || [];
    if (issueAlerts.length === 0) continue;

    const existingWorkflow = nextWorkflowState[issue.fingerprint];
    const primaryAlert = [...issueAlerts].sort((a, b) => (
      Number(b.severity === 'critical') - Number(a.severity === 'critical')
    ))[0];

    const linkedTaskId = issue.linkedTaskId || existingWorkflow?.linkedTaskId;
    if (linkedTaskId) {
      const refreshedTask = await refreshLinkedIssueTask(linkedTaskId, issue, primaryAlert, now);
      if (refreshedTask.changed) {
        changed = true;
        nextWorkflowState[issue.fingerprint] = mergeWorkflowState(existingWorkflow, {
          fingerprint: issue.fingerprint,
          linkedTaskId,
          linkedTaskTitle: refreshedTask.title || issue.linkedTaskTitle || existingWorkflow?.linkedTaskTitle,
          status: existingWorkflow?.status || issue.status,
          statusNote: existingWorkflow?.statusNote
            ? undefined
            : buildQualityIssueTaskPlan(issue, primaryAlert).statusNote,
        }, actorLabel);
      }
      tasksLinked += 1;
      continue;
    }

    const taskPlan = buildQualityIssueTaskPlan(issue, primaryAlert);
    const task = buildAutomationTask(issue, primaryAlert, now, nextSortOrder);
    nextSortOrder += 1;

    await kv.set(taskKey(task.id), task);
    await saveIssueTaskChecklist(task.id, issue, primaryAlert);
    tasksCreated += 1;
    tasksLinked += 1;
    changed = true;

    nextWorkflowState[issue.fingerprint] = mergeWorkflowState(existingWorkflow, {
      fingerprint: issue.fingerprint,
      linkedTaskId: task.id,
      linkedTaskTitle: task.title,
      status: existingWorkflow?.status || issue.status,
      statusNote: existingWorkflow?.statusNote
        ? undefined
        : taskPlan.statusNote,
    }, actorLabel);
  }

  const automation: QualityIssueAutomationRun = {
    runAt: now.toISOString(),
    runBy: actorLabel,
    activeAlerts: alerts.length,
    criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
    tasksCreated,
    tasksLinked,
    alerts,
  };

  await kv.set(AUTOMATION_STATE_KEY, automation);

  return { workflowState: nextWorkflowState, automation, changed };
}

async function loadQualityIssueState(): Promise<{
  baseSnapshot: QualityIssueSnapshot;
  baseRuntimeIssues: QualityIssue[];
  baseSecurityFeedIssues: QualityIssue[];
  workflowState: Record<string, QualityIssueWorkflowState>;
  automation?: QualityIssueAutomationRun;
}> {
  const snapshot = await kv.get(LATEST_SNAPSHOT_KEY) as QualityIssueSnapshot | null;
  const runtimeIssues = await kv.get(RUNTIME_CLIENT_ISSUES_KEY) as QualityIssue[] | null;
  const securityFeedIssues = await kv.get(SECURITY_FEED_ISSUES_KEY) as QualityIssue[] | null;

  return {
    baseSnapshot: snapshot || createEmptyQualityIssueSnapshot(),
    baseRuntimeIssues: Array.isArray(runtimeIssues) ? runtimeIssues : [],
    baseSecurityFeedIssues: Array.isArray(securityFeedIssues) ? securityFeedIssues : [],
    workflowState: normalizeWorkflowMap(await kv.get(ISSUE_WORKFLOW_KEY)),
    automation: normalizeAutomationRun(await kv.get(AUTOMATION_STATE_KEY)),
  };
}

async function buildCurrentSnapshot(
  state?: Awaited<ReturnType<typeof loadQualityIssueState>>,
): Promise<{
  snapshot: QualityIssueSnapshot;
  workflowState: Record<string, QualityIssueWorkflowState>;
  state: Awaited<ReturnType<typeof loadQualityIssueState>>;
}> {
  const loadedState = state || await loadQualityIssueState();
  let workflowState = loadedState.workflowState;
  let combinedSnapshot = combineSnapshots(
    loadedState.baseSnapshot,
    loadedState.baseRuntimeIssues,
    loadedState.baseSecurityFeedIssues,
    workflowState,
  );
  const recurrence = reopenRecurringWorkflows(combinedSnapshot.issues, workflowState);

  if (recurrence.changed) {
    workflowState = recurrence.workflowState;
    await kv.set(ISSUE_WORKFLOW_KEY, workflowState);
    combinedSnapshot = combineSnapshots(
      loadedState.baseSnapshot,
      loadedState.baseRuntimeIssues,
      loadedState.baseSecurityFeedIssues,
      workflowState,
    );

    log.warn('Resolved quality issues reopened after recurrence', {
      count: combinedSnapshot.issues.filter((issue) => issue.reopenedAt).length,
    });
  }

  return {
    snapshot: loadedState.automation
      ? { ...combinedSnapshot, automation: loadedState.automation }
      : combinedSnapshot,
    workflowState,
    state: loadedState,
  };
}

async function runAutomationOnCurrentState(actorLabel: string): Promise<{
  snapshot: QualityIssueSnapshot;
  automation: QualityIssueAutomationRun;
}> {
  const current = await buildCurrentSnapshot();
  const result = await runIssueAutomation(current.snapshot.issues, current.workflowState, actorLabel);

  if (result.changed) {
    await kv.set(ISSUE_WORKFLOW_KEY, result.workflowState);
  }

  const refreshedSnapshot = combineSnapshots(
    current.state.baseSnapshot,
    current.state.baseRuntimeIssues,
    current.state.baseSecurityFeedIssues,
    result.workflowState,
  );

  return {
    snapshot: { ...refreshedSnapshot, automation: result.automation },
    automation: result.automation,
  };
}

function combineSnapshots(
  ciSnapshot: QualityIssueSnapshot,
  runtimeIssues: QualityIssue[],
  securityFeedIssues: QualityIssue[],
  workflowState: Record<string, QualityIssueWorkflowState>,
): QualityIssueSnapshot {
  const now = new Date().toISOString();
  const ciIssues = Array.isArray(ciSnapshot.issues)
    ? ciSnapshot.issues.map((issue, index) => normalizeIssue(issue as unknown as Record<string, unknown>, index, now))
    : [];
  const normalizedRuntimeIssues = runtimeIssues.map((issue, index) =>
    normalizeIssue(issue as unknown as Record<string, unknown>, index, now)
  );
  const normalizedSecurityIssues = securityFeedIssues.map((issue, index) =>
    normalizeIssue(issue as unknown as Record<string, unknown>, index, now)
  );
  const issues = [...ciIssues, ...normalizedRuntimeIssues, ...normalizedSecurityIssues]
    .map((issue) => applyQualityIssueWorkflow(issue, workflowState[issue.fingerprint]));

  return {
    ...ciSnapshot,
    generatedAt: now,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

function hasValidIngestToken(c: Context): boolean {
  const expectedToken = Deno.env.get('QUALITY_ISSUES_INGEST_TOKEN');
  if (!expectedToken) {
    return false;
  }

  const bearerToken = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerToken = c.req.header('X-Quality-Ingest-Token')?.trim();
  return bearerToken === expectedToken || headerToken === expectedToken;
}

app.get('/', requireAdmin, asyncHandler(async (c) => {
  const current = await buildCurrentSnapshot();

  return c.json({
    success: true,
    snapshot: current.snapshot,
  });
}));

app.post('/automation/run', requireAdmin, asyncHandler(async (c) => {
  const user = c.get('user') as { id?: string; email?: string } | undefined;
  const actorLabel = user?.email || user?.id || 'admin';
  const result = await runAutomationOnCurrentState(actorLabel);

  log.info('Quality issue automation completed', {
    activeAlerts: result.automation.activeAlerts,
    criticalAlerts: result.automation.criticalAlerts,
    tasksCreated: result.automation.tasksCreated,
    actor: actorLabel,
  });

  return c.json({
    success: true,
    automation: result.automation,
    snapshot: result.snapshot,
  });
}));

app.post('/ingest-ci-report', asyncHandler(async (c) => {
  if (!hasValidIngestToken(c)) {
    return c.json({ success: false, error: 'Unauthorized quality issue ingest request' }, 401);
  }

  const body = await c.req.json();
  const snapshot = normalizeSnapshot(body);
  await kv.set(LATEST_SNAPSHOT_KEY, snapshot);
  let automation: QualityIssueAutomationRun | undefined;

  try {
    automation = (await runAutomationOnCurrentState('quality-feed')).automation;
  } catch (error) {
    log.error('Quality issue automation failed after CI ingest', error as Error);
  }

  log.info('Quality issue snapshot ingested', {
    total: snapshot.summary.total,
    errors: snapshot.summary.errors,
    warnings: snapshot.summary.warnings,
    runId: snapshot.runId,
    automationAlerts: automation?.activeAlerts,
  });

  return c.json({ success: true, snapshot, automation });
}));

app.post('/ingest-security-report', asyncHandler(async (c) => {
  if (!hasValidIngestToken(c)) {
    return c.json({ success: false, error: 'Unauthorized security issue ingest request' }, 401);
  }

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const issues = normalizeSecurityFeed(body)
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_SECURITY_FEED_ISSUES);

  await kv.set(SECURITY_FEED_ISSUES_KEY, issues);
  let automation: QualityIssueAutomationRun | undefined;

  try {
    automation = (await runAutomationOnCurrentState('quality-feed')).automation;
  } catch (error) {
    log.error('Quality issue automation failed after security ingest', error as Error);
  }

  log.info('Security issue feed ingested', {
    total: issues.length,
    detectedBy: typeof body.detectedBy === 'string' ? body.detectedBy : body.tool,
    automationAlerts: automation?.activeAlerts,
  });

  return c.json({ success: true, issues, automation });
}));

app.patch('/workflow', requireAdmin, asyncHandler(async (c) => {
  const update = normalizeWorkflowUpdate(await c.req.json().catch(() => null));
  if (!update) {
    return c.json({ success: false, error: 'A valid issue fingerprint is required' }, 400);
  }

  const currentWorkflowState = normalizeWorkflowMap(await kv.get(ISSUE_WORKFLOW_KEY));
  const user = c.get('user') as { id?: string; email?: string } | undefined;
  const actorLabel = user?.email || user?.id || 'admin';
  const workflow = mergeWorkflowState(currentWorkflowState[update.fingerprint], update, actorLabel);

  currentWorkflowState[update.fingerprint] = workflow;
  await kv.set(ISSUE_WORKFLOW_KEY, currentWorkflowState);

  log.info('Quality issue workflow updated', {
    fingerprint: update.fingerprint,
    status: workflow.status,
    ownerName: workflow.ownerName,
    linkedTaskId: workflow.linkedTaskId,
    actor: actorLabel,
  });

  return c.json({ success: true, workflow });
}));

app.post('/runtime-client', requireAuth, asyncHandler(async (c) => {
  const now = new Date().toISOString();
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const kind = asTrimmedString(body.kind, 'window-error', 80);
  const message = asTrimmedString(body.message, 'Client runtime error');
  const filePath = asTrimmedString(body.filePath, 'browser', 240);
  const line = asOptionalNumber(body.line);
  const column = asOptionalNumber(body.column);
  const title = asTrimmedString(body.title, 'Client runtime error', 240);
  const stack = asTrimmedString(body.stack, '', 3000);
  const componentStack = asTrimmedString(body.componentStack, '', 3000);
  const href = asTrimmedString(body.href, '', 500);
  const userAgent = asTrimmedString(body.userAgent, '', 500);
  const user = c.get('user') as { id?: string; email?: string } | undefined;
  const userEmail = user?.email ? `\nUser: ${user.email}` : '';
  const context = [
    href ? `URL: ${href}` : '',
    userAgent ? `User-Agent: ${userAgent}` : '',
    componentStack ? `Component stack:\n${componentStack}` : '',
    stack ? `Stack:\n${stack}` : '',
  ].filter(Boolean).join('\n\n');
  const id = issueId(['runtime-client', kind, message, filePath, line, column]);
  const category = inferQualityIssueCategory('runtime-client', kind);
  const priority = inferQualityIssuePriority({
    source: 'runtime-client',
    severity: 'error',
    category,
  });
  const currentIssues = await kv.get(RUNTIME_CLIENT_ISSUES_KEY) as QualityIssue[] | null;
  const issues = Array.isArray(currentIssues) ? currentIssues : [];
  const existingIndex = issues.findIndex((issue) => issue.id === id);

  const nextIssue: QualityIssue = {
    id,
    source: 'runtime-client',
    category,
    priority,
    fingerprint: createQualityIssueFingerprint({
      source: 'runtime-client',
      category,
      ruleId: kind,
      title,
      filePath,
      line,
      column,
    }),
    severity: 'error',
    status: 'open',
    title,
    message: `${message}${userEmail}${context ? `\n\n${context}` : ''}`.slice(0, 5000),
    filePath,
    line,
    column,
    ruleId: kind,
    firstSeenAt: existingIndex >= 0 ? issues[existingIndex].firstSeenAt : now,
    lastSeenAt: now,
    occurrences: existingIndex >= 0 ? issues[existingIndex].occurrences + 1 : 1,
  };

  const nextIssues = existingIndex >= 0
    ? issues.map((issue, index) => index === existingIndex ? nextIssue : issue)
    : [nextIssue, ...issues];

  const trimmedIssues = nextIssues
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, MAX_RUNTIME_ISSUES);

  await kv.set(RUNTIME_CLIENT_ISSUES_KEY, trimmedIssues);

  log.warn('Runtime client issue ingested', {
    id,
    title,
    userId: user?.id,
    occurrences: nextIssue.occurrences,
  });

  return c.json({ success: true, issue: nextIssue });
}));

export default app;
