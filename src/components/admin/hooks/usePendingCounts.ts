import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../../../utils/api';
import { getSession } from '../../../utils/auth';
import type { ApplicationStats } from '../modules/applications';
import type { AdminModule } from '../layout/types';
import { dashboardKeys, pendingCountsKeys } from '../../../utils/queryKeys';
import { getIncompleteCount } from '../modules/applications/shell';
import { dashboardApi } from '../modules/dashboard/shell';

// All admin modules — stable list used for initialisation
const ALL_MODULES: AdminModule[] = [
  'dashboard',
  'clients',
  'personnel',
  'advice-engine',
  'product-management',
  'resources',
  'publications',
  'compliance',
  'tasks',
  'notes',
  'applications',
  'submissions',
  'communication',
  'newsletter',
  'marketing',
  'reporting',
  'calendar',
  'esign',
  'issues',
  'ai-management',
];

/** Build a zeroed-out counts record — used as placeholder and fallback */
function buildEmptyCounts(): Record<AdminModule, { count: number }> {
  const result = {} as Record<AdminModule, { count: number }>;
  for (const mod of ALL_MODULES) {
    result[mod] = { count: 0 };
  }
  return result;
}

/** Module-level stable placeholder so React Query never re-creates it */
const EMPTY_COUNTS = buildEmptyCounts();

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Fetch every badge count at once.
 *
 * The four requests are independent, so they run in parallel: each costs a
 * full Edge Function round trip (~2 s from South Africa), and awaiting them one
 * after another kept the sidebar badges blank for ~8 s on every refresh.
 *
 * `/admin/stats` is shared with the dashboard's own stats query — same key,
 * same fetcher — so when both want it within `staleTime`, it is requested
 * once. It is the most expensive route in the function; it used to be fetched
 * twice a minute by every admin tab on the dashboard.
 *
 * Each count is best-effort: a failing endpoint leaves its badge at 0 without
 * affecting the others.
 */
async function fetchPendingCounts(
  queryClient: QueryClient,
): Promise<Record<AdminModule, { count: number }>> {
  const session = await getSession();
  if (!session?.access_token) {
    // Silently return empty counts if not authenticated
    return EMPTY_COUNTS;
  }

  const [statsResult, tasksResult, submissionsResult, issuesResult] = await Promise.allSettled([
    queryClient.fetchQuery({
      queryKey: dashboardKeys.stats(),
      queryFn: () => dashboardApi.stats.getStats(),
      staleTime: 30_000,
      retry: false,
    }),
    api.get<{ new?: number; in_progress?: number }>('/tasks/stats'),
    api.get<{ count?: number }>('/submissions/count/new'),
    api.get<{ snapshot?: { summary?: { open?: unknown } } }>('/quality-issues'),
  ]);

  // `/admin/stats` returns the full ApplicationStats; the dashboard's type
  // names only the fields the dashboard shows.
  const stats =
    statsResult.status === 'fulfilled'
      ? (statsResult.value as unknown as Partial<ApplicationStats>)
      : undefined;
  // Count "submitted_for_review" + incomplete (draft + in-progress signups)
  const applicationsPending =
    safeCount(stats?.submitted_for_review) + getIncompleteCount(stats as ApplicationStats);

  // Tasks count (New + In Progress) via the tasks/stats KV-backed endpoint
  const tasksPending =
    tasksResult.status === 'fulfilled'
      ? safeCount(tasksResult.value.new) + safeCount(tasksResult.value.in_progress)
      : 0;

  const submissionsNew =
    submissionsResult.status === 'fulfilled' ? safeCount(submissionsResult.value.count) : 0;

  // Open issue count for the Issue Manager
  const issuesOpen =
    issuesResult.status === 'fulfilled'
      ? safeCount(issuesResult.value?.snapshot?.summary?.open)
      : 0;

  // Initialize all modules with 0 count
  const result = buildEmptyCounts();

  // Set actual counts for operations modules
  result.applications = { count: applicationsPending };
  result.tasks = { count: tasksPending };
  result.submissions = { count: submissionsNew };
  result.calendar = { count: 0 }; // TODO: Implement calendar counting
  result.issues = { count: issuesOpen };

  return result;
}

// Hook for fetching pending counts with React Query
export function usePendingCounts(): Record<AdminModule, { count: number }> {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: pendingCountsKeys.all,
    queryFn: () => fetchPendingCounts(queryClient),
    refetchInterval: 60_000, // 60 seconds — badge counts don't need sub-minute freshness
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes — clean up when admin panel unmounts
    retry: 1,
    // Return empty counts on error
    placeholderData: EMPTY_COUNTS,
  });

  // Return data or placeholder
  return data || EMPTY_COUNTS;
}

// Alias for backward compatibility
export const usePendingCountsWithPriority = usePendingCounts;
