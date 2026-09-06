/**
 * Dashboard — boot-time prefetch
 *
 * `useDashboardData` gates its queries on `enabled: isAdmin`, and `isAdmin`
 * needs the AppUser that `AuthProvider` builds from the KV profile. `AdminRoute`
 * renders a page loader until that lands, so `AdminDashboardPage` is not even
 * mounted while the profile is hydrating — meaning that on a fresh sign-in
 * (which finishes with a hard `window.location` navigation, so nothing is
 * cached) the dashboard's first request was not issued until profile hydration
 * had already completed. Two network legs ran back to back that could have run
 * side by side.
 *
 * This puts the fetches in flight as soon as the Supabase session is known.
 * The queries mount later against the same keys, so React Query either serves
 * them from cache or attaches to the request already in flight — never a
 * duplicate.
 *
 * Prefetching is an optimisation, never a source of truth: it cannot widen
 * access, because every endpoint behind it is `requireAdmin` on the server.
 */

import type { QueryClient } from '@tanstack/react-query';
import { dashboardApi } from './api';
import { dashboardKeys } from './hooks/queryKeys';

/** Matches the `staleTime` the dashboard queries use, so a prefetch counts as fresh. */
const STALE_TIME_MS = 30000;

/**
 * Warm the three dashboard queries. Fire-and-forget: `prefetchQuery` resolves
 * rather than rejects on failure, and a failed prefetch simply leaves the real
 * query to fetch and report the error as it always did.
 *
 * `accessToken` is required, not optional, and that is the load-bearing part of
 * this signature. The point of prefetching is to run BESIDE `AuthContext`'s
 * profile hydration, and auth-js holds its lock for the whole of every
 * `onAuthStateChange` subscriber callback — hydration included. A request that
 * asked for the session would therefore queue behind exactly the work this is
 * meant to overlap with, turning the optimisation into a no-op. Passing the
 * token the auth event already carries keeps these three requests off the auth
 * lock entirely.
 */
export function prefetchDashboardData(
  queryClient: QueryClient,
  accessToken: string,
): Promise<void> {
  const options = { accessToken };

  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.stats(),
      queryFn: () => dashboardApi.stats.getStats(options),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.metrics(),
      queryFn: () => dashboardApi.metrics.getMetrics(options),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.tasksToday(),
      queryFn: () => dashboardApi.tasks.getDueToday(options),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
  ]).then(() => undefined);
}
