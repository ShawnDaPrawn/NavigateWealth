import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dashboardStatsApi,
  dashboardMetricsApi,
  tasksApi,
  systemActivityApi,
  dashboardApi,
  systemHealthApi,
  adminAuditApi,
} from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../../utils/errorUtils', () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
}));

const MOCK_STATS = {
  total_clients: 42,
  pending_applications: 5,
  pending_tasks: 8,
  new_this_month: 10,
  new_last_month: 6,
  total_completed: 30,
  avg_completion_time: 3.5,
};

const MOCK_METRICS = {
  activePolicies: 100,
  newPoliciesCount: 12,
  publishedFnas: 20,
};

const MOCK_TASK = {
  id: 'task-001',
  title: 'Review plan',
  priority: 'high',
  due_date: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dashboardStatsApi.getStats', () => {
  it('returns stats from API', async () => {
    mockApiGet.mockResolvedValue({ stats: MOCK_STATS });
    const result = await dashboardStatsApi.getStats();
    expect(result.total_clients).toBe(42);
  });

  it('returns empty stats on unauthorized error', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
    const result = await dashboardStatsApi.getStats();
    expect(result.total_clients).toBe(0);
    expect(result.pending_applications).toBe(0);
  });

  it('returns empty stats on server error (500)', async () => {
    mockApiGet.mockRejectedValue(
      Object.assign(new Error('Internal server error'), { statusCode: 500 }),
    );
    const result = await dashboardStatsApi.getStats();
    expect(result.total_clients).toBe(0);
  });

  it('throws on unexpected errors', async () => {
    mockApiGet.mockRejectedValue(Object.assign(new Error('Unexpected'), { statusCode: 400 }));
    await expect(dashboardStatsApi.getStats()).rejects.toThrow('Unexpected');
  });
});

describe('dashboardStatsApi.getClientCount', () => {
  it('returns total_clients from stats', async () => {
    mockApiGet.mockResolvedValue({ stats: MOCK_STATS });
    const count = await dashboardStatsApi.getClientCount();
    expect(count).toBe(42);
  });

  it('returns 0 on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const count = await dashboardStatsApi.getClientCount();
    expect(count).toBe(0);
  });
});

describe('dashboardStatsApi.getPendingApplicationsCount', () => {
  it('returns pending_applications count', async () => {
    mockApiGet.mockResolvedValue({ stats: MOCK_STATS });
    const count = await dashboardStatsApi.getPendingApplicationsCount();
    expect(count).toBe(5);
  });
});

describe('dashboardStatsApi.getPendingTasksCount', () => {
  it('returns pending_tasks count', async () => {
    mockApiGet.mockResolvedValue({ stats: MOCK_STATS });
    const count = await dashboardStatsApi.getPendingTasksCount();
    expect(count).toBe(8);
  });
});

describe('dashboardMetricsApi.getMetrics', () => {
  it('returns metrics from API', async () => {
    mockApiGet.mockResolvedValue(MOCK_METRICS);
    const metrics = await dashboardMetricsApi.getMetrics();
    expect(metrics.activePolicies).toBe(100);
    expect(metrics.newPoliciesCount).toBe(12);
    expect(metrics.completedFNAs).toBe(20);
  });

  it('returns zero metrics on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const metrics = await dashboardMetricsApi.getMetrics();
    expect(metrics.activePolicies).toBe(0);
    expect(metrics.completedFNAs).toBe(0);
  });
});

describe('dashboardMetricsApi.getActivePoliciesCount', () => {
  it('returns activePolicies from metrics', async () => {
    mockApiGet.mockResolvedValue(MOCK_METRICS);
    const count = await dashboardMetricsApi.getActivePoliciesCount();
    expect(count).toBe(100);
  });
});

describe('dashboardMetricsApi.getNewPoliciesCount', () => {
  it('returns newPoliciesCount from metrics', async () => {
    mockApiGet.mockResolvedValue(MOCK_METRICS);
    const count = await dashboardMetricsApi.getNewPoliciesCount();
    expect(count).toBe(12);
  });
});

describe('dashboardMetricsApi.getCompletedFNAsCount', () => {
  it('returns completedFNAs from metrics', async () => {
    mockApiGet.mockResolvedValue(MOCK_METRICS);
    const count = await dashboardMetricsApi.getCompletedFNAsCount();
    expect(count).toBe(20);
  });
});

describe('tasksApi.getDueToday', () => {
  it('returns tasks from API', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [MOCK_TASK] });
    const tasks = await tasksApi.getDueToday();
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('task-001');
  });

  it('returns empty array when data is absent', async () => {
    mockApiGet.mockResolvedValue({ success: true });
    const tasks = await tasksApi.getDueToday();
    expect(tasks).toEqual([]);
  });

  it('returns empty array on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const tasks = await tasksApi.getDueToday();
    expect(tasks).toEqual([]);
  });
});

describe('tasksApi.getByDate', () => {
  it('returns tasks for a specific date', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [MOCK_TASK] });
    const tasks = await tasksApi.getByDate(new Date('2025-01-15'));
    expect(tasks.length).toBe(1);
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining('2025-01-15'));
  });
});

describe('tasksApi.getDueTodayCount', () => {
  it('returns count of tasks due today', async () => {
    mockApiGet.mockResolvedValue({ success: true, data: [MOCK_TASK, MOCK_TASK] });
    const count = await tasksApi.getDueTodayCount();
    expect(count).toBe(2);
  });
});

describe('tasksApi.getHighPriorityDueToday', () => {
  it('returns only high/critical priority tasks', async () => {
    const lowTask = { ...MOCK_TASK, id: 't2', priority: 'low' };
    mockApiGet.mockResolvedValue({ success: true, data: [MOCK_TASK, lowTask] });
    const tasks = await tasksApi.getHighPriorityDueToday();
    expect(tasks.length).toBe(1);
    expect(tasks[0].priority).toBe('high');
  });
});

describe('systemActivityApi.getAll', () => {
  it('returns activity array with known types', async () => {
    mockApiGet.mockResolvedValueOnce({ stats: MOCK_STATS }).mockResolvedValueOnce(MOCK_METRICS);
    const activities = await systemActivityApi.getAll();
    const types = activities.map((a) => a.type);
    expect(types).toContain('new_applications');
    expect(types).toContain('pending_tasks');
    expect(types).toContain('completed_fnas');
  });

  it('calculates growth as 100 when previous month was 0', async () => {
    const statsWithNoLastMonth = { ...MOCK_STATS, new_last_month: 0, new_this_month: 5 };
    mockApiGet
      .mockResolvedValueOnce({ stats: statsWithNoLastMonth })
      .mockResolvedValueOnce(MOCK_METRICS);
    const activities = await systemActivityApi.getAll();
    const newApps = activities.find((a) => a.type === 'new_applications');
    expect(newApps?.growth).toBe(100);
  });

  it('returns empty array on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const activities = await systemActivityApi.getAll();
    expect(activities).toEqual([]);
  });
});

describe('systemActivityApi.getByType', () => {
  it('returns activity for a given type', async () => {
    mockApiGet.mockResolvedValueOnce({ stats: MOCK_STATS }).mockResolvedValueOnce(MOCK_METRICS);
    const activity = await systemActivityApi.getByType('pending_tasks');
    expect(activity?.type).toBe('pending_tasks');
    expect(activity?.count).toBe(8);
  });

  it('returns null for unknown type', async () => {
    mockApiGet.mockResolvedValueOnce({ stats: MOCK_STATS }).mockResolvedValueOnce(MOCK_METRICS);
    const activity = await systemActivityApi.getByType('unknown_type');
    expect(activity).toBeNull();
  });
});

describe('dashboardApi.getAll', () => {
  it('returns combined dashboard data', async () => {
    mockApiGet
      .mockResolvedValueOnce({ stats: MOCK_STATS }) // stats
      .mockResolvedValueOnce(MOCK_METRICS) // metrics
      .mockResolvedValueOnce({ success: true, data: [MOCK_TASK] }) // tasks
      .mockResolvedValueOnce({ stats: MOCK_STATS }) // systemActivity -> stats
      .mockResolvedValueOnce(MOCK_METRICS); // systemActivity -> metrics
    const data = await dashboardApi.getAll();
    expect(data.stats.total_clients).toBe(42);
    expect(data.tasks.length).toBe(1);
  });

  it('throws on complete failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Complete failure'));
    await expect(dashboardApi.getAll()).rejects.toThrow();
  });
});

describe('dashboardApi.refresh', () => {
  it('calls getAll', async () => {
    mockApiGet
      .mockResolvedValueOnce({ stats: MOCK_STATS })
      .mockResolvedValueOnce(MOCK_METRICS)
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ stats: MOCK_STATS })
      .mockResolvedValueOnce(MOCK_METRICS);
    const data = await dashboardApi.refresh();
    expect(data.stats).toBeDefined();
    expect(data.tasks).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// systemHealthApi
// ---------------------------------------------------------------------------

describe('systemHealthApi.getLastCleanupRun', () => {
  it('returns lastRun from API response', async () => {
    const lastRun = { ranAt: '2025-01-01T00:00:00Z', deletedCount: 12, dryRun: false };
    mockApiGet.mockResolvedValue({ success: true, lastRun });
    const result = await systemHealthApi.getLastCleanupRun();
    expect(result).toEqual(lastRun);
    expect(mockApiGet).toHaveBeenCalledWith('/kv-cleanup/status');
  });

  it('returns null when lastRun is null in response', async () => {
    mockApiGet.mockResolvedValue({ success: true, lastRun: null });
    const result = await systemHealthApi.getLastCleanupRun();
    expect(result).toBeNull();
  });

  it('returns null on API failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const result = await systemHealthApi.getLastCleanupRun();
    expect(result).toBeNull();
  });
});

describe('systemHealthApi.runCleanup', () => {
  it('posts to cleanup endpoint with default dryRun=true and retentionDays=90', async () => {
    const cleanupResult = { success: true, deletedCount: 5, dryRun: true };
    mockApiPost.mockResolvedValue(cleanupResult);
    const result = await systemHealthApi.runCleanup();
    expect(mockApiPost).toHaveBeenCalledWith('/kv-cleanup/run', {
      dryRun: true,
      retentionDays: 90,
    });
    expect(result).toEqual(cleanupResult);
  });

  it('posts with explicit dryRun=false and custom retentionDays', async () => {
    const cleanupResult = { success: true, deletedCount: 20, dryRun: false };
    mockApiPost.mockResolvedValue(cleanupResult);
    await systemHealthApi.runCleanup({ dryRun: false, retentionDays: 30 });
    expect(mockApiPost).toHaveBeenCalledWith('/kv-cleanup/run', {
      dryRun: false,
      retentionDays: 30,
    });
  });

  it('returns null on API failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Server error'));
    const result = await systemHealthApi.runCleanup();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adminAuditApi
// ---------------------------------------------------------------------------

describe('adminAuditApi.getLog', () => {
  it('returns entries from API with no filters', async () => {
    const entries = [{ id: 'e1', action: 'login', category: 'auth', severity: 'info' }];
    mockApiGet.mockResolvedValue({ success: true, entries });
    const result = await adminAuditApi.getLog();
    expect(result).toEqual(entries);
    expect(mockApiGet).toHaveBeenCalledWith('/admin-audit/log');
  });

  it('appends query params when filters are provided', async () => {
    mockApiGet.mockResolvedValue({ success: true, entries: [] });
    await adminAuditApi.getLog({
      category: 'security' as const,
      severity: 'warning' as const,
      limit: 25,
    });
    const calledUrl = mockApiGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('category=security');
    expect(calledUrl).toContain('severity=warning');
    expect(calledUrl).toContain('limit=25');
  });

  it('returns empty array when entries field is absent', async () => {
    mockApiGet.mockResolvedValue({ success: true });
    const result = await adminAuditApi.getLog();
    expect(result).toEqual([]);
  });

  it('returns empty array on API failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const result = await adminAuditApi.getLog();
    expect(result).toEqual([]);
  });
});

describe('adminAuditApi.getSummary', () => {
  it('returns summary with default days=7', async () => {
    const summary = { auth: 3, data: 1 };
    mockApiGet.mockResolvedValue({ success: true, days: 7, summary });
    const result = await adminAuditApi.getSummary();
    expect(result?.days).toBe(7);
    expect(result?.summary).toEqual(summary);
    expect(mockApiGet).toHaveBeenCalledWith('/admin-audit/summary?days=7');
  });

  it('accepts a custom days argument', async () => {
    mockApiGet.mockResolvedValue({ success: true, days: 30, summary: {} });
    await adminAuditApi.getSummary(30);
    expect(mockApiGet).toHaveBeenCalledWith('/admin-audit/summary?days=30');
  });

  it('returns null on API failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network fail'));
    const result = await adminAuditApi.getSummary();
    expect(result).toBeNull();
  });
});
