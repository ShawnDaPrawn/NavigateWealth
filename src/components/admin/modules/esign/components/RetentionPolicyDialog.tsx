/**
 * P7.7 — Retention policy dialog.
 *
 * Lets a firm administrator configure how long completed, terminated,
 * and drafted envelopes are kept before the daily sweep purges them.
 * Empty (or zero) fields mean "never purge" — the default. The
 * `delete_artifacts` toggle switches between soft-delete (recoverable
 * from the bin) and hard-delete (Storage objects and KV rows removed).
 *
 * The dialog is deliberately terse — retention is a compliance tool,
 * not a growth tool. Each field carries a plain-English description
 * so admins know what they're enabling.
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../../ui/dialog';
import { Label } from '../../../../ui/label';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { Switch } from '../../../../ui/switch';
import { Loader2, AlertTriangle } from 'lucide-react';
import { esignApi } from '../api';
import { toast } from 'sonner';
import { logger } from '../../../../../utils/logger';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toInput(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

function fromInput(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function RetentionPolicyDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState('');
  const [terminated, setTerminated] = useState('');
  const [draft, setDraft] = useState('');
  const [deleteArtifacts, setDeleteArtifacts] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { policy } = await esignApi.getRetentionPolicy();
        if (cancelled) return;
        if (policy) {
          setCompleted(toInput(policy.completed_retention_days));
          setTerminated(toInput(policy.terminated_retention_days));
          setDraft(toInput(policy.draft_retention_days));
          setDeleteArtifacts(!!policy.delete_artifacts);
          setUpdatedAt(policy.updated_at);
        } else {
          setCompleted(''); setTerminated(''); setDraft('');
          setDeleteArtifacts(false);
          setUpdatedAt(null);
        }
      } catch (err) {
        logger.error('Failed to load retention policy:', err);
        toast.error('Failed to load retention policy');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { policy } = await esignApi.setRetentionPolicy({
        completed_retention_days: fromInput(completed),
        terminated_retention_days: fromInput(terminated),
        draft_retention_days: fromInput(draft),
        delete_artifacts: deleteArtifacts,
      });
      if (policy?.updated_at) setUpdatedAt(String(policy.updated_at));
      toast.success('Retention policy saved');
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to save retention policy:', err);
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Revert to default (no purging)?')) return;
    setSaving(true);
    try {
      await esignApi.deleteRetentionPolicy();
      setCompleted(''); setTerminated(''); setDraft('');
      setDeleteArtifacts(false);
      setUpdatedAt(null);
      toast.success('Retention reverted to default');
      onOpenChange(false);
    } catch (err) {
      logger.error('Failed to reset retention policy:', err);
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retention policy</DialogTitle>
          <DialogDescription>
            Configure how long envelopes are kept before the daily sweep purges them.
            Leave a field blank to keep that category indefinitely.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="retention-completed">Completed envelopes (days)</Label>
              <Input
                id="retention-completed"
                type="number"
                min={1}
                value={completed}
                onChange={(e) => setCompleted(e.target.value)}
                placeholder="e.g. 2555 (seven years)"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Measured from the envelope's completed timestamp.
              </p>
            </div>
            <div>
              <Label htmlFor="retention-terminated">Terminated envelopes (days)</Label>
              <Input
                id="retention-terminated"
                type="number"
                min={1}
                value={terminated}
                onChange={(e) => setTerminated(e.target.value)}
                placeholder="e.g. 365"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Applies to declined, expired, or voided envelopes.
              </p>
            </div>
            <div>
              <Label htmlFor="retention-draft">Inactive drafts (days)</Label>
              <Input
                id="retention-draft"
                type="number"
                min={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. 90"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Drafts that have not been edited for this many days are removed.
              </p>
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="retention-purge" className="text-sm">
                    Permanently delete artifacts
                  </Label>
                  <Switch
                    id="retention-purge"
                    checked={deleteArtifacts}
                    onCheckedChange={setDeleteArtifacts}
                  />
                </div>
                <p className="text-[11px] text-amber-900 mt-1">
                  When on, the sweep removes the signed PDF, certificate, and attachments
                  from Storage. When off, envelopes are moved to the recovery bin where
                  they remain restorable for 90 days.
                </p>
              </div>
            </div>

            {updatedAt && (
              <p className="text-[10px] text-muted-foreground">
                Last updated {new Date(updatedAt).toLocaleString('en-ZA')}.
              </p>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="ghost" onClick={handleReset} disabled={saving}>
                Revert to default
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
