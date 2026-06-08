/**
 * issues/api.ts — unit tests
 *
 * Mocks `utils/api/client` so no real HTTP calls are made.
 * Also mocks the shared quality helpers to keep tests deterministic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  QualityIssue,
  QualityIssueSnapshot,
  QualityIssueWorkflowState,
  QualityIssueWorkflowUpdate,
  QualityIssueAutomationRun,
  QualityIssueSummary,
} from '../types';

// ── Mock api client ──────────────────────────────────────────────────────────
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
    patch: (...a: unknown[]) => mockApiPatch(...a),
  },
}));

// ── Mock TasksAPI ────────────────────────────────────────────────────────────
const mockCreateTask = vi.fn();
const mockSaveChecklist = vi.fn();

vi.mock('../../tasks/api', () => ({
  TasksAPI: {
    createTask: (...a: unknown[]) => mockCreateTask(...a),
    saveChecklist: (...a: unknown[]) => mockSaveChecklist(...a),
  },
}));

// ── Mock shared quality helpers ──────────────────────────────────────────────
vi.mock('../../../../../shared/quality/qualityIssues', () => ({
  applyQualityIssueWorkflow: (issue: QualityIssue, workflow: QualityIssueWorkflowState) => ({
    ...issue,
    ...workflow,
  }),
  createQualityIssueFingerprint: () => 'fp-test',
  inferQualityIssueCategory: () => 'security',
  inferQualityIssuePriority: () => 'high',
  summarizeQualityIssues: (issues: QualityIssue[]) => ({ total: issues.length }),
}));

vi.mock('../../../../../shared/quality/qualityIssueTasks', () => ({
  buildQualityIssueTaskPlan: () => ({
    title: 'Fix issue',
    description: 'Resolve the issue',
    tags: ['security'],
    checklist: ['Step 1', 'Step 2'],
    statusNote: 'Auto-generated',
  }),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import {
  fetchQualityIssuesSnapshot,
  updateQualityIssueWorkflow,
  runQualityIssueAutomation,
  createQualityIssueRemediationTask,
} from '../api';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const makeIssue = (overrides: Partial<QualityIssue> = {}): QualityIssue => ({
  id: 'issue-1',
  fingerprint: 'fp-001',
  source: 'audit',
  ruleId: 'rule-1',
  severity: 'error',
  category: 'security',
  priority: 'high',
  status: 'open',
  title: 'Test Issue',
  message: 'Something is wrong',
  filePath: undefined,
  line: undefined,
  column: undefined,
  cvssScore: undefined,
  ownerName: undefined,
  statusNote: undefined,
  resolutionEvidence: undefined,
  firstSeenAt: '2025-01-01T00:00:00Z',
  lastSeenAt: '2025-01-01T00:00:00Z',
  occurrences: 1,
  ...overrides,
});

const makeSnapshot = (overrides: Partial<QualityIssueSnapshot> = {}): QualityIssueSnapshot => ({
  generatedAt: '2025-01-01T00:00:00Z',
  issues: [makeIssue()],
  summary: {
    total: 1,
    open: 1,
    acknowledged: 0,
    resolved: 0,
    critical: 0,
    high: 1,
    medium: 0,
    low: 0,
  } as unknown as QualityIssueSummary,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveChecklist.mockResolvedValue(undefined);
});

// ── fetchQualityIssuesSnapshot ────────────────────────────────────────────────
describe('fetchQualityIssuesSnapshot', () => {
  it('returns normalized snapshot on success', async () => {
    const snapshot = makeSnapshot();
    mockApiGet.mockResolvedValue({ success: true, snapshot });

    const result = await fetchQualityIssuesSnapshot();
    expect(mockApiGet).toHaveBeenCalledWith('/quality-issues');
    // normalizeSnapshotForClient re-infers category/priority and recalculates summary
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].category).toBeDefined();
  });

  it('normalizes issues without category/priority', async () => {
    const issue = makeIssue({
      category: undefined as unknown as 'security',
      priority: undefined as unknown as 'high',
    });
    const snapshot = makeSnapshot({ issues: [issue] });
    mockApiGet.mockResolvedValue({ success: true, snapshot });

    const result = await fetchQualityIssuesSnapshot();
    expect(result.issues[0].category).toBe('security'); // from mock
    expect(result.issues[0].priority).toBe('high'); // from mock
  });

  it('propagates errors thrown by the api client', async () => {
    mockApiGet.mockRejectedValue(new Error('API error'));
    await expect(fetchQualityIssuesSnapshot()).rejects.toThrow('API error');
  });

  it('handles empty issues array', async () => {
    const snapshot = makeSnapshot({ issues: [] });
    mockApiGet.mockResolvedValue({ success: true, snapshot });

    const result = await fetchQualityIssuesSnapshot();
    expect(result.issues).toHaveLength(0);
  });
});

// ── updateQualityIssueWorkflow ────────────────────────────────────────────────
describe('updateQualityIssueWorkflow', () => {
  it('returns workflow state on success', async () => {
    const workflow: QualityIssueWorkflowState = {
      fingerprint: 'fp-001',
      status: 'acknowledged',
    };
    mockApiPatch.mockResolvedValue({ success: true, workflow });

    const input: QualityIssueWorkflowUpdate = {
      fingerprint: 'fp-001',
      status: 'acknowledged',
    };

    const result = await updateQualityIssueWorkflow(input);
    expect(mockApiPatch).toHaveBeenCalledWith('/quality-issues/workflow', input);
    expect(result).toEqual(workflow);
  });

  it('propagates errors thrown by the api client', async () => {
    mockApiPatch.mockRejectedValue(new Error('Patch failed'));
    await expect(updateQualityIssueWorkflow({ fingerprint: 'fp-001' })).rejects.toThrow(
      'Patch failed',
    );
  });
});

// ── runQualityIssueAutomation ─────────────────────────────────────────────────
describe('runQualityIssueAutomation', () => {
  it('returns automation run and normalized snapshot on success', async () => {
    const automation: QualityIssueAutomationRun = {
      runAt: '2025-01-01T00:00:00Z',
      runBy: 'system',
      activeAlerts: 0,
      criticalAlerts: 0,
      tasksCreated: 0,
      tasksLinked: 0,
      alerts: [],
    };
    const snapshot = makeSnapshot();
    mockApiPost.mockResolvedValue({ success: true, automation, snapshot });

    const result = await runQualityIssueAutomation();
    expect(mockApiPost).toHaveBeenCalledWith('/quality-issues/automation/run', {});
    expect(result.automation).toEqual(automation);
    expect(result.snapshot.issues).toHaveLength(1);
  });

  it('propagates errors thrown by the api client', async () => {
    mockApiPost.mockRejectedValue(new Error('Post failed'));
    await expect(runQualityIssueAutomation()).rejects.toThrow('Post failed');
  });
});

// ── createQualityIssueRemediationTask ─────────────────────────────────────────
describe('createQualityIssueRemediationTask', () => {
  it('creates a task and saves checklist, then updates workflow', async () => {
    const createdTask = {
      id: 'task-1',
      title: 'Fix issue',
      status: 'open',
      priority: 'high',
      category: 'internal',
    };
    const workflow: QualityIssueWorkflowState = {
      fingerprint: 'fp-001',
      status: 'acknowledged',
      linkedTaskId: 'task-1',
      linkedTaskTitle: 'Fix issue',
    };

    mockCreateTask.mockResolvedValue(createdTask);
    mockApiPatch.mockResolvedValue({ success: true, workflow });

    const issue = makeIssue();
    const result = await createQualityIssueRemediationTask(issue);

    expect(mockCreateTask).toHaveBeenCalledOnce();
    expect(mockSaveChecklist).toHaveBeenCalledOnce();
    expect(mockSaveChecklist).toHaveBeenCalledWith(
      'task-1',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Step 1', completed: false }),
        expect.objectContaining({ text: 'Step 2', completed: false }),
      ]),
    );
    expect(result.task).toEqual(createdTask);
    expect(result.workflow).toEqual(workflow);
  });

  it('propagates errors from task creation', async () => {
    mockCreateTask.mockRejectedValue(new Error('Create task failed'));
    await expect(createQualityIssueRemediationTask(makeIssue())).rejects.toThrow(
      'Create task failed',
    );
  });

  it('sets status to acknowledged when issue is open', async () => {
    const createdTask = {
      id: 'task-2',
      title: 'Fix',
      status: 'open',
      priority: 'high',
      category: 'internal',
    };
    const workflow: QualityIssueWorkflowState = { fingerprint: 'fp-001', status: 'acknowledged' };

    mockCreateTask.mockResolvedValue(createdTask);
    mockApiPatch.mockResolvedValue({ success: true, workflow });

    const issue = makeIssue({ status: 'open' });
    await createQualityIssueRemediationTask(issue);

    const patchCall = mockApiPatch.mock.calls[0][1] as QualityIssueWorkflowUpdate;
    expect(patchCall.status).toBe('acknowledged');
  });

  it('preserves existing status when issue is not open', async () => {
    const createdTask = {
      id: 'task-3',
      title: 'Fix',
      status: 'open',
      priority: 'high',
      category: 'internal',
    };
    const workflow: QualityIssueWorkflowState = { fingerprint: 'fp-001', status: 'resolved' };

    mockCreateTask.mockResolvedValue(createdTask);
    mockApiPatch.mockResolvedValue({ success: true, workflow });

    const issue = makeIssue({ status: 'resolved' });
    await createQualityIssueRemediationTask(issue);

    const patchCall = mockApiPatch.mock.calls[0][1] as QualityIssueWorkflowUpdate;
    expect(patchCall.status).toBe('resolved');
  });
});
