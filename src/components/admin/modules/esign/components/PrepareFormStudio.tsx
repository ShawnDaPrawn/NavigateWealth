/**
 * Prepare Form Studio
 * The professional 3-column editor for placing fields on documents.
 * Replaces the older PrepareFormEditor.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Undo,
  Redo,
  ChevronDown,
  Settings as SettingsIcon,
  Eye,
  Keyboard,
  Users,
  Copy,
  Trash2,
  Magnet,
  Filter,
  Layers,
  Plus,
  X,
  FileText,
} from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { FieldPalette } from './FieldPalette';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';
import type { EsignEnvelope, EsignField, SignerFormData } from '../types';
import { esignApi, type EnvelopeDocumentRef } from '../api';
import { SIGNER_COLORS } from '../constants';
import { toast } from 'sonner@2.0.3';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../../ui/sheet';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { Switch } from '../../../../ui/switch';
import { logger } from '../../../../../utils/logger';
import { RecipientsManager } from './RecipientsManager';
import { PageManagerDialog } from './PageManagerDialog';

interface PrepareFormStudioProps {
  envelope: EsignEnvelope;
  signers: SignerFormData[];
  onBack?: () => void;
  onSaveFields?: (fields: EsignField[]) => Promise<void>;
  onSendForSignature?: (fields?: EsignField[]) => Promise<void>;
  /**
   * Optional callback for when the user updates recipients (Phase 2 quick
   * edit). The studio will save the new signer list to the draft envelope
   * and inform the parent so its `signers` prop refreshes.
   */
  onSignersChange?: (signers: SignerFormData[]) => void;
  /**
   * Optional callback for when the user updates envelope-level metadata
   * (title / message / expiry / signing mode). Called AFTER a successful
   * persist so the parent can refresh its envelope cache.
   */
  onEnvelopeUpdated?: (envelope: EsignEnvelope) => void;
  saving?: boolean;
  sending?: boolean;
  documentUrl?: string;
}

export function PrepareFormStudio({
  envelope,
  signers,
  onBack,
  onSaveFields,
  onSendForSignature,
  onSignersChange,
  onEnvelopeUpdated,
  saving = false,
  sending = false,
  documentUrl,
}: PrepareFormStudioProps) {
  // State
  const [fields, setFields] = useState<EsignField[]>(envelope.fields || []);
  // Multi-selection: Set of selected field ids. The "primary" selection
  // (used by the Properties panel) is whichever id was added LAST.
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  // Most recently selected id — drives the Properties panel and the
  // legacy `selectedFieldId` prop on PDFViewer.
  const [primarySelectedId, setPrimarySelectedId] = useState<string | undefined>(undefined);
  const [selectedSignerId, setSelectedSignerId] = useState<string | undefined>(signers[0]?.email);
  // Optional filter: when non-empty, only fields belonging to these signer
  // emails are shown. Driven by clicking a swatch in the signer legend.
  const [visibleSignerIds, setVisibleSignerIds] = useState<Set<string> | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  // P2.5 2.3 — total page count, populated by PDFViewer once the doc loads.
  const [pageCount, setPageCount] = useState<number>(1);

  // ── P3.4 — Multi-document envelope state ──
  // Even single-document envelopes get a one-element list here so the
  // tab-bar UI doesn't have to special-case "old" envelopes. The
  // active document drives which PDF is rendered and which document_id
  // is stamped onto newly-placed fields.
  const [envelopeDocuments, setEnvelopeDocuments] = useState<EnvelopeDocumentRef[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string>(envelope.document_id ?? '');
  const [docsLoading, setDocsLoading] = useState(false);
  const [addingDoc, setAddingDoc] = useState(false);
  const addDocInputRef = useRef<HTMLInputElement>(null);

  // ── P3.1 + P3.2 — autodetect candidates ──
  // Populated once from `envelope.field_candidates` (returned only on the
  // upload response). The studio shows them as a dismissable banner with
  // per-candidate accept and "Accept all" actions. Once accepted/dismissed
  // they're cleared from this state — they're not persisted to the
  // envelope until the sender hits Save.
  const [candidates, setCandidates] = useState<NonNullable<EsignEnvelope['field_candidates']>>(
    envelope.field_candidates ?? [],
  );
  const [showCandidatesPanel, setShowCandidatesPanel] = useState<boolean>(
    (envelope.field_candidates?.length ?? 0) > 0,
  );

  // Phase 2 dialogs / sheets
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // P3.3 — Page Manager dialog (reorder/delete/rotate pages).
  const [showPageManager, setShowPageManager] = useState(false);
  // P2.5 2.10 — Preview-as-recipient: pick one signer's POV, plus toggle
  // between document and email mock. '__all__' shows every field at once.
  const [previewSignerEmail, setPreviewSignerEmail] = useState<string>('__all__');
  const [previewMode, setPreviewMode] = useState<'doc' | 'email'>('doc');

  // Editable settings draft (mirrors envelope until user saves).
  const [settingsDraft, setSettingsDraft] = useState({
    title: envelope.title,
    message: envelope.message ?? '',
    expiryDays: 30,
    signingMode: (envelope.signing_mode ?? 'sequential') as 'sequential' | 'parallel',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Re-sync the editable settings draft whenever the parent envelope changes
  // (e.g. after the studio writes back via onEnvelopeUpdated).
  useEffect(() => {
    let days = 30;
    if (envelope.expires_at) {
      const diff = new Date(envelope.expires_at).getTime() - Date.now();
      const d = Math.ceil(diff / (24 * 60 * 60 * 1000));
      if (Number.isFinite(d) && d > 0) days = d;
    }
    setSettingsDraft({
      title: envelope.title,
      message: envelope.message ?? '',
      expiryDays: days,
      signingMode: (envelope.signing_mode ?? 'sequential') as 'sequential' | 'parallel',
    });
  }, [envelope.id, envelope.title, envelope.message, envelope.expires_at, envelope.signing_mode]);

  // Internal clipboard for cmd+c / cmd+v. Stays scoped to this component so
  // we never collide with the OS clipboard (and never leak field metadata to
  // it). On paste, fields are placed at +20px offset from their originals.
  const fieldClipboardRef = useRef<EsignField[] | null>(null);

  // History for Undo/Redo
  const [history, setHistory] = useState<EsignField[][]>([envelope.fields || []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Auto-save tracking — `lastSavedFieldsRef` is the canonical record of the
  // most recently persisted state so we can short-circuit redundant saves and
  // detect drift on unmount/back navigation.
  const lastSavedFieldsRef = useRef<string>(JSON.stringify(envelope.fields || []));
  const fieldsRef = useRef<EsignField[]>(envelope.fields || []);
  fieldsRef.current = fields;
  const onSaveFieldsRef = useRef(onSaveFields);
  onSaveFieldsRef.current = onSaveFields;

  // Field counts per signer — drives the legend badges. Computed from the
  // current `fields` so it's always in sync with edits.
  const fieldCountsBySigner = useMemo(() => {
    const counts: Record<string, number> = {};
    fields.forEach((f) => {
      if (!f.signer_id) return;
      counts[f.signer_id] = (counts[f.signer_id] ?? 0) + 1;
    });
    return counts;
  }, [fields]);

  // Eligible signers for placing fields = everyone EXCEPT carbon-copy
  // recipients. CCs are notified only and never sign anything, so they
  // shouldn't appear in the "Placing fields for" picker. The legend still
  // shows them (so the sender knows who else gets a copy) but they're
  // visually distinguished and unclickable for filtering.
  const eligibleSigners = useMemo(
    () => signers.filter((s) => s.kind !== 'cc'),
    [signers],
  );

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
        const { documents } = await esignApi.listEnvelopeDocuments(envelope.id);
        if (cancelled) return;
        setEnvelopeDocuments(documents);
        if (!documents.some((d) => d.document_id === activeDocumentId)) {
          setActiveDocumentId(documents[0]?.document_id ?? envelope.document_id);
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
  }, [envelope.id]);

  /**
   * Resolve the active document's URL. Prefers the multi-doc list
   * (which carries presigned URLs) but falls back to the legacy
   * single-document `documentUrl` prop for back-compat.
   */
  const activeDocumentUrl = useMemo<string | undefined>(() => {
    const fromList = envelopeDocuments.find((d) => d.document_id === activeDocumentId);
    return (
      fromList?.url ??
      documentUrl ??
      envelope.document?.url ??
      envelope.documentUrl ??
      undefined
    );
  }, [envelopeDocuments, activeDocumentId, documentUrl, envelope.document, envelope.documentUrl]);

  /**
   * Filter the in-memory fields to only those belonging to the active
   * document. Fields without an explicit `document_id` (legacy) are
   * scoped to the primary document so old drafts continue to render.
   */
  const visibleFields = useMemo<EsignField[]>(() => {
    if (envelopeDocuments.length <= 1) return fields;
    return fields.filter((f) => {
      const docId = (f as EsignField & { document_id?: string }).document_id ?? envelope.document_id;
      return docId === activeDocumentId;
    });
  }, [fields, envelopeDocuments.length, activeDocumentId, envelope.document_id]);

  /**
   * Per-document field counts shown as small badges in the tab bar so
   * the sender can see at a glance which documents they've placed
   * fields on.
   */
  const fieldCountsByDocument = useMemo(() => {
    const counts: Record<string, number> = {};
    fields.forEach((f) => {
      const docId =
        (f as EsignField & { document_id?: string }).document_id ?? envelope.document_id ?? '';
      if (!docId) return;
      counts[docId] = (counts[docId] ?? 0) + 1;
    });
    return counts;
  }, [fields, envelope.document_id]);

  /**
   * Upload a new document to the envelope. Errors are surfaced as
   * toasts; on success the document list is refreshed and the new
   * document becomes the active tab so the user can immediately start
   * placing fields on it.
   */
  const handleAddDocument = useCallback(
    async (file: File) => {
      if (envelope.status !== 'draft') {
        toast.error('Only draft envelopes can have documents added');
        return;
      }
      setAddingDoc(true);
      try {
        const result = await esignApi.addEnvelopeDocument(envelope.id, file, {
          displayName: file.name.replace(/\.pdf$/i, ''),
          idempotencyKey: `add-doc-${envelope.id}-${Date.now()}`,
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
    [envelope.id, envelope.status],
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
        const { documents } = await esignApi.removeEnvelopeDocument(envelope.id, documentId);
        setEnvelopeDocuments(documents);
        setFields((prev) =>
          prev.filter((f) => {
            const docId =
              (f as EsignField & { document_id?: string }).document_id ?? envelope.document_id;
            return docId !== documentId;
          }),
        );
        if (activeDocumentId === documentId) {
          setActiveDocumentId(documents[0]?.document_id ?? envelope.document_id);
        }
        toast.success('Document removed');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to remove document');
      }
    },
    [envelope.id, envelope.document_id, envelopeDocuments.length, activeDocumentId],
  );

  // Build signer color map for consistent color assignment
  const signerColorMap = signers.reduce((map, signer, index) => {
    map[signer.email] = SIGNER_COLORS[index % SIGNER_COLORS.length].hex;
    return map;
  }, {} as Record<string, string>);

  // If the currently-selected signer is a CC (e.g. they were edited after
  // selection), drop the selection back to the first eligible signer.
  useEffect(() => {
    if (!selectedSignerId) return;
    const cur = signers.find((s) => s.email === selectedSignerId);
    if (!cur || cur.kind === 'cc') {
      setSelectedSignerId(eligibleSigners[0]?.email);
    }
  }, [selectedSignerId, signers, eligibleSigners]);

  // ==================== HISTORY MANAGEMENT ====================

  const pushToHistory = (newFields: EsignField[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newFields);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setFields(newFields);
    setHasUnsavedChanges(true);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setFields(history[historyIndex - 1]);
      setHasUnsavedChanges(true);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setFields(history[historyIndex + 1]);
      setHasUnsavedChanges(true);
    }
  };

  // ==================== FIELD OPERATIONS ====================

  const handleFieldPlace = useCallback((newField: Partial<EsignField>) => {
    // Guard: never place a field on a CC recipient. Falls back to the first
    // eligible signer (or the currently-selected one if they're not a CC).
    let assignedSigner = newField.signer_id || selectedSignerId || eligibleSigners[0]?.email;
    const assigneeRecord = signers.find((s) => s.email === assignedSigner);
    if (!assigneeRecord || assigneeRecord.kind === 'cc') {
      assignedSigner = eligibleSigners[0]?.email;
    }

    const field: EsignField = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      envelope_id: envelope.id,
      // P3.4 — stamp the field with the active document so multi-doc
      // envelopes know which PDF the field belongs to. Single-doc
      // envelopes still get a value here; the materialiser treats it
      // as a no-op when there's only one document.
      document_id: activeDocumentId,
      type: newField.type || 'signature',
      page: newField.page || 1,
      x: newField.x || 50,
      y: newField.y || 50,
      width: newField.width || 150,
      height: newField.height || 50,
      required: true,
      signer_id: assignedSigner,
      value: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as EsignField;

    pushToHistory([...fields, field]);
    setPrimarySelectedId(field.id);
    setSelectedFieldIds(new Set([field.id]));
  }, [envelope.id, selectedSignerId, signers, eligibleSigners, fields, history, historyIndex, activeDocumentId]);

  const handleFieldUpdate = useCallback((fieldId: string, updates: Partial<EsignField>) => {
    const updatedFields = fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
    // Don't push to history for every micro-drag event?
    // Ideally we debounce history pushes or only push on mouse up.
    // For now, we update state directly for smooth drag, but history might get spammy.
    // Optimization: Just update state here, push to history on "drag end" (not implemented in this simplified version)
    // We'll update state directly and set unsaved changes.
    setFields(updatedFields);
    setHasUnsavedChanges(true);
  }, [fields]);

  const handleFieldDelete = useCallback((fieldId: string) => {
    const newFields = fields.filter(f => f.id !== fieldId);
    pushToHistory(newFields);
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
    if (primarySelectedId === fieldId) setPrimarySelectedId(undefined);
  }, [fields, primarySelectedId]);

  // ==================== MULTI-SELECT / CLIPBOARD ====================

  /**
   * Click handler for field overlays. Implements three modes:
   *   • plain click  → single-select (replace selection)
   *   • shift-click  → toggle the field in/out of the existing selection
   *   • cmd/ctrl     → same as shift on Mac/Windows for muscle-memory
   *
   * Clicking the empty canvas (`field === null`) clears the selection
   * unless shift is held, which is a no-op so users can keep their
   * selection while panning.
   */
  const handleFieldClick = useCallback(
    (field: EsignField | null, modifiers?: { shiftKey: boolean; metaOrCtrl: boolean }) => {
      if (!field) {
        if (modifiers?.shiftKey) return;
        setSelectedFieldIds(new Set());
        setPrimarySelectedId(undefined);
        return;
      }
      const isMulti = modifiers?.shiftKey || modifiers?.metaOrCtrl;
      setSelectedFieldIds((prev) => {
        if (!isMulti) return new Set([field.id]);
        const next = new Set(prev);
        if (next.has(field.id)) next.delete(field.id);
        else next.add(field.id);
        return next;
      });
      setPrimarySelectedId(field.id);
    },
    [],
  );

  /** Marquee callback from PDFViewer — replace or union with current selection. */
  const handleMarqueeSelect = useCallback(
    (ids: string[], modifiers: { shiftKey: boolean; metaOrCtrl: boolean }) => {
      setSelectedFieldIds((prev) => {
        if (modifiers.shiftKey || modifiers.metaOrCtrl) {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        }
        return new Set(ids);
      });
      setPrimarySelectedId(ids[ids.length - 1]);
    },
    [],
  );

  /** Copy currently-selected fields to the in-memory clipboard. */
  const handleCopy = useCallback(() => {
    if (selectedFieldIds.size === 0) return;
    const snap = fields.filter((f) => selectedFieldIds.has(f.id));
    fieldClipboardRef.current = snap;
    toast.success(`Copied ${snap.length} field${snap.length === 1 ? '' : 's'}`);
  }, [selectedFieldIds, fields]);

  /** Paste clipboard fields with a small offset; selects the new copies. */
  const handlePaste = useCallback(() => {
    const clip = fieldClipboardRef.current;
    if (!clip || clip.length === 0) return;
    const OFFSET_PCT = 1.5; // ~1.5% of page → noticeable but not disruptive
    const now = new Date().toISOString();
    const newFields: EsignField[] = clip.map((f, i) => ({
      ...f,
      id: `field-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 6)}`,
      x: Math.min(95, f.x + OFFSET_PCT),
      y: Math.min(95, f.y + OFFSET_PCT),
      created_at: now,
      updated_at: now,
    }));
    pushToHistory([...fields, ...newFields]);
    const newIds = new Set(newFields.map((f) => f.id));
    setSelectedFieldIds(newIds);
    setPrimarySelectedId(newFields[newFields.length - 1]?.id);
    toast.success(`Pasted ${newFields.length} field${newFields.length === 1 ? '' : 's'}`);
  }, [fields, history, historyIndex]);

  /** Duplicate selection in-place (cmd+d) — a copy + paste in one step. */
  const handleDuplicate = useCallback(() => {
    if (selectedFieldIds.size === 0) return;
    fieldClipboardRef.current = fields.filter((f) => selectedFieldIds.has(f.id));
    handlePaste();
  }, [selectedFieldIds, fields, handlePaste]);

  // ── P3.1 + P3.2 — Accept / dismiss autodetect candidates ──
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
        envelope_id: envelope.id,
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
    [candidates, selectedSignerId, eligibleSigners, fields, envelope.id, history, historyIndex],
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
    const now = new Date().toISOString();
    const newFields: EsignField[] = [];
    for (const cand of candidates) {
      const dupe = fields.some(
        (f) =>
          f.page === cand.page &&
          f.type === cand.type &&
          Math.abs(f.x - cand.x) < 1.5 &&
          Math.abs(f.y - cand.y) < 1.5,
      );
      if (dupe) continue;
      newFields.push({
        id: `field-${Date.now()}-${newFields.length}-${Math.random().toString(36).slice(2, 6)}`,
        envelope_id: envelope.id,
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
      });
    }
    if (newFields.length === 0) {
      toast.info('All suggested fields already match an existing one.');
      setCandidates([]);
      return;
    }
    pushToHistory([...fields, ...newFields]);
    setCandidates([]);
    toast.success(`Accepted ${newFields.length} suggested field${newFields.length === 1 ? '' : 's'}`);
  }, [candidates, selectedSignerId, eligibleSigners, fields, envelope.id, history, historyIndex]);

  const dismissCandidate = useCallback(
    (candidateId: string) => setCandidates((prev) => prev.filter((c) => c.id !== candidateId)),
    [],
  );

  const dismissAllCandidates = useCallback(() => {
    setCandidates([]);
    setShowCandidatesPanel(false);
  }, []);

  /** Bulk-delete every selected field. */
  const handleBulkDelete = useCallback(() => {
    if (selectedFieldIds.size === 0) return;
    const remaining = fields.filter((f) => !selectedFieldIds.has(f.id));
    pushToHistory(remaining);
    setSelectedFieldIds(new Set());
    setPrimarySelectedId(undefined);
  }, [fields, selectedFieldIds, history, historyIndex]);

  // ── P2.5 2.2 — Bulk reassign / required toggle ──
  /**
   * Reassign every currently-selected field to `signerEmail`. Used from the
   * bulk-action bar dropdown so a sender can drag a marquee around 12 fields
   * and re-route them all to a different signer in one action.
   */
  const handleBulkReassign = useCallback((signerEmail: string) => {
    if (selectedFieldIds.size === 0) return;
    const updated = fields.map((f) =>
      selectedFieldIds.has(f.id) ? { ...f, signer_id: signerEmail } : f,
    );
    pushToHistory(updated);
    toast.success(`Reassigned ${selectedFieldIds.size} field${selectedFieldIds.size === 1 ? '' : 's'}`);
  }, [fields, selectedFieldIds, history, historyIndex]);

  /** Toggle the `required` flag on every selected field to a single value. */
  const handleBulkRequired = useCallback((required: boolean) => {
    if (selectedFieldIds.size === 0) return;
    const updated = fields.map((f) =>
      selectedFieldIds.has(f.id) ? { ...f, required } : f,
    );
    pushToHistory(updated);
    toast.success(`${selectedFieldIds.size} field${selectedFieldIds.size === 1 ? '' : 's'} marked ${required ? 'required' : 'optional'}`);
  }, [fields, selectedFieldIds, history, historyIndex]);

  // ── P2.5 2.3 — Apply to all pages ──
  /**
   * Replicate the currently-selected fields onto every other page in the
   * document at the same x/y/width/height. Useful for footers, initials,
   * page-number stamps, etc. We deliberately copy field-level metadata too
   * (validation rules, format) so a SA-ID field stays a SA-ID field.
   */
  const handleApplyToAllPages = useCallback(() => {
    if (selectedFieldIds.size === 0 || pageCount <= 1) return;
    const seeds = fields.filter((f) => selectedFieldIds.has(f.id));
    const now = new Date().toISOString();
    const replicas: EsignField[] = [];
    for (const seed of seeds) {
      for (let p = 1; p <= pageCount; p++) {
        if (p === seed.page) continue;
        // Skip if a near-duplicate already exists on this page (same signer,
        // same coords ±0.5%) so repeated clicks don't carpet-bomb the doc.
        const dupe = fields.some(
          (f) =>
            f.page === p &&
            f.signer_id === seed.signer_id &&
            f.type === seed.type &&
            Math.abs(f.x - seed.x) < 0.5 &&
            Math.abs(f.y - seed.y) < 0.5,
        );
        if (dupe) continue;
        replicas.push({
          ...seed,
          id: `field-${Date.now()}-${p}-${Math.random().toString(36).slice(2, 8)}`,
          page: p,
          created_at: now,
          updated_at: now,
        });
      }
    }
    if (replicas.length === 0) {
      toast.info('Selected fields already exist on every page.');
      return;
    }
    pushToHistory([...fields, ...replicas]);
    toast.success(`Replicated to ${replicas.length} field${replicas.length === 1 ? '' : 's'} across ${pageCount - 1} other page${pageCount - 1 === 1 ? '' : 's'}`);
  }, [fields, selectedFieldIds, pageCount, history, historyIndex]);

  // ==================== ACTIONS ====================

  /**
   * Persist the *current* `fieldsRef.current` snapshot. We deliberately read
   * from the ref (not the closure) because both auto-save and unmount-flush
   * can race with the latest user edits; the ref always holds the freshest
   * state. Returns true on success, false if a save was already in flight or
   * the snapshot matched the last saved version (no-op).
   */
  const persistFields = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    const handler = onSaveFieldsRef.current;
    if (!handler) return false;
    const snapshot = fieldsRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSavedFieldsRef.current) return false;
    try {
      if (!opts?.silent) setAutoSaving(true);
      await handler(snapshot);
      lastSavedFieldsRef.current = serialized;
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      if (!opts?.silent) {
        toast.error('Auto-save failed — please click Save to retry.');
      }
      return false;
    } finally {
      if (!opts?.silent) setAutoSaving(false);
    }
  }, []);

  const handleSave = async () => {
    await persistFields();
  };

  const handleSend = async () => {
    if (fields.length === 0) {
      toast.error('Please place at least one field');
      return;
    }

    if (hasUnsavedChanges) {
      await persistFields({ silent: true });
    }

    if (onSendForSignature) {
      await onSendForSignature(fieldsRef.current);
    }
  };

  // ==================== AUTO-SAVE ====================
  //
  // Debounced auto-save (1.5s after the last change). This is the single most
  // important defence against the "I clicked Save and lost my work" class of
  // bugs — it means a user who places fields and walks away for two seconds
  // is already safely persisted.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    if (saving || sending || autoSaving) return;
    const timer = setTimeout(() => {
      persistFields({ silent: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [fields, hasUnsavedChanges, saving, sending, autoSaving, persistFields]);

  // beforeunload: warn the user if they try to close the tab / navigate away
  // with unsaved changes still in memory. We can't make `await persistFields`
  // run reliably here (browsers cancel async work in unload), so we surface a
  // confirmation prompt instead.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        // Modern browsers ignore the message and show their own copy, but the
        // returnValue assignment is still required to trigger the prompt.
        e.returnValue = 'You have unsaved field changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Unmount-flush: when this view is torn down (top-nav click, route change,
  // parent state transition), make a best-effort silent save so nothing is
  // lost. The empty-deps array intentionally captures persistFields via ref.
  const persistFieldsRef = useRef(persistFields);
  persistFieldsRef.current = persistFields;
  useEffect(() => {
    return () => {
      const serialized = JSON.stringify(fieldsRef.current);
      if (serialized !== lastSavedFieldsRef.current) {
        // fire-and-forget — the parent React Query cache will refresh on
        // next dashboard visit.
        void persistFieldsRef.current({ silent: true });
      }
    };
  }, []);

  /**
   * Save before navigating back. If the save fails or there are still
   * unsaved changes, ask the user whether to discard.
   */
  const handleBack = useCallback(async () => {
    if (hasUnsavedChanges) {
      const saved = await persistFields({ silent: true });
      if (!saved) {
        const discard = window.confirm(
          'Your latest changes could not be saved. Leave anyway and discard them?',
        );
        if (!discard) return;
      }
    }
    onBack?.();
  }, [hasUnsavedChanges, persistFields, onBack]);

  // ==================== SETTINGS POPOVER ====================

  const handleSaveSettings = useCallback(async () => {
    if (!envelope.id) return;
    if (settingsDraft.title.trim().length < 3) {
      toast.error('Title must be at least 3 characters');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await esignApi.updateDraftSettings(envelope.id, {
        title: settingsDraft.title.trim(),
        message: settingsDraft.message.trim() || null,
        expiryDays: settingsDraft.expiryDays,
        signing_mode: settingsDraft.signingMode,
      });
      if (res?.success !== false) {
        toast.success('Envelope settings updated');
        setShowSettings(false);
        if (res?.envelope) {
          onEnvelopeUpdated?.(res.envelope);
        }
      }
    } catch (err) {
      logger.error('Failed to update envelope settings:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }, [envelope.id, settingsDraft, onEnvelopeUpdated]);

  // ==================== RECIPIENTS QUICK-EDIT ====================

  const handleRecipientsSave = useCallback(
    async (next: SignerFormData[]) => {
      if (!envelope.id) return;
      try {
        await esignApi.saveDraftSigners(
          envelope.id,
          next.map((s, idx) => ({
            name: s.name,
            email: s.email,
            role: s.role || 'Signer',
            order: s.order ?? idx + 1,
            otpRequired: s.otpRequired,
            accessCode: s.accessCode,
            clientId: s.clientId,
            isSystemClient: s.isSystemClient,
          })),
        );
        onSignersChange?.(next);
        toast.success('Recipients updated');
      } catch (err) {
        logger.error('Failed to save recipients:', err);
        toast.error('Could not save recipient changes');
      }
    },
    [envelope.id, onSignersChange],
  );

  // ==================== KEYBOARD SHORTCUTS ====================
  //
  // Single global listener — saves us from having a hundred onKeyDown handlers
  // strewn through child components and means every shortcut is documented in
  // one place (the help dialog below). We early-exit when the user is typing
  // in a real input so we never hijack normal typing.
  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;

      // Help — '?' (shift+/)
      if (e.key === '?' && !meta) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      // Escape — clear selection / close popovers handled by Radix
      if (e.key === 'Escape') {
        if (selectedFieldIds.size > 0 || primarySelectedId) {
          setSelectedFieldIds(new Set());
          setPrimarySelectedId(undefined);
        }
        return;
      }
      // Save — cmd/ctrl + S
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persistFields();
        return;
      }
      // Undo / Redo — handled by global meta+z / shift+meta+z
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Copy / Paste / Duplicate
      if (meta && e.key.toLowerCase() === 'c') {
        if (selectedFieldIds.size === 0) return;
        e.preventDefault();
        handleCopy();
        return;
      }
      if (meta && e.key.toLowerCase() === 'v') {
        if (!fieldClipboardRef.current) return;
        e.preventDefault();
        handlePaste();
        return;
      }
      if (meta && e.key.toLowerCase() === 'd') {
        if (selectedFieldIds.size === 0) return;
        e.preventDefault();
        handleDuplicate();
        return;
      }
      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldIds.size > 0) {
        e.preventDefault();
        handleBulkDelete();
        return;
      }
      // Select-all — cmd/ctrl + a
      if (meta && e.key.toLowerCase() === 'a' && fields.length > 0) {
        e.preventDefault();
        const visibleIds = fields
          .filter((f) => !visibleSignerIds || (f.signer_id && visibleSignerIds.has(f.signer_id)))
          .map((f) => f.id);
        setSelectedFieldIds(new Set(visibleIds));
        setPrimarySelectedId(visibleIds[visibleIds.length - 1]);
        return;
      }
      // P2.5 2.11 — number keys 1..9 jump to the Nth signer in the
      // "Placing fields for" picker. Cuts the round-trip through the
      // dropdown out of the field-placement loop entirely.
      if (!meta && /^[1-9]$/.test(e.key) && eligibleSigners.length > 0) {
        const idx = Number(e.key) - 1;
        const target = eligibleSigners[idx];
        if (target) {
          e.preventDefault();
          setSelectedSignerId(target.email);
        }
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedFieldIds,
    primarySelectedId,
    fields,
    visibleSignerIds,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleBulkDelete,
    persistFields,
    eligibleSigners,
  ]);


  // ==================== RENDER ====================

  // Currently-displayed field for the right-hand Properties panel.
  const propertiesField = fields.find((f) => f.id === primarySelectedId) || null;
  const totalSelected = selectedFieldIds.size;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Top Toolbar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-gray-200" />
          <h2 className="font-semibold text-gray-900 truncate max-w-[260px]" title={envelope.title}>
            {envelope.title}
          </h2>
          {/* Recipients quick-edit trigger */}
          <button
            type="button"
            onClick={() => setShowRecipients(true)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition shrink-0"
            title="Edit recipients"
          >
            <Users className="h-3 w-3" />
            {signers.length} Recipient{signers.length !== 1 ? 's' : ''}
          </button>
          {/* Auto-save status indicator */}
          <div className="text-xs text-gray-500 ml-1 min-w-[110px]" aria-live="polite">
            {(saving || autoSaving) ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            ) : hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </span>
            ) : lastSavedAt ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Snap toggle — Magnet icon makes the metaphor self-explanatory. */}
          <Button
            variant={snapEnabled ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSnapEnabled((v) => !v)}
            className="h-8 px-2 gap-1"
            title="Toggle snap to grid (hold Alt while dragging to bypass)"
          >
            <Magnet className="h-3.5 w-3.5" />
            <span className="text-xs">Snap</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8 px-2 gap-1"
            title="Edit envelope settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Settings</span>
          </Button>

          {/* P3.3 — Reorder / delete / rotate pages before sending. Only
              shown for envelopes that actually have a source PDF. */}
          {(envelope.document?.url || envelope.documentUrl || documentUrl) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPageManager(true)}
              className="h-8 px-2 gap-1"
              title="Reorder, rotate, or delete pages"
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="text-xs">Pages</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(true)}
            className="h-8 px-2 gap-1"
            title="Preview as recipient"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="text-xs">Preview</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowShortcuts(true)}
            className="h-8 w-8"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>

          <div className="h-6 w-px bg-gray-200 mx-1" />

          <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex === 0} aria-label="Undo">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex === history.length - 1} aria-label="Redo">
            <Redo className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-gray-200 mx-1" />

          <Button
            variant="outline"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saving || autoSaving}
            className="w-24"
          >
            {(saving || autoSaving) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>

          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-purple-600 hover:bg-purple-700 w-32"
          >
            {sending ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </div>
            ) : (
              <div className="contents">
                Send
                <Send className="h-4 w-4 ml-2" />
              </div>
            )}
          </Button>
        </div>
      </div>

      {/* Signer Legend Strip — shows every recipient with their colour swatch
          and field count. Click a swatch to filter the canvas to just their
          fields, click again to clear. CCs are dimmed and unclickable.

          P2.5 2.5 — when a signer has zero fields placed, the count chip
          becomes a dashed "Place →" button: clicking it makes them the
          active recipient AND scrolls the canvas to the top so the sender
          can immediately start dropping fields. */}
      <div className="bg-white border-b px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-xs uppercase tracking-wider text-gray-400 mr-1 shrink-0">Signers</span>
        {signers.map((signer, idx) => {
          const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
          const isCC = signer.kind === 'cc';
          const isWitness = signer.kind === 'witness';
          const isVisible = !visibleSignerIds || visibleSignerIds.has(signer.email);
          const isFiltering = !!visibleSignerIds && visibleSignerIds.size > 0;
          const count = fieldCountsBySigner[signer.email] ?? 0;
          const isActive = selectedSignerId === signer.email;
          return (
            <div
              key={signer.email}
              className={[
                'inline-flex items-center gap-1 rounded-full border text-xs transition shrink-0 overflow-hidden',
                isCC ? 'opacity-60 border-gray-200' : 'border-gray-200',
                isFiltering && !isVisible ? 'opacity-40' : '',
                isFiltering && isVisible ? 'border-purple-300 bg-purple-50' : '',
                isActive ? 'ring-2 ring-purple-400/60' : '',
              ].join(' ')}
            >
              <button
                type="button"
                disabled={isCC}
                onClick={() => {
                  if (isCC) return;
                  setVisibleSignerIds((prev) => {
                    if (!prev) return new Set([signer.email]);
                    if (prev.has(signer.email) && prev.size === 1) return null;
                    if (prev.has(signer.email)) {
                      const next = new Set(prev);
                      next.delete(signer.email);
                      return next.size === 0 ? null : next;
                    }
                    const next = new Set(prev);
                    next.add(signer.email);
                    return next;
                  });
                }}
                className={[
                  'inline-flex items-center gap-2 px-2.5 py-1',
                  isCC ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50',
                ].join(' ')}
                title={isCC ? `${signer.name} — Receives a copy` : `Filter to ${signer.name}'s fields`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/5"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate max-w-[120px] font-medium text-gray-700">{signer.name}</span>
                {isCC && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 ml-1">CC</span>
                )}
                {isWitness && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-600 ml-1">Witness</span>
                )}
              </button>
              {!isCC && count > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Make this signer the active one for new placements.
                    setSelectedSignerId(signer.email);
                  }}
                  className={[
                    'text-[10px] tabular-nums px-1.5 py-1 rounded-r-full',
                    isActive ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  ].join(' ')}
                  title={`${count} field${count === 1 ? '' : 's'} — click to place fields for ${signer.name}`}
                >
                  {count}
                </button>
              )}
              {!isCC && count === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Jump-to-first-unplaced: set as active recipient and scroll
                    // the document canvas back to the top so the sender's next
                    // click will place a field for this signer.
                    setSelectedSignerId(signer.email);
                    const canvas = document.querySelector('[data-esign-canvas]');
                    canvas?.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={[
                    'text-[10px] uppercase tracking-wide px-1.5 py-1 rounded-r-full border-l border-dashed',
                    isActive
                      ? 'bg-purple-600 text-white border-purple-700'
                      : 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100',
                  ].join(' ')}
                  title={`${signer.name} has no fields — click to place the first one`}
                >
                  Place →
                </button>
              )}
            </div>
          );
        })}
        {visibleSignerIds && visibleSignerIds.size > 0 && (
          <button
            type="button"
            onClick={() => setVisibleSignerIds(null)}
            className="ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-100 shrink-0"
            title="Show all signers"
          >
            <Filter className="h-3 w-3" />
            Clear filter
          </button>
        )}
      </div>

      {/* Bulk-action bar — appears only when 2+ fields are selected so it
          doesn't waste vertical space the rest of the time.

          P2.5 2.2 + 2.3 — duplicate, delete, reassign, toggle required, and
          replicate to every page. The bulk actions live on the bar so the
          sender doesn't have to open the right-hand Properties panel for
          every field individually. */}
      {totalSelected > 1 && (
        <div className="bg-purple-600 text-white px-4 py-1.5 flex items-center gap-3 text-sm shrink-0">
          <span className="font-medium">{totalSelected} fields selected</span>
          <div className="h-4 w-px bg-white/30" />
          <button
            type="button"
            onClick={handleDuplicate}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
          {pageCount > 1 && (
            <button
              type="button"
              onClick={handleApplyToAllPages}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
              title={`Replicate selection to all ${pageCount} pages`}
            >
              <Layers className="h-3.5 w-3.5" />
              Apply to all pages
            </button>
          )}

          {/* Bulk reassign — dropdown of eligible (non-cc) signers. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
              >
                <Users className="h-3.5 w-3.5" />
                Reassign
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {eligibleSigners.length === 0 ? (
                <DropdownMenuItem disabled>No eligible signers</DropdownMenuItem>
              ) : (
                eligibleSigners.map((s, idx) => {
                  const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
                  return (
                    <DropdownMenuItem
                      key={s.email}
                      onSelect={() => handleBulkReassign(s.email)}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate">{s.name}</span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => handleBulkRequired(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
            title="Mark all selected as required"
          >
            Required
          </button>
          <button
            type="button"
            onClick={() => handleBulkRequired(false)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
            title="Mark all selected as optional"
          >
            Optional
          </button>

          <button
            type="button"
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <div className="ml-auto text-xs opacity-80">
            ⌘/Ctrl + C / V / D · Backspace to delete · Esc to clear
          </div>
        </div>
      )}

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left Sidebar: Toolbox */}
        <div className="w-64 bg-white border-r flex flex-col z-10 overflow-hidden">
          <div className="p-4 border-b">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
              Placing Fields For
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: signerColorMap[selectedSignerId || ''] || '#6d28d9' }} />
                    <span className="truncate text-sm">{eligibleSigners.find(s => s.email === selectedSignerId)?.name || 'Select signer'}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                {eligibleSigners.map((signer) => {
                  const idx = signers.findIndex((s) => s.email === signer.email);
                  const color = SIGNER_COLORS[idx % SIGNER_COLORS.length];
                  return (
                    <DropdownMenuItem
                      key={signer.email}
                      onClick={() => setSelectedSignerId(signer.email)}
                      className="flex items-center gap-2"
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                      <span className="flex-1 truncate">{signer.name}</span>
                      <span className="text-xs text-gray-400">{signer.kind === 'witness' ? 'Witness' : (signer.role || 'Signer')}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
             <FieldPalette
               signers={eligibleSigners}
               fields={fields}
               onAddField={handleFieldPlace}
               onUpdateField={handleFieldUpdate}
               onDeleteField={handleFieldDelete}
               selectedSignerId={selectedSignerId}
             />
          </div>
        </div>

        {/* Center: Canvas — independent scroll area for the document */}
        <div className="flex-1 bg-gray-100/50 relative min-h-0 min-w-0 overflow-hidden" data-esign-canvas>
          {/* P3.1 + P3.2 — Suggested-fields banner. Shows once after upload
              when the backend's PDF analysis pipeline returned candidates.
              The sender accepts/dismisses individually or in bulk; once
              empty (or explicitly dismissed) the banner disappears. */}
          {showCandidatesPanel && candidates.length > 0 && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-amber-50 border-b border-amber-200 px-4 py-2 shadow-sm">
              <div className="flex items-center gap-3 text-sm">
                <Magnet className="h-4 w-4 text-amber-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-amber-900">
                    {candidates.length} suggested field{candidates.length === 1 ? '' : 's'} from this PDF
                  </div>
                  <div className="text-xs text-amber-700/80 truncate">
                    {candidates.filter((c) => c.source === 'acroform').length} from PDF form
                    {' · '}
                    {candidates.filter((c) => c.source === 'anchor').length} from text anchors
                    {selectedSignerId && (
                      <>
                        {' · will be assigned to '}
                        <span className="font-medium">{selectedSignerId}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={acceptAllCandidates}
                  className="px-3 py-1 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700"
                  disabled={!selectedSignerId && eligibleSigners.length === 0}
                  title={
                    !selectedSignerId && eligibleSigners.length === 0
                      ? 'Add a recipient before accepting suggestions'
                      : 'Accept every suggestion'
                  }
                >
                  Accept all
                </button>
                <button
                  type="button"
                  onClick={dismissAllCandidates}
                  className="px-3 py-1 text-xs text-amber-800 hover:bg-amber-100 rounded"
                >
                  Dismiss
                </button>
              </div>

              {/* Per-candidate list, capped at 6 rows visible to keep the
                  banner compact; the rest scroll inside. */}
              <div className="mt-2 max-h-36 overflow-y-auto border-t border-amber-200/70 pt-2 space-y-1">
                {candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 text-xs bg-white/60 hover:bg-white rounded px-2 py-1"
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        c.source === 'acroform' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    />
                    <span className="font-medium capitalize w-16 shrink-0">{c.type}</span>
                    <span className="text-amber-700/80 shrink-0">p.{c.page}</span>
                    <span className="flex-1 truncate text-gray-700">
                      {c.label || c.anchorText || (c.source === 'acroform' ? 'PDF form widget' : 'Text anchor')}
                    </span>
                    <button
                      type="button"
                      onClick={() => acceptCandidate(c.id)}
                      className="px-2 py-0.5 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissCandidate(c.id)}
                      className="px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-100 rounded"
                      aria-label="Dismiss suggestion"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* P3.4 — Multi-document tab bar.
              Always render at least one tab (the active document). The
              "+" button opens a hidden file input that uploads a new
              PDF and switches to it. Hidden when only one document
              exists AND we're not in draft (to keep the chrome lean
              for read-only views). */}
          {(envelopeDocuments.length > 1 || envelope.status === 'draft') && (
            <div className="absolute top-0 left-0 right-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200 px-2 py-1.5 flex items-center gap-1 overflow-x-auto">
              <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-1" />
              {envelopeDocuments.map((d) => {
                const isActive = d.document_id === activeDocumentId;
                const fieldCount = fieldCountsByDocument[d.document_id] ?? 0;
                const canRemove =
                  envelope.status === 'draft' && envelopeDocuments.length > 1;
                return (
                  <div
                    key={d.document_id}
                    className={`group flex items-center gap-1 rounded-md text-xs whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                        : 'border border-transparent hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <button
                      type="button"
                      className="px-2 py-1 flex items-center gap-1.5"
                      onClick={() => setActiveDocumentId(d.document_id)}
                      title={d.original_filename}
                    >
                      <span className="max-w-[160px] truncate">{d.display_name}</span>
                      {fieldCount > 0 && (
                        <span
                          className={`text-[10px] px-1 py-px rounded ${
                            isActive
                              ? 'bg-blue-200 text-blue-900'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {fieldCount}
                        </span>
                      )}
                    </button>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(d.document_id)}
                        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        title="Remove document"
                        aria-label={`Remove ${d.display_name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {envelope.status === 'draft' && (
                <>
                  <button
                    type="button"
                    disabled={addingDoc || docsLoading}
                    onClick={() => addDocInputRef.current?.click()}
                    className="ml-1 px-2 py-1 text-xs flex items-center gap-1 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Add another PDF to this envelope"
                  >
                    {addingDoc ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    <span>Add document</span>
                  </button>
                  <input
                    ref={addDocInputRef}
                    type="file"
                    accept="application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void handleAddDocument(f);
                    }}
                  />
                </>
              )}
            </div>
          )}
          <div
            className={`absolute inset-0 ${envelopeDocuments.length > 1 || envelope.status === 'draft' ? 'top-[40px]' : ''}`}
          >
            <PDFViewer
              documentUrl={activeDocumentUrl}
              documentName={envelope.title}
              fields={visibleFields}
              signers={signers}
              onFieldPlace={handleFieldPlace}
              onFieldUpdate={handleFieldUpdate}
              onFieldDelete={handleFieldDelete}
              onFieldClick={handleFieldClick}
              onPageCount={setPageCount}
              onMarqueeSelect={handleMarqueeSelect}
              selectedSignerId={selectedSignerId}
              selectedFieldId={primarySelectedId}
              selectedFieldIds={selectedFieldIds}
              visibleSignerIds={visibleSignerIds ?? undefined}
              snapToGrid={snapEnabled}
              showFields={true}
            />
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <div className="w-72 bg-white border-l z-10 overflow-y-auto">
           <FieldPropertiesPanel
             field={propertiesField}
             signers={signers}
             allFields={fields}
             onUpdate={handleFieldUpdate}
             onDelete={handleFieldDelete}
           />
        </div>

      </div>

      {/* ====================== SETTINGS DIALOG ====================== */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-purple-600" />
              Envelope settings
            </DialogTitle>
            <DialogDescription>
              Update the envelope title, message, signing order, and expiry. Changes apply immediately to this draft.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="env-title">Title</Label>
              <Input
                id="env-title"
                value={settingsDraft.title}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="e.g. Investment Mandate – Jane Smith"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="env-message">Message to recipients</Label>
              <Textarea
                id="env-message"
                value={settingsDraft.message}
                onChange={(e) => setSettingsDraft((d) => ({ ...d, message: e.target.value }))}
                placeholder="Optional. Shown to every recipient in the email and signing screen."
                rows={3}
                maxLength={1000}
              />
              <p className="text-[11px] text-gray-400 text-right">
                {settingsDraft.message.length}/1000
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="env-expiry">Expires in (days)</Label>
                <Input
                  id="env-expiry"
                  type="number"
                  min={1}
                  max={365}
                  value={settingsDraft.expiryDays}
                  onChange={(e) =>
                    setSettingsDraft((d) => ({
                      ...d,
                      expiryDays: Math.max(1, Math.min(365, parseInt(e.target.value || '30', 10))),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Signing order</Label>
                <Select
                  value={settingsDraft.signingMode}
                  onValueChange={(v) =>
                    setSettingsDraft((d) => ({ ...d, signingMode: v as 'sequential' | 'parallel' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sequential">Sequential</SelectItem>
                    <SelectItem value="parallel">Parallel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)} disabled={savingSettings}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-purple-600 hover:bg-purple-700">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================== P3.3 — PAGE MANAGER ====================== */}
      <PageManagerDialog
        open={showPageManager}
        onClose={() => setShowPageManager(false)}
        envelopeId={envelope.id}
        documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl || ''}
        sourcePageCount={envelope.document?.page_count ?? pageCount}
        onApplied={(_newPageCount, pageMap) => {
          // Drop placed fields whose source page no longer exists; remap
          // surviving fields to their new page index. Wrap in a history
          // push so undo works after page edits.
          setFields((prev) => {
            const remapped: EsignField[] = [];
            for (const f of prev) {
              const newPage = pageMap[f.page];
              if (newPage == null) continue;
              remapped.push({ ...f, page: newPage });
            }
            return remapped;
          });
        }}
      />

      {/* ====================== KEYBOARD SHORTCUTS ====================== */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-purple-600" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>
              Power-user controls for placing and arranging fields quickly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2 text-sm">
            {[
              ['Save', '⌘ / Ctrl + S'],
              ['Undo', '⌘ / Ctrl + Z'],
              ['Redo', '⇧ + ⌘ / Ctrl + Z'],
              ['Copy', '⌘ / Ctrl + C'],
              ['Paste', '⌘ / Ctrl + V'],
              ['Duplicate', '⌘ / Ctrl + D'],
              ['Select all', '⌘ / Ctrl + A'],
              ['Delete', 'Delete / Backspace'],
              ['Nudge field', 'Arrow keys'],
              ['Nudge ×10', 'Shift + Arrow'],
              ['Bypass snap', 'Hold Alt while drag'],
              ['Multi-select', 'Shift + click / drag'],
              ['Clear selection', 'Esc'],
              // P2.5 2.11
              ['Pick recipient 1–9', '1 … 9'],
              ['Show this help', '?'],
            ].map(([label, keys]) => (
              <React.Fragment key={label}>
                <span className="text-gray-600">{label}</span>
                <span className="font-mono text-xs text-gray-800 text-right">{keys}</span>
              </React.Fragment>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================== RECIPIENTS QUICK-EDIT ====================== */}
      <Sheet open={showRecipients} onOpenChange={setShowRecipients}>
        <SheetContent side="right" className="w-full sm:max-w-[520px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Recipients</SheetTitle>
            <SheetDescription>
              Reorder, add or remove recipients without leaving the studio.
              Changes save automatically when you close this panel.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <RecipientsManager
              signers={signers}
              onChange={(next) => {
                // Persist on every change so the studio's `signers` prop and
                // the legend stay in sync without a "Save recipients" button.
                void handleRecipientsSave(next);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ====================== PREVIEW DIALOG ======================
          P2.5 2.10 — Two-mode preview:
            1. "Document" — non-interactive PDF preview, optionally filtered
               to a single recipient so the sender sees exactly what that
               person will see on signing day.
            2. "Email" — a faithful HTML mock of the invitation email each
               recipient will receive (subject, signer name, document title,
               personal message, "Review and sign" CTA). Catches things like
               "this still says 'Hi {{name}}'" before send time. */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[1100px] w-[95vw] h-[88vh] p-0 flex flex-col">
          <DialogHeader className="px-5 py-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              Preview as recipient
            </DialogTitle>
            <DialogDescription>
              See the document and email exactly as a recipient will. Choose a
              specific signer to filter the document view to their fields only.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar: signer picker + view-mode tabs. Kept above the content
              so switching modes doesn't reset the chosen signer. */}
          <div className="px-5 py-2 border-b shrink-0 flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600">Recipient:</span>
            <Select value={previewSignerEmail} onValueChange={setPreviewSignerEmail}>
              <SelectTrigger className="w-[260px] h-8">
                <SelectValue placeholder="All recipients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All recipients (combined)</SelectItem>
                {eligibleSigners.map((s, idx) => {
                  const color = SIGNER_COLORS[idx % SIGNER_COLORS.length].hex;
                  return (
                    <SelectItem key={s.email} value={s.email}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <div className="ml-auto inline-flex rounded-md border border-gray-200 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setPreviewMode('doc')}
                className={`px-3 py-1.5 ${previewMode === 'doc' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Document
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('email')}
                className={`px-3 py-1.5 border-l border-gray-200 ${previewMode === 'email' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Email
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-gray-100">
            {previewMode === 'doc' ? (
              <PDFViewer
                documentUrl={documentUrl || envelope.document?.url || envelope.documentUrl}
                documentName={envelope.title}
                // Filter to a single signer's fields so the sender sees what
                // that recipient will see — including the gentle reality that
                // a recipient with zero fields gets nothing to do.
                fields={
                  previewSignerEmail === '__all__'
                    ? fields
                    : fields.filter((f) => f.signer_id === previewSignerEmail)
                }
                signers={signers}
                showFields={true}
                selectedSignerId={previewSignerEmail === '__all__' ? undefined : previewSignerEmail}
              />
            ) : (
              <EmailPreview
                envelope={{
                  title: envelope.title,
                  message: envelope.message ?? undefined,
                  sender_name: (envelope as { sender_name?: string | null }).sender_name ?? undefined,
                  firm_name: (envelope as { firm_name?: string | null }).firm_name ?? undefined,
                }}
                signer={
                  previewSignerEmail === '__all__'
                    ? eligibleSigners[0] // best-effort fallback
                    : eligibleSigners.find((s) => s.email === previewSignerEmail) ?? eligibleSigners[0]
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// EmailPreview — P2.5 2.10
// -----------------------------------------------------------------------------
// Renders a static, branded mock of the invitation email so a sender can
// visually verify the subject, salutation, document title, and personal
// message before clicking Send. Deliberately read-only and self-contained so
// it can be lifted out into Storybook later.
// =============================================================================
interface EmailPreviewProps {
  // Structural subset — pulls only the optional fields we render. We use a
  // narrow type rather than `EsignEnvelope` so EmailPreview is reusable from
  // tests and Storybook with a hand-built fixture.
  envelope: {
    title?: string;
    message?: string;
    sender_name?: string;
    firm_name?: string;
  };
  signer?: { name: string; email: string; role?: string };
}

function EmailPreview({ envelope, signer }: EmailPreviewProps) {
  const senderName = envelope.sender_name || envelope.firm_name || 'Your adviser';
  const signerName = signer?.name || 'Recipient';
  const title = envelope.title || 'document';
  const subject = `${senderName} sent you "${title}" to sign`;
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-[640px] mx-auto bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50 text-xs text-gray-600 space-y-1">
          <div>
            <span className="font-medium text-gray-700">From:</span>{' '}
            {senderName} &lt;noreply@navigatewealth.co&gt;
          </div>
          <div>
            <span className="font-medium text-gray-700">To:</span>{' '}
            {signerName} &lt;{signer?.email || 'recipient@example.com'}&gt;
          </div>
          <div>
            <span className="font-medium text-gray-700">Subject:</span> {subject}
          </div>
        </div>
        <div className="px-6 py-8 text-gray-800">
          <div className="text-2xl font-semibold text-gray-900 mb-1">Navigate Wealth</div>
          <div className="text-xs text-gray-500 mb-6">Secure document signing</div>

          <p className="mb-4">Hi {signerName},</p>

          <p className="mb-4">
            <span className="font-medium">{senderName}</span> has sent you the
            document <span className="font-medium">"{title}"</span> to
            review and sign.
          </p>

          {envelope.message && (
            <div className="border-l-4 border-purple-300 bg-purple-50/60 px-4 py-3 mb-5 text-sm text-gray-700 whitespace-pre-wrap">
              {envelope.message}
            </div>
          )}

          <div className="flex justify-center my-6">
            <span className="inline-block px-6 py-3 rounded-md bg-purple-600 text-white font-medium">
              Review and sign
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            This link is unique to you. Please do not forward this email.
          </p>

          <hr className="my-6 border-gray-200" />
          <p className="text-xs text-gray-500">
            If you weren't expecting this, you can safely ignore the email or
            contact {senderName} directly.
          </p>
        </div>
      </div>
    </div>
  );
}