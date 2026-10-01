/**
 * PortfolioTableTab — the provider/product book, one row per client policy.
 *
 * The same table an outside agent reads and writes through
 * `/integrations/portfolio-table`: columns follow the Product Structure, then
 * when the record was last updated and which policy print (PDF) is on file.
 * Download it as a spreadsheet, amend it, upload it back: rows are matched
 * by client name + policy number, previewed, then applied on confirmation.
 *
 * This file owns the data (the book query, download, preview, apply, the
 * print link) and the page around the table; `PortfolioGrid` draws the table
 * and `PortfolioUploadReport` the preview.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Bot,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Search,
  TableProperties,
  Upload,
  X,
} from 'lucide-react';
import { Card } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Skeleton } from '../../../../ui/skeleton';
import { cn } from '../../../../ui/utils';
import { productManagementApi } from '../api';
import { IntegrationProvider, getProductCategoryLabel } from '../types';
import { integrationsKeys } from '../../../../../utils/queryKeys';
import { supabaseUrl } from '../../../../../utils/supabase/info';
import { copyToClipboard } from '../../../../../utils/clipboard';
import {
  PORTFOLIO_TOKEN_HEADER,
  type PortfolioApplyReport,
  type PortfolioRow,
} from '@/shared/integrations/portfolio-table';
import {
  DEFAULT_PORTFOLIO_SORT,
  filterPortfolioRows,
  formatPortfolioDateTime,
  nextPortfolioSort,
  pluralise as plural,
  sortPortfolioRows,
  type PortfolioSort,
} from './portfolioFormat';
import { PortfolioGrid } from './PortfolioGrid';
import { PortfolioUploadReport } from './PortfolioUploadReport';
import { PortfolioAgentsPanel } from './PortfolioAgentsPanel';

interface PortfolioTableTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
}

function EndpointPanel({ endpointUrl }: { endpointUrl: string }) {
  // The agent tokens are fetched the first time the panel is opened, not on
  // every visit to the tab, and stay mounted after that so a freshly issued
  // token is not lost by closing the panel before copying it.
  const [opened, setOpened] = useState(false);
  const handleCopy = async () => {
    try {
      await copyToClipboard(endpointUrl);
      toast.success('Endpoint address copied');
    } catch {
      toast.error('Could not copy the endpoint address');
    }
  };

  return (
    <details
      className="group border-t border-gray-100 px-6 py-4"
      onToggle={(event) => {
        if (event.currentTarget.open) setOpened(true);
      }}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        <Bot className="h-4 w-4 text-gray-400" aria-hidden="true" />
        Endpoint for external agents
        <span className="hidden font-normal text-gray-400 sm:inline">
          for a scheduled bot that keeps this book up to date
        </span>
      </summary>
      <div className="mt-3 space-y-3 pl-6">
        <p className="text-sm text-gray-600">
          An agent reads this table with a <code className="text-xs">GET</code> and posts
          corrections with a <code className="text-xs">POST</code> to the same address, sending its
          own token in the <code className="text-xs">{PORTFOLIO_TOKEN_HEADER}</code> header.{' '}
          <code className="text-xs">docs/runbooks/portfolio-table.md</code> has the full contract.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 py-1 pr-1 pl-3">
          <code
            className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800"
            title={endpointUrl}
          >
            {endpointUrl}
          </code>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy
          </Button>
        </div>
        {opened && (
          <div className="border-t border-gray-100 pt-3">
            <PortfolioAgentsPanel />
          </div>
        )}
      </div>
    </details>
  );
}

export function PortfolioTableTab({ provider, selectedCategoryId }: PortfolioTableTabProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [report, setReport] = useState<PortfolioApplyReport | null>(null);
  const [openingPrintFor, setOpeningPrintFor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PortfolioSort>(DEFAULT_PORTFOLIO_SORT);

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

  // The report opens above the book; bring it into view, since the adviser
  // may have been scrolled down the table when they chose the file.
  useEffect(() => {
    if (report) reportRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [report]);

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
    // Open the tab synchronously, inside the click's transient activation:
    // Safari (and a slow signed-URL request anywhere) blocks a `window.open`
    // that happens after an `await` as a popup. The placeholder is navigated
    // once the link arrives, and closed if it does not. Severing `opener`
    // gives the new tab no handle on this one, which is what `noopener`
    // would have done — but `noopener` also makes `window.open` return null,
    // and then there is nothing to navigate.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await productManagementApi.fetchPolicyPrintUrl(row.policyId, row.clientId);
      if (tab && !tab.closed) {
        tab.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      tab?.close();
      toast.error(err instanceof Error ? err.message : 'Could not open the policy print');
    } finally {
      setOpeningPrintFor(null);
    }
  };

  const summary = useMemo(() => {
    const rows = table?.rows ?? [];
    return {
      lastChange: rows.reduce(
        (latest, row) => (row.updatedAt > latest ? row.updatedAt : latest),
        '',
      ),
      prints: rows.filter((row) => row.policyPrint).length,
    };
  }, [table]);

  const visibleRows = useMemo(
    () =>
      table ? sortPortfolioRows(filterPortfolioRows(table.rows, search), table.columns, sort) : [],
    [table, search, sort],
  );

  const endpointUrl = `${supabaseUrl}/functions/v1/make-server-91ed8379/integrations/portfolio-table?providerId=${encodeURIComponent(
    provider.id,
  )}&categoryId=${encodeURIComponent(selectedCategoryId)}`;

  if (!selectedCategoryId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Select a product category to see its portfolio.</p>
        </div>
      </div>
    );
  }

  const hasRows = Boolean(table && table.rows.length > 0);

  const renderBook = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4" aria-busy="true">
          <span className="sr-only">Loading the portfolio…</span>
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-full opacity-70" />
          ))}
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h5 className="text-sm font-medium text-red-900">The portfolio could not be loaded</h5>
            <p className="mt-1 text-sm text-red-700">
              {error instanceof Error ? error.message : 'Unexpected error'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Try again
          </Button>
        </div>
      );
    }
    if (!table || !hasRows) {
      return (
        <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white p-10 text-center">
          <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-gray-300" aria-hidden="true" />
          <h4 className="mb-1 text-sm font-semibold text-gray-900">No policies on record</h4>
          <p className="text-sm text-gray-500">
            No {categoryLabel} policies are recorded with {provider.name} yet. Policies added to
            client profiles appear here.
          </p>
        </div>
      );
    }
    if (visibleRows.length === 0) {
      return (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center">
          <Search className="mx-auto mb-3 h-6 w-6 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-600">
            No client or policy number matches “{search.trim()}”.
          </p>
          <Button variant="link" size="sm" className="mt-1" onClick={() => setSearch('')}>
            Clear the search
          </Button>
        </div>
      );
    }
    return (
      <PortfolioGrid
        table={table}
        rows={visibleRows}
        sort={sort}
        onSort={(key) => setSort((current) => nextPortfolioSort(current, key))}
        openingPrintFor={openingPrintFor}
        onOpenPrint={handleOpenPrint}
      />
    );
  };

  const stats = table
    ? [
        { label: 'Policies', value: String(table.policyCount) },
        { label: 'Clients', value: String(table.clientCount) },
        { label: 'Policy prints', value: `${summary.prints} of ${table.policyCount}` },
        { label: 'Latest update', value: formatPortfolioDateTime(summary.lastChange) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".csv, .xlsx, .xls"
        aria-label="Upload portfolio spreadsheet"
        onChange={handleFileSelect}
      />

      {report && (
        <div ref={reportRef} className="scroll-mt-6">
          <PortfolioUploadReport
            report={report}
            fileName={pendingFile?.name ?? null}
            columns={table?.columns ?? []}
            canApply={Boolean(pendingFile)}
            isApplying={applyMutation.isPending}
            onApply={() => pendingFile && applyMutation.mutate(pendingFile)}
            onDismiss={dismissReport}
          />
        </div>
      )}

      <Card className="gap-0 overflow-hidden hover:shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 px-6 pt-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50">
              <TableProperties className="h-5 w-5 text-purple-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{categoryLabel} portfolio</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                Every {categoryLabel} policy held with {provider.name}, one row per client policy.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh portfolio"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              onClick={() => downloadMutation.mutate()}
              disabled={downloadMutation.isPending || !enabled}
            >
              {downloadMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download spreadsheet
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => fileInputRef.current?.click()}
              disabled={previewMutation.isPending || !enabled}
            >
              {previewMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload spreadsheet
            </Button>
          </div>
        </div>

        {hasRows && (
          <dl className="mx-6 mt-5 grid grid-cols-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50/70 sm:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  'border-gray-200 px-4 py-3',
                  index % 2 === 1 && 'border-l',
                  index >= 2 && 'border-t sm:border-t-0',
                  index === 2 && 'sm:border-l',
                )}
              >
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-gray-900">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="px-6 pt-5 pb-6">
          {hasRows && (
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search client or policy number"
                  aria-label="Search the portfolio"
                  className="h-9 pr-8 pl-9 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-0.5 text-gray-400 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="flex min-w-0 items-start gap-1.5 text-xs text-gray-500 sm:ml-auto sm:max-w-lg">
                <Info className="mt-px h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                <span>
                  Upload an amended sheet to update records. Rows match on client name and policy
                  number, and nothing is saved until you apply the preview.
                </span>
              </p>
            </div>
          )}

          {renderBook()}

          {table && hasRows && (
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                {visibleRows.length === table.rows.length
                  ? `${plural(table.rows.length, 'policy', 'policies')}`
                  : `Showing ${visibleRows.length} of ${plural(table.rows.length, 'policy', 'policies')}`}
              </span>
              <span>Generated {formatPortfolioDateTime(table.generatedAt)}</span>
            </div>
          )}
        </div>

        <EndpointPanel endpointUrl={endpointUrl} />
      </Card>
    </div>
  );
}
