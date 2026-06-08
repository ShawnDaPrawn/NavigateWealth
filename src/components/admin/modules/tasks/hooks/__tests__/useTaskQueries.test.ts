/**
 * Tests for task query hooks.
 *
 * Strategy: mock @tanstack/react-query's `useQuery` so we can inspect the
 * options object (queryKey, queryFn, staleTime, enabled, retry) without
 * needing a QueryClientProvider or live network. Each test calls the hook,
 * captures the options useQuery received, and asserts on them.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('../../api', () => ({
  TasksAPI: {
    getTasks: (...args: unknown[]) => mockGetTasks(...args),
    getTask: (...args: unknown[]) => mockGetTask(...args),
  },
  TaskStatsAPI: {
    getStats: (...args: unknown[]) => mockGetStats(...args),
  },
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockGetTasks = vi.fn();
const mockGetTask = vi.fn();
const mockGetStats = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useTasks, useTask, useTaskStats, taskKeys } from '../useTaskQueries';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  retry?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
}

function captureQueryOptions(invoke: () => void): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {};
  });
  invoke();
  return captured!;
}

// ── taskKeys factory ──────────────────────────────────────────────────────────

describe('taskKeys', () => {
  it('all is ["tasks"]', () => {
    expect(taskKeys.all).toEqual(['tasks']);
  });

  it('lists() appends "list"', () => {
    expect(taskKeys.lists()).toEqual(['tasks', 'list']);
  });

  it('list(filter) appends filter string', () => {
    expect(taskKeys.list('active')).toEqual(['tasks', 'list', 'active']);
  });

  it('stats() returns tasks stats key', () => {
    expect(taskKeys.stats()).toEqual(['tasks', 'stats']);
  });

  it('detail(id) returns tasks detail key', () => {
    expect(taskKeys.detail('abc')).toEqual(['tasks', 'detail', 'abc']);
  });
});

// ── useTasks ──────────────────────────────────────────────────────────────────

describe('useTasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.queryKey).toEqual(taskKeys.lists());
  });

  it('passes staleTime of 30 000ms', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.staleTime).toBe(30000);
  });

  it('passes gcTime of 5 minutes', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.gcTime).toBe(5 * 60 * 1000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.retry).toBe(false);
  });

  it('passes refetchOnWindowFocus: false', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.refetchOnWindowFocus).toBe(false);
  });

  it('passes refetchOnMount: true', () => {
    const opts = captureQueryOptions(() => useTasks());
    expect(opts.refetchOnMount).toBe(true);
  });

  it('queryFn calls TasksAPI.getTasks', async () => {
    mockGetTasks.mockResolvedValue([]);
    const opts = captureQueryOptions(() => useTasks());
    await opts.queryFn();
    expect(mockGetTasks).toHaveBeenCalledOnce();
  });
});

// ── useTask ───────────────────────────────────────────────────────────────────

describe('useTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey for a given id', () => {
    const opts = captureQueryOptions(() => useTask('task-1'));
    expect(opts.queryKey).toEqual(taskKeys.detail('task-1'));
  });

  it('passes staleTime of 30 000ms', () => {
    const opts = captureQueryOptions(() => useTask('task-1'));
    expect(opts.staleTime).toBe(30000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => useTask('task-1'));
    expect(opts.retry).toBe(false);
  });

  it('is enabled when id is provided and enabled is true (default)', () => {
    const opts = captureQueryOptions(() => useTask('task-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when enabled is explicitly false', () => {
    const opts = captureQueryOptions(() => useTask('task-1', false));
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when id is empty string', () => {
    const opts = captureQueryOptions(() => useTask(''));
    expect(opts.enabled).toBe(false);
  });

  it('queryFn calls TasksAPI.getTask with the id', async () => {
    mockGetTask.mockResolvedValue({ id: 'task-1' });
    const opts = captureQueryOptions(() => useTask('task-1'));
    await opts.queryFn();
    expect(mockGetTask).toHaveBeenCalledWith('task-1');
  });
});

// ── useTaskStats ──────────────────────────────────────────────────────────────

describe('useTaskStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useTaskStats());
    expect(opts.queryKey).toEqual(taskKeys.stats());
  });

  it('passes staleTime of 30 000ms', () => {
    const opts = captureQueryOptions(() => useTaskStats());
    expect(opts.staleTime).toBe(30000);
  });

  it('passes retry: false', () => {
    const opts = captureQueryOptions(() => useTaskStats());
    expect(opts.retry).toBe(false);
  });

  it('queryFn calls TaskStatsAPI.getStats', async () => {
    mockGetStats.mockResolvedValue({ total: 0, new: 0, in_progress: 0, completed: 0, archived: 0 });
    const opts = captureQueryOptions(() => useTaskStats());
    await opts.queryFn();
    expect(mockGetStats).toHaveBeenCalledOnce();
  });
});
