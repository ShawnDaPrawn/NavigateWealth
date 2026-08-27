/**
 * Quality-issue state assembly: loading the stored snapshot/workflow/feeds,
 * building the combined current snapshot, and running automation over it.
 * Moved verbatim from quality-issues-routes.ts.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  applyQualityIssueWorkflow,
  coalesceQualityIssuesByFingerprint,
  createEmptyQualityIssueSnapshot,
  summarizeQualityIssues,
  type QualityIssueAutomationRun,
  type QualityIssue,
  type QualityIssueSnapshot,
  type QualityIssueWorkflowState,
} from '../../../shared/quality/qualityIssues.ts';
import { getRuntimeServerIssues } from './quality-issues-runtime-server.ts';
import {
  AUTOMATION_STATE_KEY,
  ISSUE_WORKFLOW_KEY,
  LATEST_SNAPSHOT_KEY,
  RUNTIME_CLIENT_ISSUES_KEY,
  CSP_VIOLATION_ISSUES_KEY,
  SECURITY_FEED_ISSUES_KEY,
  normalizeAutomationRun,
  normalizeIssue,
  normalizeWorkflowMap,
} from './quality-issues-normalize.ts';
import { reopenRecurringWorkflows, runIssueAutomation } from './quality-issues-automation.ts';

const log = createModuleLogger('quality-issues');

export async function loadQualityIssueState(): Promise<{
  baseSnapshot: QualityIssueSnapshot;
  baseRuntimeIssues: QualityIssue[];
  baseSecurityFeedIssues: QualityIssue[];
  workflowState: Record<string, QualityIssueWorkflowState>;
  automation?: QualityIssueAutomationRun;
}> {
  const snapshot = (await kv.get(LATEST_SNAPSHOT_KEY)) as QualityIssueSnapshot | null;
  const runtimeIssues = (await kv.get(RUNTIME_CLIENT_ISSUES_KEY)) as QualityIssue[] | null;
  const securityFeedIssues = (await kv.get(SECURITY_FEED_ISSUES_KEY)) as QualityIssue[] | null;
  // CSP violations land in their own key (an unauthenticated endpoint feeds it,
  // so a burst must not evict advisory findings) but belong on the same
  // dashboard — they are security findings about this deployment.
  const cspViolations = (await kv.get(CSP_VIOLATION_ISSUES_KEY)) as QualityIssue[] | null;
  // Server-side runtime errors (source: 'runtime-server') are recorded by the
  // error middleware via quality-issues-runtime-server.ts. Fold them into the
  // runtime bucket so they appear in the dashboard snapshot alongside client
  // errors — coalesceQualityIssuesByFingerprint keeps the two sources distinct.
  const runtimeServerIssues = await getRuntimeServerIssues();

  return {
    baseSnapshot: snapshot || createEmptyQualityIssueSnapshot(),
    baseRuntimeIssues: [
      ...(Array.isArray(runtimeIssues) ? runtimeIssues : []),
      ...runtimeServerIssues,
    ],
    baseSecurityFeedIssues: [
      ...(Array.isArray(securityFeedIssues) ? securityFeedIssues : []),
      ...(Array.isArray(cspViolations) ? cspViolations : []),
    ],
    workflowState: normalizeWorkflowMap(await kv.get(ISSUE_WORKFLOW_KEY)),
    automation: normalizeAutomationRun(await kv.get(AUTOMATION_STATE_KEY)),
  };
}

export async function buildCurrentSnapshot(
  state?: Awaited<ReturnType<typeof loadQualityIssueState>>,
): Promise<{
  snapshot: QualityIssueSnapshot;
  workflowState: Record<string, QualityIssueWorkflowState>;
  state: Awaited<ReturnType<typeof loadQualityIssueState>>;
}> {
  const loadedState = state || (await loadQualityIssueState());
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

export async function runAutomationOnCurrentState(actorLabel: string): Promise<{
  snapshot: QualityIssueSnapshot;
  automation: QualityIssueAutomationRun;
}> {
  const current = await buildCurrentSnapshot();
  const result = await runIssueAutomation(
    current.snapshot.issues,
    current.workflowState,
    actorLabel,
  );

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

export function combineSnapshots(
  ciSnapshot: QualityIssueSnapshot,
  runtimeIssues: QualityIssue[],
  securityFeedIssues: QualityIssue[],
  workflowState: Record<string, QualityIssueWorkflowState>,
): QualityIssueSnapshot {
  const now = new Date().toISOString();
  const ciIssues = Array.isArray(ciSnapshot.issues)
    ? ciSnapshot.issues.map((issue, index) =>
        normalizeIssue(issue as unknown as Record<string, unknown>, index, now),
      )
    : [];
  const normalizedRuntimeIssues = runtimeIssues.map((issue, index) =>
    normalizeIssue(issue as unknown as Record<string, unknown>, index, now),
  );
  const normalizedSecurityIssues = securityFeedIssues.map((issue, index) =>
    normalizeIssue(issue as unknown as Record<string, unknown>, index, now),
  );
  const issues = coalesceQualityIssuesByFingerprint([
    ...ciIssues,
    ...normalizedRuntimeIssues,
    ...normalizedSecurityIssues,
  ]).map((issue) => applyQualityIssueWorkflow(issue, workflowState[issue.fingerprint]));

  return {
    ...ciSnapshot,
    generatedAt: now,
    issues,
    summary: summarizeQualityIssues(issues),
  };
}
