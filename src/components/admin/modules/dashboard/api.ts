import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import { getErrorMessage } from '../../../../utils/errorUtils';
import { ENDPOINTS } from './constants';
import type {
  DashboardStats,
  DashboardMetrics,
  TaskDueToday,
  RecentRequest,
  SystemActivity,
  LastCleanupRun,
  CleanupRunResult,
  AdminAuditEntry,
  AuditSummary,
  AuditActionCategory,
  AuditSeverity,
} from './types';

export const dashboardStatsApi = {
  async getStats(): Promise<DashboardStats> {
    try {
      const response = await api.get<{ stats: DashboardStats }>(ENDPOINTS.ADMIN_STATS);
      return response.stats;
    } catch (error) {
      const message = getErrorMessage(error);
      // For auth errors, return empty stats silently
      if (message.includes('Unauthorized') || 
          message.includes('Forbidden') ||
          message.includes('401')) {
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
      if (typeof statusCode === 'number' && statusCode >= 500 || message.includes('Internal server error') || message.includes('cloudflare')) {
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
  async getMetrics(): Promise<DashboardMetrics> {
    try {
      const response = await api.get<{
        activePolicies: number;
        newPoliciesCount: number;
        publishedFnas: number;
      }>(ENDPOINTS.DASHBOARD_STATS);

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
  async getDueToday(): Promise<TaskDueToday[]> {
    try {
      const response = await api.get<{ success: boolean; data: TaskDueToday[] }>(ENDPOINTS.TASKS_DUE_TODAY);
      return response.data || [];
    } catch (error) {
      logger.error('Failed to fetch tasks due today', error);
      return [];
    }
  },

  async getByDate(date: Date): Promise<TaskDueToday[]> {
    try {
      const dateStr = date.toISOString().split('T')[0]; 
      const response = await api.get<{ success: boolean; data: TaskDueToday[] }>(
        `${ENDPOINTS.TASKS_BY_DATE}?date=${dateStr}`
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
      return tasks.filter(task => 
        task.priority === 'high' || task.priority === 'critical'
      );
    } catch (error) {
      logger.error('Failed to fetch high priority tasks', error);
      return [];
    }
  },
};

export const requestsApi = {
  async getRecent(limit: number = 10): Promise<RecentRequest[]> {
    try {
      const response = await api.get<{ success: boolean; data: RecentRequest[] }>(
        `${ENDPOINTS.RECENT_REQUESTS}?limit=${limit}`
      );
      return response.data || [];
    } catch (error) {
      logger.error('Failed to fetch recent requests', error, { limit });
      return [];
    }
  },

  async getOpenCount(): Promise<number> {
    try {
      const requests = await this.getRecent(100); 
      return requests.filter(r => {
        const status = r.status?.toLowerCase();
        return ['awaiting information', 'info_gathering', 'pending', 'sent_for_quote', 'generated'].includes(status);
      }).length;
    } catch (error) {
      logger.error('Failed to fetch open requests count', error);
      return 0;
    }
  },

  async getAwaitingInfo(): Promise<RecentRequest[]> {
    try {
      const requests = await this.getRecent(100);
      return requests.filter(r => {
        const status = r.status?.toLowerCase();
        return status === 'awaiting information' || status === 'info_gathering';
      });
    } catch (error) {
      logger.error('Failed to fetch requests awaiting info', error);
      return [];
    }
  },

  async getPendingReview(): Promise<RecentRequest[]> {
    try {
      const requests = await this.getRecent(100);
      return requests.filter(r => {
        const status = r.status?.toLowerCase();
        return status === 'pending';
      });
    } catch (error) {
      logger.error('Failed to fetch pending review requests', error);
      return [];
    }
  },
};

export const systemActivityApi = {
  async getAll(): Promise<SystemActivity[]> {
    try {
      const [stats, metrics, requestsCount] = await Promise.all([
        dashboardStatsApi.getStats(),
        dashboardMetricsApi.getMetrics(),
        requestsApi.getOpenCount(),
      ]);

      const activities: SystemActivity[] = [
        {
          type: 'new_applications',
          count: stats.new_this_month,
          growth: stats.new_last_month > 0 
            ? ((stats.new_this_month - stats.new_last_month) / stats.new_last_month) * 100
            : stats.new_this_month > 0 ? 100 : 0,
          label: 'New Applications',
          description: 'Applications this month',
          color: 'purple',
        },
        {
          type: 'new_policies',
          count: metrics.newPoliciesCount,
          growth: 0, 
          label: 'New Policies',
          description: 'Active policies added recently',
          color: 'green',
        },
        {
          type: 'pending_tasks',
          count: stats.pending_tasks,
          growth: 0,
          label: 'Pending Tasks',
          description: 'Tasks requiring attention',
          color: 'orange',
        },
        {
          type: 'completed_fnas',
          count: metrics.completedFNAs,
          growth: 0,
          label: 'Completed FNAs',
          description: 'Financial Needs Analyses done',
          color: 'blue',
        },
      ];

      return activities;
    } catch (error) {
      logger.error('Failed to fetch system activity', error);
      return [];
    }
  },

  async getByType(type: string): Promise<SystemActivity | null> {
    try {
      const activities = await this.getAll();
      return activities.find(a => a.type === type) || null;
    } catch (error) {
      logger.error(`Failed to fetch activity for type ${type}`, error);
      return null;
    }
  },
};

export const dashboardApi = {
  async getAll() {
    try {
      const [stats, metrics, tasks, requests, activities] = await Promise.all([
        dashboardStatsApi.getStats(),
        dashboardMetricsApi.getMetrics(),
        tasksApi.getDueToday(),
        requestsApi.getRecent(10),
        systemActivityApi.getAll(),
      ]);

      return {
        stats,
        metrics,
        tasks,
        requests,
        activities,
      };
    } catch (error) {
      logger.error('Failed to fetch all dashboard data', error);
      throw error;
    }
  },

  async refresh() {
    logger.info('Refreshing dashboard data...');
    return this.getAll();
  },

  stats: dashboardStatsApi,
  metrics: dashboardMetricsApi,
  tasks: tasksApi,
  requests: requestsApi,
  activity: systemActivityApi,
};

export const systemHealthApi = {
  async getLastCleanupRun(): Promise<LastCleanupRun | null> {
    try {
      const response = await api.get<{ success: boolean; lastRun: LastCleanupRun | null }>(
        ENDPOINTS.KV_CLEANUP_STATUS
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
  async runCleanup(options: { dryRun?: boolean; retentionDays?: number } = {}): Promise<CleanupRunResult | null> {
    try {
      const response = await api.post<CleanupRunResult & { success: boolean }>(
        ENDPOINTS.KV_CLEANUP_RUN,
        {
          dryRun: options.dryRun ?? true,
          retentionDays: options.retentionDays ?? 90,
        }
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
  async getLog(filters: {
    category?: AuditActionCategory;
    severity?: AuditSeverity;
    limit?: number;
  } = {}): Promise<AdminAuditEntry[]> {
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
      logger.error('Failed to fetch admin audit log', error);
      return [];
    }
  },

  /**
   * Fetch audit summary counts by category.
   */
  async getSummary(days: number = 7): Promise<AuditSummary | null> {
    try {
      const response = await api.get<{ success: boolean; days: number; summary: AuditSummary['summary'] }>(
        `${ENDPOINTS.ADMIN_AUDIT_SUMMARY}?days=${days}`
      );
      return { days: response.days, summary: response.summary };
    } catch (error) {
      logger.error('Failed to fetch admin audit summary', error);
      return null;
    }
  },
};

export default dashboardApi;