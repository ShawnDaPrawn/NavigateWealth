/**
 * Quality-issue workflow merging and the issue-manager task automation:
 * building, saving, and refreshing linked KV tasks and running the
 * automation pass. Moved verbatim from quality-issues-routes.ts.
 */
import * as kv from './kv_store.tsx';
import {
  getQualityIssueAutomationAlerts,
  hasQualityIssueRecurredAfterResolution,
  type QualityIssueAlert,
  type QualityIssueAutomationRun,
  type QualityIssue,
  type QualityIssuePriority,
  type QualityIssueWorkflowState,
  type QualityIssueWorkflowUpdate,
} from '../../../shared/quality/qualityIssues.ts';
import { AUTOMATION_STATE_KEY } from './quality-issues-normalize.ts';
import { buildQualityIssueTaskPlan } from '../../../shared/quality/qualityIssueTasks.ts';
import type { KvTask } from './tasks-types.ts';

export function mergeWorkflowState(
  existing: QualityIssueWorkflowState | undefined,
  update: QualityIssueWorkflowUpdate,
  actorLabel: string,
): QualityIssueWorkflowState {
  const now = new Date().toISOString();
  const nextStatus = update.status || existing?.status || 'open';

  return {
    fingerprint: update.fingerprint,
    status: nextStatus,
    ownerName: update.ownerName === undefined ? existing?.ownerName : update.ownerName || undefined,
    statusNote:
      update.statusNote === undefined ? existing?.statusNote : update.statusNote || undefined,
    resolutionEvidence:
      update.resolutionEvidence === undefined
        ? existing?.resolutionEvidence
        : update.resolutionEvidence || undefined,
    linkedTaskId:
      update.linkedTaskId === undefined ? existing?.linkedTaskId : update.linkedTaskId || undefined,
    linkedTaskTitle:
      update.linkedTaskTitle === undefined
        ? existing?.linkedTaskTitle
        : update.linkedTaskTitle || undefined,
    workflowUpdatedAt: now,
    workflowUpdatedBy: actorLabel,
    acknowledgedAt:
      nextStatus === 'acknowledged'
        ? existing?.acknowledgedAt || now
        : nextStatus === 'resolved'
          ? existing?.acknowledgedAt || now
          : undefined,
    resolvedAt: nextStatus === 'resolved' ? existing?.resolvedAt || now : undefined,
    reopenedAt: existing?.reopenedAt,
    reopenedFromResolvedAt: existing?.reopenedFromResolvedAt,
    regressionCount: existing?.regressionCount,
  };
}

export function reopenRecurringWorkflows(
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

export function taskKey(id: string): string {
  return `task:${id}`;
}

export function taskChecklistKey(id: string): string {
  return `task_checklist:${id}`;
}

export async function getNextTaskSortOrder(status = 'new'): Promise<number> {
  try {
    const allRaw = (await kv.getByPrefix('task:')) as Array<Record<string, unknown>> | null;
    if (!Array.isArray(allRaw)) return 0;

    return (
      allRaw
        .filter((task) => task && task.status === status)
        .reduce((max, task) => Math.max(max, Number(task.sort_order ?? task.sortOrder ?? 0)), -1) +
      1
    );
  } catch {
    return 0;
  }
}

export function buildTaskChecklist(taskId: string, checklist: string[]) {
  return checklist.map((text, index) => ({
    id: `${taskId}-issue-step-${index + 1}`,
    text,
    completed: false,
  }));
}

export function isIssueManagerTask(task: Record<string, unknown>): boolean {
  const tags = Array.isArray(task.tags) ? task.tags.map(String) : [];
  return (
    tags.includes('issue-manager') ||
    task.created_by === 'issue-manager-automation' ||
    String(task.title || '').startsWith('[Issue Manager]') ||
    String(task.title || '').startsWith('[Security]')
  );
}

export function getAutomationTaskDueDate(issue: QualityIssue, now: Date): string {
  const hoursByPriority: Record<QualityIssuePriority, number> = {
    critical: 24,
    high: 48,
    medium: 120,
    low: 240,
  };
  const due = new Date(now.getTime() + hoursByPriority[issue.priority] * 60 * 60 * 1000);
  return due.toISOString().slice(0, 10);
}

export function buildAutomationTask(
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

export async function saveIssueTaskChecklist(
  taskId: string,
  issue: QualityIssue,
  alert: QualityIssueAlert,
): Promise<void> {
  const plan = buildQualityIssueTaskPlan(issue, alert);
  await kv.set(taskChecklistKey(taskId), buildTaskChecklist(taskId, plan.checklist));
}

export async function refreshLinkedIssueTask(
  taskId: string,
  issue: QualityIssue,
  alert: QualityIssueAlert,
  now: Date,
): Promise<{ changed: boolean; title?: string }> {
  const existing = (await kv.get(taskKey(taskId))) as Record<string, unknown> | null;
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
    reminder_frequency:
      existing.reminder_frequency ??
      (issue.priority === 'critical' || issue.priority === 'high' ? 'daily' : null),
    tags: [
      ...new Set([
        ...(Array.isArray(existing.tags) ? existing.tags.map(String) : []),
        ...plan.tags,
        'automated-alert',
      ]),
    ],
    category: existing.category ?? 'internal',
    updated_at: now.toISOString(),
  };

  await kv.set(taskKey(taskId), updated);
  await kv.set(taskChecklistKey(taskId), buildTaskChecklist(taskId, plan.checklist));
  return { changed: true, title: plan.title };
}

export async function runIssueAutomation(
  issues: QualityIssue[],
  workflowState: Record<string, QualityIssueWorkflowState>,
  actorLabel: string,
): Promise<{
  workflowState: Record<string, QualityIssueWorkflowState>;
  automation: QualityIssueAutomationRun;
  changed: boolean;
}> {
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
    const primaryAlert = [...issueAlerts].sort(
      (a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical'),
    )[0];

    const linkedTaskId = issue.linkedTaskId || existingWorkflow?.linkedTaskId;
    if (linkedTaskId) {
      const refreshedTask = await refreshLinkedIssueTask(linkedTaskId, issue, primaryAlert, now);
      if (refreshedTask.changed) {
        changed = true;
        nextWorkflowState[issue.fingerprint] = mergeWorkflowState(
          existingWorkflow,
          {
            fingerprint: issue.fingerprint,
            linkedTaskId,
            linkedTaskTitle:
              refreshedTask.title || issue.linkedTaskTitle || existingWorkflow?.linkedTaskTitle,
            status: existingWorkflow?.status || issue.status,
            statusNote: existingWorkflow?.statusNote
              ? undefined
              : buildQualityIssueTaskPlan(issue, primaryAlert).statusNote,
          },
          actorLabel,
        );
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

    nextWorkflowState[issue.fingerprint] = mergeWorkflowState(
      existingWorkflow,
      {
        fingerprint: issue.fingerprint,
        linkedTaskId: task.id,
        linkedTaskTitle: task.title,
        status: existingWorkflow?.status || issue.status,
        statusNote: existingWorkflow?.statusNote ? undefined : taskPlan.statusNote,
      },
      actorLabel,
    );
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
