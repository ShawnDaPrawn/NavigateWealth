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
  const prefix = issue.category === 'security' ? 'Patch' : issue.category === 'runtime' ? 'Investigate' : 'Resolve';
  const location = issue.filePath ? `\nLocation: ${issue.filePath}` : '';
  const metadata = [
    issue.ruleId ? `Rule: ${issue.ruleId}` : '',
    issue.packageName ? `Package: ${issue.packageName}${issue.packageVersion ? `@${issue.packageVersion}` : ''}` : '',
    issue.referenceUrl ? `Reference: ${issue.referenceUrl}` : '',
    `Fingerprint: ${issue.fingerprint}`,
  ].filter(Boolean).join('\n');

  return {
    title: `${prefix}: ${issue.title}`.slice(0, 500),
    description: `${issue.message}${location}${metadata ? `\n\n${metadata}` : ''}`.slice(0, 5000),
    priority: issue.priority,
    category: 'internal' as const,
    tags: ['issue-manager', issue.category, issue.source],
  };
}

export async function createQualityIssueRemediationTask(issue: QualityIssue) {
  const task = await TasksAPI.createTask(buildIssueTaskPayload(issue));
  const workflow = await updateQualityIssueWorkflow({
    fingerprint: issue.fingerprint,
    linkedTaskId: task.id,
    linkedTaskTitle: task.title,
    status: issue.status === 'open' ? 'acknowledged' : issue.status,
    ownerName: issue.ownerName || undefined,
    statusNote: issue.statusNote || undefined,
    resolutionEvidence: issue.resolutionEvidence || undefined,
  });

  return {
    task,
    workflow,
    issue: applyQualityIssueWorkflow(issue, workflow),
  };
}
