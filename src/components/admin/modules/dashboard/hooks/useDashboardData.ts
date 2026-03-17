import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../auth/AuthContext';
import { dashboardApi } from '../api';
import { dashboardKeys } from './queryKeys';
import type {
  DashboardStats,
  DashboardMetrics,
  TaskDueToday,
  RecentRequest,
  SystemActivity,
} from '../types';

export interface UseDashboardDataReturn {
  stats: DashboardStats | null;
  metrics: DashboardMetrics | null;
  tasks: TaskDueToday[];
  requests: RecentRequest[];
  activities: SystemActivity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadingStates: {
    stats: boolean;
    metrics: boolean;
    tasks: boolean;
    requests: boolean;
    activities: boolean;
  };
}

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

  // Fetch recent requests
  const {
    data: requests,
    isLoading: requestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: dashboardKeys.recentRequests(),
    queryFn: () => dashboardApi.requests.getRecent(10),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false,
    retry: false,
    staleTime: 30000,
  });

  // Fetch system activity
  const {
    data: activities,
    isLoading: activitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
  } = useQuery({
    queryKey: dashboardKeys.systemActivity(),
    queryFn: () => dashboardApi.activity.getAll(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60000 : false,
    retry: false,
    staleTime: 30000,
  });

  // Refetch all data
  const refetch = async () => {
    await Promise.all([
      refetchStats(),
      refetchMetrics(),
      refetchTasks(),
      refetchRequests(),
      refetchActivities(),
    ]);
  };

  // Determine overall loading state
  const loading = statsLoading || metricsLoading || tasksLoading || requestsLoading || activitiesLoading;

  // Collect errors
  const errors = [statsError, metricsError, tasksError, requestsError, activitiesError]
    .filter(Boolean)
    .map((e) => (e as Error).message);
  const error = errors.length > 0 ? errors.join('; ') : null;

  return {
    stats: stats || null,
    metrics: metrics || null,
    tasks: tasks || [],
    requests: requests || [],
    activities: activities || [],
    loading,
    error,
    refetch,
    loadingStates: {
      stats: statsLoading,
      metrics: metricsLoading,
      tasks: tasksLoading,
      requests: requestsLoading,
      activities: activitiesLoading,
    },
  };
}