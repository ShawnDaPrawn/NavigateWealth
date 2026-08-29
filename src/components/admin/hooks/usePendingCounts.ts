import { useQuery } from '@tanstack/react-query';
import { api } from '../../../utils/api';
import { getSession } from '../../../utils/auth';
import type { ApplicationStats } from '../modules/applications';
import type { AdminModule } from '../layout/types';
import { pendingCountsKeys } from '../../../utils/queryKeys';
import { getIncompleteCount } from '../modules/applications';

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

// Fetch pending counts from various sources
async function fetchPendingCounts(): Promise<Record<AdminModule, { count: number }>> {
  const session = await getSession();
  if (!session?.access_token) {
    // Silently return empty counts if not authenticated
    return EMPTY_COUNTS;
  }

  // Each call is independent + best-effort: a failing endpoint leaves its count at
  // 0 (the api client throws APIError on non-2xx) without affecting the others.
  // The api client supplies the session JWT and refreshes it as needed.
  let applicationsPending = 0;
  try {
    const data = await api.get<{ stats?: ApplicationStats }>('/admin/stats');
    // Count "submitted_for_review" + incomplete (draft + in-progress signups)
    applicationsPending = (data.stats?.submitted_for_review || 0) + getIncompleteCount(data.stats);
  } catch {
    // Silent — zeroed fallback (offline / server unavailable)
  }

  // Tasks count (New + In Progress) via the tasks/stats KV-backed endpoint
  let tasksPending = 0;
  try {
    const tasksData = await api.get<{ new?: number; in_progress?: number }>('/tasks/stats');
    tasksPending = (tasksData.new ?? 0) + (tasksData.in_progress ?? 0);
  } catch {
    // Silent — tasks module may not be initialised
  }

  // Submissions 'new' count
  let submissionsNew = 0;
  try {
    const subData = await api.get<{ count?: number }>('/submissions/count/new');
    submissionsNew = subData.count ?? 0;
  } catch {
    // Silent — submissions module may not be initialised
  }

  // Open issue count for the Issue Manager
  let issuesOpen = 0;
  try {
    const issuesData = await api.get<{ snapshot?: { summary?: { open?: unknown } } }>(
      '/quality-issues',
    );
    issuesOpen = safeCount(issuesData?.snapshot?.summary?.open);
  } catch {
    // Silent — quality issues module may be unavailable
  }

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
  const { data } = useQuery({
    queryKey: pendingCountsKeys.all,
    queryFn: fetchPendingCounts,
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
