/**
 * P6.8 — Recovery Bin dialog.
 *
 * Lists envelopes that admins have soft-deleted but whose retention
 * window (90 days) has not yet elapsed, and lets them either restore
 * one back into the active workspace or permanently purge it ahead of
 * the automated sweep. Mirrors the "Trash" pattern users already know
 * from Gmail/Google Drive so the UX feels familiar without any
 * onboarding.
 *
 * The dialog uses `esignApi.listRecoveryBin()` / `restoreEnvelope()` /
 * `purgeEnvelope()` which are all firm-scoped on the server, so admins
 * only ever see their own firm's bin.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Loader2, RefreshCw, RotateCcw, Trash2, Inbox } from 'lucide-react';
import { esignApi } from '../api';
import { logger } from '../../../../../utils/logger';

interface RecoveryBinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after any restore/purge so the dashboard can refetch. */
  onChanged?: () => void;
}

interface BinEnvelope {
  id: string;
  title?: string;
  status?: string;
  deleted_at?: string;
  deleted_by?: string;
  delete_reason?: string;
  firm_id?: string;
  client_id?: string;
}

function daysUntilPurge(deletedAt: string | undefined, retentionDays: number): number | null {
  if (!deletedAt) return null;
  const deletedMs = new Date(deletedAt).getTime();
  if (!Number.isFinite(deletedMs)) return null;
  const purgeMs = deletedMs + retentionDays * 24 * 60 * 60 * 1000;
  const diffMs = purgeMs - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function RecoveryBinDialog({ open, onOpenChange, onChanged }: RecoveryBinDialogProps) {
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<BinEnvelope[]>([]);
  const [retentionDays, setRetentionDays] = useState(90);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await esignApi.listRecoveryBin();
      setItems((response.envelopes as BinEnvelope[]) || []);
      setRetentionDays(response.retention_days ?? 90);
    } catch (err) {
      logger.error('Failed to load recovery bin:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load recovery bin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleRestore = async (id: string) => {
    setBusyId(id);
    try {
      await esignApi.restoreEnvelope(id);
      toast.success('Envelope restored');
      setItems((prev) => prev.filter((e) => e.id !== id));
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore envelope');
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async (id: string) => {
    // Purge is destructive and immediate; surface an inline confirm via
    // toast.promise so the UX stays in-dialog without another modal.
    const confirmed = window.confirm(
      'Permanently delete this envelope? This cannot be undone.',
    );
    if (!confirmed) return;
    setBusyId(id);
    try {
      await esignApi.purgeEnvelope(id);
      toast.success('Envelope permanently deleted');
      setItems((prev) => prev.filter((e) => e.id !== id));
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to purge envelope');
    } finally {
      setBusyId(null);
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.deleted_at || '') < (b.deleted_at || '') ? 1 : -1),
    [items],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-purple-600" />
            Recovery Bin
          </DialogTitle>
          <DialogDescription>
            Soft-deleted envelopes stay here for {retentionDays} days before being
            permanently purged. Restore an envelope to return it to the active
            workspace, or purge now to remove it immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {sortedItems.length} item{sortedItems.length === 1 ? '' : 's'} in bin
          </span>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? (
              <div className="contents">
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Refreshing…
              </div>
            ) : (
              <div className="contents">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </div>
            )}
          </Button>
        </div>

        <ScrollArea className="max-h-[480px] -mx-6 px-6 border-t mt-2">
          {sortedItems.length === 0 && !loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nothing in the recovery bin.
            </div>
          ) : (
            <ul className="divide-y">
              {sortedItems.map((envelope) => {
                const remaining = daysUntilPurge(envelope.deleted_at, retentionDays);
                return (
                  <li key={envelope.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm text-gray-900">
                          {envelope.title || envelope.id}
                        </span>
                        {envelope.status && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {envelope.status}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Deleted{' '}
                        {envelope.deleted_at
                          ? format(new Date(envelope.deleted_at), 'dd MMM yyyy HH:mm')
                          : 'unknown'}
                        {remaining !== null && (
                          <span className="ml-2">
                            · purges in {remaining} day{remaining === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {envelope.delete_reason && (
                        <div className="text-xs text-muted-foreground italic mt-0.5 truncate">
                          “{envelope.delete_reason}”
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === envelope.id}
                        onClick={() => handleRestore(envelope.id)}
                      >
                        {busyId === envelope.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <div className="contents">
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Restore
                          </div>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === envelope.id}
                        onClick={() => handlePurge(envelope.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Purge
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
