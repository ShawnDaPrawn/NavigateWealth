import { api } from '../../../../utils/api/client';
import { TasksAPI } from '../tasks/api';
import type {
  QualityIssueAutomationRun,
  QualityIssue,
  QualityIssueSnapshot,
  QualityIssueWorkflowState,
  QualityIssueWorkflowUpdate,
} from './types';
import {
  applyQualityIssueWorkflow,
  createQualityIssueFingerprint,
  inferQualityIssueCategory,
  inferQualityIssuePriority,
  summarizeQualityIssues,
} from '../../../../shared/quality/qualityIssues';
import { buildQualityIssueTaskPlan } from '../../../../shared/quality/qualityIssueTasks';

function normalizeSnapshotForClient(snapshot: QualityIssueSnapshot): QualityIssueSnapshot {
  const issues = (snapshot.issues || []).map((issue) => {
    const category = issue.category || inferQualityIssueCategory(issue.source, issue.ruleId);
    const priority = issue.priority || inferQualityIssuePriority({
      source: issue.source,
      severity: issue.severity,
      category,
      cvssScore: issue.cvssScore,
    });
    const normalizedIssue = {
      ...issue,
      category,
      priority,
    };

    return {
      ...normalizedIssue,
      fingerprint: issue.fingerprint || createQualityIssueFingerprint(normalizedIssue),
    };
  });

  return {
    ...snapshot,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}

export async function fetchQualityIssuesSnapshot(): Promise<QualityIssueSnapshot> {
  const response = await api.get<{ success: boolean; snapshot: QualityIssueSnapshot }>('/quality-issues');
  return normalizeSnapshotForClient(response.snapshot);
}

export async function updateQualityIssueWorkflow(
  input: QualityIssueWorkflowUpdate,
): Promise<QualityIssueWorkflowState> {
  const response = await api.patch<{ success: boolean; workflow: QualityIssueWorkflowState }>(
    '/quality-issues/workflow',
    input,
  );

  return response.workflow;
}

export async function runQualityIssueAutomation(): Promise<{
  automation: QualityIssueAutomationRun;
  snapshot: QualityIssueSnapshot;
}> {
  const response = await api.post<{
    success: boolean;
    automation: QualityIssueAutomationRun;
    snapshot: QualityIssueSnapshot;
  }>('/quality-issues/automation/run', {});

  return {
    automation: response.automation,
    snapshot: normalizeSnapshotForClient(response.snapshot),
  };
}

function buildIssueTaskPayload(issue: QualityIssue) {
  const plan = buildQualityIssueTaskPlan(issue);

  return {
    title: plan.title,
    description: plan.description,
    priority: issue.priority,
    category: 'internal' as const,
    tags: plan.tags,
  };
}

export async function createQualityIssueRemediationTask(issue: QualityIssue) {
  const taskPlan = buildQualityIssueTaskPlan(issue);
  const task = await TasksAPI.createTask(buildIssueTaskPayload(issue));
  await TasksAPI.saveChecklist(
    task.id,
    taskPlan.checklist.map((text, index) => ({
      id: `${task.id}-issue-step-${index + 1}`,
      text,
      completed: false,
    })),
  );
  const workflow = await updateQualityIssueWorkflow({
    fingerprint: issue.fingerprint,
    linkedTaskId: task.id,
    linkedTaskTitle: task.title,
    status: issue.status === 'open' ? 'acknowledged' : issue.status,
    ownerName: issue.ownerName || undefined,
    statusNote: issue.statusNote || taskPlan.statusNote,
    resolutionEvidence: issue.resolutionEvidence || undefined,
  });

  return {
    task,
    workflow,
    issue: applyQualityIssueWorkflow(issue, workflow),
  };
}
