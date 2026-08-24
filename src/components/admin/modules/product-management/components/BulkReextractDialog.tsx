/**
 * Bulk re-extraction dialog of the document-mapping tab: preview, live
 * streaming progress, and final results. Pure view over props from
 * DocumentMappingTab.
 */
/**
 * DOCUMENT AI MAPPING TAB
 *
 * Admin configuration for provider terminology mappings used by
 * the AI policy document extraction system (Phase 3).
 *
 * Features:
 * - View all providers with their terminology mappings
 * - Add/edit/remove benefit term → canonical key mappings
 * - Add/edit/remove product → category mappings
 * - Inline editing with save
 *
 * @module DocumentMappingTab
 */

import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Loader2, AlertCircle, FileText, RefreshCw, Check, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';

import type {
  BulkProvider,
  BulkPreview,
  BulkResults,
  BulkProgress,
  StreamingResult,
} from './documentMappingModel';

import type { Dispatch, SetStateAction } from 'react';

interface BulkReextractDialogProps {
  bulkReextractProvider: BulkProvider | null;
  setBulkReextractProvider: Dispatch<SetStateAction<BulkProvider | null>>;
  bulkPreview: BulkPreview | null;
  setBulkPreview: Dispatch<SetStateAction<BulkPreview | null>>;
  bulkResults: BulkResults | null;
  setBulkResults: Dispatch<SetStateAction<BulkResults | null>>;
  bulkProgress: BulkProgress | null;
  setBulkProgress: Dispatch<SetStateAction<BulkProgress | null>>;
  streamingResults: StreamingResult[];
  setStreamingResults: Dispatch<SetStateAction<StreamingResult[]>>;
  isBulkExtracting: boolean;
  onExecute: () => void;
}

export function BulkReextractDialog({
  bulkReextractProvider,
  setBulkReextractProvider,
  bulkPreview,
  setBulkPreview,
  bulkResults,
  setBulkResults,
  bulkProgress,
  setBulkProgress,
  streamingResults,
  setStreamingResults,
  isBulkExtracting,
  onExecute,
}: BulkReextractDialogProps) {
  return (
    <AlertDialog
      open={!!bulkReextractProvider && (!!bulkPreview || !!bulkResults || !!bulkProgress)}
      onOpenChange={(open) => {
        if (!open && !isBulkExtracting) {
          setBulkReextractProvider(null);
          setBulkPreview(null);
          setBulkResults(null);
          setBulkProgress(null);
          setStreamingResults([]);
        }
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className={`h-5 w-5 text-amber-600 ${bulkProgress ? 'animate-spin' : ''}`} />
            Bulk Re-extract — {bulkReextractProvider?.name}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {/* Preview Mode */}
              {bulkPreview && !bulkProgress && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Found <strong>{bulkPreview.candidateCount}</strong> policies with attached
                    documents. Re-extraction will use the updated terminology mappings.
                  </p>
                  {bulkPreview.candidateCount > 0 && (
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                      {bulkPreview.candidates.map((cand) => (
                        <div
                          key={cand.policyId}
                          className="px-3 py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate">{cand.fileName}</span>
                          </div>
                          {cand.hasExistingExtraction ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-1.5 py-0">
                              Will re-extract
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1.5 py-0">
                              New extraction
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {bulkPreview.candidateCount === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500">
                      No policies with attached documents found for this provider.
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>
                      Previous extractions will be preserved in the extraction history. Extracted
                      data will not be automatically applied.
                    </span>
                  </div>
                </div>
              )}

              {/* Streaming Progress Mode */}
              {bulkProgress &&
                (() => {
                  // Calculate ETA from completed timestamps
                  const completed = bulkProgress.completedTimestamps;
                  const remaining = bulkProgress.total - bulkProgress.current;
                  let etaText = '';

                  if (completed.length >= 2 && remaining > 0) {
                    // Average time between consecutive completions
                    const intervals: number[] = [];
                    for (let i = 1; i < completed.length; i++) {
                      intervals.push(completed[i] - completed[i - 1]);
                    }
                    const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const etaMs = avgMs * remaining;
                    const etaSec = Math.round(etaMs / 1000);

                    if (etaSec < 60) {
                      etaText = `~${etaSec}s remaining`;
                    } else {
                      const mins = Math.floor(etaSec / 60);
                      const secs = etaSec % 60;
                      etaText = `~${mins}m ${secs}s remaining`;
                    }
                  } else if (completed.length === 1 && remaining > 0) {
                    // Only one completion — estimate from elapsed since start
                    const elapsed = completed[0] - bulkProgress.startedAt;
                    const etaMs = elapsed * remaining;
                    const etaSec = Math.round(etaMs / 1000);
                    if (etaSec < 60) {
                      etaText = `~${etaSec}s remaining`;
                    } else {
                      const mins = Math.floor(etaSec / 60);
                      const secs = etaSec % 60;
                      etaText = `~${mins}m ${secs}s remaining`;
                    }
                  }

                  // Elapsed time
                  const elapsedMs = Date.now() - bulkProgress.startedAt;
                  const elapsedSec = Math.floor(elapsedMs / 1000);
                  const elapsedMin = Math.floor(elapsedSec / 60);
                  const elapsedDisplay =
                    elapsedMin > 0
                      ? `${elapsedMin}m ${elapsedSec % 60}s elapsed`
                      : `${elapsedSec}s elapsed`;

                  return (
                    <div className="space-y-3">
                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">
                            Processing {bulkProgress.current} of {bulkProgress.total}
                          </span>
                          <span className="text-gray-500">
                            {bulkProgress.total > 0
                              ? Math.round((bulkProgress.current / bulkProgress.total) * 100)
                              : 0}
                            %
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          {bulkProgress.currentFileName && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
                              <span className="truncate">{bulkProgress.currentFileName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 ml-auto">
                            <span>{elapsedDisplay}</span>
                            {etaText && (
                              <span className="text-amber-600 font-medium">{etaText}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Live results feed */}
                      {streamingResults.length > 0 && (
                        <div className="max-h-[180px] overflow-y-auto border rounded-lg divide-y">
                          {[...streamingResults].reverse().map((result, idx) => (
                            <div
                              key={`sr-${idx}`}
                              className="px-3 py-1.5 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="text-[10px] text-gray-600 truncate">
                                  {result.fileName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {result.confidence !== undefined && (
                                  <span className="text-[9px] text-gray-400">
                                    {Math.round(result.confidence * 100)}%
                                  </span>
                                )}
                                {result.status === 'completed' ? (
                                  <Check className="h-3 w-3 text-green-600" />
                                ) : result.status === 'failed' ? (
                                  <XCircle className="h-3 w-3 text-red-500" />
                                ) : (
                                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* Results Mode */}
              {bulkResults && !bulkProgress && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-900">
                        {bulkResults.totalProcessed}
                      </p>
                      <p className="text-[10px] text-gray-500">Total</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{bulkResults.successCount}</p>
                      <p className="text-[10px] text-green-600">Succeeded</p>
                    </div>
                    <div
                      className={`rounded-lg p-3 text-center ${bulkResults.failCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}
                    >
                      <p
                        className={`text-lg font-bold ${bulkResults.failCount > 0 ? 'text-red-700' : 'text-gray-400'}`}
                      >
                        {bulkResults.failCount}
                      </p>
                      <p
                        className={`text-[10px] ${bulkResults.failCount > 0 ? 'text-red-600' : 'text-gray-400'}`}
                      >
                        Failed
                      </p>
                    </div>
                  </div>

                  {/* Show streaming results in final view too */}
                  {streamingResults.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto border rounded-lg divide-y">
                      {streamingResults.map((result, idx) => (
                        <div
                          key={`fr-${idx}`}
                          className="px-3 py-2 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-700 truncate">
                              {result.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {result.confidence !== undefined && (
                              <span className="text-[10px] text-gray-500">
                                {Math.round(result.confidence * 100)}%
                              </span>
                            )}
                            {result.status === 'completed' ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[9px] px-1.5 py-0">
                                <Check className="h-2.5 w-2.5 mr-0.5" />
                                OK
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[9px] px-1.5 py-0">
                                <XCircle className="h-2.5 w-2.5 mr-0.5" />
                                {result.error?.slice(0, 30) || 'Failed'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {bulkProgress ? (
            <Button variant="outline" disabled className="opacity-50">
              Processing...
            </Button>
          ) : (
            <AlertDialogCancel>{bulkResults ? 'Close' : 'Cancel'}</AlertDialogCancel>
          )}
          {bulkPreview && bulkPreview.candidateCount > 0 && !bulkProgress && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onExecute();
              }}
              disabled={isBulkExtracting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isBulkExtracting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="contents">
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Re-extract {bulkPreview.candidateCount} Policies
                </div>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
