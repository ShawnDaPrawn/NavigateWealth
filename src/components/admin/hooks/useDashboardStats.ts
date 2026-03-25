import { useQuery } from '@tanstack/react-query';
import { api } from '../../../utils/api/client';
import { ApplicationStats } from '../../../supabase/functions/server/types';
import { useAuth } from '../../auth/AuthContext';
import { logError } from '../../../utils/errorUtils';
import { adminStatsKeys } from '../../../utils/queryKeys';

export function useDashboardStats() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');

  return useQuery({
    queryKey: adminStatsKeys.all,
    queryFn: async () => {
      try {
        const data = await api.get<{ stats: ApplicationStats }>('/admin/stats');
        return data.stats;
      } catch (error) {
        // If unauthorized, return empty stats instead of throwing
        if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Forbidden'))) {
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            logError(error, 'Admin stats unauthorized - user may need to log in as admin');
          }
          return {
            total: 0,
            submitted_for_review: 0,
            approved: 0,
            declined: 0,
            application_in_progress: 0,
            draft: 0,
            incomplete: 0,
            no_application: 0,
            new_applications_7d: 0,
            new_this_month: 0,
            new_last_month: 0,
            new_tasks: 0,
            pending_tasks: 0,
            pending_requests: 0,
            total_requests: 0,
            pending_esignatures: 0,
            active_users: 0,
            total_clients: 0,
          } as ApplicationStats;
        }
        // Network errors and other transient failures — return empty stats
        // rather than throwing, to avoid error propagation to the UI
        return {
          total: 0,
          submitted_for_review: 0,
          approved: 0,
          declined: 0,
          application_in_progress: 0,
          draft: 0,
          incomplete: 0,
          no_application: 0,
          new_applications_7d: 0,
          new_this_month: 0,
          new_last_month: 0,
          new_tasks: 0,
          pending_tasks: 0,
          pending_requests: 0,
          total_requests: 0,
          pending_esignatures: 0,
          active_users: 0,
          total_clients: 0,
        } as ApplicationStats;
      }
    },
    enabled: isAdmin, // Only run query if user is authenticated as admin
    refetchInterval: isAdmin ? 60000 : false, // Only auto-refresh if admin
    retry: false, // Don't retry unauthorized requests
  });
}