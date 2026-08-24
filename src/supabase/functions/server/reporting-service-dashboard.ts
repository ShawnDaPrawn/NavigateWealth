/**
 * Dashboard overview, key stats, revenue, AUM, and commissions.
 * One slice of the reporting service — the ReportingService facade in
 * reporting-service.ts binds these as its methods.
 */
/**
 * Reporting Service
 * Fresh file moved to root to fix bundling issues
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  DashboardReport,
  KeyStats,
  DateRange,
  RevenueReport,
  AUMReport,
  KvReportTask,
  KvReportClient,
  KvReportApplication,
  KvReportFna,
} from './reporting-types.ts';

import { getReportingSupabaseClient } from './reporting-service-helpers.ts';

const log = createModuleLogger('reporting-service');

/**
 * Get dashboard overview
 */
export async function getDashboardReport(): Promise<DashboardReport> {
  log.info('Generating dashboard report');

  // Get all data sources
  const clients = await kv.getByPrefix('user_profile:');
  const applications = await kv.getByPrefix('application:');
  const fnas = await kv.getByPrefix('fna:');
  const communications = await kv.getByPrefix('communication_history:');

  // Get tasks from Supabase DB
  const supabase = getReportingSupabaseClient();
  const { data: tasksData } = await supabase.from('tasks_91ed8379').select('*');
  const tasks = tasksData || [];

  // Calculate metrics
  const totalClients = clients?.length || 0;
  const totalApplications = applications?.length || 0;
  const totalFNAs = fnas?.length || 0;
  const totalCommunications = communications?.length || 0;

  // Calculate Task Metrics
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const lastMonthDate = new Date();
  lastMonthDate.setDate(lastMonthDate.getDate() - 30);
  const lastMonthStr = lastMonthDate.toISOString().split('T')[0];

  const tasksDueToday = tasks.filter((t: KvReportTask) => {
    // Check if due_date matches today and task is not completed/archived
    if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
    return t.due_date.startsWith(todayStr);
  }).length;

  const tasksDueLastMonth = tasks.filter((t: KvReportTask) => {
    if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
    return t.due_date.startsWith(lastMonthStr);
  }).length;

  const tasksGrowth =
    tasksDueLastMonth > 0
      ? ((tasksDueToday - tasksDueLastMonth) / tasksDueLastMonth) * 100
      : tasksDueToday > 0
        ? 100
        : 0;

  const totalTasks = tasks.filter((t: KvReportTask) => t.status !== 'archived').length;
  const completedTasks = tasks.filter((t: KvReportTask) => t.status === 'completed').length;

  // Calculate growth (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(now.getDate() - 60);

  const recentClients =
    clients?.filter(
      (c: KvReportClient) => new Date(c.createdAt || c.created_at || '') >= thirtyDaysAgo,
    ).length || 0;

  const previousClientsCount = totalClients - recentClients;
  const clientGrowth =
    previousClientsCount > 0
      ? (recentClients / previousClientsCount) * 100
      : recentClients > 0
        ? 100
        : 0;

  const recentApplications =
    applications?.filter(
      (a: KvReportApplication) => new Date(a.created_at || a.createdAt || '') >= thirtyDaysAgo,
    ).length || 0;

  // Calculate New Applications Growth (volume comparison vs previous 30 days)
  const previousPeriodApplications =
    applications?.filter((a: KvReportApplication) => {
      const date = new Date(a.created_at || a.createdAt || '');
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    }).length || 0;

  const recentApplicationsGrowth =
    previousPeriodApplications > 0
      ? ((recentApplications - previousPeriodApplications) / previousPeriodApplications) * 100
      : recentApplications > 0
        ? 100
        : 0;

  const previousApplicationsCount = totalApplications - recentApplications;
  const applicationGrowth =
    previousApplicationsCount > 0
      ? (recentApplications / previousApplicationsCount) * 100
      : recentApplications > 0
        ? 100
        : 0;

  return {
    clients: {
      total: totalClients,
      recent: recentClients,
      growth: clientGrowth,
    },
    applications: {
      total: totalApplications,
      recent: recentApplications,
      growth: applicationGrowth,
      recentGrowth: recentApplicationsGrowth,
      pending: applications?.filter((a: KvReportApplication) => a.status === 'pending').length || 0,
      approved:
        applications?.filter((a: KvReportApplication) => a.status === 'approved').length || 0,
    },
    fnas: {
      total: totalFNAs,
      published: fnas?.filter((f: KvReportFna) => f.status === 'published').length || 0,
      draft: fnas?.filter((f: KvReportFna) => f.status === 'draft').length || 0,
    },
    tasks: {
      total: totalTasks,
      dueToday: tasksDueToday,
      dueTodayGrowth: tasksGrowth,
      completed: completedTasks,
    },
    activity: {
      communications: totalCommunications,
    },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get key statistics
 */
export async function getKeyStats(): Promise<KeyStats> {
  const dashboard = await getDashboardReport();

  return {
    totalClients: dashboard.clients.total,
    totalApplications: dashboard.applications.total,
    totalFNAs: dashboard.fnas.total,
    clientGrowth: dashboard.clients.growth,
    applicationApprovalRate:
      dashboard.applications.total > 0
        ? (dashboard.applications.approved / dashboard.applications.total) * 100
        : 0,
  };
}

// ========================================================================
// FINANCIAL REPORTS
// ========================================================================

/**
 * Get revenue report
 */
export async function getRevenueReport(dateRange?: DateRange): Promise<RevenueReport> {
  log.info('Generating revenue report', { dateRange });

  // TODO: Implement actual revenue tracking
  // For now, return placeholder data

  return {
    total: 0,
    currency: 'ZAR',
    period: dateRange,
    breakdown: {
      commissions: 0,
      fees: 0,
      recurring: 0,
    },
  };
}

/**
 * Get Assets Under Management (AUM) report
 */
export async function getAUMReport(): Promise<AUMReport> {
  log.info('Generating AUM report');

  // TODO: Calculate from client portfolios

  return {
    total: 0,
    currency: 'ZAR',
    breakdown: {
      equities: 0,
      bonds: 0,
      cash: 0,
      alternatives: 0,
    },
  };
}

/**
 * Get commissions report
 */
export async function getCommissionsReport(dateRange?: DateRange): Promise<RevenueReport> {
  log.info('Generating commissions report', { dateRange });

  return {
    total: 0,
    currency: 'ZAR',
    period: dateRange,
    breakdown: { commissions: 0, fees: 0, recurring: 0 },
  };
}
