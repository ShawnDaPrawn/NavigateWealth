import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../../ui/table';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import {
  History,
  Download,
  RefreshCw,
  Shield,
  Filter,
  X,
  Loader2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';
import { ComplianceResultViewer } from './ComplianceResultViewer';
import { ActivityDetailSummary } from './ActivityDetailSummary';
import { generateDossierHtml } from './generateDossierHtml';
import { ComplianceActivity } from './complianceTypes';

const REPORTS_PAGE_SIZE = 15;

interface ComplianceCheckResult {
  checkType: string;
  submittedAt: string;
  status: string;
  summary?: string;
  matterId?: string;
  rawResponse?: unknown;
}

interface ActivityLogContentProps {
  activities: ComplianceActivity[];
  isLoading: boolean;
  onRefresh: () => void;
  clientId: string;
  clientName: string;
}

export function ActivityLogContent({
  activities,
  isLoading,
  onRefresh,
  clientId,
  clientName,
}: ActivityLogContentProps) {
  const [viewerActivity, setViewerActivity] = useState<ComplianceActivity | null>(null);

  // ── Filters ──
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // ── Pagination ──
  const [currentPage, setCurrentPage] = useState(1);

  const activityTypes = useMemo(() => {
    const types = new Set(activities.map((a) => a.type));
    return Array.from(types).sort();
  }, [activities]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (new Date(a.date) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(a.date) > to) return false;
      }
      return true;
    });
  }, [activities, typeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / REPORTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedActivities = useMemo(() => {
    const start = (safePage - 1) * REPORTS_PAGE_SIZE;
    return filteredActivities.slice(start, start + REPORTS_PAGE_SIZE);
  }, [filteredActivities, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, dateFrom, dateTo]);

  const hasActiveFilters = typeFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    const toastId = toast.loading('Generating compliance dossier...');

    try {
      const data = await api.get<{ history?: ComplianceCheckResult[] }>(
        `/integrations/honeycomb/checks/history/${clientId}`,
      );
      const allResults = data.history || [];

      const now = new Date().toLocaleString('en-ZA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const issueDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const checkTypeLabels: Record<string, string> = {
        idv_no_photo: 'Identity Verification (No Photo)',
        idv_with_photo: 'Identity Verification (With Photo)',
        idv_no_photo_secondary: 'IDV Secondary (No Photo)',
        idv_with_photo_secondary: 'IDV Secondary (With Photo)',
        idv_bulk: 'Bulk IDV',
        bank_verification: 'Bank Account Verification',
        consumer_credit: 'Consumer Credit Check',
        consumer_trace: 'Consumer Trace',
        debt_enquiry: 'Debt Review Enquiry',
        lifestyle_audit: 'Lifestyle Audit',
        income_predictor: 'Income Predictor',
        cipc: 'CIPC Company Search',
        director_enquiry: 'Director Enquiry',
        tenders_blue: 'Tenders Blue List',
        custom_screening: 'Custom Screening',
        sanctions_search: 'Sanctions Search',
        enforcement_actions: 'Enforcement Actions',
        legal_a_listing: 'Legal A Listing',
        best_known_address: 'Best Known Address',
        cdd_report: 'Customer Due Diligence (CDD)',
        assessment: 'Risk Assessment',
        registration: 'Client Registration',
      };

      const grouped: Record<string, ComplianceCheckResult[]> = {};
      for (const r of allResults) {
        if (!grouped[r.checkType]) grouped[r.checkType] = [];
        grouped[r.checkType].push(r);
      }

      let sectionNum = 0;
      let sectionsHtml = '';
      for (const [checkType, results] of Object.entries(grouped)) {
        sectionNum++;
        const label = checkTypeLabels[checkType] || checkType.replace(/_/g, ' ');
        sectionsHtml += `
          <div class="section dossier-section">
            <div class="section-head dossier-section-head">
              <span class="num">${sectionNum}</span>
              <h2>${label} <span style="font-weight:400;color:#9ca3af;font-size:9.5px">(${results.length} result${results.length !== 1 ? 's' : ''})</span></h2>
            </div>
            ${results
              .map(
                (r) => `
              <div class="dossier-result">
                <table>
                  <tr><th>Date</th><td>${new Date(r.submittedAt).toLocaleString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td></tr>
                  <tr><th>Status</th><td>${r.status}</td></tr>
                  <tr><th>Summary</th><td>${r.summary || '—'}</td></tr>
                  ${r.matterId ? `<tr><th>Matter ID</th><td style="font-family:monospace;font-size:9px">${r.matterId}</td></tr>` : ''}
                </table>
                <details style="margin-top:2mm">
                  <summary style="cursor:pointer;font-size:8.5px;color:#6b7280">View full provider response</summary>
                  <pre style="background:#1f2937;color:#e5e7eb;padding:6px;border-radius:4px;font-size:8px;overflow-x:auto;max-height:200px;overflow-y:auto;margin-top:4px;white-space:pre-wrap;word-break:break-word">${JSON.stringify(r.rawResponse, null, 2)}</pre>
                </details>
              </div>
            `,
              )
              .join('')}
          </div>
        `;
      }

      const dossierHtml = generateDossierHtml({
        clientName,
        now,
        issueDate,
        grouped,
        allResults,
        sectionsHtml,
      });
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(dossierHtml);
        win.document.close();
      }

      toast.success(
        `Dossier generated: ${allResults.length} results across ${Object.keys(grouped).length} check types`,
        { id: toastId },
      );
    } catch (err: unknown) {
      console.error('[ActivityLog] Download All error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to generate dossier', {
        id: toastId,
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="contents">
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Compliance Reports
            {filteredActivities.length !== activities.length && (
              <Badge variant="secondary" className="text-xs">
                {filteredActivities.length} of {activities.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll || activities.length === 0}
            >
              {isDownloadingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Download All
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 min-h-0">
          {/* Third-party attribution banner */}
          <div className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <Shield className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
            <span className="text-xs text-slate-600">
              All compliance checks performed by independent third party{' '}
              <strong className="text-slate-800">Honeycomb Information Services</strong> via the
              Beeswax platform.
            </span>
          </div>

          {/* Filter bar */}
          {activities.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Filter className="h-3.5 w-3.5" />
                <span className="font-medium">Filters</span>
              </div>
              <div className="flex-1 min-w-[160px] max-w-[220px]">
                <label className="block text-xs text-gray-500 mb-1">Check Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}

          {/* Table / empty states */}
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No compliance activity recorded yet. Start by running an assessment or requesting a
              report.
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
              No activities match the current filters.{' '}
              <button onClick={clearFilters} className="text-purple-600 hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="overflow-auto max-h-[520px] border border-gray-200 rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Provider</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Details</TableHead>
                      <TableHead className="text-right text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(activity.date).toLocaleString('en-ZA', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{activity.type}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">Honeycomb</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 border-green-200"
                          >
                            {activity.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          <ActivityDetailSummary activity={activity} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setViewerActivity(activity)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination footer */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
                <span className="text-xs text-gray-500">
                  Showing {(safePage - 1) * REPORTS_PAGE_SIZE + 1}–
                  {Math.min(safePage * REPORTS_PAGE_SIZE, filteredActivities.length)} of{' '}
                  {filteredActivities.length}
                  {filteredActivities.length !== activities.length
                    ? ` (filtered from ${activities.length})`
                    : ''}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage(safePage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 5) return true;
                      if (p === 1 || p === totalPages) return true;
                      return Math.abs(p - safePage) <= 1;
                    })
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1];
                        if (p - prev > 1) acc.push(`ellipsis-${idx}`);
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item) =>
                      typeof item === 'string' ? (
                        <span key={item} className="px-1 text-xs text-gray-400">
                          ...
                        </span>
                      ) : (
                        <Button
                          key={item}
                          variant={item === safePage ? 'default' : 'outline'}
                          size="sm"
                          className={`h-8 w-8 p-0 text-xs ${item === safePage ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                          onClick={() => setCurrentPage(item as number)}
                        >
                          {item}
                        </Button>
                      ),
                    )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage(safePage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ComplianceResultViewer
        open={!!viewerActivity}
        onClose={() => setViewerActivity(null)}
        activity={viewerActivity}
        clientId={clientId}
        clientName={clientName}
      />
    </div>
  );
}
