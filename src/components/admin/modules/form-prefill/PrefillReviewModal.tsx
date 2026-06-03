/**
 * Prefill Review Modal — admin review before applying client data to a form.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '../../../ui/badge';
import { Checkbox } from '../../../ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table';
import { Alert, AlertDescription } from '../../../ui/alert';
import { ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
  const [overwriteConflicts, setOverwriteConflicts] = useState(false);

  const safeMatches = useMemo(() => result?.matches ?? [], [result?.matches]);
  const conflictMatches = useMemo(() => safeMatches.filter((m) => m.conflict), [safeMatches]);

  const profileCompletenessHints = useMemo(() => {
    if (!result) return [];
    const matchedKeys = new Set(result.matches.map((m) => m.canonicalKey));
    return Object.entries(PREFILL_PROFILE_HINTS)
      .filter(([key]) => !matchedKeys.has(key))
      .map(([, label]) => label);
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const defaults = new Set(result.matches.filter((m) => !m.conflict).map((m) => m.formField));
    setSelected(defaults);
    setOverwriteConflicts(false);
  }, [result]);

  const toggleField = (field: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  const selectAllSafe = () => {
    setSelected(new Set(safeMatches.filter((m) => !m.conflict).map((m) => m.formField)));
  };

  const handleApply = () => {
    onApply(Array.from(selected), overwriteConflicts);
    onOpenChange(false);
  };

  const profileEditUrl = clientId
    ? `/admin?module=clients&clientId=${encodeURIComponent(clientId)}`
    : '/admin?module=clients';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Review client data matches
          </DialogTitle>
          <DialogDescription>
            Select which fields to prefill from the client record. Conflicting values are unchecked
            by default.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading matches…
          </div>
        )}

        {!loading && result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{result.matches.length} matched</Badge>
              <Badge variant="outline">{result.unmatchedFormFields.length} unmatched</Badge>
              {conflictMatches.length > 0 && (
                <Badge variant="destructive">{conflictMatches.length} conflicts</Badge>
              )}
              <Badge variant="outline">Resolver v{result.resolverVersion}</Badge>
            </div>

            {profileCompletenessHints.length > 0 && (
              <Alert>
                <AlertDescription className="space-y-2">
                  <p>
                    Profile may be incomplete — consider adding:{' '}
                    {profileCompletenessHints.slice(0, 5).join(', ')}
                    {profileCompletenessHints.length > 5 ? '…' : ''}.
                  </p>
                  <Link
                    to={profileEditUrl}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Edit client profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </AlertDescription>
              </Alert>
            )}

            {result.matches.length === 0 ? (
              <Alert>
                <AlertDescription className="space-y-2">
                  <p>
                    No mappable client data was found for this form. You can continue entering
                    details manually.
                  </p>
                  <Link
                    to={profileEditUrl}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Update client profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={selectAllSafe}>
                    Select all safe
                  </Button>
                  {onRefresh && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void onRefresh()}
                    >
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Refresh
                    </Button>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Form field</TableHead>
                      <TableHead>Proposed value</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.matches.map((match: PrefillMatch) => (
                      <TableRow
                        key={match.formField}
                        className={match.conflict ? 'bg-amber-50/60' : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selected.has(match.formField)}
                            onCheckedChange={(v) => toggleField(match.formField, v === true)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{match.label}</div>
                          <div className="text-xs text-muted-foreground">{match.formField}</div>
                          {match.conflict && (
                            <div className="text-xs text-amber-700 mt-1">
                              Current: {formatValue(match.currentFormValue)}
                            </div>
                          )}
                          {match.sourceDetail && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {match.sourceDetail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatValue(match.proposedValue)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SOURCE_LABELS[match.source] ?? match.source}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {conflictMatches.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={overwriteConflicts}
                      onCheckedChange={(v) => setOverwriteConflicts(v === true)}
                    />
                    Overwrite conflicting fields when applying selected rows
                  </label>
                )}
              </>
            )}

            {result.unmatchedFormFields.length > 0 && (
              <Alert>
                <AlertDescription className="space-y-2">
                  <p>Unmatched fields: {result.unmatchedFormFields.join(', ')}</p>
                  <Link
                    to={profileEditUrl}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Add missing data in client profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
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
