import React, { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminModule } from '../admin/layout/types';
import { AdminNavigationProvider } from '../admin/layout/AdminNavigationContext';
import { moduleSearchParams } from '../admin/layout/moduleSearchParams';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useOptionalUnsavedChangesRegistry } from '../shared/unsaved-changes';

// ============================================================================
// SHELL ENTRIES, NOT BARRELS
// Skeletons and the three self-lazy modules come from each module's
// `shell.ts`, never from its `index.ts` barrel. This page also
// `import()`s those barrels below, and Rollup cannot split out a module that is
// imported both statically and dynamically: one static barrel import here puts
// the whole module in this page's chunk, and every admin visit downloads it.
// `admin-shell-static-graph.test.ts` fails if a barrel import comes back.
// Each skeleton mirrors the full card/tab/table structure of its module so the
// page layout is stable from the first paint, before the JS chunk loads.
// ============================================================================

import { PublicationsSkeleton } from '../admin/modules/publications/shell';
import { TasksSkeleton } from '../admin/modules/tasks/shell';
import { ClientManagementSkeleton } from '../admin/modules/client-management/shell';
import { NewsletterSkeleton } from '../admin/modules/newsletter/shell';
import { SocialMediaModule, SocialMediaSkeleton } from '../admin/modules/social-media/shell';
import { IssuesModule, IssuesSkeleton } from '../admin/modules/issues/shell';
import { EsignModule, EsignSkeleton } from '../admin/modules/esign/shell';
import { DashboardSkeleton } from '../admin/modules/dashboard/shell';
import { ApplicationsSkeleton } from '../admin/modules/applications/shell';
import { PersonnelSkeleton } from '../admin/modules/personnel/shell';
import { AdviceEngineSkeleton } from '../admin/modules/advice-engine/shell';
import { ProductManagementSkeleton } from '../admin/modules/product-management/shell';
import { ResourcesSkeleton } from '../admin/modules/resources/shell';
import { ComplianceSkeleton } from '../admin/modules/compliance/shell';
import { CommunicationSkeleton } from '../admin/modules/communication/shell';
import { ReportingSkeleton } from '../admin/modules/reporting/shell';
import { CalendarSkeleton } from '../admin/modules/calendar/shell';
import { SubmissionsSkeleton } from '../admin/modules/submissions/shell';
import { NotesSkeleton } from '../admin/modules/notes/shell';
import { AIManagementSkeleton } from '../admin/modules/ai-management/shell';

// ============================================================================
// LAZY-LOADED MODULE CHUNKS
// Each module is only loaded when the user navigates to it (or when its
// sidebar item is hovered — see moduleLoaders.ts). The skeletons above provide
// structural continuity.
// ============================================================================

const DashboardModule = React.lazy(() =>
  import('../admin/modules/dashboard').then((m) => ({ default: m.DashboardModule })),
);
const ClientManagementModule = React.lazy(() =>
  import('../admin/modules/client-management').then((m) => ({ default: m.ClientManagementModule })),
);
const PersonnelModule = React.lazy(() =>
  import('../admin/modules/personnel').then((m) => ({ default: m.PersonnelModule })),
);
const TaskManagementModule = React.lazy(() =>
  import('../admin/modules/tasks').then((m) => ({ default: m.TaskManagementModule })),
);
const ApplicationsModule = React.lazy(() =>
  import('../admin/modules/applications').then((m) => ({ default: m.ApplicationsModule })),
);
const ReportingModule = React.lazy(() =>
  import('../admin/modules/reporting').then((m) => ({ default: m.ReportingModule })),
);
const CalendarModule = React.lazy(() =>
  import('../admin/modules/calendar').then((m) => ({ default: m.CalendarModule })),
);
const AdviceEngineModule = React.lazy(() =>
  import('../admin/modules/advice-engine').then((m) => ({ default: m.AdviceEngineModule })),
);
const ComplianceModule = React.lazy(() =>
  import('../admin/modules/compliance').then((m) => ({ default: m.ComplianceModule })),
);
const CommunicationModule = React.lazy(() =>
  import('../admin/modules/communication').then((m) => ({ default: m.CommunicationModule })),
);
const NewsletterModule = React.lazy(() =>
  import('../admin/modules/newsletter').then((m) => ({ default: m.NewsletterModule })),
);
const ProductManagementModule = React.lazy(() =>
  import('../admin/modules/product-management').then((m) => ({
    default: m.ProductManagementModule,
  })),
);
const ResourcesModule = React.lazy(() =>
  import('../admin/modules/resources').then((m) => ({ default: m.ResourcesModule })),
);
const PublicationsModule = React.lazy(() =>
  import('../admin/modules/publications').then((m) => ({ default: m.PublicationsModule })),
);
// EsignModule intentionally has NO React.lazy wrapper here: the esign barrel
// already exports it as a lazy component (its chunk splits at the barrel).
// Wrapping it again made the outer lazy resolve to the inner lazy OBJECT,
// which is React error #306 ("Lazy element type must resolve to a class or
// function") — the standalone E-Signature route crashed on load. Same
// pattern as SocialMediaModule/IssuesModule above.
const SubmissionsModule = React.lazy(() =>
  import('../admin/modules/submissions').then((m) => ({ default: m.SubmissionsModule })),
);
const NotesModule = React.lazy(() =>
  import('../admin/modules/notes').then((m) => ({ default: m.NotesModule })),
);
const AIManagementModule = React.lazy(() =>
  import('../admin/modules/ai-management').then((m) => ({ default: m.AIManagementModule })),
);
const LockedModule = React.lazy(() =>
  import('../admin/modules/locked').then((m) => ({ default: m.LockedModule })),
);

export function AdminDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const unsavedChangesRegistry = useOptionalUnsavedChangesRegistry();

  // ── Deep Link Support ──────────────────────────────────────────────────
  // URL params like ?module=resources&resourcesTab=tools allow drawer links
  // (Fill external form, prefill profile edit) to open the correct admin module.
  const moduleFromUrl = (searchParams.get('module') as AdminModule | null) || 'dashboard';
  const [activeModule, setActiveModule] = useState<AdminModule>(moduleFromUrl);

  React.useEffect(() => {
    setActiveModule(moduleFromUrl);
  }, [moduleFromUrl]);

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
  const handleModuleChange = useCallback(
    (module: string) => {
      const applyModuleChange = () => {
        // A fresh address bar: deep-link params belong to the module they
        // were opened in (see moduleSearchParams).
        setSearchParams(moduleSearchParams(module), { replace: true });

        if (module !== 'tasks') {
          setDeepLinkTaskId(null);
        }
        setActiveModule(module as AdminModule);
      };

      if (unsavedChangesRegistry?.getDirtyEntries().length) {
        unsavedChangesRegistry.tryLeaveAny(applyModuleChange);
        return;
      }

      applyModuleChange();
    },
    [setSearchParams, unsavedChangesRegistry],
  );

  // ── No background jobs here ──
  // Scheduled publishing, auto-content, article and newsletter delivery, the
  // overdue-task digest and data maintenance all run from pg_cron on the
  // server (docs/runbooks/scheduled-jobs.md). They used to be pollers mounted
  // on this page as well, so every open admin tab spent its first minute
  // firing them and kept a timer running for each. Do not bring one back:
  // a job that must run belongs in a cron job, not in whoever has a tab open.

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <Suspense fallback={<DashboardSkeleton />}>
            <ErrorBoundary fallbackTitle="Dashboard Module Error">
              <DashboardModule
                onModuleChange={handleModuleChange}
                onViewTask={handleViewTaskFromDashboard}
              />
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
      case 'newsletter':
        return (
          <Suspense fallback={<NewsletterSkeleton />}>
            <ErrorBoundary fallbackTitle="Newsletters Error">
              <NewsletterModule />
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
      case 'issues':
        return (
          <Suspense fallback={<IssuesSkeleton />}>
            <ErrorBoundary fallbackTitle="Issue Manager Error">
              <IssuesModule />
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
      case 'locked':
        return (
          <Suspense fallback={<div className="p-6" />}>
            <ErrorBoundary fallbackTitle="Locked Module Error">
              <LockedModule />
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
        <AdminLayout activeModule={activeModule} onModuleChange={handleModuleChange}>
          {renderModule()}
        </AdminLayout>
      </AdminNavigationProvider>
    </ErrorBoundary>
  );
}

export default AdminDashboardPage;
