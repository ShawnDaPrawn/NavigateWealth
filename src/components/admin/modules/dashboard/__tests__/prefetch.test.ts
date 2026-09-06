/**
 * dashboard/prefetch — warms the queries the dashboard is about to run.
 *
 * Two contracts matter. Cache identity: the prefetch must land under exactly
 * the keys `useDashboardData` reads, or it is pure extra load. And token
 * passing: every request must carry the access token it was handed, because a
 * request that asked for the session instead would queue behind the auth lock
 * that AuthContext's profile hydration holds — the very work this runs beside.
 *
 * It must also stay best-effort — a failure here can never surface as a
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
    stats: { getStats: (o?: unknown) => mockGetStats(o) },
    metrics: { getMetrics: (o?: unknown) => mockGetMetrics(o) },
    tasks: { getDueToday: (o?: unknown) => mockGetDueToday(o) },
  },
}));

import { prefetchDashboardData } from '../prefetch';

const ACCESS_TOKEN = 'session-access-token';
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
    await prefetchDashboardData(queryClient, ACCESS_TOKEN);

    expect(queryClient.getQueryData(dashboardKeys.stats())).toEqual(STATS);
    expect(queryClient.getQueryData(dashboardKeys.metrics())).toEqual(METRICS);
    expect(queryClient.getQueryData(dashboardKeys.tasksToday())).toEqual(TASKS);
  });

  it('requests each source exactly once', async () => {
    await prefetchDashboardData(makeClient(), ACCESS_TOKEN);

    expect(mockGetStats).toHaveBeenCalledOnce();
    expect(mockGetMetrics).toHaveBeenCalledOnce();
    expect(mockGetDueToday).toHaveBeenCalledOnce();
  });

  it('leaves the prefetched data fresh, so the mounting query does not refetch', async () => {
    const queryClient = makeClient();
    await prefetchDashboardData(queryClient, ACCESS_TOKEN);

    const stats = queryClient.getQueryCache().find({ queryKey: dashboardKeys.stats() });
    expect(stats?.isStaleByTime(30000)).toBe(false);
  });

  it('resolves rather than rejecting when a source fails', async () => {
    mockGetStats.mockRejectedValue(new Error('server down'));
    const queryClient = makeClient();

    await expect(prefetchDashboardData(queryClient, ACCESS_TOKEN)).resolves.toBeUndefined();
    // The failed source is simply absent; the real query will fetch and report.
    expect(queryClient.getQueryData(dashboardKeys.stats())).toBeUndefined();
    expect(queryClient.getQueryData(dashboardKeys.metrics())).toEqual(METRICS);
  });
});

describe('prefetchDashboardData — stays off the auth lock', () => {
  it('sends the supplied token with every request rather than reading the session', async () => {
    await prefetchDashboardData(makeClient(), ACCESS_TOKEN);

    for (const fetcher of [mockGetStats, mockGetMetrics, mockGetDueToday]) {
      expect(fetcher).toHaveBeenCalledWith({ accessToken: ACCESS_TOKEN });
    }
  });
});
