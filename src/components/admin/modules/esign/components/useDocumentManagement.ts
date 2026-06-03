/**
 * useDocumentManagement
 * ---------------------------------------------------------------------------
 * Owns multi-document envelope state for the PrepareFormStudio: the ordered
 * document list, active-document tab, upload/remove handlers, and the two
 * derived memos (active URL + per-doc field counts).
 *
 * Extracted from PrepareFormStudio.tsx (Phase 6b god-file split).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { EsignField } from '../types';
import { esignApi, type EnvelopeDocumentRef } from '../api';

export function useDocumentManagement(params: {
  envelopeId: string;
  envelopeStatus: string;
  initialDocumentId: string;
  initialDocumentUrl: string | undefined;
  /** Fallback document URL from the envelope relation (document?.url). */
  envelopeDocumentUrl: string | undefined;
  /** Legacy documentUrl stored directly on the envelope object. */
  envelopeDocumentUrlLegacy: string | undefined;
  /** The primary document_id on the envelope (used when a field has no explicit document_id). */
  envelopePrimaryDocumentId: string | undefined;
  fields: EsignField[];
  /** Called when a document removal also drops fields belonging to that doc. */
  setFields: React.Dispatch<React.SetStateAction<EsignField[]>>;
}) {
  const {
    envelopeId,
    envelopeStatus,
    initialDocumentId,
    initialDocumentUrl,
    envelopeDocumentUrl,
    envelopeDocumentUrlLegacy,
    envelopePrimaryDocumentId,
    fields,
    setFields,
  } = params;

  const [envelopeDocuments, setEnvelopeDocuments] = useState<EnvelopeDocumentRef[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string>(initialDocumentId);
  const [docsLoading, setDocsLoading] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const addDocInputRef = useRef<HTMLInputElement>(null);

  // ── P3.4 — Load envelope documents ──
  // Fetch the ordered document list (with presigned URLs) on mount and
  // whenever the envelope id changes. Falls back gracefully on network
  // errors so the studio still works as a single-doc editor using the
  // legacy `documentUrl` prop.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDocsLoading(true);
      try {
        const { documents } = await esignApi.listEnvelopeDocuments(envelopeId);
        if (cancelled) return;
        setEnvelopeDocuments(documents);
        if (!documents.some((d) => d.document_id === activeDocumentId)) {
          setActiveDocumentId(documents[0]?.document_id ?? initialDocumentId);
        }
      } catch (err) {
        // Non-fatal — single-doc envelopes still work via the legacy prop.
        console.warn('Failed to load envelope documents:', err);
      } finally {
        if (!cancelled) setDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopeId]);

  /**
   * Resolve the active document's URL. Prefers the multi-doc list
   * (which carries presigned URLs) but falls back to the legacy
   * single-document `documentUrl` prop for back-compat.
   */
  const activeDocumentUrl = useMemo<string | undefined>(() => {
    const fromList = envelopeDocuments.find((d) => d.document_id === activeDocumentId);
    return (
      fromList?.url ?? initialDocumentUrl ?? envelopeDocumentUrl ?? envelopeDocumentUrlLegacy ?? undefined
    );
  }, [
    envelopeDocuments,
    activeDocumentId,
    initialDocumentUrl,
    envelopeDocumentUrl,
    envelopeDocumentUrlLegacy,
  ]);

  /**
   * Per-document field counts shown as small badges in the tab bar so
   * the sender can see at a glance which documents they've placed
   * fields on.
   */
  const fieldCountsByDocument = useMemo(() => {
    const counts: Record<string, number> = {};
    fields.forEach((f) => {
      const docId =
        (f as EsignField & { document_id?: string }).document_id ?? envelopePrimaryDocumentId ?? '';
      if (!docId) return;
      counts[docId] = (counts[docId] ?? 0) + 1;
    });
    return counts;
  }, [fields, envelopePrimaryDocumentId]);

  /**
   * Upload a new document to the envelope. Errors are surfaced as
   * toasts; on success the document list is refreshed and the new
   * document becomes the active tab so the user can immediately start
   * placing fields on it.
   */
  const handleAddDocument = useCallback(
    async (file: File) => {
      if (envelopeStatus !== 'draft') {
        toast.error('Only draft envelopes can have documents added');
        return;
      }
      setAddingDoc(true);
      try {
        const result = await esignApi.addEnvelopeDocument(envelopeId, file, {
          displayName: file.name.replace(/\.pdf$/i, ''),
          idempotencyKey: `add-doc-${envelopeId}-${Date.now()}`,
        });
        setEnvelopeDocuments(result.documents);
        setActiveDocumentId(result.added.document_id);
        toast.success(`Added ${file.name}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add document');
      } finally {
        setAddingDoc(false);
      }
    },
    [envelopeId, envelopeStatus],
  );

  /**
   * Remove a document from the envelope. Refuses to remove the last
   * one (server enforces the same rule). On success, also drop any
   * fields anchored to that document from local state so the UI stays
   * in sync without a full refetch.
   */
  const handleRemoveDocument = useCallback(
    async (documentId: string) => {
      if (envelopeDocuments.length <= 1) {
        toast.error('An envelope must have at least one document');
        return;
      }
      const confirmed = window.confirm(
        'Remove this document from the envelope? Any fields placed on it will also be removed.',
      );
      if (!confirmed) return;
      try {
        const { documents } = await esignApi.removeEnvelopeDocument(envelopeId, documentId);
        setEnvelopeDocuments(documents);
        setFields((prev) =>
          prev.filter((f) => {
            const docId =
              (f as EsignField & { document_id?: string }).document_id ?? envelopePrimaryDocumentId;
            return docId !== documentId;
          }),
        );
        if (activeDocumentId === documentId) {
          setActiveDocumentId(documents[0]?.document_id ?? initialDocumentId);
        }
        toast.success('Document removed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove document');
      }
    },
    [
      envelopeId,
      envelopePrimaryDocumentId,
      envelopeDocuments.length,
      activeDocumentId,
      initialDocumentId,
      setFields,
    ],
  );

  return {
    envelopeDocuments,
    activeDocumentId,
    setActiveDocumentId,
    docsLoading,
    addingDoc,
    addDocInputRef,
    activeDocumentUrl,
    fieldCountsByDocument,
    handleAddDocument,
    handleRemoveDocument,
  };
}
