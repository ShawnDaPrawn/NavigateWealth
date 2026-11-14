import { api, type APIRequestOptions } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { ENDPOINTS } from './constants';
import type {
  DashboardPeriod,
  DashboardStats,
  DashboardMetrics,
  TaskDueToday,
  LastCleanupRun,
  CleanupRunResult,
  AdminAuditEntry,
  AuditSummary,
  AuditActionCategory,
  AuditSeverity,
} from './types';

/**
 * Request options the three dashboard fetchers forward untouched.
 *
 * The only caller that passes anything is `prefetchDashboardData`, which
 * supplies the access token straight off the auth event so the prefetch makes
 * no auth call of its own — see `accessToken` on APIRequestOptions.
 */
export type DashboardFetchOptions = Pick<APIRequestOptions, 'accessToken'>;

export const dashboardStatsApi = {
  async getStats(
    options?: DashboardFetchOptions,
    period: DashboardPeriod = 'month',
  ): Promise<DashboardStats> {
    try {
      const url =
        period === 'month' ? ENDPOINTS.ADMIN_STATS : `${ENDPOINTS.ADMIN_STATS}?period=${period}`;
      const response = await api.get<{ stats: DashboardStats }>(url, options);
      return response.stats;
    } catch (error) {
      const message = getErrorMessage(error);
      // For auth errors, return empty stats silently
      if (
        message.includes('Unauthorized') ||
        message.includes('Forbidden') ||
        message.includes('401')
      ) {
        logger.warn('Dashboard stats unauthorized - returning empty stats', { error });
        return {
          total_clients: 0,
          pending_applications: 0,
          pending_tasks: 0,
          new_this_month: 0,
          new_last_month: 0,
          total_completed: 0,
          avg_completion_time: 0,
        };
      }
      // For server errors (500, 502, 503, 504) or Cloudflare errors, return
      // empty stats gracefully instead of crashing the dashboard
      const statusCode = (error as Record<string, unknown>)?.statusCode;
      if (
        (typeof statusCode === 'number' && statusCode >= 500) ||
        message.includes('Internal server error') ||
        message.includes('cloudflare')
      ) {
        logger.warn('Dashboard stats server error - returning empty stats', { error: message });
        return {
          total_clients: 0,
          pending_applications: 0,
          pending_tasks: 0,
          new_this_month: 0,
          new_last_month: 0,
          total_completed: 0,
          avg_completion_time: 0,
        };
      }
      logger.error('Failed to fetch dashboard stats', error);
      throw error;
    }
  },

  async getClientCount(): Promise<number> {
    try {
      const stats = await this.getStats();
      return stats.total_clients;
    } catch (error) {
      logger.error('Failed to fetch client count', error);
      return 0;
    }
  },

  async getPendingApplicationsCount(): Promise<number> {
    try {
      const stats = await this.getStats();
      return stats.pending_applications;
    } catch (error) {
      logger.error('Failed to fetch pending applications count', error);
      return 0;
    }
  },

  async getPendingTasksCount(): Promise<number> {
    try {
      const stats = await this.getStats();
      return stats.pending_tasks;
    } catch (error) {
      logger.error('Failed to fetch pending tasks count', error);
      return 0;
    }
  },
};

export const dashboardMetricsApi = {
  async getMetrics(
    options?: DashboardFetchOptions,
    period: DashboardPeriod = 'month',
  ): Promise<DashboardMetrics> {
    try {
      const response = await api.get<{
        activePolicies: number;
        newPoliciesCount: number;
        publishedFnas: number;
      }>(
        period === 'month'
          ? ENDPOINTS.DASHBOARD_STATS
          : `${ENDPOINTS.DASHBOARD_STATS}?period=${period}`,
        options,
      );

      return {
        activePolicies: response.activePolicies || 0,
        newPoliciesCount: response.newPoliciesCount || 0,
        completedFNAs: response.publishedFnas || 0,
        pendingFNAs: 0,
      };
    } catch (error) {
      logger.error('Failed to fetch dashboard metrics', error);
      return {
        activePolicies: 0,
        newPoliciesCount: 0,
        completedFNAs: 0,
        pendingFNAs: 0,
      };
    }
  },

  async getActivePoliciesCount(): Promise<number> {
    try {
      const metrics = await this.getMetrics();
      return metrics.activePolicies;
    } catch (error) {
      logger.error('Failed to fetch active policies count', error);
      return 0;
    }
  },

  async getNewPoliciesCount(): Promise<number> {
    try {
      const metrics = await this.getMetrics();
      return metrics.newPoliciesCount;
    } catch (error) {
      logger.error('Failed to fetch new policies count', error);
      return 0;
    }
  },

  async getCompletedFNAsCount(): Promise<number> {
    try {
      const metrics = await this.getMetrics();
      return metrics.completedFNAs;
    } catch (error) {
      logger.error('Failed to fetch completed FNAs count', error);
      return 0;
    }
  },
};

export const tasksApi = {
  async getDueToday(options?: DashboardFetchOptions): Promise<TaskDueToday[]> {
    try {
      const response = await api.get<{ success: boolean; data: TaskDueToday[] }>(
        ENDPOINTS.TASKS_DUE_TODAY,
        options,
      );
      return response.data || [];
    } catch (error) {
      // Rethrown so the Due today card can say so and offer Try again,
      // rather than claiming there is nothing due.
      logger.error('Failed to fetch tasks due today', error);
      throw error;
    }
  },

  async getByDate(date: Date): Promise<TaskDueToday[]> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await api.get<{ success: boolean; data: TaskDueToday[] }>(
        `${ENDPOINTS.TASKS_BY_DATE}?date=${dateStr}`,
      );
      return response.data || [];
    } catch (error) {
      logger.error('Failed to fetch tasks by date', error, { date });
      return [];
    }
  },

  async getDueTodayCount(): Promise<number> {
    try {
      const tasks = await this.getDueToday();
      return tasks.length;
    } catch (error) {
      logger.error('Failed to fetch tasks due today count', error);
      return 0;
    }
  },

  async getHighPriorityDueToday(): Promise<TaskDueToday[]> {
    try {
      const tasks = await this.getDueToday();
      return tasks.filter((task) => task.priority === 'high' || task.priority === 'critical');
    } catch (error) {
      logger.error('Failed to fetch high priority tasks', error);
      return [];
    }
  },
};

/**
 * The dashboard's three data sources — one request each, no aggregate fetcher.
 *
 * There is deliberately no `activity` member: System Activity is a projection
 * of stats + metrics, derived client-side by `buildSystemActivity` in
 * `utils.ts`. It used to be a fourth fetcher that re-requested both of the
 * endpoints below, which is how one dashboard load came to hit the app's most
 * expensive route twice.
 */
/** Task totals for the Tasks figure (open and completed). */
export const taskStatsApi = {
  async getStats(): Promise<{ open: number; completed: number }> {
    const response = await api.get<{
      new?: number;
      in_progress?: number;
      completed?: number;
    }>(ENDPOINTS.TASK_STATS);
    return {
      open: (response.new ?? 0) + (response.in_progress ?? 0),
      completed: response.completed ?? 0,
    };
  },
};

export const dashboardApi = {
  stats: dashboardStatsApi,
  metrics: dashboardMetricsApi,
  tasks: tasksApi,
};

export const systemHealthApi = {
  async getLastCleanupRun(): Promise<LastCleanupRun | null> {
    try {
      const response = await api.get<{ success: boolean; lastRun: LastCleanupRun | null }>(
        ENDPOINTS.KV_CLEANUP_STATUS,
      );
      return response.lastRun ?? null;
    } catch (error) {
      logger.error('Failed to fetch last cleanup run status', error);
      return null;
    }
  },

  /**
   * Trigger a KV cleanup run.
   * Defaults to dry-run (dryRun: true) — caller must explicitly set false for live.
   */
  async runCleanup(
    options: { dryRun?: boolean; retentionDays?: number } = {},
  ): Promise<CleanupRunResult | null> {
    try {
      const response = await api.post<CleanupRunResult & { success: boolean }>(
        ENDPOINTS.KV_CLEANUP_RUN,
        {
          dryRun: options.dryRun ?? true,
          retentionDays: options.retentionDays ?? 90,
        },
      );
      return response;
    } catch (error) {
      logger.error('Failed to trigger KV cleanup', error);
      return null;
    }
  },
};

export const adminAuditApi = {
  /**
   * Fetch recent audit log entries.
   */
  async getLog(
    filters: {
      category?: AuditActionCategory;
      severity?: AuditSeverity;
      limit?: number;
    } = {},
  ): Promise<AdminAuditEntry[]> {
    try {
      const params = new URLSearchParams();
      if (filters.category) params.set('category', filters.category);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      const url = `${ENDPOINTS.ADMIN_AUDIT_LOG}${qs ? `?${qs}` : ''}`;
      const response = await api.get<{ success: boolean; entries: AdminAuditEntry[] }>(url);
      return response.entries ?? [];
    } catch (error) {
      // Rethrown so the audit trail can show an error with Try again rather
      // than an empty log that looks like nothing happened.
      logger.error('Failed to fetch admin audit log', error);
      throw error;
    }
  },

  /**
   * Fetch audit summary counts by category.
   */
  async getSummary(days: number = 7): Promise<AuditSummary | null> {
    try {
      const response = await api.get<{
        success: boolean;
        days: number;
        summary: AuditSummary['summary'];
      }>(`${ENDPOINTS.ADMIN_AUDIT_SUMMARY}?days=${days}`);
      return { days: response.days, summary: response.summary };
    } catch (error) {
      logger.error('Failed to fetch admin audit summary', error);
      return null;
    }
  },
};

export default dashboardApi;
