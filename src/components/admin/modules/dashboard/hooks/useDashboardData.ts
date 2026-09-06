import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../auth/AuthContext';
import { dashboardApi } from '../api';
import { buildSystemActivity } from '../utils';
import { dashboardKeys } from './queryKeys';
import type { DashboardStats, DashboardMetrics, TaskDueToday, SystemActivity } from '../types';

export interface UseDashboardDataReturn {
  stats: DashboardStats | null;
  metrics: DashboardMetrics | null;
  tasks: TaskDueToday[];
  activities: SystemActivity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadingStates: {
    stats: boolean;
    metrics: boolean;
    tasks: boolean;
    /** True while either input to the derived System Activity tiles is loading. */
    activities: boolean;
  };
}

/**
 * The dashboard's shared data layer: three requests, fired in parallel.
 *
 * `loading` is the union of all three and exists for callers that genuinely
 * need "is anything still in flight". Widgets should read the matching
 * `loadingStates` flag instead — gating a widget on the union makes every
 * widget wait for the slowest request, which is what made the whole page
 * appear at once, late, rather than filling in as its data arrived.
 */
export function useDashboardData(): UseDashboardDataReturn {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');

  // Fetch dashboard stats
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => dashboardApi.stats.getStats(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false, // Refresh every minute if admin
    retry: false,
    staleTime: 30000,
  });

  // Fetch dashboard metrics
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: dashboardKeys.metrics(),
    queryFn: () => dashboardApi.metrics.getMetrics(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false,
    retry: false,
    staleTime: 30000,
  });

  // Fetch tasks due today
  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: dashboardKeys.tasksToday(),
    queryFn: () => dashboardApi.tasks.getDueToday(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false,
    retry: false,
    staleTime: 30000,
  });

  // System Activity is a projection of the two queries above, not a fourth
  // request. Fetching it separately meant re-requesting /admin/stats and
  // /integrations/dashboard-stats on every load and every 60s refetch.
  const activities = useMemo(
    () => buildSystemActivity(stats ?? null, metrics ?? null),
    [stats, metrics],
  );

  // Refetch all data
  const refetch = async () => {
    await Promise.all([refetchStats(), refetchMetrics(), refetchTasks()]);
  };

  // Determine overall loading state
  const loading = statsLoading || metricsLoading || tasksLoading;

  // Collect errors
  const errors = [statsError, metricsError, tasksError]
    .filter(Boolean)
    .map((e) => (e as Error).message);
  const error = errors.length > 0 ? errors.join('; ') : null;

  return {
    stats: stats || null,
    metrics: metrics || null,
    tasks: tasks || [],
    activities,
    loading,
    error,
    refetch,
    loadingStates: {
      stats: statsLoading,
      metrics: metricsLoading,
      tasks: tasksLoading,
      activities: statsLoading || metricsLoading,
    },
  };
}
