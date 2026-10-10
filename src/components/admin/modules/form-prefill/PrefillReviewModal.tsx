/**
 * Prefill Review Modal — admin review before applying client data to a form.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Button } from '../../../ui/button';
import { Checkbox } from '../../../ui/checkbox';
import { ArrowRight, ChevronRight, ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { PrefillMatch, PrefillResolveResponse } from '../../../../shared/form-prefill/types';
import { PREFILL_PROFILE_HINTS } from '../../../../shared/form-prefill/form-field-registry';

interface PrefillReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  result: PrefillResolveResponse | null;
  clientId?: string;
  onRefresh?: () => void | Promise<unknown>;
  onApply: (selectedFields: string[], overwriteConflicts: boolean) => void;
  onSkip?: () => void;
  /** Drawer preview — review only, no live form apply */
  previewOnly?: boolean;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const SOURCE_LABELS: Record<string, string> = {
  profile: 'Client profile',
  client_keys: 'Client keys',
  policies: 'Policies',
  intake: 'Client intake',
  fna_draft: 'FNA draft',
  derived: 'Calculated',
  template: 'Template',
};

export function PrefillReviewModal({
  open,
  onOpenChange,
  loading = false,
  result,
  clientId,
  onRefresh,
  onApply,
  onSkip,
  previewOnly = false,
}: PrefillReviewModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const matches = useMemo(() => result?.matches ?? [], [result?.matches]);
  const readyMatches = useMemo(() => matches.filter((m) => !m.conflict), [matches]);
  const conflictMatches = useMemo(() => matches.filter((m) => m.conflict), [matches]);

  const missingLabels = useMemo(() => {
    if (!result) return [];
    const matchedKeys = new Set(result.matches.map((m) => m.canonicalKey));
    return Object.entries(PREFILL_PROFILE_HINTS)
      .filter(([key]) => !matchedKeys.has(key))
      .map(([, label]) => label);
  }, [result]);

  useEffect(() => {
    if (!result) return;
    setSelected(new Set(result.matches.filter((m) => !m.conflict).map((m) => m.formField)));
  }, [result]);

  const toggleField = (field: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  const allReadySelected =
    readyMatches.length > 0 && readyMatches.every((m) => selected.has(m.formField));

  const toggleAllReady = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const m of readyMatches) {
        if (allReadySelected) next.delete(m.formField);
        else next.add(m.formField);
      }
      return next;
    });
  };

  const handleApply = () => {
    // A conflicting row the admin ticked is an explicit decision to overwrite.
    const overwrite = conflictMatches.some((m) => selected.has(m.formField));
    onApply(Array.from(selected), overwrite);
    onOpenChange(false);
  };

  const profileEditUrl = clientId
    ? `/admin?module=clients&clientId=${encodeURIComponent(clientId)}`
    : '/admin?module=clients';

  const unmatchedCount = result?.unmatchedFormFields.length ?? 0;
  const showMissing = missingLabels.length > 0 || unmatchedCount > 0;

  const renderRow = (match: PrefillMatch) => {
    const checked = selected.has(match.formField);
    return (
      <label
        key={match.formField}
        className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40 ${
          match.conflict ? 'bg-amber-50/50' : ''
        }`}
      >
        <Checkbox
          className="mt-0.5"
          checked={checked}
          onCheckedChange={(v) => toggleField(match.formField, v === true)}
        />
        <div className="min-w-0 flex-1" title={match.formField}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{match.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {match.sourceDetail ?? SOURCE_LABELS[match.source] ?? match.source}
            </span>
          </div>
          {match.conflict ? (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground line-through">
                {formatValue(match.currentFormValue)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
              <span className="font-medium text-foreground">
                {formatValue(match.proposedValue)}
              </span>
            </div>
          ) : (
            <div className="mt-0.5 text-sm text-foreground/80">
              {formatValue(match.proposedValue)}
            </div>
          )}
        </div>
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-1 border-b px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Prefill from client record
          </DialogTitle>
          <DialogDescription>
            {result
              ? `${matches.length} field${matches.length === 1 ? '' : 's'} found. Choose what to fill in.`
              : 'Choose which client details to fill in.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading matches…
            </div>
          )}

          {!loading && result && matches.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No client data could be matched to this form. You can continue entering details
                manually.
              </p>
              <Link
                to={profileEditUrl}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Update client profile
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {!loading && readyMatches.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Ready to fill</h3>
                <div className="flex items-center gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={toggleAllReady}>
                    {allReadySelected ? 'Clear all' : 'Select all'}
                  </Button>
                  {onRefresh && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => void onRefresh()}
                      aria-label="Refresh matches"
                      title="Refresh matches"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="divide-y overflow-hidden rounded-lg border">
                {readyMatches.map(renderRow)}
              </div>
            </section>
          )}

          {!loading && conflictMatches.length > 0 && (
            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Needs your decision</h3>
                <p className="text-xs text-muted-foreground">
                  The form already has a different value. Tick a row to replace it.
                </p>
              </div>
              <div className="divide-y overflow-hidden rounded-lg border border-amber-200">
                {conflictMatches.map(renderRow)}
              </div>
            </section>
          )}

          {!loading && result && showMissing && (
            <details className="group rounded-lg bg-muted/40 text-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-muted-foreground">
                <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                {unmatchedCount > 0
                  ? `${unmatchedCount} field${unmatchedCount === 1 ? '' : 's'} couldn’t be matched`
                  : 'Client profile looks incomplete'}
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {unmatchedCount > 0 && (
                  <p className="text-muted-foreground">{result.unmatchedFormFields.join(', ')}</p>
                )}
                {missingLabels.length > 0 && (
                  <p className="text-muted-foreground">
                    Missing from profile: {missingLabels.slice(0, 5).join(', ')}
                    {missingLabels.length > 5 ? ` +${missingLabels.length - 5} more` : ''}
                  </p>
                )}
                <Link
                  to={profileEditUrl}
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Edit client profile
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onSkip?.();
              onOpenChange(false);
            }}
          >
            {previewOnly ? 'Close' : 'Skip prefill'}
          </Button>
          {!previewOnly && (
            <Button
              type="button"
              onClick={handleApply}
              disabled={loading || !result || selected.size === 0}
              data-testid="prefill-apply-selected"
            >
              Apply selected ({selected.size})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
