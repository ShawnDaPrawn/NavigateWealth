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
 */
export function prefetchDashboardData(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.stats(),
      queryFn: () => dashboardApi.stats.getStats(),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.metrics(),
      queryFn: () => dashboardApi.metrics.getMetrics(),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
    queryClient.prefetchQuery({
      queryKey: dashboardKeys.tasksToday(),
      queryFn: () => dashboardApi.tasks.getDueToday(),
      staleTime: STALE_TIME_MS,
      retry: false,
    }),
  ]).then(() => undefined);
}
