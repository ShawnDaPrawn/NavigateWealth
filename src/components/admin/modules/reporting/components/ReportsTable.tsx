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
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  Clock,
  Play,
  Settings,
  FileSpreadsheet,
  BarChart3,
  Plus,
  Users,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  Search,
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
            .includes(searchQuery.toLowerCase())
      )
    : reports;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder="Search reports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          aria-label="Search reports"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead style={{ width: '350px' }} scope="col">
                Report Name
              </TableHead>
              <TableHead style={{ width: '120px' }} scope="col">
                Category
              </TableHead>
              <TableHead style={{ width: '150px' }} scope="col">
                Last Run
              </TableHead>
              <TableHead style={{ width: '120px' }} scope="col">
                Format
              </TableHead>
              <TableHead style={{ width: '150px' }} scope="col">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No reports found</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchQuery
                        ? 'Try adjusting your search query.'
                        : 'Create your first report to get started with analytics.'}
                    </p>
                    {!searchQuery && (
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Report
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => {
                const cfg =
                  CATEGORY_CONFIG[report.category] || CATEGORY_CONFIG.custom;
                const IconComponent = cfg.icon;
                const isRunning = runningReports.has(report.id);
                const ext = report.outputs[0]?.split('.').pop()?.toUpperCase() || 'XLSX';

                return (
                  <TableRow key={report.id}>
                    {/* Report Name */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`${cfg.bgClass} p-2 rounded-lg flex-shrink-0`}>
                          <IconComponent
                            className={`h-5 w-5 ${cfg.iconClass}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{report.name}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-[280px]">
                            {report.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Category Badge */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${cfg.badgeClass}`}
                      >
                        {cfg.label}
                      </Badge>
                    </TableCell>

                    {/* Last Run */}
                    <TableCell>
                      {report.lastRunAt ? (
                        <div className="text-sm">
                          <div>
                            {new Date(report.lastRunAt).toLocaleDateString()}
                          </div>
                          <div className="text-muted-foreground">
                            {new Date(report.lastRunAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Never
                        </span>
                      )}
                    </TableCell>

                    {/* Format */}
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ext}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRunReport(report)}
                          disabled={isRunning}
                        >
                          {isRunning ? (
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4 mr-2" />
                          )}
                          {isRunning ? 'Running' : 'Run'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOpenSettings(report)}
                          aria-label={`Settings for ${report.name}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
