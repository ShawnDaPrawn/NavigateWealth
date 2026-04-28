import { useQuery } from '@tanstack/react-query';
import { projectId } from '../../../utils/supabase/info';
import { getSession } from '../../../utils/auth';
import type { AdminModule } from '../layout/types';
import { pendingCountsKeys } from '../../../utils/queryKeys';
import { getIncompleteCount } from '../modules/applications/utils';

// All admin modules — stable list used for initialisation
const ALL_MODULES: AdminModule[] = [
  'dashboard', 'clients', 'personnel', 'advice-engine', 'product-management',
  'resources', 'publications', 'compliance', 'tasks', 'notes', 'applications',
  'quotes', 'submissions', 'communication', 'marketing', 'reporting', 'calendar',
  'esign', 'issues', 'ai-management',
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

/** Base URL for server requests */
const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379`;

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

  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };

  // Fetch application stats from backend
  let applicationsPending = 0;
  let requestsPending = 0;
  try {
    const statsResponse = await fetch(
      `${SERVER_BASE}/admin/stats`,
      { headers }
    );

    if (statsResponse.ok) {
      const data = await statsResponse.json();
      // Count "submitted_for_review" + incomplete (draft + in-progress signups)
      applicationsPending =
        (data.stats?.submitted_for_review || 0) + getIncompleteCount(data.stats);
      // Get pending requests count
      requestsPending = data.stats?.pending_requests || 0;
    }
  } catch (error) {
    // Silently handle network errors - these are expected when offline or server unavailable
    // The function returns zeroed counts as a safe fallback — no logging needed
  }

  // Fetch tasks count (New + In Progress) via the tasks/stats KV-backed endpoint
  let tasksPending = 0;
  try {
    const tasksResponse = await fetch(
      `${SERVER_BASE}/tasks/stats`,
      { headers }
    );
    if (tasksResponse.ok) {
      const tasksData = await tasksResponse.json();
      // Sum "new" + "in_progress" statuses for the pending badge
      tasksPending = (tasksData.new ?? 0) + (tasksData.in_progress ?? 0);
    }
  } catch (error) {
    // Silently handle errors - tasks module may not be initialized
  }

  // Fetch submissions 'new' count
  let submissionsNew = 0;
  try {
    const subResponse = await fetch(
      `${SERVER_BASE}/submissions/count/new`,
      { headers }
    );
    if (subResponse.ok) {
      const subData = await subResponse.json();
      submissionsNew = subData.count ?? 0;
    }
  } catch (error) {
    // Silently handle errors - submissions module may not be initialized
  }

  // Fetch open issue count for Issue Manager
  let issuesOpen = 0;
  try {
    const issuesResponse = await fetch(
      `${SERVER_BASE}/quality-issues`,
      { headers }
    );
    if (issuesResponse.ok) {
      const issuesData = await issuesResponse.json();
      issuesOpen = safeCount(issuesData?.snapshot?.summary?.open);
    }
  } catch (error) {
    // Silently handle errors - quality issues module may be unavailable
  }

  // Initialize all modules with 0 count
  const result = buildEmptyCounts();

  // Set actual counts for operations modules
  result.applications = { count: applicationsPending };
  result.tasks = { count: tasksPending };
  result.quotes = { count: requestsPending };
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
