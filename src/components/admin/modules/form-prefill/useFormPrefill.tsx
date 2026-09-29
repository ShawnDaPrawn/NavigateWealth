/**
 * Hook for unified form prefill with review-before-apply flow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { FormPrefillId, PrefillResolveResponse } from '../../../../shared/form-prefill/types';
import { logPrefillAudit, resolveFormPrefill } from '../../../../services/form-prefill-api';
import { PREFILL_PROFILE_HINTS } from '../../../../shared/form-prefill/form-field-registry';
import { clientKeysApi } from '../client-keys';
import { PrefillReviewModal } from './PrefillReviewModal';
import { PrefillBanner } from './PrefillBanner';

/**
 * Sets `a.b.c` on `target`, copying each nested object on the way down.
 * `target` is a shallow copy of the form's state, so writing into its nested
 * objects in place would mutate that state (Estate's `familyInfo.*` fields).
 */
function setNestedValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cursor[key];
    cursor[key] =
      child && typeof child === 'object' ? { ...(child as Record<string, unknown>) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function applyMatchesToValues(
  currentValues: Record<string, unknown>,
  matches: PrefillResolveResponse['matches'],
  selectedFields: string[],
  overwriteConflicts: boolean,
): Record<string, unknown> {
  const next = { ...currentValues };

  for (const match of matches) {
    if (!selectedFields.includes(match.formField)) continue;
    if (match.conflict && !overwriteConflicts) continue;

    if (match.formField.includes('.')) {
      setNestedValue(next, match.formField, match.proposedValue);
    } else {
      next[match.formField] = match.proposedValue;
    }
  }

  return next;
}

interface UseFormPrefillOptions {
  clientId?: string;
  formId: FormPrefillId;
  currentValues: Record<string, unknown>;
  onApplyValues: (values: Record<string, unknown>) => void;
  autoOpenReview?: boolean;
  intakeInputs?: Record<string, unknown>;
}

export function useFormPrefill({
  clientId,
  formId,
  currentValues,
  onApplyValues,
  autoOpenReview = true,
  intakeInputs,
}: UseFormPrefillOptions) {
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [result, setResult] = useState<PrefillResolveResponse | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => () => setReviewOpen(false), []);

  const runResolve = useCallback(async () => {
    if (!clientId) return null;
    setLoading(true);
    try {
      const response = await resolveFormPrefill({
        clientId,
        formId,
        currentFormValues: currentValues,
        options: { intakeInputs, includePolicies: true, includeClientKeys: true },
      });
      setResult(response);
      return response;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load prefill matches');
      return null;
    } finally {
      setLoading(false);
    }
  }, [clientId, formId, currentValues, intakeInputs]);

  const openReview = useCallback(async () => {
    const response = await runResolve();
    if (response && response.matches.length > 0) {
      setReviewOpen(true);
    } else if (response) {
      toast.info('No client data matches found for this form.');
    }
  }, [runResolve]);

  /**
   * Recalculates the client's keys from their saved policies, then opens the
   * review. This is the one way any FNA pulls fresh policy totals (existing
   * cover, medical aid, retirement capital) — through the same review as
   * everything else, never straight into the form.
   */
  const refreshFromPolicies = useCallback(async () => {
    if (!clientId) return;
    setRefreshing(true);
    try {
      await clientKeysApi.recalculateClientKeys(clientId);
      await openReview();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to refresh client keys from policies',
      );
    } finally {
      setRefreshing(false);
    }
  }, [clientId, openReview]);

  const startPrefill = useCallback(async () => {
    if (!clientId) return;
    const response = await runResolve();
    if (!response) return;

    if (autoOpenReview && response.matches.length > 0) {
      setReviewOpen(true);
      return;
    }

    if (response.matches.length === 0) return;

    const safeFields = response.matches.filter((m) => !m.conflict).map((m) => m.formField);
    const merged = applyMatchesToValues(currentValues, response.matches, safeFields, false);
    onApplyValues(merged);
    setAppliedCount(safeFields.length);
    await logPrefillAudit({
      clientId,
      formId,
      appliedFields: safeFields,
      resolverVersion: response.resolverVersion,
    }).catch(() => undefined);
  }, [autoOpenReview, clientId, currentValues, formId, onApplyValues, runResolve]);

  const handleApply = async (selectedFields: string[], overwriteConflicts: boolean) => {
    if (!result || !clientId) return;
    const merged = applyMatchesToValues(
      currentValues,
      result.matches,
      selectedFields,
      overwriteConflicts,
    );
    onApplyValues(merged);
    setAppliedCount(selectedFields.length);
    setReviewOpen(false);
    toast.success(
      `Applied ${selectedFields.length} field${selectedFields.length === 1 ? '' : 's'} from client record`,
    );
    await logPrefillAudit({
      clientId,
      formId,
      appliedFields: selectedFields,
      resolverVersion: result.resolverVersion,
    }).catch(() => undefined);
  };

  const missingProfileHints = useMemo(() => {
    if (!result || result.matches.length > 0) return [];
    const matchedKeys = new Set(result.matches.map((m) => m.canonicalKey));
    return Object.entries(PREFILL_PROFILE_HINTS)
      .filter(([key]) => !matchedKeys.has(key))
      .map(([, label]) => label);
  }, [result]);

  const PrefillUI = (
    <>
      <PrefillBanner
        loading={loading || refreshing}
        matchCount={result?.matches.length ?? 0}
        appliedCount={appliedCount}
        resolverVersion={result?.resolverVersion}
        clientId={clientId}
        missingProfileHints={missingProfileHints}
        onReview={openReview}
        onReapply={startPrefill}
        onRefreshFromPolicies={clientId ? refreshFromPolicies : undefined}
      />
      <PrefillReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        loading={loading}
        result={result}
        clientId={clientId}
        onRefresh={runResolve}
        onApply={handleApply}
        onSkip={() => setReviewOpen(false)}
      />
    </>
  );

  return {
    loading,
    result,
    reviewOpen,
    setReviewOpen,
    runResolve,
    openReview,
    startPrefill,
    refreshFromPolicies,
    refreshing,
    PrefillUI,
  };
}
