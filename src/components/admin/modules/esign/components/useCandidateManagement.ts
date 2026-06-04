/**
 * useCandidateManagement
 * ---------------------------------------------------------------------------
 * Owns the autodetect-candidate state (P3.1 + P3.2) for PrepareFormStudio:
 * the candidate list, the dismissable banner, accept/dismiss handlers, and
 * the auto-populate effect that fires once per envelope upload.
 *
 * Extracted from PrepareFormStudio.tsx (Phase 6b god-file split).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import type { EsignEnvelope, EsignField, SignerFormData } from '../types';

/** Convenience alias for a single candidate entry. */
export type Candidate = NonNullable<EsignEnvelope['field_candidates']>[number];

export function useCandidateManagement(params: {
  envelopeId: string;
  initialCandidates: EsignEnvelope['field_candidates'];
  autoPopulateSuggestedFields: boolean;
  fields: EsignField[];
  pushToHistory: (fields: EsignField[]) => void;
  selectedSignerId: string | undefined;
  eligibleSigners: SignerFormData[];
  buildFieldsFromCandidates: (candidates: Candidate[], signerId: string) => EsignField[];
}) {
  const {
    envelopeId,
    initialCandidates,
    autoPopulateSuggestedFields,
    fields,
    pushToHistory,
    selectedSignerId,
    eligibleSigners,
    buildFieldsFromCandidates,
  } = params;

  const [candidates, setCandidates] = useState<NonNullable<EsignEnvelope['field_candidates']>>(
    initialCandidates ?? [],
  );
  const [showCandidatesPanel, setShowCandidatesPanel] = useState<boolean>(
    (initialCandidates?.length ?? 0) > 0,
  );
  const autoPopulateHandledRef = useRef<string | null>(null);

  /**
   * Convert one candidate into a real EsignField bound to the currently
   * active signer. The candidate is removed from the candidates list once
   * accepted so we never duplicate it. Pushes to undo history so the
   * sender can roll back.
   */
  const acceptCandidate = useCallback(
    (candidateId: string) => {
      const cand = candidates.find((c) => c.id === candidateId);
      if (!cand) return;
      const target = selectedSignerId || eligibleSigners[0]?.email;
      if (!target) {
        toast.error('Add a recipient first.');
        return;
      }
      const now = new Date().toISOString();
      const newField: EsignField = {
        id: `field-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        envelope_id: envelopeId,
        signer_id: target,
        type: cand.type,
        page: cand.page,
        x: cand.x,
        y: cand.y,
        width: cand.width,
        height: cand.height,
        required: cand.required,
        metadata: { ...(cand.metadata ?? {}), source: cand.source, label: cand.label },
        created_at: now,
        updated_at: now,
      };
      pushToHistory([...fields, newField]);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    },
    [candidates, selectedSignerId, eligibleSigners, fields, envelopeId, pushToHistory],
  );

  /**
   * Bulk accept — convert every remaining candidate into a field bound to
   * the active signer. Same dedupe rules as `handleApplyToAllPages` so we
   * never carpet-bomb the doc with overlapping fields.
   */
  const acceptAllCandidates = useCallback(() => {
    const target = selectedSignerId || eligibleSigners[0]?.email;
    if (!target) {
      toast.error('Add a recipient first.');
      return;
    }
    if (candidates.length === 0) return;
    const newFields = buildFieldsFromCandidates(candidates, target);
    if (newFields.length === 0) {
      toast.info('All suggested fields already match an existing one.');
      setCandidates([]);
      return;
    }
    pushToHistory([...fields, ...newFields]);
    setCandidates([]);
    toast.success(
      `Accepted ${newFields.length} suggested field${newFields.length === 1 ? '' : 's'}`,
    );
  }, [
    candidates,
    selectedSignerId,
    eligibleSigners,
    buildFieldsFromCandidates,
    fields,
    pushToHistory,
  ]);

  // Auto-populate effect: fires once per envelope upload when
  // autoPopulateSuggestedFields is true. Immediately applies all candidates
  // so the sender starts with a pre-populated draft they can refine.
  useEffect(() => {
    if (!autoPopulateSuggestedFields) {
      autoPopulateHandledRef.current = envelopeId;
      return;
    }
    if (candidates.length === 0) {
      autoPopulateHandledRef.current = envelopeId;
      return;
    }
    if (autoPopulateHandledRef.current === envelopeId) return;

    const target = selectedSignerId || eligibleSigners[0]?.email;
    if (!target) return;

    const newFields = buildFieldsFromCandidates(candidates, target);
    autoPopulateHandledRef.current = envelopeId;
    setShowCandidatesPanel(false);
    setCandidates([]);

    if (newFields.length === 0) {
      toast.info('Suggested PDF fields were already present on this envelope.');
      return;
    }

    pushToHistory([...fields, ...newFields]);
    toast.success(
      `Auto-added ${newFields.length} suggested field${newFields.length === 1 ? '' : 's'} from the PDF.`,
    );
  }, [
    autoPopulateSuggestedFields,
    candidates,
    selectedSignerId,
    eligibleSigners,
    buildFieldsFromCandidates,
    envelopeId,
    fields,
    pushToHistory,
  ]);

  const dismissCandidate = useCallback(
    (candidateId: string) => setCandidates((prev) => prev.filter((c) => c.id !== candidateId)),
    [],
  );

  const dismissAllCandidates = useCallback(() => {
    setCandidates([]);
    setShowCandidatesPanel(false);
  }, []);

  return {
    candidates,
    showCandidatesPanel,
    setShowCandidatesPanel,
    acceptCandidate,
    acceptAllCandidates,
    dismissCandidate,
    dismissAllCandidates,
  };
}
