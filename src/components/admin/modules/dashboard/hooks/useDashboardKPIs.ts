import { useMemo } from 'react';
import { Users, FileText, CheckSquare, TrendingUp } from 'lucide-react';
import type { DashboardKPI, DashboardPeriod, DashboardStats, DashboardMetrics } from '../types';
import { calculateGrowth } from '../utils';

export interface UseDashboardKPIsReturn {
  kpis: DashboardKPI[];
  loading: boolean;
}

export interface UseDashboardKPIsOptions {
  stats: DashboardStats | null;
  metrics: DashboardMetrics | null;
  /** Open and completed task totals (the Tasks figure's second line). */
  taskTotals?: { open: number; completed: number } | null;
  /** The period the figures cover (labels follow it). */
  period?: DashboardPeriod;
  loading?: boolean;
  /** Granular loading states per data source — allows per-card skeleton rendering */
  loadingStates?: {
    stats: boolean;
    metrics: boolean;
  };
}

/**
 * Always returns exactly 4 KPI entries so the grid structure is stable from
 * the first render.  Individual cards carry their own `loading` flag when
 * their backing data source hasn't resolved yet, preventing the "pop-in"
 * effect where the 4th card appears only after metrics load.
 */
const PERIOD_LABELS: Record<DashboardPeriod, string> = {
  month: 'this month',
  '30d': 'last 30 days',
  year: 'this year',
};

export function useDashboardKPIs(options: UseDashboardKPIsOptions): UseDashboardKPIsReturn {
  const {
    stats,
    metrics,
    taskTotals = null,
    period = 'month',
    loading = false,
    loadingStates,
  } = options;
  const periodLabel = PERIOD_LABELS[period];

  const kpis = useMemo<DashboardKPI[]>(() => {
    const statsLoading = loadingStates?.stats ?? (!stats && loading);
    const metricsLoading = loadingStates?.metrics ?? (!metrics && loading);

    // KPI 1: Total Clients
    const totalClientsKpi: DashboardKPI = stats
      ? {
          title: 'Total clients',
          value: stats.total_clients || 0,
          change: 0,
          icon: Users,
          format: 'number',
          subtitle: 'active clients in system',
        }
      : {
          title: 'Total clients',
          value: 0,
          change: 0,
          icon: Users,
          format: 'number',
          subtitle: 'active clients in system',
          loading: statsLoading,
        };

    // KPI 2: New Applications
    // The period's own counts when the server sent them (older servers: month).
    const newThisMonth = stats?.new_in_period ?? stats?.new_this_month ?? 0;
    const newLastMonth = stats?.new_previous_period ?? stats?.new_last_month ?? 0;
    const appsGrowth = stats ? calculateGrowth(newThisMonth, newLastMonth) : 0;

    const newApplicationsKpi: DashboardKPI = stats
      ? {
          title: 'New applications',
          value: newThisMonth,
          change: appsGrowth,
          icon: FileText,
          format: 'number',
          subtitle: periodLabel,
          trend: appsGrowth > 0 ? 'up' : appsGrowth < 0 ? 'down' : 'neutral',
        }
      : {
          title: 'New applications',
          value: 0,
          change: 0,
          icon: FileText,
          format: 'number',
          subtitle: periodLabel,
          loading: statsLoading,
        };

    // KPI 3: Tasks — open, with completed as the second line (this used to
    // be a separate System Activity tile).
    const completedLine = taskTotals ? `open · ${taskTotals.completed} completed` : 'open';
    const pendingTasksKpi: DashboardKPI = stats
      ? {
          title: 'Tasks',
          value: stats.pending_tasks || 0,
          change: 0,
          icon: CheckSquare,
          format: 'number',
          subtitle: completedLine,
          hideChange: true,
        }
      : {
          title: 'Tasks',
          value: 0,
          change: 0,
          icon: CheckSquare,
          format: 'number',
          subtitle: completedLine,
          hideChange: true,
          loading: statsLoading,
        };

    // KPI 4: Active Policies
    const activePolicies = metrics?.activePolicies || 0;
    const newPolicies = metrics?.newPoliciesCount || 0;
    const previousPolicies = activePolicies - newPolicies;
    const policiesGrowth = metrics ? calculateGrowth(newPolicies, previousPolicies) : 0;

    const activePoliciesKpi: DashboardKPI = metrics
      ? {
          title: 'Active policies',
          value: activePolicies,
          change: policiesGrowth,
          icon: TrendingUp,
          format: 'number',
          subtitle: `${newPolicies} new ${periodLabel}`,
          trend: policiesGrowth > 0 ? 'up' : policiesGrowth < 0 ? 'down' : 'neutral',
        }
      : {
          title: 'Active policies',
          value: 0,
          change: 0,
          icon: TrendingUp,
          format: 'number',
          subtitle: '',
          loading: metricsLoading,
        };

    return [totalClientsKpi, newApplicationsKpi, pendingTasksKpi, activePoliciesKpi];
  }, [stats, metrics, taskTotals, periodLabel, loading, loadingStates]);

  return {
    kpis,
    loading,
  };
}

export function getClientKPI(stats: DashboardStats | null): DashboardKPI | null {
  if (!stats) return null;

  return {
    title: 'Total Clients',
    value: stats.total_clients || 0,
    change: 0,
    icon: Users,
    format: 'number',
    subtitle: 'Active clients',
  };
}

export function getApplicationsKPI(stats: DashboardStats | null): DashboardKPI | null {
  if (!stats) return null;

  const newThisMonth = stats.new_this_month || 0;
  const newLastMonth = stats.new_last_month || 0;
  const growth = calculateGrowth(newThisMonth, newLastMonth);

  return {
    title: 'New Applications',
    value: newThisMonth,
    change: growth,
    icon: FileText,
    format: 'number',
    subtitle: 'This month',
    trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'neutral',
  };
}

export function getTasksKPI(stats: DashboardStats | null): DashboardKPI | null {
  if (!stats) return null;

  return {
    title: 'Pending Tasks',
    value: stats.pending_tasks || 0,
    change: 0,
    icon: CheckSquare,
    format: 'number',
    subtitle: 'Requiring attention',
  };
}

export function getPoliciesKPI(metrics: DashboardMetrics | null): DashboardKPI | null {
  if (!metrics) return null;

  const activePolicies = metrics.activePolicies || 0;
  const newPolicies = metrics.newPoliciesCount || 0;
  const previousPolicies = activePolicies - newPolicies;
  const growth = calculateGrowth(newPolicies, previousPolicies);

  return {
    title: 'Active Policies',
    value: activePolicies,
    change: growth,
    icon: TrendingUp,
    format: 'number',
    subtitle: `${newPolicies} new`,
    trend: growth > 0 ? 'up' : growth < 0 ? 'down' : 'neutral',
  };
}
