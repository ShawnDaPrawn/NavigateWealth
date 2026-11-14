import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../ui/button';
import { Plus } from 'lucide-react';
import { Notice, PageHeader, useBreadcrumbTrail, useConfirm } from '../../layout/page';
import { toast } from 'sonner';

// Import types
import { Report, ReportRun } from './types';

// Import components
import { ReportsTable } from './components/ReportsTable';
import { ReportRunsList } from './components/ReportRunsList';
import { ReportDialog } from './components/ReportDialog';
import { CreateReportDialog, type NewReportDefinition } from './components/CreateReportDialog';
import { reportDefinitionsApi } from './api';
import { definitionToReport } from './reportSources';

// Import utilities
import { executeReport, createReportRun } from './utils';
import { useCurrentUserPermissions } from '../personnel';

/**
 * Pre-defined report definitions.
 * Each entry maps to a backend endpoint via the REPORT_ENDPOINTS registry in api.ts.
 */
const DEFAULT_REPORTS: Report[] = [
  {
    id: 'personal-clients',
    name: 'Personal Clients List',
    description: 'Full list of personal clients with demographic and contact details',
    category: 'clients',
    parameters: { format: 'xlsx' },
    lastRunAt: undefined,
    outputs: ['personal-clients.xlsx'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'applications-pipeline',
    name: 'Applications Pipeline',
    description: 'All applications with status, applicant details, and processing time',
    category: 'activity',
    parameters: { format: 'xlsx' },
    lastRunAt: undefined,
    outputs: ['applications-pipeline.xlsx'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'fna-completion',
    name: 'FNA Completion Report',
    description: 'Financial needs analyses by type, status, adviser, and completion time',
    category: 'financial',
    parameters: { format: 'xlsx' },
    lastRunAt: undefined,
    outputs: ['fna-completion.xlsx'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'compliance-audit',
    name: 'POPIA / FAIS Compliance Audit',
    description: 'Consent status across all clients — POPIA, FAIS, electronic comms, and marketing',
    category: 'compliance',
    parameters: { format: 'xlsx' },
    lastRunAt: undefined,
    outputs: ['compliance-audit.xlsx'],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lifecycle-audit',
    name: 'Client Lifecycle Audit',
    description: 'Cross-references profile and security entries to surface status inconsistencies',
    category: 'compliance',
    parameters: { format: 'xlsx' },
    lastRunAt: undefined,
    outputs: ['lifecycle-audit.xlsx'],
    createdAt: new Date().toISOString(),
  },
];

export function ReportingModule() {
  // State management
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportRuns, setReportRuns] = useState<ReportRun[]>([]);
  const [runningReports, setRunningReports] = useState<Set<string>>(new Set());
  const [reports, setReports] = useState<Report[]>(DEFAULT_REPORTS);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [definitionsError, setDefinitionsError] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  // Saved custom reports come after the built-in five.
  const loadDefinitions = useCallback(async () => {
    try {
      setDefinitionsError(null);
      const defs = await reportDefinitionsApi.list();
      setReports((prev) => [...prev.filter((r) => !r.custom), ...defs.map(definitionToReport)]);
    } catch (error) {
      setDefinitionsError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  const handleCreate = async (input: NewReportDefinition) => {
    setCreating(true);
    try {
      const def = await reportDefinitionsApi.create(input);
      setReports((prev) => [...prev, definitionToReport(def)]);
      setCreateOpen(false);
      toast.success('Report created');
    } catch (error) {
      toast.error(
        `Could not create the report: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (report: Report) => {
    const ok = await confirm({
      title: 'Delete this report?',
      description: `"${report.name}" is removed for everyone. Its data is not affected.`,
      confirmLabel: 'Delete report',
      destructive: true,
    });
    if (!ok) return;
    try {
      await reportDefinitionsApi.remove(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      setReportDialogOpen(false);
      toast.success('Report deleted');
    } catch (error) {
      toast.error(
        `Could not delete the report: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  };

  const { canDo } = useCurrentUserPermissions();

  const canCreate = canDo('reporting', 'create');

  // Top-bar breadcrumb: Reporting / <report> while its settings are open.
  useBreadcrumbTrail(reportDialogOpen && selectedReport ? [{ label: selectedReport.name }] : []);

  /**
   * Execute a report with progress tracking
   */
  const runReport = async (report: Report) => {
    // Mark report as running
    setRunningReports((prev) => new Set(prev).add(report.id));

    // Create new report run
    const newRun = createReportRun(report);
    setReportRuns((prev) => [newRun, ...prev]);

    try {
      await executeReport(report, newRun.id, {
        // Update progress
        onProgress: (runId, progress) => {
          setReportRuns((prev) =>
            prev.map((run) => (run.id === runId ? { ...run, progress } : run)),
          );
        },

        // Handle completion
        onComplete: (runId, outputFile) => {
          setReportRuns((prev) =>
            prev.map((run) =>
              run.id === runId
                ? {
                    ...run,
                    status: 'Completed' as const,
                    progress: 100,
                    completedAt: new Date().toISOString(),
                    outputFile,
                  }
                : run,
            ),
          );

          // Update last run time
          setReports((prev) =>
            prev.map((r) =>
              r.id === report.id ? { ...r, lastRunAt: new Date().toISOString() } : r,
            ),
          );

          toast.success('Report generated successfully');
        },

        // Handle errors
        onError: (runId, error) => {
          setReportRuns((prev) =>
            prev.map((run) =>
              run.id === runId
                ? {
                    ...run,
                    status: 'Failed' as const,
                    progress: 0,
                    completedAt: new Date().toISOString(),
                    error,
                  }
                : run,
            ),
          );

          toast.error('Failed to generate report');
        },
      });
    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      // Remove from running reports
      setRunningReports((prev) => {
        const newSet = new Set(prev);
        newSet.delete(report.id);
        return newSet;
      });
    }
  };

  /**
   * Open report configuration dialog
   */
  const openReportDialog = (report: Report) => {
    setSelectedReport(report);
    setReportDialogOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-6 p-6 lg:p-8">
      <PageHeader
        title="Reporting"
        description="Generate insights and export data with custom reports."
        actions={
          // "New report" is not switched on yet: it stays visible but off, and
          // only for people allowed to create reports.
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New report
            </Button>
          ) : null
        }
      />

      {definitionsError && (
        <Notice
          kind="error"
          title="Couldn't load your saved reports."
          action={
            <Button variant="outline" size="sm" onClick={() => void loadDefinitions()}>
              Try again
            </Button>
          }
        >
          The built-in reports below still work.
        </Notice>
      )}

      {/* Reports Table */}
      <ReportsTable
        reports={reports}
        runningReports={runningReports}
        onRunReport={runReport}
        onOpenSettings={openReportDialog}
      />

      {/* Recent report runs: under the table, once something has run */}
      <ReportRunsList runs={reportRuns} reports={reports} />

      {/* Report Configuration Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        report={selectedReport}
        onRun={runReport}
        onDelete={(report) => void handleDelete(report)}
      />

      {createOpen && (
        <CreateReportDialog
          open
          onOpenChange={setCreateOpen}
          submitting={creating}
          onCreate={(input) => void handleCreate(input)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
