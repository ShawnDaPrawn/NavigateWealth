import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import {
  DsPage,
  DsSection,
  DsSegmented,
  NoAccess,
  useBreadcrumbTrail,
  useUrlState,
} from '../../layout/page';
import { DashboardHeader } from './components/DashboardHeader';
import { AuditTrailPage } from './components/AuditTrailPage';
import { NeedsAttentionCard } from './components/NeedsAttentionCard';
import { KPIGrid } from './components/KPIGrid';
import { CardError } from './components/CardError';
import { QuickActionsCard } from './components/QuickActionsCard';
import { TasksWidget } from './components/TasksWidget';
import { RecentNotesWidget } from './components/RecentNotesWidget';
import { NewsletterKPICard } from './components/NewsletterKPICard';
import { PublicationsCard } from './components/PublicationsCard';
import { useDashboardData, useDashboardKPIs } from './hooks';
import { dashboardKeys } from './hooks/queryKeys';
import { taskStatsApi } from './api';
import type { DashboardModuleProps, DashboardPeriod } from './types';

/** The dashboard home, or the audit trail page (?view=audit). */
const DASHBOARD_VIEWS = ['home', 'audit'] as const;
const DASHBOARD_PERIODS = ['month', '30d', 'year'] as const;
type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export function DashboardModule({ onModuleChange, onViewTask }: DashboardModuleProps = {}) {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');
  const [view, setView] = useUrlState<DashboardView>('view', 'home', DASHBOARD_VIEWS);
  const [period, setPeriod] = useUrlState<DashboardPeriod>('period', 'month', DASHBOARD_PERIODS);
  // Top-bar breadcrumb: Dashboard / Audit trail.
  useBreadcrumbTrail(view === 'audit' ? [{ label: 'Audit trail' }] : []);

  // Fetch all dashboard data
  const { stats, metrics, tasks, errors, refetchStats, loadingStates } = useDashboardData(period);

  // Open / completed totals for the Tasks figure (was a System Activity tile).
  const { data: taskTotals = null } = useQuery({
    queryKey: [...dashboardKeys.all, 'task-totals'] as const,
    queryFn: () => taskStatsApi.getStats(),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  });

  // Generate KPIs from stats and metrics — always returns 4 entries
  // so the grid structure is stable from first render.
  const { kpis, loading: kpisLoading } = useDashboardKPIs({
    stats,
    metrics,
    taskTotals,
    period,
    loading: loadingStates.stats || loadingStates.metrics,
    loadingStates: {
      stats: loadingStates.stats,
      metrics: loadingStates.metrics,
    },
  });

  if (!isAdmin) {
    return (
      <NoAccess
        what="the dashboard"
        howToGetAccess="The dashboard is for admins. Ask a super admin if you need it."
      />
    );
  }

  if (view === 'audit') {
    return <AuditTrailPage onBack={() => setView('home')} />;
  }

  return (
    <DsPage>
      <DashboardHeader userName={user?.firstName} onOpenAuditTrail={() => setView('audit')} />

      {/* ── Needs your attention: the sidebar's waiting counts ─────────── */}
      <NeedsAttentionCard
        onModuleChange={onModuleChange}
        tasksDueToday={tasks.length}
        tasksDueTodayFailed={errors.tasks}
      />

      {/* ── Practice at a glance ──────────────────────────────────────── */}
      <DsSection
        title="Practice at a glance"
        titleId="practice-at-a-glance"
        actions={
          <DsSegmented
            label="Period"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'month', label: 'This month' },
              { value: '30d', label: 'Last 30 days' },
              { value: 'year', label: 'This year' },
            ]}
          />
        }
      >
        {errors.stats ? (
          <CardError title="Couldn't load the practice figures" onRetry={refetchStats} />
        ) : (
          <KPIGrid kpis={kpis} loading={kpisLoading} columns={4} />
        )}
      </DsSection>

      {/* ── Due today + Quick actions ────────────────────────────────── */}
      <div className="ds-split">
        <TasksWidget onModuleChange={onModuleChange} onViewTask={onViewTask} maxTasks={5} />
        <QuickActionsCard onModuleChange={onModuleChange} />
      </div>

      {/* ── Recent notes | Publications | Newsletter ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentNotesWidget onModuleChange={onModuleChange} maxNotes={4} />
        <PublicationsCard onModuleChange={onModuleChange} maxArticles={3} />
        <NewsletterKPICard onModuleChange={onModuleChange} />
      </div>
    </DsPage>
  );
}
