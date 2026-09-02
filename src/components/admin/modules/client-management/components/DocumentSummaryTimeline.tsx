import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
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
import { History, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '../../../../../utils/logger';
import { DocumentSummaryEntry } from './DocumentSummaryEntry';
import { documentSummaryApi, targetForBatchKey } from './documents/summaryApi';
import { formatSummaryDate, groupSummariesByPeriod } from './documents/summaryFormat';
import type { DocumentBatch, DocumentSummary, SummaryEditDraft } from './documents/summaryTypes';

interface DocumentSummaryTimelineProps {
  clientId: string;
  /** Bumped by the parent after an upload/delete so the timeline refetches. */
  refreshToken?: number;
}

/**
 * The AI activity timeline on the client's Documents tab.
 *
 * Reads as a history: each entry is one batch of documents that was filed, and
 * what that batch shows was done for the client. Batches with no summary yet
 * are surfaced above the timeline as work waiting to be done — the weekly
 * Saturday scan picks them up on its own, and this is the manual path for
 * anyone who does not want to wait for it.
 *
 * Permissions come from the server (`canEdit` / `canGenerate`) rather than
 * being re-derived here. Editing is super admin only.
 */
export function DocumentSummaryTimeline({ clientId, refreshToken }: DocumentSummaryTimelineProps) {
  const [summaries, setSummaries] = useState<DocumentSummary[]>([]);
  const [batches, setBatches] = useState<DocumentBatch[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Batch keys currently being summarised, so each row can spin on its own. */
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<DocumentSummary | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const data = await documentSummaryApi.list(clientId);
      setSummaries(data.summaries ?? []);
      setBatches(data.batches ?? []);
      setCanEdit(Boolean(data.canEdit));
      setCanGenerate(Boolean(data.canGenerate));
    } catch (error) {
      logger.error('Failed to load document summaries', error, { clientId });
      toast.error('Failed to load the document summary timeline');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const markBusy = (key: string, busy: boolean) =>
    setBusyKeys((keys) => (busy ? [...keys, key] : keys.filter((entry) => entry !== key)));

  /** Summarise one batch; `force` re-runs over an existing summary. */
  const generate = useCallback(
    async (batchKey: string, title: string, force = false) => {
      markBusy(batchKey, true);
      try {
        const result = await documentSummaryApi.generate(
          clientId,
          targetForBatchKey(batchKey),
          force,
        );
        setSummaries((current) => {
          const without = current.filter((entry) => entry.id !== result.summary.id);
          return [...without, result.summary].sort((a, b) =>
            (b.documentDate || '').localeCompare(a.documentDate || ''),
          );
        });
        setBatches((current) =>
          current.map((batch) => (batch.key === batchKey ? { ...batch, hasSummary: true } : batch)),
        );

        if (result.summary.status === 'failed') {
          toast.error(`Could not summarise “${title}”`);
        } else {
          toast.success(`Summarised “${title}”`);
        }
      } catch (error) {
        logger.error('Failed to generate document summary', error, { clientId, batchKey });
        toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
      } finally {
        markBusy(batchKey, false);
      }
    },
    [clientId],
  );

  const pending = batches.filter((batch) => !batch.hasSummary);

  /** Summarise everything outstanding, one at a time to keep the load sane. */
  const generateAllPending = async () => {
    for (const batch of pending) {
      await generate(batch.key, batch.title);
    }
  };

  const handleSave = async (summaryId: string, edit: SummaryEditDraft) => {
    try {
      const result = await documentSummaryApi.update(clientId, summaryId, edit);
      setSummaries((current) =>
        current.map((entry) => (entry.id === summaryId ? result.summary : entry)),
      );
      toast.success('Summary updated');
    } catch (error) {
      logger.error('Failed to update document summary', error, { clientId, summaryId });
      toast.error(error instanceof Error ? error.message : 'Failed to update summary');
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const summary = pendingDelete;
    setPendingDelete(null);
    try {
      await documentSummaryApi.remove(clientId, summary.id);
      setSummaries((current) => current.filter((entry) => entry.id !== summary.id));
      setBatches((current) =>
        current.map((batch) =>
          batch.key === summary.id ? { ...batch, hasSummary: false } : batch,
        ),
      );
      toast.success('Summary deleted');
    } catch (error) {
      logger.error('Failed to delete document summary', error, { clientId, id: summary.id });
      toast.error('Failed to delete summary');
    }
  };

  const periods = groupSummariesByPeriod(summaries);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Document Activity Timeline
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            AI summaries of what each batch of documents was — a running history of what was done
            for this client.
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh timeline
          </Button>
          {canGenerate && pending.length > 0 && (
            <Button size="sm" onClick={generateAllPending} disabled={busyKeys.length > 0}>
              <Sparkles className="mr-2 h-4 w-4" />
              Summarise {pending.length} pending
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {canGenerate && pending.length > 0 && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
            <p className="mb-2 text-sm font-medium text-blue-900">
              {pending.length} document {pending.length === 1 ? 'batch has' : 'batches have'} not
              been summarised yet
            </p>
            <p className="mb-3 text-xs text-blue-800">
              The weekly Saturday scan will pick these up automatically. Summarise one now if you
              need it sooner.
            </p>
            <div className="space-y-2">
              {pending.map((batch) => (
                <div
                  key={batch.key}
                  className="flex items-center justify-between gap-3 rounded border border-blue-100 bg-white p-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{batch.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSummaryDate(batch.documentDate)} · {batch.documentCount}{' '}
                      {batch.documentCount === 1 ? 'file' : 'files'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyKeys.includes(batch.key)}
                    onClick={() => generate(batch.key, batch.title)}
                  >
                    {busyKeys.includes(batch.key) ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Summarise
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && summaries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
            Loading timeline...
          </div>
        ) : summaries.length === 0 ? (
          <div className="py-10 text-center">
            <History className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No document summaries yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {batches.length === 0
                ? 'Upload documents to build this client’s activity history'
                : 'Summarise a batch above, or wait for the weekly Saturday scan'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {periods.map((period) => (
              <div key={period.period}>
                <div className="mb-3 flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-700">{period.period}</h4>
                  <Badge variant="outline" className="text-xs">
                    {period.summaries.length}
                  </Badge>
                </div>

                <div className="relative space-y-3 border-l border-slate-200 pl-0">
                  {period.summaries.map((summary) => (
                    <DocumentSummaryEntry
                      key={summary.id}
                      summary={summary}
                      canEdit={canEdit}
                      canGenerate={canGenerate}
                      busy={busyKeys.includes(summary.id)}
                      onSave={handleSave}
                      onDelete={setPendingDelete}
                      onRegenerate={(entry) =>
                        // `force` only when overwriting a summary that worked —
                        // retrying a failed one needs no privilege beyond the
                        // one that generated it.
                        generate(entry.id, entry.title, entry.status !== 'failed')
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this summary?</AlertDialogTitle>
            <AlertDialogDescription>
              The documents themselves are not touched. The batch becomes unsummarised again and the
              next weekly scan will write a fresh entry for it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
