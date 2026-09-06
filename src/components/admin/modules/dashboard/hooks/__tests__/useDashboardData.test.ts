/**
 * Tests for useDashboardData hook.
 *
 * Strategy: mock @tanstack/react-query's useQuery, the AuthContext, the API
 * module, and queryKeys. Call the hook directly to assert on queryKey,
 * enabled flag, staleTime, retry, refetchInterval, and the aggregated return
 * values.
 *
 * The hook fires THREE queries. System Activity is derived from stats and
 * metrics, not fetched — a fourth query for it re-requested both endpoints
 * and doubled the cost of every dashboard load.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// The hook derives System Activity inside useMemo. Called outside a render,
// React's real useMemo would throw, so stand it up as plain evaluation.
vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useMemo: (factory: () => unknown) => factory(),
}));

vi.mock('../../../../../auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../api', () => ({
  dashboardApi: {
    stats: { getStats: (...args: unknown[]) => mockGetStats(...args) },
    metrics: { getMetrics: (...args: unknown[]) => mockGetMetrics(...args) },
    tasks: { getDueToday: (...args: unknown[]) => mockGetDueToday(...args) },
  },
}));

vi.mock('../queryKeys', () => ({
  dashboardKeys: {
    all: ['dashboard'],
    stats: () => ['dashboard-stats'],
    metrics: () => ['dashboard-metrics'],
    tasksToday: () => ['dashboard-tasks-today'],
  },
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
const mockGetStats = vi.fn();
const mockGetMetrics = vi.fn();
const mockGetDueToday = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useDashboardData } from '../useDashboardData';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
  staleTime?: number;
  retry?: boolean;
  refetchInterval?: number | false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Set up three successive useQuery calls, each returning the given value. */
function setupQueries(
  overrides: Partial<{
    statsData: unknown;
    metricsData: unknown;
    tasksData: unknown;
    isLoading: boolean;
    error: Error | null;
  }> = {},
) {
  const defaultReturn = { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
  const makeReturn = (data: unknown) => ({
    ...defaultReturn,
    data,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn().mockResolvedValue(undefined),
  });

  mockUseQuery
    .mockReturnValueOnce(makeReturn(overrides.statsData ?? undefined))
    .mockReturnValueOnce(makeReturn(overrides.metricsData ?? undefined))
    .mockReturnValueOnce(makeReturn(overrides.tasksData ?? undefined));
}

function setAdmin(isAdmin = true) {
  mockUseAuth.mockReturnValue({
    isAuthenticated: isAdmin,
    user: { role: isAdmin ? 'admin' : 'viewer' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useDashboardData — query configuration (admin user)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdmin(true);
  });

  it('three useQuery calls are made — one per fetched data domain', () => {
    setupQueries();
    useDashboardData();
    expect(mockUseQuery).toHaveBeenCalledTimes(3);
  });

  it('stats query uses dashboard-stats key', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    expect(captured[0].queryKey).toEqual(['dashboard-stats']);
  });

  it('metrics query uses dashboard-metrics key', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    expect(captured[1].queryKey).toEqual(['dashboard-metrics']);
  });

  it('tasks query uses dashboard-tasks-today key', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    expect(captured[2].queryKey).toEqual(['dashboard-tasks-today']);
  });

  it('all queries have staleTime of 30 000ms', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.staleTime).toBe(30000));
  });

  it('all queries have retry: false', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.retry).toBe(false));
  });

  it('queries are enabled for admin users', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.enabled).toBe(true));
  });

  it('queries have refetchInterval of 60 000ms for admin users', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.refetchInterval).toBe(60000));
  });
});

// ── Non-admin user ────────────────────────────────────────────────────────────

describe('useDashboardData — non-admin user', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdmin(false);
  });

  it('queries are disabled for non-admin users', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.enabled).toBe(false));
  });

  it('refetchInterval is false for non-admin users', () => {
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    captured.forEach((opts) => expect(opts.refetchInterval).toBe(false));
  });
});

// ── Returned state ────────────────────────────────────────────────────────────

describe('useDashboardData — returned state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdmin(true);
  });

  it('stats defaults to null when data is undefined', () => {
    setupQueries();
    const result = useDashboardData();
    expect(result.stats).toBeNull();
  });

  it('stats reflects data when query returns data', () => {
    const statsData = { total_clients: 10, pending_tasks: 2 };
    setupQueries({ statsData });
    const result = useDashboardData();
    expect(result.stats).toEqual(statsData);
  });

  it('metrics defaults to null when data is undefined', () => {
    setupQueries();
    const result = useDashboardData();
    expect(result.metrics).toBeNull();
  });

  it('tasks defaults to [] when data is undefined', () => {
    setupQueries();
    const result = useDashboardData();
    expect(result.tasks).toEqual([]);
  });

  it('tasks reflects data when query returns array', () => {
    const tasksData = [{ id: 't-1' }];
    setupQueries({ tasksData });
    const result = useDashboardData();
    expect(result.tasks).toEqual(tasksData);
  });

  it('activities is empty until stats and metrics have both arrived', () => {
    setupQueries();
    expect(useDashboardData().activities).toEqual([]);

    setupQueries({ statsData: { new_this_month: 3, new_last_month: 0, pending_tasks: 7 } });
    expect(useDashboardData().activities).toEqual([]);
  });

  it('derives activities from stats and metrics rather than fetching them', () => {
    setupQueries({
      statsData: { new_this_month: 3, new_last_month: 0, pending_tasks: 7 },
      metricsData: { newPoliciesCount: 4, completedFNAs: 9 },
    });
    const byType = new Map(useDashboardData().activities.map((a) => [a.type, a.count]));
    expect(byType.get('new_applications')).toBe(3);
    expect(byType.get('new_policies')).toBe(4);
    expect(byType.get('pending_tasks')).toBe(7);
    expect(byType.get('completed_fnas')).toBe(9);
    // Three queries, not four: the old activity query re-fetched stats+metrics.
    expect(mockUseQuery).toHaveBeenCalledTimes(3);
  });

  it('loading is true when any query is loading', () => {
    setupQueries({ isLoading: true });
    const result = useDashboardData();
    expect(result.loading).toBe(true);
  });

  it('loading is false when no queries are loading', () => {
    setupQueries({ isLoading: false });
    const result = useDashboardData();
    expect(result.loading).toBe(false);
  });

  it('error is null when all queries succeed', () => {
    setupQueries();
    const result = useDashboardData();
    expect(result.error).toBeNull();
  });

  it('error contains error message when a query fails', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: new Error('stats failed'),
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    const result = useDashboardData();
    expect(result.error).toBe('stats failed');
  });

  it('error joins multiple error messages with "; "', () => {
    mockUseQuery
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: new Error('err1'),
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({
        data: undefined,
        isLoading: false,
        error: new Error('err2'),
        refetch: vi.fn(),
      })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    const result = useDashboardData();
    expect(result.error).toBe('err1; err2');
  });

  it('loadingStates has individual loading flags', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    const result = useDashboardData();
    expect(result.loadingStates).toEqual({
      stats: true,
      metrics: false,
      tasks: false,
      // Derived from stats + metrics, so it is loading while either is.
      activities: true,
    });
  });

  it('tasks loading does not hold up the activity tiles', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
      .mockReturnValueOnce({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
      .mockReturnValueOnce({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    const { loadingStates } = useDashboardData();
    expect(loadingStates.tasks).toBe(true);
    expect(loadingStates.activities).toBe(false);
    expect(loadingStates.stats).toBe(false);
  });
});

// ── queryFn wiring ────────────────────────────────────────────────────────────

describe('useDashboardData — queryFn wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAdmin(true);
  });

  it('stats queryFn calls dashboardApi.stats.getStats', async () => {
    const statsResult = { total_clients: 5 };
    mockGetStats.mockResolvedValue(statsResult);
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    const result = await captured[0].queryFn();
    expect(result).toEqual(statsResult);
    expect(mockGetStats).toHaveBeenCalledOnce();
  });

  it('tasks queryFn calls dashboardApi.tasks.getDueToday', async () => {
    const tasksResult = [{ id: 't-1' }];
    mockGetDueToday.mockResolvedValue(tasksResult);
    const captured: QueryOptions[] = [];
    mockUseQuery.mockImplementation((opts: unknown) => {
      captured.push(opts as QueryOptions);
      return { data: undefined, isLoading: false, error: null, refetch: vi.fn() };
    });
    useDashboardData();
    const result = await captured[2].queryFn();
    expect(result).toEqual(tasksResult);
    expect(mockGetDueToday).toHaveBeenCalledOnce();
  });
});
