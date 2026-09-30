/**
 * PortfolioTableTab — the provider/product book, one row per client policy.
 *
 * The same table an outside agent reads and writes through
 * `/integrations/portfolio-table`: columns follow the Product Structure, then
 * when the record was last updated and which policy print (PDF) is on file.
 * Download it as a spreadsheet, amend it, upload it back: rows are matched
 * by client name + policy number, previewed, then applied on confirmation.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Lock,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { productManagementApi } from '../api';
import { IntegrationProvider, getProductCategoryLabel } from '../types';
import { integrationsKeys } from '../../../../../utils/queryKeys';
import { supabaseUrl } from '../../../../../utils/supabase/info';
import {
  PORTFOLIO_TOKEN_HEADER,
  type PortfolioApplyReport,
  type PortfolioRow,
  type PortfolioRowOutcome,
  type PortfolioRowStatus,
} from '@/shared/integrations/portfolio-table';
import {
  formatPortfolioDateTime,
  formatPortfolioValue,
  pluralise as plural,
} from './portfolioFormat';

interface PortfolioTableTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
}

const STATUS_LABELS: Record<PortfolioRowStatus, string> = {
  updated: 'Updated',
  unchanged: 'Unchanged',
  unmatched: 'Unmatched',
  client_mismatch: 'Client mismatch',
  duplicate: 'Duplicate',
  invalid: 'Invalid',
  failed: 'Failed',
};

const STATUS_CLASSES: Record<PortfolioRowStatus, string> = {
  updated: 'bg-green-50 text-green-700 border-green-200',
  unchanged: 'bg-gray-50 text-gray-600 border-gray-200',
  unmatched: 'bg-amber-50 text-amber-700 border-amber-200',
  client_mismatch: 'bg-red-50 text-red-700 border-red-200',
  duplicate: 'bg-amber-50 text-amber-700 border-amber-200',
  invalid: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

function describeOutcomeNotes(outcome: PortfolioRowOutcome): string[] {
  return [...outcome.errors, ...outcome.warnings];
}

export function PortfolioTableTab({ provider, selectedCategoryId }: PortfolioTableTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [report, setReport] = useState<PortfolioApplyReport | null>(null);
  const [openingPrintFor, setOpeningPrintFor] = useState<string | null>(null);

  const categoryLabel = getProductCategoryLabel(selectedCategoryId);
  const enabled = Boolean(provider.id && selectedCategoryId);

  const {
    data: table,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: integrationsKeys.portfolioTable(provider.id, selectedCategoryId),
    enabled,
    queryFn: () => productManagementApi.fetchPortfolioTable(provider.id, selectedCategoryId),
  });

  const invalidateBook = () => {
    queryClient.invalidateQueries({
      queryKey: integrationsKeys.portfolioTable(provider.id, selectedCategoryId),
    });
    queryClient.invalidateQueries({
      queryKey: integrationsKeys.history(provider.id, selectedCategoryId),
    });
  };

  const downloadMutation = useMutation({
    mutationFn: () => productManagementApi.downloadPortfolioTable(provider.id, selectedCategoryId),
    onSuccess: () => toast.success('Portfolio spreadsheet downloaded'),
    onError: (err: Error) => toast.error(err.message || 'Failed to download the portfolio'),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) =>
      productManagementApi.uploadPortfolioTable(file, provider.id, selectedCategoryId, 'preview'),
    onSuccess: (result, file) => {
      setPendingFile(file);
      setReport(result);
      if (result.summary.updated > 0) {
        toast.success(
          `${plural(result.summary.updated, 'row', 'rows')} would change. Review, then apply.`,
        );
      } else {
        toast.info('Sheet checked. No cell differs from the records.');
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Could not read the spreadsheet'),
  });

  const applyMutation = useMutation({
    mutationFn: (file: File) =>
      productManagementApi.uploadPortfolioTable(file, provider.id, selectedCategoryId, 'apply'),
    onSuccess: (result) => {
      setReport(result);
      setPendingFile(null);
      toast.success(`Updated ${plural(result.summary.updated, 'policy', 'policies')}.`);
      invalidateBook();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to apply the spreadsheet'),
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) previewMutation.mutate(file);
  };

  const dismissReport = () => {
    setReport(null);
    setPendingFile(null);
  };

  const handleOpenPrint = async (row: PortfolioRow) => {
    setOpeningPrintFor(row.policyId);
    try {
      const url = await productManagementApi.fetchPolicyPrintUrl(row.policyId, row.clientId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the policy print');
    } finally {
      setOpeningPrintFor(null);
    }
  };

  const lastChange = useMemo(
    () =>
      (table?.rows ?? []).reduce(
        (latest, row) => (row.updatedAt > latest ? row.updatedAt : latest),
        '',
      ),
    [table],
  );

  const endpointUrl = `${supabaseUrl}/functions/v1/make-server-91ed8379/integrations/portfolio-table?providerId=${encodeURIComponent(
    provider.id,
  )}&categoryId=${encodeURIComponent(selectedCategoryId)}`;

  if (!selectedCategoryId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>Select a product category to see its portfolio.</p>
        </div>
      </div>
    );
  }

  const renderReport = () => {
    if (!report) return null;
    const counters: Array<{ label: string; value: number; tone: string }> = [
      { label: 'Rows', value: report.summary.rows, tone: 'bg-gray-50 text-gray-900' },
      {
        label: report.dryRun ? 'Will update' : 'Updated',
        value: report.summary.updated,
        tone: 'bg-green-50 text-green-900',
      },
      { label: 'Unchanged', value: report.summary.unchanged, tone: 'bg-gray-50 text-gray-700' },
      { label: 'Unmatched', value: report.summary.unmatched, tone: 'bg-amber-50 text-amber-900' },
      {
        label: 'Client mismatch',
        value: report.summary.clientMismatch,
        tone: 'bg-red-50 text-red-900',
      },
      { label: 'Duplicate', value: report.summary.duplicate, tone: 'bg-amber-50 text-amber-900' },
      { label: 'Invalid', value: report.summary.invalid, tone: 'bg-red-50 text-red-900' },
      ...(report.summary.failed > 0
        ? [{ label: 'Failed', value: report.summary.failed, tone: 'bg-red-50 text-red-900' }]
        : []),
    ];

    return (
      <Card className={report.dryRun ? 'border-purple-200' : 'border-green-200'}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  {report.dryRun
                    ? `Preview: ${pendingFile?.name || 'uploaded sheet'}`
                    : 'Spreadsheet applied'}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {report.dryRun
                    ? 'Nothing has been written yet. Rows are matched by client name and policy number; review them, then apply.'
                    : `${plural(report.summary.updated, 'policy', 'policies')} updated across ${plural(
                        report.summary.clientsTouched,
                        'client',
                        'clients',
                      )}.`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={dismissReport} aria-label="Dismiss report">
              <X className="w-4 h-4 text-gray-400" />
            </Button>
          </div>

          {report.warnings.length > 0 && (
            <ul className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {counters.map((counter) => (
              <div key={counter.label} className={cn('rounded-lg border p-3', counter.tone)}>
                <p className="text-[10px] uppercase font-medium opacity-80">{counter.label}</p>
                <p className="text-lg font-semibold">{counter.value}</p>
              </div>
            ))}
          </div>

          <div className="border rounded-lg overflow-auto bg-white max-h-[40vh]">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Policy Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((outcome) => {
                  const notes = describeOutcomeNotes(outcome);
                  return (
                    <TableRow key={`${outcome.rowNumber}-${outcome.policyNumber}`}>
                      <TableCell className="text-xs">{outcome.rowNumber}</TableCell>
                      <TableCell className="text-xs">
                        {outcome.clientName || '—'}
                        {outcome.matchedClientName && outcome.status === 'client_mismatch' && (
                          <p className="text-[11px] text-gray-500">
                            On record: {outcome.matchedClientName}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {outcome.policyNumber || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', STATUS_CLASSES[outcome.status])}
                        >
                          {STATUS_LABELS[outcome.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {outcome.changes.length > 0 ? (
                          <div className="space-y-1 text-[11px] leading-5">
                            {outcome.changes.map((change) => (
                              <div key={change.fieldId}>
                                <span className="font-medium">{change.fieldName}:</span>{' '}
                                <span className="text-gray-500">
                                  {String(change.oldValue ?? '—')}
                                </span>{' '}
                                &rarr;{' '}
                                <span className="text-gray-900">
                                  {String(change.newValue ?? '—')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">No changes</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {notes.length > 0 ? (
                          <div className="space-y-1 text-[11px] leading-5 text-amber-800">
                            {notes.map((note) => (
                              <p key={note}>{note}</p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {report.dryRun && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={dismissReport}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={!pendingFile || report.summary.updated === 0 || applyMutation.isPending}
                onClick={() => pendingFile && applyMutation.mutate(pendingFile)}
              >
                {applyMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {report.summary.updated > 0
                  ? `Apply ${plural(report.summary.updated, 'update', 'updates')}`
                  : 'Nothing to apply'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <Loader2 className="w-8 h-8 mb-2 text-purple-600 animate-spin" />
          <p>Loading the portfolio...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h5 className="font-medium text-red-900">The portfolio could not be loaded</h5>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'Unexpected error'}
            </p>
          </div>
        </div>
      );
    }
    if (!table || table.rows.length === 0) {
      return (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center bg-white">
          <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <h4 className="font-medium text-gray-900 mb-1">No policies on record</h4>
          <p className="text-sm text-gray-500">
            No {categoryLabel} policies are recorded with {provider.name} yet. Policies added to
            client profiles appear here.
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-auto bg-white max-h-[60vh]">
        <Table className="min-w-max">
          <TableHeader className="bg-gray-50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-gray-50 min-w-[180px]">Client</TableHead>
              {table.columns.map((column) => (
                <TableHead key={column.id} className="whitespace-nowrap">
                  {column.name}
                  {column.isPolicyNumber && (
                    <span className="ml-1 text-[10px] uppercase text-purple-600">key</span>
                  )}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap">Last Updated</TableHead>
              <TableHead className="whitespace-nowrap">Policy Print</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.policyId}>
                <TableCell className="sticky left-0 z-10 bg-white text-xs font-medium text-gray-900">
                  {row.clientName}
                </TableCell>
                {table.columns.map((column) => {
                  const locked = row.lockedFields.includes(column.id);
                  return (
                    <TableCell
                      key={column.id}
                      className="whitespace-nowrap text-xs text-gray-700"
                      title={
                        locked ? `${column.name} is locked against automated updates` : undefined
                      }
                    >
                      {locked && (
                        <Lock
                          className="inline w-3 h-3 mr-1 text-gray-400 align-[-1px]"
                          aria-label="Locked"
                        />
                      )}
                      {formatPortfolioValue(column, row.values[column.id])}
                    </TableCell>
                  );
                })}
                <TableCell className="whitespace-nowrap text-xs text-gray-600">
                  {formatPortfolioDateTime(row.updatedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.policyPrint ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={openingPrintFor === row.policyId}
                      onClick={() => handleOpenPrint(row)}
                      title={`${row.policyPrint.fileName} (uploaded ${formatPortfolioDateTime(
                        row.policyPrint.uploadDate,
                      )})`}
                    >
                      {openingPrintFor === row.policyId ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <ExternalLink className="w-3 h-3 mr-1" />
                      )}
                      PDF
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-400">None on file</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv, .xlsx, .xls"
        aria-label="Upload portfolio spreadsheet"
        onChange={handleFileSelect}
      />

      {renderReport()}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
            <div>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription className="mt-2">
                Every <strong>{categoryLabel}</strong> policy with <strong>{provider.name}</strong>,
                one row per client policy, laid out as the product structure. Download it, amend it,
                and upload it to update the matching records — rows are matched by client name and
                policy number. An external agent reads and writes this same table through the
                endpoint below.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh portfolio"
              >
                <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadMutation.mutate()}
                disabled={downloadMutation.isPending || !enabled}
              >
                {downloadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Download spreadsheet
              </Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => fileInputRef.current?.click()}
                disabled={previewMutation.isPending || !enabled}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload spreadsheet
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {table && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Policies</p>
                <p className="text-lg font-semibold text-gray-900">{table.policyCount}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Clients</p>
                <p className="text-lg font-semibold text-gray-900">{table.clientCount}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">
                  Last record change
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatPortfolioDateTime(lastChange)}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-500 font-medium">Table generated</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatPortfolioDateTime(table.generatedAt)}
                </p>
              </div>
            </div>
          )}

          {renderTable()}

          <details className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
            <summary className="cursor-pointer font-medium">Endpoint for external agents</summary>
            <div className="mt-3 space-y-2">
              <p>
                A scheduled bot reads this table with a GET and posts corrections with a POST to the
                same address, authenticating with the <code>{PORTFOLIO_TOKEN_HEADER}</code> header.
                The token lives in Supabase Vault; the runbook{' '}
                <code>docs/runbooks/portfolio-table.md</code> has the contract and the SQL to read
                or rotate it.
              </p>
              <code className="block break-all rounded bg-white/70 px-2 py-1 text-xs text-blue-950">
                {endpointUrl}
              </code>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
