import React from 'react';
import { Card, CardContent } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Separator } from '../../../../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../ui/table';
import { CheckCircle2, AlertCircle, FileSpreadsheet, X, RefreshCw, FileAxis3D, UploadCloud, FileText } from 'lucide-react';
import { cn } from '../../../../ui/utils';
import { IntegrationProvider, PRODUCT_CATEGORIES, PreviewData, IntegrationStats, IntegrationSyncRun, PortalJobPolicyItem } from '../types';

interface UploadTabProps {
  provider: IntegrationProvider;
  selectedCategoryId: string;
  uploadedFile: { name: string, size: string, uploadedAt: string } | null;
  isProcessing: boolean;
  showPreview: boolean;
  onDrop: (e: React.DragEvent) => void;
  onManualUpload: () => void;
  onProcess: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onPublishRun: () => void;
  isPublishingRun: boolean;
  isColumnMapped: (col: string) => boolean;
  previewData?: PreviewData | null;
  stagedRun?: IntegrationSyncRun | null;
  portalJobItems?: PortalJobPolicyItem[];
  stats: IntegrationStats;
  matchedColumnsCount: number;
}

const isPortalMetadataColumn = (key: string) => key.trim().startsWith('_NW ');

const formatExtractedValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const formatDisplayDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const formatDisplayDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const getExtractedValues = (row: IntegrationSyncRun['rows'][number]) =>
  Object.entries(row.rawData || {})
    .filter(([key, value]) => !isPortalMetadataColumn(key) && String(value ?? '').trim().length > 0)
    .slice(0, 8);

export function UploadTab({
  provider,
  selectedCategoryId,
  uploadedFile,
  isProcessing,
  showPreview,
  onDrop,
  onManualUpload,
  onProcess,
  onClear,
  onConfirm,
  onPublishRun,
  isPublishingRun,
  isColumnMapped,
  previewData,
  stagedRun,
  portalJobItems = [],
  stats,
  matchedColumnsCount,
}: UploadTabProps) {
  const categoryName = PRODUCT_CATEGORIES.find((c) => c.id === selectedCategoryId)?.name;

  const publishableRows = stagedRun?.rows.filter((row) =>
    row.matchStatus === 'matched' &&
    row.diffs.length > 0 &&
    row.publishStatus !== 'published' &&
    row.publishStatus !== 'failed' &&
    row.publishStatus !== 'skipped'
  ) || [];

  const getStatusBadge = (status: string) => {
    const className = status === 'published'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'matched' || status === 'pending' || status === 'auto_eligible'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : status === 'skipped'
          ? 'bg-gray-50 text-gray-600 border-gray-200'
          : 'bg-amber-50 text-amber-700 border-amber-200';

    return (
      <Badge variant="outline" className={cn('text-[10px] capitalize', className)}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getMatchMethodCopy = (row: IntegrationSyncRun['rows'][number]) => {
    if (row.matchMethod === 'template_metadata') {
      return row.matchStatus === 'invalid'
        ? 'Template metadata was supplied but did not validate'
        : 'Matched via hidden template metadata';
    }
    if (row.matchMethod === 'policy_number') {
      return row.matchStatus === 'duplicate'
        ? 'Policy number matched multiple existing policies'
        : row.matchStatus === 'unmatched'
          ? 'No existing policy matched this policy number'
          : 'Matched via policy number fallback';
    }
    return 'No stable match key supplied';
  };

  const reviewHeading = stagedRun?.source === 'portal' ? 'Integration Review' : 'Spreadsheet Upload';
  const reviewDescription = stagedRun?.source === 'portal'
    ? 'Portal runs and spreadsheet uploads now stage through the same canonical integration template format.'
    : 'Upload the downloaded Integration Template or any spreadsheet that matches its configured columns.';
  const displayStats = {
    lastAttempted: stats.lastAttempted && stats.lastAttempted !== '-'
      ? stats.lastAttempted
      : formatDisplayDateTime(stagedRun?.createdAt),
    lastSuccessful: stats.lastSuccessful && stats.lastSuccessful !== '-'
      ? stats.lastSuccessful
      : stagedRun?.summary.publishedRows
        ? formatDisplayDate(stagedRun.updatedAt || stagedRun.createdAt)
        : '-',
    lastStatus: stats.lastUpdateStatus
      ? stats.lastUpdateStatus
      : stagedRun?.summary.publishedRows
        ? 'success'
        : null,
    lastStatusLabel: stats.lastUpdateStatus === 'success'
      ? 'Successful'
      : stats.lastUpdateStatus === 'failed'
        ? 'Failed'
        : stagedRun
          ? stagedRun.summary.publishedRows > 0
            ? 'Published'
            : 'Staged'
          : 'No Data',
  };
  const attachedPortalDocuments = portalJobItems
    .filter((item) => item.documentAttached || item.artifactStatuses?.some((status) => status.status === 'attached'))
    .map((item) => {
      const attached = item.artifactStatuses?.find((status) => status.status === 'attached');
      return {
        item,
        fileName: attached?.fileName || item.documentFileName || 'Policy document',
        label: attached?.label || 'Policy schedule',
      };
    });
  const failedPortalDocuments = portalJobItems
    .flatMap((item) => (item.artifactStatuses || [])
      .filter((status) => status.status === 'failed')
      .map((status) => ({ item, status })));
  const skippedPortalDocuments = portalJobItems
    .flatMap((item) => (item.artifactStatuses || [])
      .filter((status) => status.status === 'not_requested' || status.status === 'skipped')
      .map((status) => ({ item, status })));
  const portalDocumentActivityCount = portalJobItems.reduce((count, item) => count + (item.artifactStatuses?.length || 0), 0);
  const portalDocumentStatusLabel = attachedPortalDocuments.length > 0
    ? `${attachedPortalDocuments.length} PDF${attachedPortalDocuments.length === 1 ? '' : 's'} attached`
    : failedPortalDocuments.length > 0
      ? `${failedPortalDocuments.length} PDF issue${failedPortalDocuments.length === 1 ? '' : 's'}`
      : portalDocumentActivityCount > 0
        ? 'No PDFs attached'
        : 'PDF not requested';

  const renderStagedRun = () => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">
                {stagedRun?.fileName || `${provider.name} portal extraction`}
              </h4>
              <p className="text-sm text-gray-500">
                {stagedRun?.source === 'portal'
                  ? 'Portal extraction staged into the canonical integration template format'
                  : 'Spreadsheet staged against the canonical integration template format'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear staged run">
            <X className="w-4 h-4 text-gray-400" />
          </Button>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="text-[10px] uppercase text-gray-500 font-medium">Rows</p>
              <p className="text-lg font-semibold text-gray-900">{stagedRun?.summary.totalRows || 0}</p>
            </div>
            <div className="rounded-lg border bg-blue-50 p-3">
              <p className="text-[10px] uppercase text-blue-700 font-medium">Matched</p>
              <p className="text-lg font-semibold text-blue-900">{stagedRun?.summary.matchedRows || 0}</p>
            </div>
            <div className="rounded-lg border bg-amber-50 p-3">
              <p className="text-[10px] uppercase text-amber-700 font-medium">Held</p>
              <p className="text-lg font-semibold text-amber-900">{stagedRun?.summary.heldRows || 0}</p>
            </div>
            <div className="rounded-lg border bg-red-50 p-3">
              <p className="text-[10px] uppercase text-red-700 font-medium">Issues</p>
              <p className="text-lg font-semibold text-red-900">
                {(stagedRun?.summary.invalidRows || 0) + (stagedRun?.summary.duplicateRows || 0) + (stagedRun?.summary.unmatchedRows || 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-green-50 p-3">
              <p className="text-[10px] uppercase text-green-700 font-medium">Published</p>
              <p className="text-lg font-semibold text-green-900">{stagedRun?.summary.publishedRows || 0}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                <div>
                  <h5 className="font-medium text-gray-900">
                    {publishableRows.length > 0
                      ? `${publishableRows.length} policy update${publishableRows.length === 1 ? '' : 's'} ready for review`
                      : 'No field changes waiting to publish'}
                  </h5>
                  <p className="mt-1 text-sm text-gray-600">
                    {stagedRun?.source === 'portal'
                      ? 'Portal extraction is staged for this product category. Review the changed cells below, then publish only the rows you trust.'
                      : 'Spreadsheet data is staged for review. Only populated changed cells can be published.'}
                  </p>
                </div>
              </div>
              {stagedRun?.source === 'portal' && (
                <Badge variant="outline" className={cn(
                  'shrink-0',
                  attachedPortalDocuments.length > 0
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : failedPortalDocuments.length > 0
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600',
                )}>
                  {portalDocumentStatusLabel}
                </Badge>
              )}
            </div>
            <details className="mt-3 text-sm text-gray-500">
              <summary className="cursor-pointer font-medium text-gray-700">Matching details</summary>
              <p className="mt-2">
                Hidden template metadata is used when present, policy number matching is used as fallback, and only populated changed cells are publishable.
              </p>
            </details>
          </div>

          {stagedRun?.source === 'portal' && (
            <div className="rounded-lg border bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <h5 className="font-medium text-gray-900">Portal Documents</h5>
                </div>
                <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-600">
                  {portalDocumentStatusLabel}
                </Badge>
              </div>
              {attachedPortalDocuments.length === 0 && failedPortalDocuments.length === 0 && skippedPortalDocuments.length === 0 && (
                <p className="text-sm text-gray-500">No PDF download or attachment activity was recorded for this run.</p>
              )}
              <div className="space-y-2 text-sm">
                {attachedPortalDocuments.map(({ item, fileName, label }) => (
                  <div key={`${item.id}-${fileName}`} className="flex flex-col gap-1 rounded-md border border-green-100 bg-green-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-green-900">{label} attached</p>
                      <p className="text-xs text-green-700">{item.clientName} / {item.policyNumber}</p>
                    </div>
                    <p className="max-w-sm truncate text-xs text-green-700" title={fileName}>{fileName}</p>
                  </div>
                ))}
                {failedPortalDocuments.map(({ item, status }) => (
                  <div key={`${item.id}-${status.id}`} className="rounded-md border border-red-100 bg-red-50 px-3 py-2">
                    <p className="font-medium text-red-900">{status.label} failed</p>
                    <p className="text-xs text-red-700">{item.clientName} / {item.policyNumber}: {status.error || 'No failure reason supplied'}</p>
                  </div>
                ))}
                {attachedPortalDocuments.length === 0 && failedPortalDocuments.length === 0 && skippedPortalDocuments.map(({ item, status }) => (
                  <div key={`${item.id}-${status.id}`} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                    <p className="font-medium text-gray-800">{status.label} {status.status === 'not_requested' ? 'not requested' : 'skipped'}</p>
                    <p className="text-xs text-gray-500">{item.clientName} / {item.policyNumber}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-x-auto bg-white">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Policy Number</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>Publish</TableHead>
                  <TableHead>Extracted</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Warnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagedRun?.rows.slice(0, 25).map((row) => {
                  const extractedValues = getExtractedValues(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs">{row.rowNumber}</TableCell>
                      <TableCell className="text-xs font-medium">{row.policyNumber || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <div className="space-y-1">
                          {getStatusBadge(row.matchStatus)}
                          <p className="text-[11px] text-gray-500">{getMatchMethodCopy(row)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(row.publishStatus)}</TableCell>
                      <TableCell className="min-w-[220px] text-xs">
                        {extractedValues.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer whitespace-nowrap font-medium text-gray-900">
                              {extractedValues.length} value{extractedValues.length === 1 ? '' : 's'}
                            </summary>
                            <div className="mt-2 max-w-sm space-y-1 text-[11px] leading-5">
                              {extractedValues.map(([key, value]) => (
                                <div key={`${row.id}-raw-${key}`}>
                                  <span className="font-medium text-gray-900">{key}:</span>{' '}
                                  <span className="text-gray-700">{formatExtractedValue(value)}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400">No extracted values</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.diffs.length > 0 ? (
                          <details>
                            <summary className="cursor-pointer whitespace-nowrap font-medium text-gray-900">
                              {row.diffs.length} changed cell{row.diffs.length === 1 ? '' : 's'}
                            </summary>
                            <div className="mt-2 max-w-sm space-y-1 text-[11px] leading-5">
                              {row.diffs.map((diff) => (
                                <div key={diff.fieldId}>
                                  <span className="font-medium">{diff.fieldName}:</span> {String(diff.oldValue ?? '-')} {' -> '} {String(diff.newValue ?? '-')}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400">No publishable cell changes</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {[...row.validationErrors, ...row.warnings].length > 0 ? (
                          <details className="text-amber-700">
                            <summary className="cursor-pointer whitespace-nowrap">
                              {[...row.validationErrors, ...row.warnings].length} warning{[...row.validationErrors, ...row.warnings].length === 1 ? '' : 's'}
                            </summary>
                            <div className="mt-2 max-w-xs space-y-1 text-[11px] leading-5 text-amber-800">
                              {[...row.validationErrors, ...row.warnings].map((message, index) => (
                                <p key={`${row.id}-warning-${index}`}>{message}</p>
                              ))}
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400">No warnings</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClear}>
              Clear
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={onPublishRun}
              disabled={isPublishingRun || publishableRows.length === 0}
            >
              {isPublishingRun ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UploadCloud className="w-4 h-4 mr-2" />
              )}
              {publishableRows.length > 0
                ? `Publish ${publishableRows.length} Update${publishableRows.length === 1 ? '' : 's'}`
                : 'No Updates To Publish'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderUploadedFile = () => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{uploadedFile?.name}</h4>
              <p className="text-sm text-gray-500">{uploadedFile?.size} • Uploaded at {uploadedFile?.uploadedAt}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClear} aria-label="Clear uploaded file">
            <X className="w-4 h-4 text-gray-400" />
          </Button>
        </div>

        {!showPreview ? (
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={onProcess}
              disabled={isProcessing}
              className="bg-purple-600 hover:bg-purple-700 min-w-[140px]"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileAxis3D className="w-4 h-4 mr-2" />
              )}
              {isProcessing ? 'Processing...' : 'Process & Preview'}
            </Button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {previewData?.validationErrors && previewData.validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h5 className="font-medium text-red-900">Validation Errors Detected</h5>
                  <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                    {previewData.validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h5 className="font-medium text-blue-900">File Processed Successfully</h5>
                <p className="text-sm text-blue-700 mt-1">
                  The file matched {matchedColumnsCount} configured columns for {categoryName}. The preview below shows only business columns; hidden template metadata, when present, will still be used for safe matching during staging.
                </p>
              </div>
            </div>

            <div className="border rounded-lg overflow-x-auto bg-white">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    {previewData?.headers.map((col, i) => (
                      <TableHead
                        key={i}
                        className={cn(
                          'whitespace-nowrap border-b-2',
                          isColumnMapped(col) ? 'border-green-400 bg-green-50/20 text-green-700' : 'border-red-300 bg-red-50/20 text-red-700',
                        )}
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData?.rows.map((row, idx) => (
                    <TableRow key={idx}>
                      {previewData.headers.map((_, cellIdx) => {
                        const colName = previewData.headers[cellIdx];
                        const mapped = isColumnMapped(colName);
                        const cell = row[colName] || '';
                        return (
                          <TableCell
                            key={cellIdx}
                            className={cn(
                              'whitespace-nowrap text-xs',
                              mapped ? 'text-gray-700' : 'text-gray-400 bg-gray-50/50',
                            )}
                          >
                            {typeof cell === 'object' ? JSON.stringify(cell) : cell}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClear}>
                Cancel
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={onConfirm}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Stage for Review
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-gray-50 border-gray-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Attempted</p>
            <p className="text-sm font-semibold">{displayStats.lastAttempted}</p>
          </CardContent>
        </Card>
        <Card className={cn(
          'border-gray-200 shadow-none',
          displayStats.lastStatus === 'success' ? 'bg-green-50/50' :
            displayStats.lastStatus === 'failed' ? 'bg-red-50/50' : 'bg-gray-50',
        )}>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Status</p>
            <div className="flex items-center gap-2">
              {displayStats.lastStatus === 'success' ? (
                <div className="contents"><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-sm font-semibold text-green-700">Successful</span></div>
              ) : displayStats.lastStatus === 'failed' ? (
                <div className="contents"><AlertCircle className="w-4 h-4 text-red-600" /><span className="text-sm font-semibold text-red-700">Failed</span></div>
              ) : (
                <span className="text-sm font-semibold text-gray-600">{displayStats.lastStatusLabel}</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50 border-gray-200 shadow-none">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Last Successful</p>
            <p className="text-sm font-semibold">{displayStats.lastSuccessful}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{reviewHeading}</h3>
            <p className="text-sm text-gray-500 mt-1">{reviewDescription}</p>
          </div>
        </div>

        {stagedRun ? (
          renderStagedRun()
        ) : !uploadedFile ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 bg-blue-50 rounded-full shadow-sm flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="font-medium text-gray-900 mb-1">Drag and drop your file here</h4>
            <p className="text-sm text-gray-500 mb-6">
              Use the Integration Template or a matching spreadsheet for <span className="font-semibold text-blue-600">{categoryName}</span>
            </p>
            <Button
              onClick={onManualUpload}
              variant="outline"
              className="mx-auto"
            >
              Browse Files
            </Button>
          </div>
        ) : (
          renderUploadedFile()
        )}
      </div>
    </div>
  );
}
