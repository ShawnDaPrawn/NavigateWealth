/**
 * dashboard/prefetch — warms the queries the dashboard is about to run.
 *
 * The contract that matters is cache identity: the prefetch must land under
 * exactly the keys `useDashboardData` reads, or it is pure extra load. It must
 * also stay a best-effort optimisation — a failure here can never surface as a
 * rejection at the call site, which sits in an auth callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '../../../../../utils/queryKeys';

const mockGetStats = vi.fn();
const mockGetMetrics = vi.fn();
const mockGetDueToday = vi.fn();

vi.mock('../api', () => ({
  dashboardApi: {
    stats: { getStats: () => mockGetStats() },
    metrics: { getMetrics: () => mockGetMetrics() },
    tasks: { getDueToday: () => mockGetDueToday() },
  },
}));

import { prefetchDashboardData } from '../prefetch';

const STATS = { total_clients: 42, pending_tasks: 8 };
const METRICS = { activePolicies: 100, newPoliciesCount: 12, completedFNAs: 20, pendingFNAs: 0 };
const TASKS = [{ id: 't-1' }];

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetStats.mockResolvedValue(STATS);
  mockGetMetrics.mockResolvedValue(METRICS);
  mockGetDueToday.mockResolvedValue(TASKS);
});

describe('prefetchDashboardData', () => {
  it('fills the cache under the keys the dashboard queries read', async () => {
    const queryClient = makeClient();
    await prefetchDashboardData(queryClient);

    expect(queryClient.getQueryData(dashboardKeys.stats())).toEqual(STATS);
    expect(queryClient.getQueryData(dashboardKeys.metrics())).toEqual(METRICS);
    expect(queryClient.getQueryData(dashboardKeys.tasksToday())).toEqual(TASKS);
  });

  it('requests each source exactly once', async () => {
    await prefetchDashboardData(makeClient());

    expect(mockGetStats).toHaveBeenCalledOnce();
    expect(mockGetMetrics).toHaveBeenCalledOnce();
    expect(mockGetDueToday).toHaveBeenCalledOnce();
  });

  it('leaves the prefetched data fresh, so the mounting query does not refetch', async () => {
    const queryClient = makeClient();
    await prefetchDashboardData(queryClient);

    const stats = queryClient.getQueryCache().find({ queryKey: dashboardKeys.stats() });
    expect(stats?.isStaleByTime(30000)).toBe(false);
  });

  it('resolves rather than rejecting when a source fails', async () => {
    mockGetStats.mockRejectedValue(new Error('server down'));
    const queryClient = makeClient();

    await expect(prefetchDashboardData(queryClient)).resolves.toBeUndefined();
    // The failed source is simply absent; the real query will fetch and report.
    expect(queryClient.getQueryData(dashboardKeys.stats())).toBeUndefined();
    expect(queryClient.getQueryData(dashboardKeys.metrics())).toEqual(METRICS);
  });
});
