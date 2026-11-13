import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../auth/AuthContext';
import { Tabs } from '../../../ui/tabs';
import {
  NoAccess,
  SegmentedList,
  SegmentedTrigger,
  SoonBadge,
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
import type { DashboardModuleProps } from './types';

/** The dashboard home, or the audit trail page (?view=audit). */
const DASHBOARD_VIEWS = ['home', 'audit'] as const;
type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export function DashboardModule({ onModuleChange, onViewTask }: DashboardModuleProps = {}) {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin');
  const [view, setView] = useUrlState<DashboardView>('view', 'home', DASHBOARD_VIEWS);
  // Top-bar breadcrumb: Dashboard / Audit trail.
  useBreadcrumbTrail(view === 'audit' ? [{ label: 'Audit trail' }] : []);

  // Fetch all dashboard data
  const { stats, metrics, tasks, errors, refetchStats, loadingStates } = useDashboardData();

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
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <DashboardHeader userName={user?.firstName} onOpenAuditTrail={() => setView('audit')} />

      {/* ── Needs your attention: the sidebar's waiting counts ─────────── */}
      <NeedsAttentionCard onModuleChange={onModuleChange} tasksDueToday={tasks.length} />

      {/* ── Practice at a glance ──────────────────────────────────────── */}
      <section aria-labelledby="practice-at-a-glance" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="practice-at-a-glance" className="text-base font-semibold text-nw-ink">
            Practice at a glance
          </h2>
          {/* Only "this month" exists on the server today. */}
          <Tabs value="month">
            <SegmentedList aria-label="Period">
              <SegmentedTrigger value="month">This month</SegmentedTrigger>
              <SegmentedTrigger value="30d" disabled>
                Last 30 days <SoonBadge />
              </SegmentedTrigger>
              <SegmentedTrigger value="year" disabled>
                This year <SoonBadge />
              </SegmentedTrigger>
            </SegmentedList>
          </Tabs>
        </div>
        {errors.stats ? (
          <CardError title="Couldn't load the practice figures" onRetry={refetchStats} />
        ) : (
          <KPIGrid kpis={kpis} loading={kpisLoading} columns={4} />
        )}
      </section>

      {/* ── Due today + Quick actions ────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TasksWidget onModuleChange={onModuleChange} onViewTask={onViewTask} maxTasks={5} />
        <QuickActionsCard onModuleChange={onModuleChange} />
      </div>

      {/* ── Recent notes ─────────────────────────────────────────────── */}
      <RecentNotesWidget onModuleChange={onModuleChange} maxNotes={5} />

      {/* ── Publications | Newsletter ────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PublicationsCard onModuleChange={onModuleChange} maxArticles={5} />
        </div>
        <div className="lg:col-span-2">
          <NewsletterKPICard onModuleChange={onModuleChange} />
        </div>
      </div>
    </div>
  );
}
