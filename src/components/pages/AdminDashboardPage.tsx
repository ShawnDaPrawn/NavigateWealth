import React, { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminModule } from '../admin/layout/types';
import { AdminNavigationProvider } from '../admin/layout/AdminNavigationContext';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useAutoContentProcessor } from '../admin/modules/publications/hooks/useAutoContentProcessor';
import { useScheduledPublishProcessor } from '../admin/modules/publications/hooks/useScheduledPublishProcessor';
import { useOverdueDigestProcessor } from '../admin/modules/tasks/hooks/useOverdueDigestProcessor';
import { useMaintenanceCronProcessor } from '../admin/modules/client-management/hooks/useMaintenanceCronProcessor';
import { toast } from 'sonner@2.0.3';

// ============================================================================
// EAGERLY IMPORTED SKELETONS
// Each skeleton mirrors the full card/tab/table structure of its module so
// the page layout is stable from the first paint, before the JS chunk loads.
// These are intentionally NOT imported through the lazy module barrels.
// ============================================================================

import { DashboardSkeleton } from '../admin/modules/dashboard/components/DashboardSkeleton';
import { ClientManagementSkeleton } from '../admin/modules/client-management/components/ClientManagementSkeleton';
import { ApplicationsSkeleton } from '../admin/modules/applications/components/ApplicationsSkeleton';
import { TasksSkeleton } from '../admin/modules/tasks/components/TasksSkeleton';
import { PersonnelSkeleton } from '../admin/modules/personnel/components/PersonnelSkeleton';
import { EsignSkeleton } from '../admin/modules/esign/components/EsignSkeleton';
import { AdviceEngineSkeleton } from '../admin/modules/advice-engine/components/AdviceEngineSkeleton';
import { ProductManagementSkeleton } from '../admin/modules/product-management/components/ProductManagementSkeleton';
import { ResourcesSkeleton } from '../admin/modules/resources/components/ResourcesSkeleton';
import { PublicationsSkeleton } from '../admin/modules/publications/components/PublicationsSkeleton';
import { ComplianceSkeleton } from '../admin/modules/compliance/components/ComplianceSkeleton';
import { RequestsSkeleton } from '../admin/modules/requests/components/RequestsSkeleton';
import { CommunicationSkeleton } from '../admin/modules/communication/components/CommunicationSkeleton';
import { SocialMediaSkeleton } from '../admin/modules/social-media/components/SocialMediaSkeleton';
import { ReportingSkeleton } from '../admin/modules/reporting/components/ReportingSkeleton';
import { CalendarSkeleton } from '../admin/modules/calendar/components/CalendarSkeleton';
import { SubmissionsSkeleton } from '../admin/modules/submissions/components/SubmissionsSkeleton';
import { NotesSkeleton } from '../admin/modules/notes/components/NotesSkeleton';
import { AIManagementSkeleton } from '../admin/modules/ai-management/components/AIManagementSkeleton';

// ============================================================================
// LAZY-LOADED MODULE CHUNKS
// Each module is only loaded when the user navigates to it, keeping the
// initial bundle lean. The skeletons above provide structural continuity.
// ============================================================================

const DashboardModule = React.lazy(() => import('../admin/modules/dashboard').then(m => ({ default: m.DashboardModule })));
const ClientManagementModule = React.lazy(() => import('../admin/modules/client-management').then(m => ({ default: m.ClientManagementModule })));
const PersonnelModule = React.lazy(() => import('../admin/modules/personnel').then(m => ({ default: m.PersonnelModule })));
const TaskManagementModule = React.lazy(() => import('../admin/modules/tasks').then(m => ({ default: m.TaskManagementModule })));
const ApplicationsModule = React.lazy(() => import('../admin/modules/applications').then(m => ({ default: m.ApplicationsModule })));
const ReportingModule = React.lazy(() => import('../admin/modules/reporting').then(m => ({ default: m.ReportingModule })));
const RequestsModule = React.lazy(() => import('../admin/modules/requests').then(m => ({ default: m.RequestsModule })));
const CalendarModule = React.lazy(() => import('../admin/modules/calendar').then(m => ({ default: m.CalendarModule })));
const AdviceEngineModule = React.lazy(() => import('../admin/modules/advice-engine').then(m => ({ default: m.AdviceEngineModule })));
const ComplianceModule = React.lazy(() => import('../admin/modules/compliance').then(m => ({ default: m.ComplianceModule })));
const CommunicationModule = React.lazy(() => import('../admin/modules/communication').then(m => ({ default: m.CommunicationModule })));
const SocialMediaModule = React.lazy(() => import('../admin/modules/social-media/SocialMediaModule').then(m => ({ default: m.SocialMediaModule })));
const ProductManagementModule = React.lazy(() => import('../admin/modules/product-management').then(m => ({ default: m.ProductManagementModule })));
const ResourcesModule = React.lazy(() => import('../admin/modules/resources').then(m => ({ default: m.ResourcesModule })));
const PublicationsModule = React.lazy(() => import('../admin/modules/publications').then(m => ({ default: m.PublicationsModule })));
const EsignModule = React.lazy(() => import('../admin/modules/esign').then(m => ({ default: m.EsignModule })));
const SubmissionsModule = React.lazy(() => import('../admin/modules/submissions').then(m => ({ default: m.SubmissionsModule })));
const NotesModule = React.lazy(() => import('../admin/modules/notes').then(m => ({ default: m.NotesModule })));
const AIManagementModule = React.lazy(() => import('../admin/modules/ai-management').then(m => ({ default: m.AIManagementModule })));

export function AdminDashboardPage() {
  const [searchParams] = useSearchParams();

  // ── Deep Link Support ──────────────────────────────────────────────────
  // URL params like ?module=submissions&type=consultation allow email
  // notifications and external links to open a specific module with filters.
  // The `type` param is consumed by individual modules (e.g. SubmissionsModule).
  const initialModule = (searchParams.get('module') as AdminModule) || 'dashboard';
  const [activeModule, setActiveModule] = useState<AdminModule>(initialModule);

  // ── Task Deep Link ──────────────────────────────────────────────────────
  // When a task is clicked in the dashboard's Due Today widget, we store
  // the task ID and switch to the tasks module. The TaskManagementModule
  // reads this ID and auto-opens the task detail modal.
  const [deepLinkTaskId, setDeepLinkTaskId] = useState<string | null>(null);

  const handleViewTaskFromDashboard = useCallback((taskId: string) => {
    setDeepLinkTaskId(taskId);
    setActiveModule('tasks');
  }, []);

  // Clear deep-link when navigating away from tasks
  const handleModuleChange = useCallback((module: string) => {
    if (module !== 'tasks') {
      setDeepLinkTaskId(null);
    }
    setActiveModule(module as AdminModule);
  }, []);

  // ── Background Processors ──
  // These run at the AdminDashboardPage level (not inside PublicationsModule)
  // so they stay active regardless of which admin tab is open.
  // Previously they were only mounted when the Publications tab was active,
  // which meant scheduled pipelines never fired unless someone was viewing
  // that specific tab.

  // Auto-publish scheduled articles every 5 minutes
  useScheduledPublishProcessor({
    onProcessed: (count) => {
      toast.success(`${count} scheduled article${count === 1 ? '' : 's'} published automatically`);
    },
  });

  // Trigger due auto-content pipelines every 15 minutes
  useAutoContentProcessor({
    onArticlesGenerated: (count, pipelineNames) => {
      toast.success(`${count} article${count === 1 ? '' : 's'} auto-generated by content pipelines`);
    },
  });

  // Send overdue task digest every 24 hours
  useOverdueDigestProcessor({
    onDigestSent: (count) => {
      toast.success(`Overdue task digest sent with ${count} overdue task${count === 1 ? '' : 's'}`);
    },
  });

  // Run maintenance cron job every 24 hours
  useMaintenanceCronProcessor({
    onClientCleanupRan: () => {
      toast.success('Daily client data maintenance completed automatically');
    },
    onKvCleanupRan: () => {
      toast.success('Daily KV store cleanup completed automatically');
    },
  });

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <Suspense fallback={<DashboardSkeleton />}>
            <ErrorBoundary fallbackTitle="Dashboard Module Error">
              <DashboardModule onModuleChange={handleModuleChange} onViewTask={handleViewTaskFromDashboard} />
            </ErrorBoundary>
          </Suspense>
        );
      case 'clients':
        return (
          <Suspense fallback={<ClientManagementSkeleton />}>
            <ErrorBoundary fallbackTitle="Client Management Error">
              <ClientManagementModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'esign':
        return (
          <Suspense fallback={<EsignSkeleton />}>
            <ErrorBoundary fallbackTitle="E-Signature Module Error">
              <EsignModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'personnel':
        return (
          <Suspense fallback={<PersonnelSkeleton />}>
            <ErrorBoundary fallbackTitle="Personnel Module Error">
              <PersonnelModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'advice-engine':
        return (
          <Suspense fallback={<AdviceEngineSkeleton />}>
            <ErrorBoundary fallbackTitle="Advice Engine Error">
              <AdviceEngineModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'product-management':
        return (
          <Suspense fallback={<ProductManagementSkeleton />}>
            <ErrorBoundary fallbackTitle="Product Management Error">
              <ProductManagementModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'resources':
        return (
          <Suspense fallback={<ResourcesSkeleton />}>
            <ErrorBoundary fallbackTitle="Resources Module Error">
              <ResourcesModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'publications':
        return (
          <Suspense fallback={<PublicationsSkeleton />}>
            <ErrorBoundary fallbackTitle="Publications Module Error">
              <PublicationsModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'compliance':
        return (
          <Suspense fallback={<ComplianceSkeleton />}>
            <ErrorBoundary fallbackTitle="Compliance Module Error">
              <ComplianceModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'tasks':
        return (
          <Suspense fallback={<TasksSkeleton />}>
            <ErrorBoundary fallbackTitle="Task Management Error">
              <TaskManagementModule initialTaskId={deepLinkTaskId} />
            </ErrorBoundary>
          </Suspense>
        );
      case 'notes':
        return (
          <Suspense fallback={<NotesSkeleton />}>
            <ErrorBoundary fallbackTitle="Notes Module Error">
              <NotesModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'applications':
        return (
          <Suspense fallback={<ApplicationsSkeleton />}>
            <ErrorBoundary fallbackTitle="Applications Module Error">
              <ApplicationsModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'quotes':
        return (
          <Suspense fallback={<RequestsSkeleton />}>
            <ErrorBoundary fallbackTitle="Requests Module Error">
              <RequestsModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'submissions':
        return (
          <Suspense fallback={<SubmissionsSkeleton />}>
            <ErrorBoundary fallbackTitle="Submissions Manager Error">
              <SubmissionsModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'communication':
        return (
          <Suspense fallback={<CommunicationSkeleton />}>
            <ErrorBoundary fallbackTitle="Communication Module Error">
              <CommunicationModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'marketing':
        return (
          <Suspense fallback={<SocialMediaSkeleton />}>
            <ErrorBoundary fallbackTitle="Social Media Module Error">
              <SocialMediaModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'reporting':
        return (
          <Suspense fallback={<ReportingSkeleton />}>
            <ErrorBoundary fallbackTitle="Reporting Module Error">
              <ReportingModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'calendar':
        return (
          <Suspense fallback={<CalendarSkeleton />}>
            <ErrorBoundary fallbackTitle="Calendar Module Error">
              <CalendarModule />
            </ErrorBoundary>
          </Suspense>
        );
      case 'ai-management':
        return (
          <Suspense fallback={<AIManagementSkeleton />}>
            <ErrorBoundary fallbackTitle="AI Management Module Error">
              <AIManagementModule />
            </ErrorBoundary>
          </Suspense>
        );
      default:
        return (
          <Suspense fallback={<DashboardSkeleton />}>
            <ErrorBoundary fallbackTitle="Dashboard Module Error">
              <DashboardModule />
            </ErrorBoundary>
          </Suspense>
        );
    }
  };

  return (
    <ErrorBoundary fallbackTitle="Admin Dashboard Error">
      <AdminNavigationProvider onModuleChange={handleModuleChange}>
        <AdminLayout 
          activeModule={activeModule} 
          onModuleChange={handleModuleChange}
        >
          {renderModule()}
        </AdminLayout>
      </AdminNavigationProvider>
    </ErrorBoundary>
  );
}
