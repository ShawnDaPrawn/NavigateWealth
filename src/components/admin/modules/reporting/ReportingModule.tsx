import React, { useState } from 'react';
import { Button } from '../../../ui/button';
import { Plus } from 'lucide-react';
import { Badge } from '../../../ui/badge';
import { toast } from 'sonner@2.0.3';

// Import types
import { Report, ReportRun } from './types';

// Import components
import { ReportsTable } from './components/ReportsTable';
import { ReportRunsList } from './components/ReportRunsList';
import { ReportDialog } from './components/ReportDialog';

// Import utilities
import { executeReport, createReportRun } from './utils';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

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

  const { canDo } = useCurrentUserPermissions();

  const canCreate = canDo('reporting', 'create');

  /**
   * Execute a report with progress tracking
   */
  const runReport = async (report: Report) => {
    // Mark report as running
    setRunningReports(prev => new Set(prev).add(report.id));
    
    // Create new report run
    const newRun = createReportRun(report);
    setReportRuns(prev => [newRun, ...prev]);

    try {
      await executeReport(report, newRun.id, {
        // Update progress
        onProgress: (runId, progress) => {
          setReportRuns(prev => prev.map(run => 
            run.id === runId ? { ...run, progress } : run
          ));
        },
        
        // Handle completion
        onComplete: (runId, outputFile) => {
          setReportRuns(prev => prev.map(run => 
            run.id === runId 
              ? {
                  ...run,
                  status: 'Completed' as const,
                  progress: 100,
                  completedAt: new Date().toISOString(),
                  outputFile
                }
              : run
          ));
          
          // Update last run time
          setReports(prev => prev.map(r => 
            r.id === report.id 
              ? { ...r, lastRunAt: new Date().toISOString() }
              : r
          ));

          toast.success('Report generated successfully');
        },
        
        // Handle errors
        onError: (runId, error) => {
          setReportRuns(prev => prev.map(run => 
            run.id === runId 
              ? {
                  ...run,
                  status: 'Failed' as const,
                  progress: 0,
                  completedAt: new Date().toISOString(),
                  error
                }
              : run
          ));
          
          toast.error('Failed to generate report');
        }
      });

    } catch (error) {
      console.error('Report generation failed:', error);
    } finally {
      // Remove from running reports
      setRunningReports(prev => {
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
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Reporting</h1>
            <Badge variant="secondary" className="text-xs">
              {reports.length} reports
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Generate insights and export data with custom reports
          </p>
        </div>
        <Button disabled={!canCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Report
        </Button>
      </div>

      {/* Recent Report Runs */}
      <ReportRunsList runs={reportRuns} reports={reports} />

      {/* Reports Table */}
      <ReportsTable
        reports={reports}
        runningReports={runningReports}
        onRunReport={runReport}
        onOpenSettings={openReportDialog}
      />

      {/* Report Configuration Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        report={selectedReport}
        onRun={runReport}
      />
    </div>
  );
}