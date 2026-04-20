/**
 * Signing Workflow
 *
 * Phase-1 production redesign — the signer experience must be
 * self-evidently intuitive. No tour, no coach marks, no help text.
 *
 * Two explicit phases:
 *   1. READING  — the document is rendered with field placeholders shown
 *                 but inert. A single bottom-bar CTA: "I'm ready to sign".
 *   2. SIGNING  — fields become interactive. The bottom-bar CTA dynamically
 *                 reflects state:
 *                    "Complete N required fields"  → scrolls to next required
 *                    "Submit signed document"      → opens ECTA consent
 *
 * Other Phase-1 features in this component:
 *   • Adopt-once-apply-everywhere — when the signer adopts a signature in
 *     any field, every empty signature/initials field they own is filled.
 *   • Saved-signature reuse from the server (signature is persisted per
 *     email after first adoption).
 *   • Auto-derived initials based on signer name.
 *   • Mobile-first sticky bottom action bar with Decline / Save & Finish
 *     later / primary CTA — no buried menus.
 *   • Print / Download to read — always visible in the header.
 *   • Optional SA-ID masking + checksum in text fields when the field
 *     metadata declares format === 'sa_id'.
 *   • Local persistence (localStorage) of in-progress signatures so a
 *     paused signer can resume.
 *   • No tooltips. No popovers explaining what a field is for. The visual
 *     language alone communicates state.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  FileText,
  Check,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ArrowRight,
  Lock,
  Calendar,
  Type,
  Pen,
  ShieldCheck,
  Download,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { FieldHighlight } from './FieldHighlight';
import type { SignerSessionData, SignatureData, SignerField } from './types';
import { evaluateRuleState } from './services/ruleEngine';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { esignSignerService, uploadAttachmentForSigner } from './services/esignSignerService';

// ── pdf.js bootstrap (canvas-based rendering — works on all browsers including mobile) ──
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

interface SigningWorkflowProps {
  token: string;
  sessionData: SignerSessionData | null;
  onComplete: () => void;
  onReject: (reason: string) => void;
  submitSignature: (token: string, signatures: SignatureData[]) => Promise<{ success: boolean; error?: string }>;
}

type WorkflowPhase = 'reading' | 'signing';

/** Validate a 13-digit South African ID number with the Luhn-variant
 *  checksum used by Home Affairs. Returns true for valid IDs. */
function isValidSaId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  // Sum odd-positioned digits (1st, 3rd, ...) — index 0,2,4,...
  let oddSum = 0;
  for (let i = 0; i < 12; i += 2) oddSum += Number(digits[i]);
  // Concatenate even-positioned digits and double, then sum each digit.
  let evenConcat = '';
  for (let i = 1; i < 12; i += 2) evenConcat += digits[i];
  const evenDoubled = String(Number(evenConcat) * 2);
  let evenSum = 0;
  for (const ch of evenDoubled) evenSum += Number(ch);
  const total = oddSum + evenSum;
  const checkDigit = (10 - (total % 10)) % 10;
  return checkDigit === Number(digits[12]);
}

/** Format a string of digits as "YYMMDD SSSS C AZ" (SA ID grouping). */
function maskSaId(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  const parts: string[] = [];
  if (d.length > 0) parts.push(d.slice(0, 6));
  if (d.length > 6) parts.push(d.slice(6, 10));
  if (d.length > 10) parts.push(d.slice(10, 11));
  if (d.length > 11) parts.push(d.slice(11, 13));
  return parts.join(' ');
}

/** localStorage key for in-progress signatures (keyed by signing token). */
const inProgressKey = (token: string) => `nw-esign-inprogress:${token}`;

export function SigningWorkflow({
  token,
  sessionData,
  onComplete,
  onReject,
  submitSignature
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
      return Math.max(50, Math.round((window.innerWidth - 32) / 595 * 100));
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
      f => f.type === 'auto_date' && f.signer_id === sessionData.signer_id
    );
    if (autoDateFields.length === 0) return;

    const now = new Date().toLocaleDateString('en-ZA', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });

    setSignatures(prev => {
      const newEntries = autoDateFields
        .filter(f => !prev.some(s => s.field_id === f.id))
        .map(f => ({ field_id: f.id, type: 'auto_date' as const, value: now }));
      return newEntries.length > 0 ? [...prev, ...newEntries] : prev;
    });
  }, [sessionData]);

  // ── Restore in-progress signatures from localStorage on mount ────────
  // Lets a signer pause then return without losing any field they filled.
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(inProgressKey(token));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { signatures?: SignatureData[]; phase?: WorkflowPhase };
      if (Array.isArray(parsed.signatures) && parsed.signatures.length > 0) {
        setSignatures(prev => {
          // Merge — anything already auto-filled (auto_date) wins.
          const existingIds = new Set(prev.map(s => s.field_id));
          const merged = [...prev];
          parsed.signatures!.forEach(s => {
            if (!existingIds.has(s.field_id)) merged.push(s);
          });
          return merged;
        });
        // If we restored work, jump straight to signing.
        if (parsed.phase === 'signing' || parsed.signatures.length > 0) {
          setPhase('signing');
        }
      }
    } catch {
      // best-effort
    }
  }, [token]);

  // ── Persist in-progress signatures to localStorage on every change ───
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        inProgressKey(token),
        JSON.stringify({ signatures, phase }),
      );
    } catch {
      // quota / private mode — best-effort only
    }
  }, [token, signatures, phase]);

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
  const [attachmentUploading, setAttachmentUploading] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Record<string, { id: string; filename: string; size: number }>>({});
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  interface PageDim { pageNumber: number; width: number; height: number; }
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

        if (cancelled) { pdf.destroy(); return; }

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

    return () => {
      cancelled = true;
      renderTasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* noop */ } });
      renderTasksRef.current.clear();
      if (pdfDocRef.current) {
        (pdfDocRef.current as { destroy: () => void }).destroy();
        pdfDocRef.current = null;
      }
    };
  }, [sessionData?.document_url]);

  // ── P7.6 — render a specific page lazily when it becomes visible ──────
  const renderPage = useCallback(async (pageNumber: number) => {
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
    if (existing) { try { existing.cancel(); } catch { /* noop */ } }

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
  }, [zoom]);

  // ── P7.6 — zoom change invalidates every previously-rendered page ─────
  // but we only re-render ones that are currently visible. Pages that
  // scroll back into view later will re-render on the observer tick.
  useEffect(() => {
    if (pageDims.length === 0) return;
    // Cancel all in-flight renders from the previous zoom.
    renderTasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* noop */ } });
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
            const pageNumber = Number(
              (entry.target as HTMLElement).dataset.pageNumber,
            );
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
      if (el) { canvasRefs.current.set(pageNumber, el); }
      else { canvasRefs.current.delete(pageNumber); }
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

  // ── Early-return if session missing ────────────────────────────────────
  if (!sessionData) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="p-8 text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Session Error</h3>
          <p className="text-gray-500 mt-2">Session data not available. Please try refreshing the page.</p>
        </Card>
      </div>
    );
  }

  const { envelope_title, fields = [] } = sessionData;
  const isFieldsLocked = sessionData.is_turn === false;

  const usesZeroBasedIndexing = useMemo(() =>
    fields.some(f => f.page === 0),
    [fields]);

  const displayPageCount = useMemo(() => {
    const pdfPageCount = sessionData.page_count || 1;
    const maxFieldPage = fields.length > 0
      ? Math.max(...fields.map(f => f.page)) + (usesZeroBasedIndexing ? 1 : 0)
      : 1;
    return Math.max(pdfPageCount, maxFieldPage);
  }, [sessionData.page_count, fields, usesZeroBasedIndexing]);

  const signerFields = useMemo(() =>
    fields.filter(f => f.signer_id === sessionData.signer_id),
    [fields, sessionData.signer_id]);

  // P4.5 / P4.6 — Build a `valuesMap` of every field's current answer
  // (signer-entered first, prefill fallback) and feed the rule engine.
  // Conditional fields use this to evaluate visibility; calculated
  // fields use it to compute their derived display value.
  const valuesMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const f of signerFields) {
      const sig = signatures.find(s => s.field_id === f.id);
      const raw = sig?.value ?? f.value ?? '';
      if (raw != null) map[f.id] = String(raw);
    }
    return map;
  }, [signerFields, signatures]);

  const ruleState = useMemo(() => evaluateRuleState(signerFields, valuesMap), [
    signerFields,
    valuesMap,
  ]);

  // Visible fields drive everything user-facing — render, gating,
  // navigation. Hidden fields stay in `signerFields` so the rule
  // engine can still resolve cross-references in their formulas if
  // they ever become visible later.
  const visibleSignerFields = useMemo(
    () => signerFields.filter(f => ruleState[f.id]?.visible !== false),
    [signerFields, ruleState],
  );

  // P4.5 — Required gate respects the engine's effective-required flag
  // so a hidden conditional field never blocks completion. P4.6 —
  // Calculated fields are display-only; we exclude them from the
  // required gate (their value is auto-derived).
  const requiredFields = useMemo(() =>
    visibleSignerFields
      .filter(f => {
        const meta = (f.metadata ?? {}) as { calculated?: { formula?: string } };
        if (meta.calculated?.formula) return false;
        return ruleState[f.id]?.requiredEffective ?? f.required;
      })
      .sort((a, b) => (a.page - b.page) || (a.y - b.y)),
    [visibleSignerFields, ruleState]);

  // P3.6 — A field is "complete" if the signer entered something OR the
  // server pre-filled it with a non-empty value. Locked prefills always
  // count as complete; unlocked prefills count until the signer touches
  // them (in which case `signatures` takes over). This unblocks the
  // submit button when every required field has SOME value source.
  const isFieldFilledByPrefillOrSig = useCallback(
    (field: SignerField) => {
      const sig = signatures.find((s) => s.field_id === field.id);
      if (sig && (sig.value ?? '').trim() !== '') return true;
      const meta = (field.metadata ?? {}) as { prefill?: { token?: string } };
      if (meta.prefill?.token && (field.value ?? '').trim() !== '') return true;
      return false;
    },
    [signatures],
  );

  const completedFields = useMemo(
    () => requiredFields.filter((f) => isFieldFilledByPrefillOrSig(f)),
    [requiredFields, isFieldFilledByPrefillOrSig],
  );

  const progress = requiredFields.length > 0
    ? (completedFields.length / requiredFields.length) * 100
    : 100;

  const allRequiredFieldsCompleted = completedFields.length === requiredFields.length;
  const requiredRemaining = requiredFields.length - completedFields.length;

  const nextIncompleteField = useMemo(() => {
    return requiredFields.find((f) => !isFieldFilledByPrefillOrSig(f));
  }, [requiredFields, isFieldFilledByPrefillOrSig]);

  // ==================== FIELD CLICK HANDLERS ====================

  const handleFieldClick = useCallback((field: SignerField) => {
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
          signatures.find(s => s.field_id === field.id)?.value
          ?? field.value
          ?? '';
        setTextInput(existingText);
        setShowTextDialog(true);
        break;
      }
      case 'date': {
        const existingDate =
          signatures.find(s => s.field_id === field.id)?.value
          ?? field.value
          ?? '';
        setDateInput(existingDate);
        setShowDateDialog(true);
        break;
      }
      case 'checkbox':
        handleCheckboxToggle(field);
        break;
      case 'auto_date': {
        const now = new Date().toLocaleDateString('en-ZA', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: false,
        });
        setSignatures(prev => {
          const existing = prev.find(s => s.field_id === field.id);
          if (existing) return prev.map(s => s.field_id === field.id ? { ...s, value: now } : s);
          return [...prev, { field_id: field.id, type: 'auto_date', value: now }];
        });
        break;
      }
      case 'dropdown': {
        const existingDropdown = signatures.find(s => s.field_id === field.id)?.value || '';
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
  }, [phase, signatures]);

  const handleCheckboxToggle = useCallback((field: SignerField) => {
    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === field.id);
      if (existing) {
        if (existing.value === 'true') {
          return prev.filter(s => s.field_id !== field.id);
        }
        return prev.map(s =>
          s.field_id === field.id ? { ...s, value: 'true' } : s
        );
      }
      return [...prev, { field_id: field.id, type: 'checkbox', value: 'true' }];
    });
  }, []);

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
  const handleSignatureSave = useCallback((signatureData: string) => {
    if (!currentField) return;

    const fieldType = currentField.type as 'signature' | 'initials';
    const sameTypeFields = signerFields.filter(f => f.type === fieldType);

    setSignatures(prev => {
      const next = [...prev];
      sameTypeFields.forEach(f => {
        const idx = next.findIndex(s => s.field_id === f.id);
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
  }, [currentField, signerFields, token]);

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

    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === currentField.id);
      const value = format === 'sa_id' ? maskSaId(textInput) : trimmed;
      if (existing) {
        return prev.map(s =>
          s.field_id === currentField.id ? { ...s, value } : s
        );
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

    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === currentField.id);
      if (existing) {
        return prev.map(s =>
          s.field_id === currentField.id ? { ...s, value: formatted } : s
        );
      }
      return [...prev, { field_id: currentField.id, type: 'date', value: formatted }];
    });

    setShowDateDialog(false);
    setCurrentField(null);
    setDateInput('');
  }, [currentField, dateInput]);

  const handleDropdownSave = useCallback(() => {
    if (!currentField || !dropdownValue) return;

    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === currentField.id);
      if (existing) {
        return prev.map(s =>
          s.field_id === currentField.id ? { ...s, value: dropdownValue } : s
        );
      }
      return [...prev, { field_id: currentField.id, type: 'dropdown', value: dropdownValue }];
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
        const idx = augmented.findIndex(s => s.field_id === f.id);
        if (idx >= 0) {
          augmented[idx] = { ...augmented[idx]!, value: calcDisplay, type: 'text' };
        } else {
          augmented.push({ field_id: f.id, type: 'text', value: calcDisplay });
        }
      }
      const result = await submitSignature(token, augmented);
      if (result.success) {
        // Clear in-progress local cache on success.
        try { window.localStorage.removeItem(inProgressKey(token)); } catch { /* noop */ }
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
    } catch { /* non-critical */ }
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

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  // ==================== DOWNLOAD ORIGINAL FOR READ ====================

  const handleDownloadOriginal = useCallback(() => {
    if (!sessionData?.document_url) return;
    // Opening in a new tab gives the signer a Download / Print option via
    // the browser's built-in PDF viewer on every platform.
    window.open(sessionData.document_url, '_blank', 'noopener,noreferrer');
  }, [sessionData?.document_url]);

  // ==================== RENDER ====================

  const isReading = phase === 'reading';

  return (
    <div className="flex flex-col h-screen bg-gray-100/50">
      {/* ==================== TOP HEADER ==================== */}
      <header className="bg-white border-b h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="h-8 w-8 hidden md:flex rounded-lg bg-indigo-600 text-white items-center justify-center shadow-sm flex-shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-semibold truncate max-w-[180px] md:max-w-md text-gray-900">
              {envelope_title}
            </h1>
            <p className="text-[11px] text-gray-500 hidden md:block truncate">
              {sessionData.signer_name} • {sessionData.signer_email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Always-visible Download / Print to read */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadOriginal}
            className="text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 h-9 px-2 md:px-3"
          >
            <Download className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline">Download to read</span>
          </Button>

          {/* Desktop progress meter (only after entering signing mode) */}
          {!isReading && (
            <div className="hidden md:flex items-center ml-1">
              <div className="text-right mr-2">
                <p className="text-xs font-medium text-gray-900">
                  {completedFields.length}/{requiredFields.length} done
                </p>
                <Progress value={progress} className="h-1.5 w-24 mt-1" />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-32 md:pb-32 bg-gray-100/50 scroll-smooth relative"
        >
          {error && (
            <div className="max-w-3xl mx-auto mb-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Locked state banner */}
          {isFieldsLocked && (
            <div className="max-w-3xl mx-auto mb-6">
              <Alert className="bg-amber-50 border-amber-300 text-amber-900">
                <Lock className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <span className="font-medium">Waiting for previous signers.</span>{' '}
                  This document requires signatures in a specific order. You will be notified by email when it is your turn.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex flex-col items-center gap-8 min-h-full">
            {/* Floating zoom controls — desktop */}
            <div className="fixed bottom-24 left-6 z-30 bg-white shadow-lg border rounded-full p-1 hidden md:flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomOut} disabled={zoom <= 50}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomIn} disabled={zoom >= 200}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Floating zoom controls — mobile (sit above the bottom action bar) */}
            <div className="fixed bottom-28 left-3 z-30 bg-white/95 shadow-lg border rounded-full p-0.5 flex md:hidden items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomOut} disabled={zoom <= 50}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-medium w-8 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomIn} disabled={zoom >= 200}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Document */}
            {pdfLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-2 text-gray-500">Loading document...</span>
              </div>
            )}

            {pdfError && (
              <div className="max-w-md mx-auto">
                <Card className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">Failed to load document</h3>
                  <p className="text-sm text-gray-500 mt-2">{pdfError}</p>
                  <Button variant="outline" className="mt-4" onClick={() => setPdfError(null)}>
                    Try Again
                  </Button>
                </Card>
              </div>
            )}

            {!pdfLoading && !pdfError && Array.from({ length: displayPageCount }).map((_, index) => {
              const pageNumber = index + 1;

              // P4.5 — Render only fields the rule engine considers
              // visible. Hidden conditional fields disappear from the
              // page entirely so the signer never wonders what they are.
              const pageFields = visibleSignerFields.filter(f =>
                usesZeroBasedIndexing
                  ? f.page === (pageNumber - 1)
                  : f.page === pageNumber
              );

              const dim = pageDims.find(d => d.pageNumber === pageNumber);
              const scale = zoom / 100;
              const pageW = dim ? dim.width * scale : undefined;

              return (
                <div
                  key={pageNumber}
                  className="relative bg-white shadow-md transition-all duration-200 ease-in-out rounded-sm"
                  style={pageW && dim ? {
                    width: `${pageW}px`,
                    maxWidth: '100%',
                    aspectRatio: `${dim.width} / ${dim.height}`,
                  } : {
                    width: `${zoom}%`,
                    maxWidth: '1000px',
                    aspectRatio: '1 / 1.414',
                    minHeight: '300px',
                  }}
                >
                  <div className="absolute -left-12 top-0 text-xs text-gray-400 font-medium hidden xl:block">
                    Page {pageNumber}
                  </div>

                  {sessionData.document_url && dim ? (
                    <div
                      ref={setPlaceholderRef(pageNumber)}
                      data-page-number={pageNumber}
                      className="absolute inset-0 overflow-hidden bg-white z-0"
                    >
                      <canvas
                        ref={setCanvasRef(pageNumber)}
                        className="absolute top-0 left-0"
                        style={{ width: '100%', height: '100%' }}
                      />
                      {/* P7.6 — skeleton placeholder shown until the page
                          canvas has been rendered by the observer tick. */}
                      {!renderedPages.has(pageNumber) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/60 animate-pulse pointer-events-none">
                          <FileText className="h-10 w-10 text-gray-300" strokeWidth={1} />
                        </div>
                      )}
                      <div className="absolute inset-0 z-[1]" />
                    </div>
                  ) : !sessionData.document_url ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-100 pointer-events-none border border-gray-100 z-0">
                      <FileText className="h-32 w-32 mb-4" strokeWidth={1} />
                      <p className="text-lg font-medium text-gray-300">Page {pageNumber}</p>
                      <p className="text-sm text-gray-300">Document preview not available</p>
                    </div>
                  ) : null}

                  {/* Fields overlay */}
                  <div className="absolute inset-0 z-10 pointer-events-none">
                    {pageFields.map((field) => {
                      const signature = signatures.find(s => s.field_id === field.id);
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
                        calculatedDisplay
                          ?? signature?.value
                          ?? (field.value ? field.value : undefined);
                      const isFilledEffective =
                        !!calculatedDisplay || !!signature || !!field.value;
                      const isNext = !!nextIncompleteField && nextIncompleteField.id === field.id;
                      return (
                        <div id={`field-${field.id}`} key={field.id} className="absolute inset-0 pointer-events-none">
                          <FieldHighlight
                            field={field}
                            zoom={zoom}
                            isFilled={isFilledEffective}
                            isNextRequired={isNext}
                            inactive={isReading}
                            filledValue={effectiveSignatureValue}
                            // Locked prefill becomes a real lock at render time
                            // — FieldHighlight already supports `locked`.
                            // P4.6 — calculated fields are always locked.
                            locked={isFieldsLocked || prefillLocked || isCalculated}
                            onClick={() => handleFieldClick(field)}
                            // P2.5 1.9 — accept inline commits for plain
                            // text & date fields. SA-ID and other masked
                            // formats still go through the modal (handled
                            // inside FieldHighlight via metadata.format).
                            onInlineCommit={(fieldId, value) => {
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
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ==================== STICKY BOTTOM ACTION BAR ==================== */}
      {/*
        The single source of truth for "what should I do next?".
        Mobile-first: full width, tall (56px), thumb-friendly. On desktop
        it remains pinned to the bottom but is content-width centered.

        Reading mode:
          [Decline]   [Download]                            [I'm ready to sign →]
        Signing mode (incomplete):
          [Decline]   [Save & Finish later]                 [Complete N required →]
        Signing mode (complete):
          [Decline]   [Save & Finish later]                 [Submit signed document ✓]
      */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)]">
        <div className="max-w-5xl mx-auto px-3 md:px-6 py-3 flex items-center gap-2 md:gap-3">
          {/* Secondary actions — left */}
          <Button
            variant="ghost"
            onClick={() => setShowRejectDialog(true)}
            disabled={isSubmitting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-12 px-2 md:px-3"
            aria-label="Decline to sign"
          >
            <XCircle className="h-4 w-4 md:mr-1.5" />
            <span className="hidden md:inline">Decline</span>
          </Button>

          {!isReading && (
            <Button
              variant="ghost"
              onClick={() => setShowPauseDialog(true)}
              disabled={isSubmitting}
              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 h-12 px-2 md:px-3"
              aria-label="Save and finish later"
            >
              <PauseCircle className="h-4 w-4 md:mr-1.5" />
              <span className="hidden md:inline">Save & Finish later</span>
            </Button>
          )}

          {/* Mobile progress meter (compact) — only in signing mode */}
          {!isReading && (
            <div className="flex-1 min-w-0 md:hidden">
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-[11px] font-medium text-gray-600 whitespace-nowrap">
                  {completedFields.length}/{requiredFields.length}
                </span>
              </div>
            </div>
          )}

          {/* Spacer (desktop only) — pushes the primary CTA to the right */}
          <div className="hidden md:block flex-1" />

          {/* PRIMARY CTA — always present, label & color reflect intent */}
          <Button
            onClick={handlePrimaryCta}
            disabled={isFieldsLocked || isSubmitting}
            className={`h-12 px-4 md:px-6 text-sm md:text-base font-semibold shadow-md flex-1 md:flex-none md:min-w-[260px] ${primaryCtaTone}`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Submitting…
              </>
            ) : isFieldsLocked ? (
              <>
                <Lock className="h-4 w-4 mr-1.5" />
                Locked
              </>
            ) : (
              <>
                <span className="truncate">{primaryCtaLabel}</span>
                {allRequiredFieldsCompleted && phase === 'signing' ? (
                  <Check className="h-4 w-4 ml-1.5 flex-shrink-0" />
                ) : (
                  <ArrowRight className="h-4 w-4 ml-1.5 flex-shrink-0" />
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ==================== READING-MODE OVERLAY HINT ==================== */}
      {/*
        When the document is loaded and we're still in reading mode, show
        a subtle floating banner near the bottom-CTA so first-time signers
        immediately know that the next step is theirs to take. NOT a tour
        — just a one-shot informational banner that disappears when they
        cross into signing.
      */}
      <AnimatePresence>
        {isReading && !pdfLoading && !pdfError && !isFieldsLocked && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="bg-gray-900/85 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              <span>Review the document, then tap below when ready</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================== P3.5 — ATTACHMENT UPLOAD ====================== */}
      {/* Hidden file input that handleFieldClick triggers programmatically.
          Kept off-screen (not display:none) so iOS Safari treats the click
          as a user gesture and actually opens the file picker. */}
      <input
        ref={attachmentInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/heic,image/heif,image/webp"
        className="sr-only"
        onChange={async (e) => {
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
        }}
      />

      {/* ==================== SIGNATURE DIALOG ==================== */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5 text-indigo-600" />
              {currentField?.type === 'signature' ? 'Adopt your signature' :
                currentField?.type === 'initials' ? 'Adopt your initials' :
                  'Sign Document'}
            </DialogTitle>
            <DialogDescription>
              {currentField?.type === 'signature'
                ? "We'll apply this to every signature spot on this document. You can change any one of them afterwards by tapping it."
                : currentField?.type === 'initials'
                  ? "We'll apply these initials to every initials spot on this document."
                  : 'Draw, type, or upload your signature.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => {
                setShowSignatureDialog(false);
                setCurrentField(null);
              }}
              type={(currentField?.type === 'initials' ? 'initials' : 'signature')}
              existingValue={signatures.find(s => s.field_id === currentField?.id)?.value}
              savedSignature={adoptedSignature}
              savedInitials={adoptedInitials}
              signerName={sessionData.signer_name}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== TEXT INPUT DIALOG ==================== */}
      <Dialog open={showTextDialog} onOpenChange={(open) => {
        setShowTextDialog(open);
        if (!open) { setCurrentField(null); setError(null); }
      }}>
        <DialogContent className="max-w-md">
          {(() => {
            // Pull validation hints from the field's metadata to drive the
            // dialog's title, helper copy, input mode, and placeholder.
            const meta = (currentField?.metadata ?? {}) as Record<string, unknown>;
            const fmt = (meta.format as string | undefined) ?? 'free_text';
            const customHelp = typeof meta.helpText === 'string' ? meta.helpText : '';
            const maxLength = typeof meta.maxLength === 'number' ? meta.maxLength : undefined;

            const titleByFormat: Record<string, string> = {
              sa_id: 'Enter SA ID number',
              number: 'Enter a number',
              email: 'Enter your email address',
              phone: 'Enter your phone number',
              custom_regex: 'Enter required value',
              free_text: 'Enter text',
            };
            const placeholderByFormat: Record<string, string> = {
              sa_id: '000000 0000 0 00',
              number: '0',
              email: 'name@example.com',
              phone: '+27 82 123 4567',
              custom_regex: 'Enter value...',
              free_text: 'Enter text...',
            };
            const inputModeByFormat: Record<string, 'text' | 'numeric' | 'email' | 'tel'> = {
              sa_id: 'numeric',
              number: 'numeric',
              email: 'email',
              phone: 'tel',
              custom_regex: 'text',
              free_text: 'text',
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Type className="h-5 w-5 text-indigo-600" />
                    {titleByFormat[fmt] ?? 'Enter text'}
                  </DialogTitle>
                  <DialogDescription>
                    {customHelp || (fmt === 'sa_id'
                      ? 'Type your 13-digit South African ID number.'
                      : 'Type the requested information for this field.')}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="text-field-input">Value</Label>
                    <Input
                      id="text-field-input"
                      inputMode={inputModeByFormat[fmt] ?? 'text'}
                      value={fmt === 'sa_id' ? maskSaId(textInput) : textInput}
                      maxLength={maxLength}
                      onChange={(e) => {
                        if (fmt === 'sa_id') {
                          setTextInput(e.target.value.replace(/\D/g, '').slice(0, 13));
                        } else {
                          setTextInput(e.target.value);
                        }
                      }}
                      placeholder={placeholderByFormat[fmt] ?? 'Enter text...'}
                      className="text-base h-12"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && textInput.trim()) handleTextSave();
                      }}
                    />
                    {error && (
                      <p className="text-xs text-red-600 mt-1">{error}</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11" onClick={() => {
              setShowTextDialog(false);
              setCurrentField(null);
              setError(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleTextSave}
              disabled={!textInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DATE INPUT DIALOG ==================== */}
      <Dialog open={showDateDialog} onOpenChange={(open) => {
        setShowDateDialog(open);
        if (!open) setCurrentField(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              Select date
            </DialogTitle>
            <DialogDescription>
              Choose the date for this field.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="date-field-input">Date</Label>
              <Input
                id="date-field-input"
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="text-base h-12"
                autoFocus
              />
              <Button
                variant="link"
                size="sm"
                className="text-indigo-600 p-0 h-auto"
                onClick={() => setDateInput(new Date().toISOString().split('T')[0])}
              >
                Use today's date
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11" onClick={() => {
              setShowDateDialog(false);
              setCurrentField(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleDateSave}
              disabled={!dateInput}
              className="bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== DROPDOWN SELECT DIALOG ==================== */}
      <Dialog open={showDropdownDialog} onOpenChange={(open) => {
        setShowDropdownDialog(open);
        if (!open) setCurrentField(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChevronDown className="h-5 w-5 text-indigo-600" />
              Select an option
            </DialogTitle>
            <DialogDescription>
              {currentField?.metadata?.placeholder
                ? String(currentField.metadata.placeholder)
                : 'Choose one of the available options below.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
            {((currentField?.metadata?.options as string[]) || []).map((option: string, idx: number) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDropdownValue(option)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all min-h-[44px] ${
                  dropdownValue === option
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {option}
              </button>
            ))}
            {(!currentField?.metadata?.options || (currentField.metadata.options as string[]).length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No options configured for this field.</p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11" onClick={() => {
              setShowDropdownDialog(false);
              setCurrentField(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleDropdownSave}
              disabled={!dropdownValue}
              className="bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              <Check className="h-4 w-4 mr-1.5" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== ECTA CONSENT DIALOG ==================== */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Confirm your signature
            </DialogTitle>
            <DialogDescription>
              Please review the following before completing your signature.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Document</span>
                <span className="font-medium text-gray-900 truncate max-w-[60%] text-right">{envelope_title}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Signer</span>
                <span className="font-medium text-gray-900">{sessionData.signer_name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Fields completed</span>
                <span className="font-medium text-green-700">{completedFields.length} of {requiredFields.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Date</span>
                <span className="font-medium text-gray-900">{new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Electronic Signature Consent</h4>
              <div className="text-xs text-gray-600 space-y-2 max-h-32 overflow-y-auto pr-2">
                <p>
                  By checking the box below and clicking "Submit Signature", I confirm and agree that:
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>I have reviewed the document in its entirety and understand its contents.</li>
                  <li>
                    I intend my electronic signature to have the same legal effect as a handwritten signature,
                    in accordance with the Electronic Communications and Transactions Act 25 of 2002 (ECTA) of South Africa.
                  </li>
                  <li>I consent to conducting this transaction electronically and acknowledge that my signature is legally binding.</li>
                  <li>I understand that a record of this signing, including timestamp, IP address, and device information, will be maintained for audit purposes.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <UICheckbox
                id="ecta-consent"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                className="mt-0.5 h-5 w-5"
              />
              <Label htmlFor="ecta-consent" className="text-sm text-gray-800 cursor-pointer leading-snug">
                I have read and agree to the above. I confirm this is my signature and I intend to electronically sign this document.
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" className="h-11" onClick={() => {
              setShowConsentDialog(false);
              setConsentAccepted(false);
            }}>
              Go back
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={!consentAccepted || isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  Submit signature
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== REJECT DIALOG ==================== */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Decline to sign
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this document? This action cannot be undone.
              The sender will be notified of your reason.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Please explain why you are declining..."
            className="mt-4 min-h-[100px]"
          />

          <DialogFooter className="mt-6">
            <Button
              onClick={() => setShowRejectDialog(false)}
              variant="outline"
              className="h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim()}
              variant="destructive"
              className="h-11"
            >
              Decline document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== PAUSE / SAVE FOR LATER DIALOG ==================== */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-indigo-600" />
              Save & Finish later
            </DialogTitle>
            <DialogDescription>
              Your filled fields will be saved on this device. You can return to this signing
              link any time before the document expires.
            </DialogDescription>
          </DialogHeader>

          {sessionData.expires_at && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
              This document expires on{' '}
              <strong>
                {new Date(sessionData.expires_at).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </strong>.
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" className="h-11" onClick={() => setShowPauseDialog(false)}>
              Keep signing
            </Button>
            <Button
              onClick={handlePauseConfirm}
              className="bg-indigo-600 hover:bg-indigo-700 h-11"
            >
              <PauseCircle className="h-4 w-4 mr-1.5" />
              Save & exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
