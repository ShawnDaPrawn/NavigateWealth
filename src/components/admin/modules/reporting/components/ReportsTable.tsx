/**
 * Reporting Module — Reports Table Component
 *
 * Renders the list of available reports with category icons,
 * colour-coded badges, and run/settings actions.
 *
 * Uses a direct table render rather than the generic DataTable
 * to avoid runtime property-access issues with the Report interface.
 */

import React, { useState } from 'react';
import { Button } from '../../../../ui/button';
import { DsButton } from '../../../layout/page';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  FileSpreadsheet,
  BarChart3,
  Users,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Report, ReportCategory } from '../types';

/**
 * Category-specific icon and colour configuration.
 * Follows the status colour vocabulary from Guidelines §8.3.
 */
const CATEGORY_CONFIG: Record<
  ReportCategory,
  {
    icon: React.ElementType;
    iconClass: string;
    bgClass: string;
    badgeClass: string;
    label: string;
  }
> = {
  clients: {
    icon: Users,
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    label: 'Clients',
  },
  activity: {
    icon: ClipboardList,
    iconClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    label: 'Activity',
  },
  financial: {
    icon: TrendingUp,
    iconClass: 'text-green-600',
    bgClass: 'bg-green-50',
    badgeClass: 'bg-green-100 text-green-700 hover:bg-green-100',
    label: 'Financial',
  },
  compliance: {
    icon: ShieldCheck,
    iconClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    badgeClass: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    label: 'Compliance',
  },
  custom: {
    icon: FileSpreadsheet,
    iconClass: 'text-gray-600',
    bgClass: 'bg-gray-50',
    badgeClass: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
    label: 'Custom',
  },
};

interface ReportsTableProps {
  reports: Report[];
  runningReports: Set<string>;
  onRunReport: (report: Report) => void;
  onOpenSettings: (report: Report) => void;
}

export function ReportsTable({
  reports,
  runningReports,
  onRunReport,
  onOpenSettings,
}: ReportsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Simple text search across name and description
  const filteredReports = searchQuery
    ? reports.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (CATEGORY_CONFIG[r.category]?.label || '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      )
    : reports;

  return (
    <section className="ds-card overflow-hidden">
      {/* RP-List: search in the card's toolbar, the count on the right */}
      <div className="ds-toolbar">
        <input
          type="search"
          placeholder="Search reports…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ds-input sm:w-[300px]"
          aria-label="Search reports"
        />
        <span className="grow" />
        <span className="ds-meta">
          {reports.length} {reports.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {/* Table */}
      <div>
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead scope="col" className="sm:w-[350px]">
                Report
              </TableHead>
              <TableHead scope="col" className="hidden w-[120px] sm:table-cell">
                Category
              </TableHead>
              <TableHead scope="col" className="hidden w-[150px] sm:table-cell">
                Last run
              </TableHead>
              <TableHead scope="col" className="hidden w-[120px] sm:table-cell">
                Format
              </TableHead>
              <TableHead scope="col" className="sm:w-[170px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="sticky left-0 w-[calc(100vw-5rem)] sm:static sm:w-auto text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No reports found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? 'Try another search.' : 'There are no reports to run.'}
                    </p>
                    {searchQuery && (
                      <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                        Clear search
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => {
                const cfg = CATEGORY_CONFIG[report.category] || CATEGORY_CONFIG.custom;
                const isRunning = runningReports.has(report.id);
                const ext = report.outputs[0]?.split('.').pop()?.toUpperCase() || 'XLSX';

                return (
                  <TableRow key={report.id}>
                    {/* Report Name */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <b className="block font-medium">{report.name}</b>
                          <div className="ds-meta max-w-[calc(100vw-15rem)] truncate sm:max-w-[420px]">
                            {report.description}
                          </div>
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {cfg.label} · Last run{' '}
                            {report.lastRunAt
                              ? new Date(report.lastRunAt).toLocaleDateString()
                              : 'never'}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Category Badge */}
                    <TableCell className="hidden sm:table-cell">
                      <span className="ds-pill">{cfg.label}</span>
                    </TableCell>

                    {/* Last Run */}
                    <TableCell className="hidden sm:table-cell">
                      {report.lastRunAt ? (
                        <div className="text-sm">
                          <div>{new Date(report.lastRunAt).toLocaleDateString()}</div>
                          <div className="text-muted-foreground">
                            {new Date(report.lastRunAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>

                    {/* Format */}
                    <TableCell className="hidden sm:table-cell">
                      {ext === 'XLSX' ? 'Excel (XLSX)' : ext}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <DsButton
                          size="sm"
                          onClick={() => onRunReport(report)}
                          disabled={isRunning}
                        >
                          {isRunning ? 'Running…' : 'Run'}
                        </DsButton>
                        <DsButton
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenSettings(report)}
                          aria-label={`Settings for ${report.name}`}
                        >
                          Settings
                        </DsButton>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
