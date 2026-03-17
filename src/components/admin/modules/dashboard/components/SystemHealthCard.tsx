/**
 * System Health Card
 *
 * Dashboard widget showing the platform's maintenance status.
 * Displays the last KV cleanup run timestamp, keys purged, and duration.
 * Includes a "Run Cleanup" button that follows the dry-run-first pattern
 * (Guidelines §14.1): preview first, then confirm via AlertDialog before
 * executing a live deletion.
 *
 * Guidelines:
 *   §8.3  — White card bg, bg-gray-50 icon container, stat card standards
 *   §8.4  — Consistent card header pattern matching AuditLogWidget
 *   §14.1 — Dry-run-first pattern for destructive admin operations
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
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
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Server,
  Eye,
  Trash2,
  HardDriveDownload,
  XCircle,
} from 'lucide-react';
import { systemHealthApi } from '../api';
import type { LastCleanupRun, CleanupRunResult, SystemHealthCardProps } from '../types';

/** Threshold in days — warn if no cleanup has run within this window. */
const STALE_THRESHOLD_DAYS = 7;

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isStale(timestamp: string): boolean {
  return Date.now() - new Date(timestamp).getTime() > STALE_THRESHOLD_DAYS * 86_400_000;
}

/** Human-readable category labels for the preview breakdown. */
const CATEGORY_LABELS: Record<string, string> = {
  rateLimits: 'Rate limits',
  expiredNewsletterTokens: 'Newsletter tokens',
  oldContactForms: 'Contact / consultation',
  oldQuoteRequests: 'Quote requests',
  staleAuditEntries: 'Audit entries',
};

type CleanupStage = 'idle' | 'previewing' | 'preview_done' | 'executing' | 'done' | 'error';

export function SystemHealthCard({ onModuleChange }: SystemHealthCardProps) {
  const [lastRun, setLastRun] = useState<LastCleanupRun | null>(null);
  const [loading, setLoading] = useState(true);

  const [stage, setStage] = useState<CleanupStage>('idle');
  const [previewResult, setPreviewResult] = useState<CleanupRunResult | null>(null);
  const [liveResult, setLiveResult] = useState<CleanupRunResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    systemHealthApi.getLastCleanupRun().then((data) => {
      if (!cancelled) {
        setLastRun(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handlePreview = useCallback(async () => {
    setStage('previewing');
    setErrorMsg('');
    setPreviewResult(null);
    setLiveResult(null);
    const result = await systemHealthApi.runCleanup({ dryRun: true });
    if (result) {
      setPreviewResult(result);
      setStage('preview_done');
    } else {
      setErrorMsg('Failed to fetch cleanup preview. Please try again.');
      setStage('error');
    }
  }, []);

  const handleLiveRun = useCallback(async () => {
    setConfirmOpen(false);
    setStage('executing');
    setErrorMsg('');
    const result = await systemHealthApi.runCleanup({ dryRun: false });
    if (result) {
      setLiveResult(result);
      setStage('done');
      setLastRun({
        timestamp: result.timestamp,
        totalKeysFound: result.totalKeysFound,
        totalKeysDeleted: result.totalKeysDeleted,
        durationMs: result.durationMs,
        retentionDays: result.retentionDays,
      });
    } else {
      setErrorMsg('Cleanup execution failed. Please try again.');
      setStage('error');
    }
  }, []);

  const resetStage = useCallback(() => {
    setStage('idle');
    setPreviewResult(null);
    setLiveResult(null);
    setErrorMsg('');
  }, []);

  const stale = lastRun ? isStale(lastRun.timestamp) : false;
  const isRunning = stage === 'previewing' || stage === 'executing';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-lg">
              <Server className="h-4 w-4 text-gray-600" />
            </div>
            System Health
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={isRunning || stage === 'preview_done'}
            className="h-7 text-xs gap-1.5"
          >
            {stage === 'previewing' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {stage === 'previewing' ? 'Scanning…' : 'Run Cleanup'}
          </Button>
        </div>
        <CardDescription>KV store maintenance status</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Status Banner ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Checking status…</span>
          </div>
        ) : lastRun ? (
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-3 ${
              stale ? 'bg-amber-50 border border-amber-100' : 'bg-green-50 border border-green-100'
            }`}
          >
            <div className={`p-1.5 rounded-md ${stale ? 'bg-amber-100' : 'bg-green-100'}`}>
              {stale ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {stale ? 'Cleanup overdue' : 'System healthy'}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 leading-4 ${
                    stale
                      ? 'text-amber-700 border-amber-300 bg-amber-50'
                      : 'text-green-700 border-green-300 bg-green-50'
                  }`}
                >
                  {stale ? 'Overdue' : 'OK'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" />
                Last run: {formatRelativeTime(lastRun.timestamp)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-3">
            <div className="p-1.5 rounded-md bg-blue-100">
              <HardDriveDownload className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">No cleanup run yet</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Click "Run Cleanup" to scan for stale KV entries.
              </p>
            </div>
          </div>
        )}

        {/* ── Last Run Stats ──────────────────────────────────────────────── */}
        {lastRun && !loading && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold leading-tight">{lastRun.totalKeysDeleted}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Keys purged</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold leading-tight">{lastRun.totalKeysFound}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Stale found</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-center">
              <p className="text-lg font-bold leading-tight">{lastRun.durationMs}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ms elapsed</p>
            </div>
          </div>
        )}

        {/* ── Cleanup Operation Flow ──────────────────────────────────────── */}
        {stage !== 'idle' && (
          <div>
            {/* Preview */}
            {stage === 'preview_done' && previewResult && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-900">Dry-run preview</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 text-blue-700 border-blue-300 bg-blue-50">
                    Not applied
                  </Badge>
                </div>

                {previewResult.totalKeysFound === 0 ? (
                  <p className="text-xs text-blue-800">
                    No stale keys found — the KV store is clean.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-blue-800">
                      Found <strong>{previewResult.totalKeysFound}</strong> stale{' '}
                      {previewResult.totalKeysFound !== 1 ? 'keys' : 'key'} to purge:
                    </p>
                    <div className="space-y-1">
                      {Object.entries(previewResult.categories || {}).map(([key, cat]) => {
                        if (!cat || cat.keysFound === 0) return null;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between text-xs text-blue-700 bg-blue-100/60 rounded px-2 py-1"
                          >
                            <span>{CATEGORY_LABELS[key] || key}</span>
                            <span className="font-semibold">{cat.keysFound}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmOpen(true)}
                        className="h-7 text-xs gap-1.5 flex-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete {previewResult.totalKeysFound} keys
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetStage}
                        className="h-7 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {previewResult.totalKeysFound === 0 && (
                  <Button size="sm" variant="ghost" onClick={resetStage} className="h-7 text-xs w-full">
                    Dismiss
                  </Button>
                )}
              </div>
            )}

            {/* Executing */}
            {stage === 'executing' && (
              <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting stale keys…
              </div>
            )}

            {/* Done */}
            {stage === 'done' && liveResult && (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-900">Cleanup complete</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 leading-4 text-green-700 border-green-300 bg-green-50">
                    Applied
                  </Badge>
                </div>
                <p className="text-xs text-green-800">
                  Deleted <strong>{liveResult.totalKeysDeleted}</strong>{' '}
                  {liveResult.totalKeysDeleted !== 1 ? 'keys' : 'key'} in {liveResult.durationMs}ms.
                </p>
                <Button size="sm" variant="ghost" onClick={resetStage} className="h-7 text-xs w-full">
                  Dismiss
                </Button>
              </div>
            )}

            {/* Error */}
            {stage === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  <span className="text-xs font-semibold text-red-900">Error</span>
                </div>
                <p className="text-xs text-red-800">{errorMsg}</p>
                <Button size="sm" variant="ghost" onClick={resetStage} className="h-7 text-xs w-full">
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* ── Confirmation Dialog (§14.1 dry-run-first) ────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Live Cleanup</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <strong>{previewResult?.totalKeysFound ?? 0}</strong> stale KV{' '}
              {(previewResult?.totalKeysFound ?? 0) !== 1 ? 'entries' : 'entry'}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLiveRun}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Keys
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
