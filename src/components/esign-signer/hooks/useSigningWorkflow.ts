/**
 * useSigningWorkflow — the signing workflow's whole state and behaviour: the
 * reading → signing phases, pdf.js loading and page-on-demand rendering, the
 * signer's fields (visibility and required gating from the rule engine,
 * prefills, calculated values), every field handler and its validation, the
 * adopt-once-apply-everywhere signature, the in-progress save, the primary
 * CTA, submission with the ECTA consent, decline, pause, zoom and the
 * attachment upload.
 *
 * Moved verbatim out of SigningWorkflow.tsx so the live workflow and the
 * Navigator redesign (src/site/sections/ESignWorkspace.tsx) render the same
 * PDF the same way and send exactly the same calls and payloads; they differ
 * only in how the workspace is drawn. The per-page and per-field values the
 * live JSX worked out inline (pageView, fieldView), and its two inline
 * handlers (makeInlineCommit, handleAttachmentChange), are here unchanged so
 * both designs share them.
 *
 * Returns null when there is no session, where the live component drew its
 * "Session Error" card.
 */

/* eslint-disable react-hooks/rules-of-hooks --
 * TODO(Phase 4/5): this 1823-line god-file calls 24 hooks after an early
 * return. The correct fix (likely a wrapper-split around the loading/early
 * guard so the inner component calls its hooks unconditionally) changes hook
 * ordering in the live e-signature SIGNER flow and must be done behind
 * characterization tests first — this file is already on the Phase 5/6
 * decomposition list. Quarantined here so react-hooks/rules-of-hooks can be
 * promoted to "error" repo-wide; remove this directive when the file is fixed.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { SignerSessionData, SignatureData, SignerField } from '../types';
import { evaluateRuleState } from '../services/ruleEngine';
import { esignSignerService, uploadAttachmentForSigner } from '../services/esignSignerService';
import { isValidSaId, maskSaId, inProgressKey } from '../signingIdentity';
import { useInProgressSignatures } from '../useInProgressSignatures';
import { sastIsoDate } from '../../../shared/esign/fieldText';

// ── pdf.js bootstrap (canvas-based rendering — works on all browsers including mobile) ──
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const STANDARD_FONT_DATA_URL = '/pdfjs/standard_fonts/';

export interface SigningWorkflowProps {
  token: string;
  sessionData: SignerSessionData | null;
  onComplete: () => void;
  onReject: (reason: string) => void;
  submitSignature: (
    token: string,
    signatures: SignatureData[],
  ) => Promise<{ success: boolean; error?: string }>;
}

export type WorkflowPhase = 'reading' | 'signing';

export function useSigningWorkflow({
  token,
  sessionData,
  onComplete,
  onReject,
  submitSignature,
}: SigningWorkflowProps) {
  // ── Phase: reading vs signing ──────────────────────────────────────────
  // We always start in 'reading' so the signer sees the document first
  // before any fields are interactive. They cross the threshold by tapping
  // the single bottom-bar CTA.
  const [phase, setPhase] = useState<WorkflowPhase>('reading');

  // ── Zoom: auto-fit on mobile ───────────────────────────────────────────
  const [zoom, setZoom] = useState(() => {
    if (typeof window === 'undefined') return 100;
    if (window.innerWidth < 768) {
      return Math.max(50, Math.round(((window.innerWidth - 32) / 595) * 100));
    }
    return 100;
  });

  // ── Submission / dialogs ────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showDropdownDialog, setShowDropdownDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [currentField, setCurrentField] = useState<SignerField | null>(null);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);

  const [textInput, setTextInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dropdownValue, setDropdownValue] = useState('');

  const [consentAccepted, setConsentAccepted] = useState(false);

  // Adopted signature/initials for THIS session — used to auto-fill all
  // remaining signature fields the moment the signer adopts in any one of
  // them. Held in state (not just a ref) so adopting also re-saves to the
  // server-side profile for next time.
  const [adoptedSignature, setAdoptedSignature] = useState<string | null>(
    sessionData?.saved_signature ?? null,
  );
  const [adoptedInitials, setAdoptedInitials] = useState<string | null>(
    sessionData?.saved_initials ?? null,
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Auto-fill auto_date fields on mount ───────────────────────────────
  useEffect(() => {
    if (!sessionData) return;
    const autoDateFields = sessionData.fields.filter(
      (f) => f.type === 'auto_date' && f.signer_id === sessionData.signer_id,
    );
    if (autoDateFields.length === 0) return;

    // Today in South Africa, as the server will stamp it on submit (the
    // server's date wins; this is the preview). It used the device's own
    // clock and time zone, with the time appended.
    const now = sastIsoDate();

    setSignatures((prev) => {
      const newEntries = autoDateFields
        .filter((f) => !prev.some((s) => s.field_id === f.id))
        .map((f) => ({ field_id: f.id, type: 'auto_date' as const, value: now }));
      return newEntries.length > 0 ? [...prev, ...newEntries] : prev;
    });
  }, [sessionData]);

  // Restores paused work on mount and saves it on every change.
  useInProgressSignatures({ token, signatures, phase, setSignatures, setPhase });

  // ── pdf.js state ──────────────────────────────────────────────────────
  const pdfDocRef = useRef<Record<string, unknown> | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());
  // P7.6 — page-on-demand rendering. `renderedPages` holds the page
  // numbers that have ever been rendered at the current zoom; pages
  // outside this set show a placeholder skeleton. The IntersectionObserver
  // below watches the placeholder elements and schedules the render
  // when they enter the viewport (with a small root margin so pages
  // appear already painted by the time the user scrolls to them).
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const pageObserverRef = useRef<IntersectionObserver | null>(null);
  const placeholderRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // P3.5 — hidden file input wired up to the active attachment field.
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [_attachmentUploading, setAttachmentUploading] = useState<string | null>(null);
  const [_attachments, setAttachments] = useState<
    Record<string, { id: string; filename: string; size: number }>
  >({});
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  interface PageDim {
    pageNumber: number;
    width: number;
    height: number;
  }
  const [pageDims, setPageDims] = useState<PageDim[]>([]);

  // ── Load PDF document via pdf.js ──────────────────────────────────────
  useEffect(() => {
    if (!sessionData?.document_url) {
      setPdfLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setPdfLoading(true);
      setPdfError(null);
      setPageDims([]);

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: sessionData.document_url,
          withCredentials: false,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf as unknown as Record<string, unknown>;

        const dims: PageDim[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          dims.push({ pageNumber: i, width: vp.width, height: vp.height });
        }

        if (!cancelled) {
          setPageDims(dims);
          setPdfLoading(false);
        }
      } catch (err: unknown) {
        console.error('Failed to load PDF for signing:', err);
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : 'Failed to load PDF document.');
          setPdfLoading(false);
        }
      }
    };

    load();

    const renderTasks = renderTasksRef.current;
    return () => {
      cancelled = true;
      renderTasks.forEach((task) => {
        try {
          task.cancel();
        } catch {
          /* noop */
        }
      });
      renderTasks.clear();
      if (pdfDocRef.current) {
        (pdfDocRef.current as { destroy: () => void }).destroy();
        pdfDocRef.current = null;
      }
    };
  }, [sessionData?.document_url]);

  // ── P7.6 — render a specific page lazily when it becomes visible ──────
  const renderPage = useCallback(
    async (pageNumber: number) => {
      const pdf = pdfDocRef.current as {
        getPage: (n: number) => Promise<{
          getViewport: (o: { scale: number }) => { width: number; height: number };
          render: (o: {
            canvasContext: CanvasRenderingContext2D;
            viewport: { width: number; height: number };
          }) => { promise: Promise<void>; cancel: () => void };
        }>;
      } | null;
      if (!pdf) return;
      const canvas = canvasRefs.current.get(pageNumber);
      if (!canvas) return;
      const scale = zoom / 100;

      // Cancel any in-flight render for this page so a rapid zoom change
      // doesn't leave us painting stale pixels.
      const existing = renderTasksRef.current.get(pageNumber);
      if (existing) {
        try {
          existing.cancel();
        } catch {
          /* noop */
        }
      }

      try {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTasksRef.current.set(pageNumber, renderTask);
        await renderTask.promise;

        setRenderedPages((prev) => {
          if (prev.has(pageNumber)) return prev;
          const next = new Set(prev);
          next.add(pageNumber);
          return next;
        });
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error(`Failed to render signing page ${pageNumber}:`, err);
        }
      }
    },
    [zoom],
  );

  // ── P7.6 — zoom change invalidates every previously-rendered page ─────
  // but we only re-render ones that are currently visible. Pages that
  // scroll back into view later will re-render on the observer tick.
  useEffect(() => {
    if (pageDims.length === 0) return;
    // Cancel all in-flight renders from the previous zoom.
    renderTasksRef.current.forEach((task) => {
      try {
        task.cancel();
      } catch {
        /* noop */
      }
    });
    renderTasksRef.current.clear();
    setRenderedPages(new Set());
    // Re-render whatever is currently visible.
    visiblePages.forEach((pageNumber) => {
      void renderPage(pageNumber);
    });
    // `visiblePages` is intentionally omitted from the deps — we only
    // want this effect to fire on zoom changes (and initial load once
    // pageDims populates). The observer tick handles visible-set
    // deltas independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, pageDims.length, renderPage]);

  // ── P7.6 — IntersectionObserver drives on-demand rendering ─────────────
  useEffect(() => {
    if (pageDims.length === 0 || typeof window === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber);
            if (!Number.isFinite(pageNumber)) continue;
            if (entry.isIntersecting) {
              if (!next.has(pageNumber)) {
                next.add(pageNumber);
                changed = true;
                // Fire the render as soon as the page enters the viewport
                // (or within the 300px prefetch margin below).
                void renderPage(pageNumber);
              }
            } else if (next.has(pageNumber)) {
              next.delete(pageNumber);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { rootMargin: '300px 0px' },
    );

    pageObserverRef.current = observer;
    for (const [, el] of placeholderRefs.current) observer.observe(el);
    return () => {
      observer.disconnect();
      pageObserverRef.current = null;
    };
  }, [pageDims.length, renderPage]);

  const setCanvasRef = useCallback(
    (pageNumber: number) => (el: HTMLCanvasElement | null) => {
      if (el) {
        canvasRefs.current.set(pageNumber, el);
      } else {
        canvasRefs.current.delete(pageNumber);
      }
    },
    [],
  );

  /**
   * P7.6 — attach an observed placeholder for a page. The placeholder
   * element lives in the DOM with the correct width/height derived
   * from the pre-computed dims so scroll position is preserved when
   * the canvas bitmap is eventually painted in.
   */
  const setPlaceholderRef = useCallback(
    (pageNumber: number) => (el: HTMLDivElement | null) => {
      const observer = pageObserverRef.current;
      if (el) {
        placeholderRefs.current.set(pageNumber, el);
        if (observer) observer.observe(el);
      } else {
        const prev = placeholderRefs.current.get(pageNumber);
        if (prev && observer) observer.unobserve(prev);
        placeholderRefs.current.delete(pageNumber);
      }
    },
    [],
  );

  // ── No session: the live component drew its "Session Error" card here ──
  if (!sessionData) {
    return null;
  }

  const { envelope_title, fields = [] } = sessionData;
  const isFieldsLocked = sessionData.is_turn === false;

  const usesZeroBasedIndexing = useMemo(() => fields.some((f) => f.page === 0), [fields]);

  const displayPageCount = useMemo(() => {
    const pdfPageCount = sessionData.page_count || 1;
    const maxFieldPage =
      fields.length > 0
        ? Math.max(...fields.map((f) => f.page)) + (usesZeroBasedIndexing ? 1 : 0)
        : 1;
    return Math.max(pdfPageCount, maxFieldPage);
  }, [sessionData.page_count, fields, usesZeroBasedIndexing]);

  const signerFields = useMemo(
    () => fields.filter((f) => f.signer_id === sessionData.signer_id),
    [fields, sessionData.signer_id],
  );

  // P4.5 / P4.6 — Build a `valuesMap` of every field's current answer
  // (signer-entered first, prefill fallback) and feed the rule engine.
  // Conditional fields use this to evaluate visibility; calculated
  // fields use it to compute their derived display value.
  const valuesMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const f of signerFields) {
      const sig = signatures.find((s) => s.field_id === f.id);
      const raw = sig?.value ?? f.value ?? '';
      if (raw != null) map[f.id] = String(raw);
    }
    return map;
  }, [signerFields, signatures]);

  const ruleState = useMemo(
    () => evaluateRuleState(signerFields, valuesMap),
    [signerFields, valuesMap],
  );

  // Visible fields drive everything user-facing — render, gating,
  // navigation. Hidden fields stay in `signerFields` so the rule
  // engine can still resolve cross-references in their formulas if
  // they ever become visible later.
  const visibleSignerFields = useMemo(
    () => signerFields.filter((f) => ruleState[f.id]?.visible !== false),
    [signerFields, ruleState],
  );

  // P4.5 — Required gate respects the engine's effective-required flag
  // so a hidden conditional field never blocks completion. P4.6 —
  // Calculated fields are display-only; we exclude them from the
  // required gate (their value is auto-derived).
  const requiredFields = useMemo(
    () =>
      visibleSignerFields
        .filter((f) => {
          // Notes are read-only sender text — never part of the required gate.
          if (f.type === 'note') return false;
          const meta = (f.metadata ?? {}) as { calculated?: { formula?: string } };
          if (meta.calculated?.formula) return false;
          return ruleState[f.id]?.requiredEffective ?? f.required;
        })
        .sort((a, b) => a.page - b.page || a.y - b.y),
    [visibleSignerFields, ruleState],
  );

  // P3.6 — A field is "complete" if the signer entered something OR the
  // server pre-filled it with a non-empty value. Locked prefills always
  // count as complete; unlocked prefills count until the signer touches
  // them (in which case `signatures` takes over). This unblocks the
  // submit button when every required field has SOME value source.
  const isFieldFilledByPrefillOrSig = useCallback(
    (field: SignerField) => {
      const sig = signatures.find((s) => s.field_id === field.id);
      if (sig && (sig.value ?? '').trim() !== '') return true;
      // Any value the field arrived with counts: a prefill, or a default the
      // sender typed. Only prefills counted, so a field showing the sender's
      // default still blocked "Finish". (Sending now keeps those values.)
      if ((field.value ?? '').trim() !== '') return true;
      return false;
    },
    [signatures],
  );

  const completedFields = useMemo(
    () => requiredFields.filter((f) => isFieldFilledByPrefillOrSig(f)),
    [requiredFields, isFieldFilledByPrefillOrSig],
  );

  const progress =
    requiredFields.length > 0 ? (completedFields.length / requiredFields.length) * 100 : 100;

  const allRequiredFieldsCompleted = completedFields.length === requiredFields.length;
  const requiredRemaining = requiredFields.length - completedFields.length;

  const nextIncompleteField = useMemo(() => {
    return requiredFields.find((f) => !isFieldFilledByPrefillOrSig(f));
  }, [requiredFields, isFieldFilledByPrefillOrSig]);

  // ==================== FIELD CLICK HANDLERS ====================

  const handleCheckboxToggle = useCallback((field: SignerField) => {
    setSignatures((prev) => {
      const existing = prev.find((s) => s.field_id === field.id);
      if (existing) {
        if (existing.value === 'true') {
          return prev.filter((s) => s.field_id !== field.id);
        }
        return prev.map((s) => (s.field_id === field.id ? { ...s, value: 'true' } : s));
      }
      return [...prev, { field_id: field.id, type: 'checkbox', value: 'true' }];
    });
  }, []);

  const handleFieldClick = useCallback(
    (field: SignerField) => {
      // Reading mode — fields are inert. The bottom-bar CTA is the only way in.
      if (phase === 'reading') return;

      // P3.6 — Prefill: a locked, server-resolved field is read-only. We
      // surface a tooltip elsewhere; here we just no-op the click so the
      // dialog never opens. Unlocked prefills DO open the dialog (so the
      // signer can edit) and pre-populate the input from `field.value`.
      const meta = (field.metadata ?? {}) as { prefill?: { locked?: boolean } };
      if (meta.prefill?.locked) return;

      setCurrentField(field);
      setError(null);

      switch (field.type) {
        case 'signature':
        case 'initials':
          setShowSignatureDialog(true);
          break;
        case 'text': {
          const existingText =
            signatures.find((s) => s.field_id === field.id)?.value ?? field.value ?? '';
          setTextInput(existingText);
          setShowTextDialog(true);
          break;
        }
        case 'date': {
          const existingDate =
            signatures.find((s) => s.field_id === field.id)?.value ?? field.value ?? '';
          setDateInput(existingDate);
          setShowDateDialog(true);
          break;
        }
        case 'checkbox':
          handleCheckboxToggle(field);
          break;
        case 'auto_date': {
          const now = sastIsoDate();
          setSignatures((prev) => {
            const existing = prev.find((s) => s.field_id === field.id);
            if (existing)
              return prev.map((s) => (s.field_id === field.id ? { ...s, value: now } : s));
            return [...prev, { field_id: field.id, type: 'auto_date', value: now }];
          });
          break;
        }
        // Radio shares the option-picker dialog (same metadata.options).
        case 'radio':
        case 'dropdown': {
          const existingDropdown = signatures.find((s) => s.field_id === field.id)?.value || '';
          setDropdownValue(existingDropdown);
          setShowDropdownDialog(true);
          break;
        }
        // P3.5 — open the OS file picker for attachment fields. The actual
        // upload is triggered by the hidden <input type="file">'s onChange
        // handler so we get the File reference without an extra dialog.
        case 'attachment': {
          setCurrentField(field);
          attachmentInputRef.current?.click();
          break;
        }
      }
    },
    [phase, signatures, handleCheckboxToggle],
  );

  /**
   * When a signer adopts a signature/initials in any field, we:
   *   1. Record it for THIS field.
   *   2. Auto-apply the same value to all OTHER empty fields of the same
   *      type owned by this signer.
   *   3. Remember the adopted value in component state so subsequent fields
   *      adopted via the dialog default to it.
   *   4. Best-effort persist to the server-side profile so the next
   *      envelope sent to this email opens with it pre-loaded.
   */
  const handleSignatureSave = useCallback(
    (signatureData: string) => {
      if (!currentField) return;

      const fieldType = currentField.type as 'signature' | 'initials';
      const sameTypeFields = signerFields.filter((f) => f.type === fieldType);

      setSignatures((prev) => {
        const next = [...prev];
        sameTypeFields.forEach((f) => {
          const idx = next.findIndex((s) => s.field_id === f.id);
          if (f.id === currentField.id) {
            // Always apply to the field the signer explicitly tapped.
            if (idx >= 0) next[idx] = { ...next[idx]!, value: signatureData };
            else next.push({ field_id: f.id, type: fieldType, value: signatureData });
          } else if (idx < 0) {
            // Auto-apply to OTHER empty same-type fields owned by this signer.
            // Already-filled fields are NOT overwritten — the signer may have
            // intentionally given them different values.
            next.push({ field_id: f.id, type: fieldType, value: signatureData });
          }
        });
        return next;
      });

      if (fieldType === 'signature') setAdoptedSignature(signatureData);
      else setAdoptedInitials(signatureData);

      // Persist to server-side profile in the background — never block.
      void esignSignerService.saveSignerSignature(token, {
        [fieldType === 'signature' ? 'signature' : 'initials']: signatureData,
      } as { signature?: string; initials?: string });

      setShowSignatureDialog(false);
      setCurrentField(null);
    },
    [currentField, signerFields, token],
  );

  const handleTextSave = useCallback(() => {
    if (!currentField || !textInput.trim()) return;

    const meta = (currentField.metadata ?? {}) as Record<string, unknown>;
    const format = typeof meta.format === 'string' ? meta.format : 'free_text';
    const minLength = typeof meta.minLength === 'number' ? meta.minLength : undefined;
    const maxLength = typeof meta.maxLength === 'number' ? meta.maxLength : undefined;
    const customPattern = typeof meta.pattern === 'string' ? meta.pattern : undefined;

    const trimmed = textInput.trim();

    // Length checks first — these run before format-specific checks so the
    // signer gets the most relevant error message.
    if (typeof minLength === 'number' && trimmed.length < minLength) {
      setError(`Please enter at least ${minLength} characters.`);
      return;
    }
    if (typeof maxLength === 'number' && trimmed.length > maxLength) {
      setError(`Please enter at most ${maxLength} characters.`);
      return;
    }

    // Format-specific validation.
    if (format === 'sa_id') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 13 || !isValidSaId(digits)) {
        setError('Please enter a valid 13-digit South African ID number.');
        return;
      }
    } else if (format === 'number') {
      if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        setError('Please enter a valid number.');
        return;
      }
    } else if (format === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError('Please enter a valid email address.');
        return;
      }
    } else if (format === 'phone') {
      // Permissive: allow +, digits, spaces, dashes, parens; require ≥ 7 digits
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 7 || !/^[+\d][\d\s\-()]+$/.test(trimmed)) {
        setError('Please enter a valid phone number.');
        return;
      }
    } else if (format === 'sa_mobile') {
      // P2.5 2.4 — South African mobile. Accept either:
      //   • 10-digit local form starting with 0:        0XXXXXXXXX
      //   • International form starting with +27 / 27:  +27XXXXXXXXX (or 27XXXXXXXXX)
      // We strip whitespace / dashes / parens before matching.
      const compact = trimmed.replace(/[\s\-()]/g, '');
      const localOk = /^0\d{9}$/.test(compact);
      const intlOk = /^(?:\+?27)\d{9}$/.test(compact);
      if (!(localOk || intlOk)) {
        setError('Please enter a valid SA mobile number, e.g. 082 123 4567 or +27 82 123 4567.');
        return;
      }
    } else if (format === 'sa_postal_code') {
      // P2.5 2.4 — South African postal codes are exactly 4 digits.
      if (!/^\d{4}$/.test(trimmed)) {
        setError('Please enter a valid 4-digit South African postal code.');
        return;
      }
    } else if (format === 'custom_regex' && customPattern) {
      try {
        const re = new RegExp(customPattern);
        if (!re.test(trimmed)) {
          setError('The value does not match the required format.');
          return;
        }
      } catch {
        // Invalid pattern from the sender — fail open so the signer can
        // still submit; we just log silently.
      }
    }

    setSignatures((prev) => {
      const existing = prev.find((s) => s.field_id === currentField.id);
      const value = format === 'sa_id' ? maskSaId(textInput) : trimmed;
      if (existing) {
        return prev.map((s) => (s.field_id === currentField.id ? { ...s, value } : s));
      }
      return [...prev, { field_id: currentField.id, type: 'text', value }];
    });

    setShowTextDialog(false);
    setCurrentField(null);
    setTextInput('');
    setError(null);
  }, [currentField, textInput]);

  const handleDateSave = useCallback(() => {
    if (!currentField || !dateInput) return;

    const formatted = new Date(dateInput).toLocaleDateString('en-ZA', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    setSignatures((prev) => {
      const existing = prev.find((s) => s.field_id === currentField.id);
      if (existing) {
        return prev.map((s) => (s.field_id === currentField.id ? { ...s, value: formatted } : s));
      }
      return [...prev, { field_id: currentField.id, type: 'date', value: formatted }];
    });

    setShowDateDialog(false);
    setCurrentField(null);
    setDateInput('');
  }, [currentField, dateInput]);

  const handleDropdownSave = useCallback(() => {
    if (!currentField || !dropdownValue) return;

    setSignatures((prev) => {
      const existing = prev.find((s) => s.field_id === currentField.id);
      if (existing) {
        return prev.map((s) =>
          s.field_id === currentField.id ? { ...s, value: dropdownValue } : s,
        );
      }
      // Record the field's real type ('dropdown' or 'radio').
      const type = currentField.type === 'radio' ? ('radio' as const) : ('dropdown' as const);
      return [...prev, { field_id: currentField.id, type, value: dropdownValue }];
    });

    setShowDropdownDialog(false);
    setCurrentField(null);
    setDropdownValue('');
  }, [currentField, dropdownValue]);

  // ==================== NAVIGATION ====================

  const scrollToNextField = useCallback(() => {
    if (nextIncompleteField) {
      const el = document.getElementById(`field-${nextIncompleteField.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [nextIncompleteField]);

  // ==================== PRIMARY CTA ====================

  /** The single bottom-bar CTA. Its label, behaviour, and styling all
   *  derive from current phase + completion state. */
  const handlePrimaryCta = useCallback(() => {
    if (isFieldsLocked) return;

    if (phase === 'reading') {
      setPhase('signing');
      // After entering signing mode, scroll to the first required field
      // so the signer immediately sees what they need to do.
      requestAnimationFrame(() => {
        if (nextIncompleteField) {
          const el = document.getElementById(`field-${nextIncompleteField.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      return;
    }

    if (!allRequiredFieldsCompleted) {
      scrollToNextField();
      return;
    }

    setShowConsentDialog(true);
  }, [phase, isFieldsLocked, allRequiredFieldsCompleted, nextIncompleteField, scrollToNextField]);

  const primaryCtaLabel = useMemo(() => {
    if (isFieldsLocked) return 'Locked';
    if (phase === 'reading') return "I'm ready to sign";
    if (!allRequiredFieldsCompleted) {
      return requiredRemaining === 1
        ? 'Complete 1 required field'
        : `Complete ${requiredRemaining} required fields`;
    }
    return 'Submit signed document';
  }, [phase, allRequiredFieldsCompleted, requiredRemaining, isFieldsLocked]);

  const primaryCtaTone = useMemo(() => {
    if (isFieldsLocked) return 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed';
    if (phase === 'reading') return 'bg-indigo-600 hover:bg-indigo-700';
    if (!allRequiredFieldsCompleted) return 'bg-amber-500 hover:bg-amber-600 text-white';
    return 'bg-green-600 hover:bg-green-700';
  }, [phase, allRequiredFieldsCompleted, isFieldsLocked]);

  // ==================== SUBMIT ====================

  const handleFinalSubmit = useCallback(async () => {
    if (!consentAccepted) return;

    setShowConsentDialog(false);
    setIsSubmitting(true);
    setError(null);

    try {
      // P4.6 — Stamp computed values for calculated fields onto the
      // submission payload so the server-rendered PDF/certificate sees
      // the same numbers the signer saw on screen. Skip if the field
      // is hidden or the formula failed to evaluate.
      const augmented: SignatureData[] = signatures.slice();
      for (const f of signerFields) {
        const calcDisplay = ruleState[f.id]?.calculatedValue;
        if (!calcDisplay) continue;
        if (ruleState[f.id]?.visible === false) continue;
        const idx = augmented.findIndex((s) => s.field_id === f.id);
        if (idx >= 0) {
          augmented[idx] = { ...augmented[idx]!, value: calcDisplay, type: 'text' };
        } else {
          augmented.push({ field_id: f.id, type: 'text', value: calcDisplay });
        }
      }
      const result = await submitSignature(token, augmented);
      if (result.success) {
        // Clear in-progress local cache on success.
        try {
          window.localStorage.removeItem(inProgressKey(token));
        } catch {
          /* noop */
        }
        onComplete();
      } else {
        setError(result.error || 'Failed to submit signature. Please try again.');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [consentAccepted, token, signatures, signerFields, ruleState, submitSignature, onComplete]);

  const handleRejectSubmit = useCallback(() => {
    if (!rejectReason.trim()) return;
    setShowRejectDialog(false);
    onReject(rejectReason);
  }, [rejectReason, onReject]);

  // ==================== PAUSE / SAVE & FINISH LATER ====================

  const handlePauseConfirm = useCallback(async () => {
    setShowPauseDialog(false);
    // Best-effort audit. localStorage already has the in-progress state so
    // the signer can return and continue.
    try {
      await esignSignerService.pauseSigning(token, {
        completed: completedFields.length,
        required: requiredFields.length,
      });
    } catch {
      /* non-critical */
    }
    // Send the user away. The browser tab close is the cleanest UX; a
    // navigation here would feel arbitrary so we just let them close.
    if (typeof window !== 'undefined') {
      // Try to close the tab; modern browsers will only close tabs the
      // script opened, so as a fallback navigate home.
      window.close();
      setTimeout(() => {
        if (!window.closed) window.location.href = '/';
      }, 250);
    }
  }, [token, completedFields.length, requiredFields.length]);

  // ==================== ZOOM ====================

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));

  // ==================== DOWNLOAD ORIGINAL FOR READ ====================

  const handleDownloadOriginal = useCallback(() => {
    if (!sessionData?.document_url) return;
    // Opening in a new tab gives the signer a Download / Print option via
    // the browser's built-in PDF viewer on every platform.
    window.open(sessionData.document_url, '_blank', 'noopener,noreferrer');
  }, [sessionData?.document_url]);

  const isReading = phase === 'reading';

  /** One page's fields, earlier signers' entries and size at the current zoom. */
  const pageView = (pageNumber: number) => {
    // P4.5 — Render only fields the rule engine considers
    // visible. Hidden conditional fields disappear from the
    // page entirely so the signer never wonders what they are.
    const pageFields = visibleSignerFields.filter((f) =>
      usesZeroBasedIndexing ? f.page === pageNumber - 1 : f.page === pageNumber,
    );
    const priorEntries = (sessionData.completed_fields ?? []).filter((f) =>
      usesZeroBasedIndexing ? f.page === pageNumber - 1 : f.page === pageNumber,
    );

    const dim = pageDims.find((d) => d.pageNumber === pageNumber);
    const scale = zoom / 100;
    const pageW = dim ? dim.width * scale : undefined;
    return { pageFields, priorEntries, dim, scale, pageW };
  };

  /** What one of the signer's fields shows: its value, fill state and lock. */
  const fieldView = (field: SignerField) => {
    const signature = signatures.find((s) => s.field_id === field.id);
    // P3.6 — When a field has a server-resolved prefill
    // value AND the signer hasn't entered anything yet,
    // show the prefill as the field's display value. A
    // locked prefill *always* wins (signer can't override).
    // P4.6 — Calculated fields are read-only and their
    // value is the engine-computed display string. They
    // override prefill / signer input.
    const meta = (field.metadata ?? {}) as {
      prefill?: { locked?: boolean };
      calculated?: { formula?: string };
    };
    const prefillLocked = !!meta.prefill?.locked;
    const calculatedDisplay = ruleState[field.id]?.calculatedValue ?? null;
    const isCalculated = !!meta.calculated?.formula;
    const effectiveSignatureValue =
      calculatedDisplay ?? signature?.value ?? (field.value ? field.value : undefined);
    const isFilledEffective = !!calculatedDisplay || !!signature || !!field.value;
    const isNext = !!nextIncompleteField && nextIncompleteField.id === field.id;
    return {
      signature,
      prefillLocked,
      calculatedDisplay,
      isCalculated,
      effectiveSignatureValue,
      isFilledEffective,
      isNext,
    };
  };

  /**
   * P2.5 1.9 — accept inline commits for plain text & date fields. SA-ID and
   * other masked formats still go through the modal (handled inside
   * FieldHighlight via metadata.format).
   */
  const makeInlineCommit = (field: SignerField) => (fieldId: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      // Empty string clears the field.
      setSignatures((prev) => prev.filter((s) => s.field_id !== fieldId));
      return true;
    }
    setSignatures((prev) => {
      const existing = prev.find((s) => s.field_id === fieldId);
      const sigType = field.type === 'date' ? 'date' : 'text';
      if (existing) {
        return prev.map((s) =>
          s.field_id === fieldId ? { ...s, value: trimmed, type: sigType } : s,
        );
      }
      return [...prev, { field_id: fieldId, type: sigType, value: trimmed }];
    });
    return true;
  };

  /** P3.5 — the hidden attachment input's change handler. */
  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after a failure.
    e.target.value = '';
    if (!file || !currentField) return;
    if (file.size > 25 * 1024 * 1024) {
      setError('Attachment exceeds the 25MB limit.');
      return;
    }
    const fieldId = currentField.id;
    setAttachmentUploading(fieldId);
    try {
      const result = await uploadAttachmentForSigner(token, fieldId, file);
      setAttachments((prev) => ({
        ...prev,
        [fieldId]: { id: result.attachmentId, filename: result.filename, size: result.size },
      }));
      setSignatures((prev) => {
        const next = prev.filter((s) => s.field_id !== fieldId);
        next.push({
          field_id: fieldId,
          type: 'attachment',
          value: `attachment:${result.attachmentId}`,
        });
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setAttachmentUploading(null);
    }
  };

  return {
    phase,
    zoom,
    isSubmitting,
    error,
    setError,
    showRejectDialog,
    setShowRejectDialog,
    rejectReason,
    setRejectReason,
    showSignatureDialog,
    setShowSignatureDialog,
    showTextDialog,
    setShowTextDialog,
    showDateDialog,
    setShowDateDialog,
    showConsentDialog,
    setShowConsentDialog,
    showDropdownDialog,
    setShowDropdownDialog,
    showPauseDialog,
    setShowPauseDialog,
    currentField,
    setCurrentField,
    signatures,
    textInput,
    setTextInput,
    dateInput,
    setDateInput,
    dropdownValue,
    setDropdownValue,
    consentAccepted,
    setConsentAccepted,
    adoptedSignature,
    adoptedInitials,
    scrollContainerRef,
    attachmentInputRef,
    renderedPages,
    pdfLoading,
    pdfError,
    setPdfError,
    setCanvasRef,
    setPlaceholderRef,
    sessionData,
    envelope_title,
    isFieldsLocked,
    displayPageCount,
    requiredFields,
    completedFields,
    progress,
    allRequiredFieldsCompleted,
    nextIncompleteField,
    handleFieldClick,
    handleSignatureSave,
    handleTextSave,
    handleDateSave,
    handleDropdownSave,
    handlePrimaryCta,
    primaryCtaLabel,
    primaryCtaTone,
    handleFinalSubmit,
    handleRejectSubmit,
    handlePauseConfirm,
    handleZoomIn,
    handleZoomOut,
    handleDownloadOriginal,
    isReading,
    pageView,
    fieldView,
    makeInlineCommit,
    handleAttachmentChange,
  };
}
