import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminModule } from '../admin/layout/types';
import { AdminNavigationProvider } from '../admin/layout/AdminNavigationContext';
import { moduleSearchParams } from '../admin/layout/moduleSearchParams';
import { taskAddress } from '../admin/modules/tasks/taskLink';
import { ModuleFrame } from '../admin/layout/ModuleFrame';
import { useCurrentUserPermissions } from '../admin/modules/personnel/shell';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { useOptionalUnsavedChangesRegistry } from '../shared/unsaved-changes';

// ============================================================================
// SHELL ENTRIES, NOT BARRELS
// The three self-lazy modules come from each module's
// `shell.ts`, never from its `index.ts` barrel. This page also
// `import()`s those barrels below, and Rollup cannot split out a module that is
// imported both statically and dynamically: one static barrel import here puts
// the whole module in this page's chunk, and every admin visit downloads it.
// `admin-shell-static-graph.test.ts` fails if a barrel import comes back.
// While a module's chunk loads, ModuleFrame shows the one shared skeleton
// (header with the module's name, grey tabs, figures and rows), and the one
// shared error state if it fails.
// ============================================================================

import { SocialMediaModule } from '../admin/modules/social-media/shell';
import { IssuesModule } from '../admin/modules/issues/shell';
import { EsignModule } from '../admin/modules/esign/shell';

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
  const { can } = useCurrentUserPermissions();

  // ── Deep Link Support ──────────────────────────────────────────────────
  // URL params like ?module=resources&resourcesTab=tools allow drawer links
  // (Fill external form, prefill profile edit) to open the correct admin module.
  const moduleFromUrl = (searchParams.get('module') as AdminModule | null) || 'dashboard';
  const [activeModule, setActiveModule] = useState<AdminModule>(moduleFromUrl);

  React.useEffect(() => {
    setActiveModule(moduleFromUrl);
  }, [moduleFromUrl]);

  // ── Task Deep Link ──────────────────────────────────────────────────────
  // A task clicked in the dashboard's Due Today widget opens To-Do with the
  // task in the address (?module=tasks&task=<id>); the module opens its page.
  const handleViewTaskFromDashboard = useCallback(
    (taskId: string) => {
      setSearchParams(taskAddress(taskId));
    },
    [setSearchParams],
  );

  const handleModuleChange = useCallback(
    (module: string) => {
      const applyModuleChange = () => {
        // A fresh address bar: deep-link params belong to the module they
        // were opened in (see moduleSearchParams).
        setSearchParams(moduleSearchParams(module), { replace: true });

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
          <ModuleFrame
            module="dashboard"
            allowed={can('dashboard')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <DashboardModule
              onModuleChange={handleModuleChange}
              onViewTask={handleViewTaskFromDashboard}
            />
          </ModuleFrame>
        );
      case 'clients':
        return (
          <ModuleFrame
            module="clients"
            allowed={can('clients')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ClientManagementModule />
          </ModuleFrame>
        );
      case 'esign':
        return (
          <ModuleFrame
            module="esign"
            allowed={can('esign')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <EsignModule />
          </ModuleFrame>
        );
      case 'personnel':
        return (
          <ModuleFrame
            module="personnel"
            allowed={can('personnel')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <PersonnelModule />
          </ModuleFrame>
        );
      case 'advice-engine':
        return (
          <ModuleFrame
            module="advice-engine"
            allowed={can('advice-engine')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <AdviceEngineModule />
          </ModuleFrame>
        );
      case 'product-management':
        return (
          <ModuleFrame
            module="product-management"
            allowed={can('product-management')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ProductManagementModule />
          </ModuleFrame>
        );
      case 'resources':
        return (
          <ModuleFrame
            module="resources"
            allowed={can('resources')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ResourcesModule />
          </ModuleFrame>
        );
      case 'publications':
        return (
          <ModuleFrame
            module="publications"
            allowed={can('publications')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <PublicationsModule />
          </ModuleFrame>
        );
      case 'compliance':
        return (
          <ModuleFrame
            module="compliance"
            allowed={can('compliance')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ComplianceModule />
          </ModuleFrame>
        );
      case 'tasks':
        return (
          <ModuleFrame
            module="tasks"
            allowed={can('tasks')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <TaskManagementModule />
          </ModuleFrame>
        );
      case 'notes':
        return (
          <ModuleFrame
            module="notes"
            allowed={can('notes')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <NotesModule />
          </ModuleFrame>
        );
      case 'applications':
        return (
          <ModuleFrame
            module="applications"
            allowed={can('applications')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ApplicationsModule />
          </ModuleFrame>
        );
      case 'submissions':
        return (
          <ModuleFrame
            module="submissions"
            allowed={can('submissions')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <SubmissionsModule />
          </ModuleFrame>
        );
      case 'communication':
        return (
          <ModuleFrame
            module="communication"
            allowed={can('communication')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <CommunicationModule />
          </ModuleFrame>
        );
      case 'newsletter':
        return (
          <ModuleFrame
            module="newsletter"
            allowed={can('newsletter')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <NewsletterModule />
          </ModuleFrame>
        );
      case 'marketing':
        return (
          <ModuleFrame
            module="marketing"
            allowed={can('marketing')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <SocialMediaModule />
          </ModuleFrame>
        );
      case 'reporting':
        return (
          <ModuleFrame
            module="reporting"
            allowed={can('reporting')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <ReportingModule />
          </ModuleFrame>
        );
      case 'issues':
        return (
          <ModuleFrame
            module="issues"
            allowed={can('issues')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <IssuesModule />
          </ModuleFrame>
        );
      case 'calendar':
        return (
          <ModuleFrame
            module="calendar"
            allowed={can('calendar')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <CalendarModule />
          </ModuleFrame>
        );
      case 'locked':
        return (
          <ModuleFrame
            module="locked"
            allowed={can('locked')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <LockedModule />
          </ModuleFrame>
        );
      case 'ai-management':
        return (
          <ModuleFrame
            module="ai-management"
            allowed={can('ai-management')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <AIManagementModule />
          </ModuleFrame>
        );
      default:
        return (
          <ModuleFrame
            module="dashboard"
            allowed={can('dashboard')}
            onBackToDashboard={() => handleModuleChange('dashboard')}
          >
            <DashboardModule />
          </ModuleFrame>
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
