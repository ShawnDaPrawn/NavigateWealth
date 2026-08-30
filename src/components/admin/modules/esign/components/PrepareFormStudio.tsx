/**
 * Prepare Form Studio
 * The professional 3-column editor for placing fields on documents.
 * Replaces the older PrepareFormEditor.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '../../../../ui/button';
import { Loader2, ChevronDown, Magnet, Plus, X, FileText } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { FieldPalette } from './FieldPalette';
import { FieldPropertiesPanel } from './FieldPropertiesPanel';
import type { EsignEnvelope, EsignField, SignerFormData } from '../types';
import { esignApi } from '../api';
import { SIGNER_COLORS } from '../constants';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { logger } from '../../../../../utils/logger';
import { PageManagerDialog } from './PageManagerDialog';
import { createFieldsFromCandidates, buildPageReplicas } from './prepareFormStudioUtils';
import { useFieldHistory } from './useFieldHistory';
import { useAutoSave } from './useAutoSave';
import { useFieldSelection } from './useFieldSelection';
import { useDocumentManagement } from './useDocumentManagement';
import { useCandidateManagement } from './useCandidateManagement';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { StudioToolbar } from './studio/StudioToolbar';
import { SignerLegend } from './studio/SignerLegend';
import { BulkActionBar } from './studio/BulkActionBar';
import { SettingsDialog } from './studio/SettingsDialog';
import { ShortcutsDialog } from './studio/ShortcutsDialog';
import { RecipientsSheet } from './studio/RecipientsSheet';
import { StudioPreviewDialog } from './studio/StudioPreviewDialog';
import type { SettingsDraft } from './studio/settingsDraft';

interface PrepareFormStudioProps {
  envelope: EsignEnvelope;
  signers: SignerFormData[];
  autoPopulateSuggestedFields?: boolean;
  onBack?: () => void;
  onSaveFields?: (fields: EsignField[]) => Promise<void>;
  onSendForSignature?: (fields?: EsignField[]) => Promise<void>;
  sendActionLabel?: string;
  sendActionBusyLabel?: string;
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
  autoPopulateSuggestedFields = true,
  onBack,
  onSaveFields,
  onSendForSignature,
  sendActionLabel = 'Send',
  sendActionBusyLabel = 'Sending...',
  onSignersChange,
  onEnvelopeUpdated,
  saving = false,
  sending = false,
  documentUrl,
}: PrepareFormStudioProps) {
  // Core field state
  const [fields, setFields] = useState<EsignField[]>(envelope.fields || []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Simple local state (snap, page count, dialog toggles)
  const [selectedSignerId, setSelectedSignerId] = useState<string | undefined>(signers[0]?.email);
  const [snapEnabled, setSnapEnabled] = useState(true);
  // P2.5 2.3 — total page count, populated by PDFViewer once the doc loads.
  const [pageCount, setPageCount] = useState<number>(1);

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
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
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

  // ── Hook: Undo/redo history ──
  const { pushToHistory, undo, redo, canUndo, canRedo } = useFieldHistory(
    envelope.fields || [],
    setFields,
    setHasUnsavedChanges,
  );

  // ── Hook: Field selection + signer-filter state machine ──
  const {
    selectedFieldIds,
    primarySelectedId,
    visibleSignerIds,
    selectOnly,
    toggleInSelection,
    removeFromSelection,
    selectMany,
    clearSelection,
    toggleSignerFilter,
    clearSignerFilter,
  } = useFieldSelection();

  // Eligible signers for placing fields = everyone EXCEPT carbon-copy
  // recipients. CCs are notified only and never sign anything, so they
  // shouldn't appear in the "Placing fields for" picker.
  const eligibleSigners = useMemo(() => signers.filter((s) => s.kind !== 'cc'), [signers]);

  // If the currently-selected signer is a CC (e.g. they were edited after
  // selection), drop the selection back to the first eligible signer.
  useEffect(() => {
    if (!selectedSignerId) return;
    const cur = signers.find((s) => s.email === selectedSignerId);
    if (!cur || cur.kind === 'cc') {
      setSelectedSignerId(eligibleSigners[0]?.email);
    }
  }, [selectedSignerId, signers, eligibleSigners]);

  // Field counts per signer — drives the legend badges.
  const fieldCountsBySigner = useMemo(() => {
    const counts: Record<string, number> = {};
    fields.forEach((f) => {
      if (!f.signer_id) return;
      counts[f.signer_id] = (counts[f.signer_id] ?? 0) + 1;
    });
    return counts;
  }, [fields]);

  const buildFieldsFromCandidates = useCallback(
    (
      candidateList: NonNullable<EsignEnvelope['field_candidates']>,
      targetSignerId: string,
    ): EsignField[] =>
      createFieldsFromCandidates(candidateList, targetSignerId, fields, envelope.id),
    [fields, envelope.id],
  );

  // ── Hook: Multi-document management ──
  const {
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
  } = useDocumentManagement({
    envelopeId: envelope.id,
    envelopeStatus: envelope.status,
    initialDocumentId: envelope.document_id ?? '',
    initialDocumentUrl: documentUrl,
    envelopeDocumentUrl: envelope.document?.url,
    envelopeDocumentUrlLegacy: envelope.documentUrl,
    envelopePrimaryDocumentId: envelope.document_id,
    fields,
    setFields,
  });

  // ── Hook: Autodetect candidate management ──
  const {
    candidates,
    showCandidatesPanel,
    acceptCandidate,
    acceptAllCandidates,
    dismissCandidate,
    dismissAllCandidates,
  } = useCandidateManagement({
    envelopeId: envelope.id,
    initialCandidates: envelope.field_candidates,
    autoPopulateSuggestedFields,
    fields,
    pushToHistory,
    selectedSignerId,
    eligibleSigners,
    buildFieldsFromCandidates,
  });

  // ── Hook: Auto-save ──
  const { autoSaving, lastSavedAt, persistFields, fieldsRef } = useAutoSave({
    fields,
    initialFields: envelope.fields || [],
    onSaveFields,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    saving,
    sending,
  });

  /**
   * Filter the in-memory fields to only those belonging to the active
   * document. Fields without an explicit `document_id` (legacy) are
   * scoped to the primary document so old drafts continue to render.
   */
  const visibleFields = useMemo<EsignField[]>(() => {
    if (envelopeDocuments.length <= 1) return fields;
    return fields.filter((f) => {
      const docId =
        (f as EsignField & { document_id?: string }).document_id ?? envelope.document_id;
      return docId === activeDocumentId;
    });
  }, [fields, envelopeDocuments.length, activeDocumentId, envelope.document_id]);

  // Build signer color map for consistent color assignment
  const signerColorMap = signers.reduce(
    (map, signer, index) => {
      map[signer.email] = SIGNER_COLORS[index % SIGNER_COLORS.length].hex;
      return map;
    },
    {} as Record<string, string>,
  );

  // ==================== FIELD OPERATIONS ====================

  const handleFieldPlace = useCallback(
    (newField: Partial<EsignField>) => {
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
        // envelopes know which PDF the field belongs to.
        document_id: activeDocumentId,
        type: newField.type ?? 'signature',
        page: newField.page ?? 1,
        // ?? not || — a drop at exactly x=0 or y=0 used to be relocated to
        // 50% (dead center) because 0 is falsy.
        x: newField.x ?? 50,
        y: newField.y ?? 50,
        width: newField.width ?? 150,
        height: newField.height ?? 50,
        // Palette presets can place optional fields (e.g. a Note is never
        // required); anything unstated stays required.
        required: newField.required ?? true,
        signer_id: assignedSigner,
        // Presets carry a default value (Note text) and metadata (prefill
        // binding, format, options) that must survive placement.
        value: newField.value ?? null,
        metadata: newField.metadata ?? {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as EsignField;

      pushToHistory([...fields, field]);
      selectOnly(field.id);
    },
    [
      envelope.id,
      selectedSignerId,
      signers,
      eligibleSigners,
      fields,
      pushToHistory,
      activeDocumentId,
      selectOnly,
    ],
  );

  const handleFieldUpdate = useCallback(
    (fieldId: string, updates: Partial<EsignField>) => {
      const updatedFields = fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
      setFields(updatedFields);
      setHasUnsavedChanges(true);
    },
    [fields],
  );

  const handleFieldDelete = useCallback(
    (fieldId: string) => {
      const newFields = fields.filter((f) => f.id !== fieldId);
      pushToHistory(newFields);
      removeFromSelection(fieldId);
    },
    [fields, pushToHistory, removeFromSelection],
  );

  // ==================== MULTI-SELECT / CLIPBOARD ====================

  /**
   * Click handler for field overlays. Implements three modes:
   *   • plain click  → single-select (replace selection)
   *   • shift-click  → toggle the field in/out of the existing selection
   *   • cmd/ctrl     → same as shift on Mac/Windows for muscle-memory
   */
  const handleFieldClick = useCallback(
    (field: EsignField | null, modifiers?: { shiftKey: boolean; metaOrCtrl: boolean }) => {
      if (!field) {
        if (modifiers?.shiftKey) return;
        clearSelection();
        return;
      }
      const isMulti = modifiers?.shiftKey || modifiers?.metaOrCtrl;
      if (isMulti) toggleInSelection(field.id);
      else selectOnly(field.id);
    },
    [clearSelection, toggleInSelection, selectOnly],
  );

  /** Marquee callback from PDFViewer — replace or union with current selection. */
  const handleMarqueeSelect = useCallback(
    (ids: string[], modifiers: { shiftKey: boolean; metaOrCtrl: boolean }) => {
      selectMany(ids, { additive: modifiers.shiftKey || modifiers.metaOrCtrl });
    },
    [selectMany],
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
    selectMany(newFields.map((f) => f.id));
    toast.success(`Pasted ${newFields.length} field${newFields.length === 1 ? '' : 's'}`);
  }, [fields, pushToHistory, selectMany]);

  /** Duplicate selection in-place (cmd+d) — a copy + paste in one step. */
  const handleDuplicate = useCallback(() => {
    if (selectedFieldIds.size === 0) return;
    fieldClipboardRef.current = fields.filter((f) => selectedFieldIds.has(f.id));
    handlePaste();
  }, [selectedFieldIds, fields, handlePaste]);

  /** Bulk-delete every selected field. */
  const handleBulkDelete = useCallback(() => {
    if (selectedFieldIds.size === 0) return;
    const remaining = fields.filter((f) => !selectedFieldIds.has(f.id));
    pushToHistory(remaining);
    clearSelection();
  }, [fields, selectedFieldIds, pushToHistory, clearSelection]);

  // ── P2.5 2.2 — Bulk reassign / required toggle ──
  const handleBulkReassign = useCallback(
    (signerEmail: string) => {
      if (selectedFieldIds.size === 0) return;
      const updated = fields.map((f) =>
        selectedFieldIds.has(f.id) ? { ...f, signer_id: signerEmail } : f,
      );
      pushToHistory(updated);
      toast.success(
        `Reassigned ${selectedFieldIds.size} field${selectedFieldIds.size === 1 ? '' : 's'}`,
      );
    },
    [fields, selectedFieldIds, pushToHistory],
  );

  const handleBulkRequired = useCallback(
    (required: boolean) => {
      if (selectedFieldIds.size === 0) return;
      const updated = fields.map((f) => (selectedFieldIds.has(f.id) ? { ...f, required } : f));
      pushToHistory(updated);
      toast.success(
        `${selectedFieldIds.size} field${selectedFieldIds.size === 1 ? '' : 's'} marked ${required ? 'required' : 'optional'}`,
      );
    },
    [fields, selectedFieldIds, pushToHistory],
  );

  // ── P2.5 2.3 — Apply to all pages ──
  const handleApplyToAllPages = useCallback(() => {
    if (selectedFieldIds.size === 0 || pageCount <= 1) return;
    const seeds = fields.filter((f) => selectedFieldIds.has(f.id));
    const replicas = buildPageReplicas(seeds, fields, pageCount);
    if (replicas.length === 0) {
      toast.info('Selected fields already exist on every page.');
      return;
    }
    pushToHistory([...fields, ...replicas]);
    toast.success(
      `Replicated to ${replicas.length} field${replicas.length === 1 ? '' : 's'} across ${pageCount - 1} other page${pageCount - 1 === 1 ? '' : 's'}`,
    );
  }, [fields, selectedFieldIds, pageCount, pushToHistory]);

  // ==================== ACTIONS ====================

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

  // ── Hook: Keyboard shortcuts ──
  useKeyboardShortcuts({
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
    clearSelection,
    selectMany,
    undo,
    redo,
    setShowShortcuts,
    setSelectedSignerId,
  });

  // ==================== RENDER ====================

  // Currently-displayed field for the right-hand Properties panel.
  const propertiesField = fields.find((f) => f.id === primarySelectedId) || null;
  const totalSelected = selectedFieldIds.size;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <StudioToolbar
        autoSaving={autoSaving}
        canRedo={canRedo}
        canUndo={canUndo}
        documentUrl={documentUrl}
        envelope={envelope}
        handleBack={handleBack}
        handleSave={handleSave}
        handleSend={handleSend}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
        redo={redo}
        saving={saving}
        sendActionBusyLabel={sendActionBusyLabel}
        sendActionLabel={sendActionLabel}
        sending={sending}
        setShowPageManager={setShowPageManager}
        setShowPreview={setShowPreview}
        setShowRecipients={setShowRecipients}
        setShowSettings={setShowSettings}
        setShowShortcuts={setShowShortcuts}
        setSnapEnabled={setSnapEnabled}
        signers={signers}
        snapEnabled={snapEnabled}
        undo={undo}
      />

      <SignerLegend
        clearSignerFilter={clearSignerFilter}
        fieldCountsBySigner={fieldCountsBySigner}
        selectedSignerId={selectedSignerId}
        setSelectedSignerId={setSelectedSignerId}
        signers={signers}
        toggleSignerFilter={toggleSignerFilter}
        visibleSignerIds={visibleSignerIds}
      />

      <BulkActionBar
        eligibleSigners={eligibleSigners}
        handleApplyToAllPages={handleApplyToAllPages}
        handleBulkDelete={handleBulkDelete}
        handleBulkReassign={handleBulkReassign}
        handleBulkRequired={handleBulkRequired}
        handleDuplicate={handleDuplicate}
        pageCount={pageCount}
        totalSelected={totalSelected}
      />

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
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: signerColorMap[selectedSignerId || ''] || '#6d28d9',
                      }}
                    />
                    <span className="truncate text-sm">
                      {eligibleSigners.find((s) => s.email === selectedSignerId)?.name ||
                        'Select signer'}
                    </span>
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
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color.hex }}
                      />
                      <span className="flex-1 truncate">{signer.name}</span>
                      <span className="text-xs text-gray-400">
                        {signer.kind === 'witness' ? 'Witness' : signer.role || 'Signer'}
                      </span>
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
        <div
          className="flex-1 bg-gray-100/50 relative min-h-0 min-w-0 overflow-hidden"
          data-esign-canvas
        >
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
                    {candidates.length} suggested field{candidates.length === 1 ? '' : 's'} from
                    this PDF
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
                      {c.label ||
                        c.anchorText ||
                        (c.source === 'acroform' ? 'PDF form widget' : 'Text anchor')}
                    </span>
                    {/* Candidates the analyzer bound to a CRM token fill
                        themselves from the client record at send time. */}
                    {c.prefill_token && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-800 rounded shrink-0">
                        auto-fills
                      </span>
                    )}
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
                const canRemove = envelope.status === 'draft' && envelopeDocuments.length > 1;
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
                            isActive ? 'bg-blue-200 text-blue-900' : 'bg-gray-200 text-gray-700'
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

      <SettingsDialog
        handleSaveSettings={handleSaveSettings}
        savingSettings={savingSettings}
        setSettingsDraft={setSettingsDraft}
        setShowSettings={setShowSettings}
        settingsDraft={settingsDraft}
        showSettings={showSettings}
      />

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

      <ShortcutsDialog setShowShortcuts={setShowShortcuts} showShortcuts={showShortcuts} />

      <RecipientsSheet
        handleRecipientsSave={handleRecipientsSave}
        setShowRecipients={setShowRecipients}
        showRecipients={showRecipients}
        signers={signers}
      />

      <StudioPreviewDialog
        documentUrl={documentUrl}
        eligibleSigners={eligibleSigners}
        envelope={envelope}
        fields={fields}
        previewMode={previewMode}
        previewSignerEmail={previewSignerEmail}
        setPreviewMode={setPreviewMode}
        setPreviewSignerEmail={setPreviewSignerEmail}
        setShowPreview={setShowPreview}
        showPreview={showPreview}
        signers={signers}
      />
    </div>
  );
}
