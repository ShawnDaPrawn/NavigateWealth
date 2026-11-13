import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { AdminLayout } from '../admin/AdminLayout';
import { AdminModule } from '../admin/layout/types';
import { AdminNavigationProvider } from '../admin/layout/AdminNavigationContext';
import { moduleSearchParams } from '../admin/layout/moduleSearchParams';
import { ModuleFrame } from '../admin/layout/ModuleFrame';
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
      const next = moduleSearchParams('tasks');
      next.set('task', taskId);
      setSearchParams(next);
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
          <ModuleFrame module="dashboard">
            <DashboardModule
              onModuleChange={handleModuleChange}
              onViewTask={handleViewTaskFromDashboard}
            />
          </ModuleFrame>
        );
      case 'clients':
        return (
          <ModuleFrame module="clients">
            <ClientManagementModule />
          </ModuleFrame>
        );
      case 'esign':
        return (
          <ModuleFrame module="esign">
            <EsignModule />
          </ModuleFrame>
        );
      case 'personnel':
        return (
          <ModuleFrame module="personnel">
            <PersonnelModule />
          </ModuleFrame>
        );
      case 'advice-engine':
        return (
          <ModuleFrame module="advice-engine">
            <AdviceEngineModule />
          </ModuleFrame>
        );
      case 'product-management':
        return (
          <ModuleFrame module="product-management">
            <ProductManagementModule />
          </ModuleFrame>
        );
      case 'resources':
        return (
          <ModuleFrame module="resources">
            <ResourcesModule />
          </ModuleFrame>
        );
      case 'publications':
        return (
          <ModuleFrame module="publications">
            <PublicationsModule />
          </ModuleFrame>
        );
      case 'compliance':
        return (
          <ModuleFrame module="compliance">
            <ComplianceModule />
          </ModuleFrame>
        );
      case 'tasks':
        return (
          <ModuleFrame module="tasks">
            <TaskManagementModule />
          </ModuleFrame>
        );
      case 'notes':
        return (
          <ModuleFrame module="notes">
            <NotesModule />
          </ModuleFrame>
        );
      case 'applications':
        return (
          <ModuleFrame module="applications">
            <ApplicationsModule />
          </ModuleFrame>
        );
      case 'submissions':
        return (
          <ModuleFrame module="submissions">
            <SubmissionsModule />
          </ModuleFrame>
        );
      case 'communication':
        return (
          <ModuleFrame module="communication">
            <CommunicationModule />
          </ModuleFrame>
        );
      case 'newsletter':
        return (
          <ModuleFrame module="newsletter">
            <NewsletterModule />
          </ModuleFrame>
        );
      case 'marketing':
        return (
          <ModuleFrame module="marketing">
            <SocialMediaModule />
          </ModuleFrame>
        );
      case 'reporting':
        return (
          <ModuleFrame module="reporting">
            <ReportingModule />
          </ModuleFrame>
        );
      case 'issues':
        return (
          <ModuleFrame module="issues">
            <IssuesModule />
          </ModuleFrame>
        );
      case 'calendar':
        return (
          <ModuleFrame module="calendar">
            <CalendarModule />
          </ModuleFrame>
        );
      case 'locked':
        return (
          <ModuleFrame module="locked">
            <LockedModule />
          </ModuleFrame>
        );
      case 'ai-management':
        return (
          <ModuleFrame module="ai-management">
            <AIManagementModule />
          </ModuleFrame>
        );
      default:
        return (
          <ModuleFrame module="dashboard">
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
