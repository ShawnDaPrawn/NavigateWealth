import React from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { AdminAuthNotice } from '../../AdminAuthNotice';
import { KPIGrid } from './components/KPIGrid';
import { SystemActivityCard } from './components/SystemActivityCard';
import { QuickActionsCard } from './components/QuickActionsCard';
import { TasksWidget } from './components/TasksWidget';
// import { RequestsWidget } from './components/RequestsWidget';
import { RecentNotesWidget } from './components/RecentNotesWidget';
import { NewsletterKPICard } from './components/NewsletterKPICard';
import { SystemHealthCard } from './components/SystemHealthCard';
import { AuditLogWidget } from './components/AuditLogWidget';
import { useDashboardData, useDashboardKPIs } from './hooks';
import type { DashboardModuleProps } from './types';

export function DashboardModule({ onModuleChange, onViewTask }: DashboardModuleProps = {}) {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');

  // Fetch all dashboard data
  const { stats, metrics, loading, error, loadingStates } = useDashboardData();

  // Generate KPIs from stats and metrics — always returns 4 entries
  // so the grid structure is stable from first render.
  const { kpis, loading: kpisLoading } = useDashboardKPIs({
    stats,
    metrics,
    loading,
    loadingStates: {
      stats: loadingStates.stats,
      metrics: loadingStates.metrics,
    },
  });

  // Show auth notice for non-admin users
  if (!isAdmin) {
    return <AdminAuthNotice />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Show error banner if dashboard data failed, but don't block the rest */}
      {error && !loading && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-center">
          <p className="text-destructive font-medium text-sm">Some dashboard data failed to load</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      )}

      {/* ========================================================================
          KPI GRID — Top-level metrics
          ======================================================================== */}
      <KPIGrid kpis={kpis} loading={kpisLoading} columns={4} />

      {/* ========================================================================
          MIDDLE SECTION — System Activity + Quick Actions
          ======================================================================== */}
      <div className="grid gap-6 md:grid-cols-2">
        <SystemActivityCard onModuleChange={onModuleChange} />
        <QuickActionsCard onModuleChange={onModuleChange} />
      </div>

      {/* ========================================================================
          TASKS + RECENT NOTES
          ======================================================================== */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TasksWidget
          onModuleChange={onModuleChange}
          onViewTask={onViewTask}
          maxTasks={5}
        />
        <RecentNotesWidget
          onModuleChange={onModuleChange}
          maxNotes={5}
        />
      </div>

      {/* ========================================================================
          BOTTOM SECTION — Newsletter + System Health (left) | Audit Trail (right)
          ======================================================================== */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-6">
          <NewsletterKPICard />
          <SystemHealthCard onModuleChange={onModuleChange} />
        </div>
        <div className="lg:col-span-3">
          <AuditLogWidget onModuleChange={onModuleChange} maxEntries={8} />
        </div>
      </div>
    </div>
  );
}