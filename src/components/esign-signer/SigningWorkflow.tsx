/**
 * Signing Workflow
 * Main document viewing and signing interface for signers.
 * 
 * Features:
 * - Continuous vertical scroll PDF viewing with zoom controls
 * - Field-type-specific input dialogs (signature/initials canvas, text input, date picker, checkbox toggle)
 * - ECTA consent disclosure before final submission
 * - Signature/value preview in completed fields
 * - Mobile-responsive with sticky header
 * - Sequential signing lock support
 * - Guided "Start / Next" navigation
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Checkbox as UICheckbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  FileText,
  Check,
  X,
  Loader2,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  ArrowRight,
  Flag,
  Menu,
  Lock,
  Shield,
  Calendar,
  Type,
  CheckSquare,
  Pen,
  ShieldCheck,
} from 'lucide-react';
import { SignatureCanvas } from './SignatureCanvas';
import { FieldHighlight } from './FieldHighlight';
import type { SignerSessionData, SignatureData, SignerField } from './types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet';

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

export function SigningWorkflow({
  token,
  sessionData,
  onComplete,
  onReject,
  submitSignature
}: SigningWorkflowProps) {
  // Auto-detect mobile and set a lower initial zoom so the PDF fits the screen
  const isMobileRef = useRef(typeof window !== 'undefined' && window.innerWidth < 768);
  const [zoom, setZoom] = useState(() => {
    if (typeof window === 'undefined') return 100;
    // On mobile, start at a zoom that roughly fits the viewport width.
    // A4 at 100% ≈ 595px. A Samsung S25 viewport is ~360-412px.
    if (window.innerWidth < 768) {
      return Math.max(50, Math.round((window.innerWidth - 32) / 595 * 100));
    }
    return 100;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showDropdownDialog, setShowDropdownDialog] = useState(false);
  const [currentField, setCurrentField] = useState<SignerField | null>(null);
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Text/Date field input state
  const [textInput, setTextInput] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dropdownValue, setDropdownValue] = useState('');

  // ECTA consent
  const [consentAccepted, setConsentAccepted] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Auto-fill auto_date fields on mount ──────────────────────────────
  // auto_date fields are read-only from the signer's perspective —
  // they capture the moment the signer enters the signing workflow.
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

  // ── pdf.js state ──────────────────────────────────────────────────────
  const pdfDocRef = useRef<Record<string, unknown> | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  /** Per-page dimension info resolved from the actual PDF */
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

        pdfDocRef.current = pdf;

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

  // ── Render pages to canvases when pageDims or zoom change ─────────────
  useEffect(() => {
    if (!pdfDocRef.current || pageDims.length === 0) return;

    const pdf = pdfDocRef.current as { getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void } }> };
    const scale = zoom / 100;

    renderTasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* noop */ } });
    renderTasksRef.current.clear();

    pageDims.forEach(async (info) => {
      const canvas = canvasRefs.current.get(info.pageNumber);
      if (!canvas) return;

      try {
        const page = await pdf.getPage(info.pageNumber);
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
        renderTasksRef.current.set(info.pageNumber, renderTask);
        await renderTask.promise;
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error(`Failed to render signing page ${info.pageNumber}:`, err);
        }
      }
    });
  }, [pageDims, zoom]);

  // Callback ref for canvas elements
  const setCanvasRef = useCallback(
    (pageNumber: number) => (el: HTMLCanvasElement | null) => {
      if (el) { canvasRefs.current.set(pageNumber, el); }
      else { canvasRefs.current.delete(pageNumber); }
    },
    [],
  );

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

  // Sequential signing: check if fields are locked (not this signer's turn)
  const isFieldsLocked = sessionData.is_turn === false;

  // Determine if fields use 0-based or 1-based indexing
  const usesZeroBasedIndexing = useMemo(() =>
    fields.some(f => f.page === 0),
    [fields]);

  // Calculate total pages to render
  const displayPageCount = useMemo(() => {
    const pdfPageCount = sessionData.page_count || 1;
    const maxFieldPage = fields.length > 0
      ? Math.max(...fields.map(f => f.page)) + (usesZeroBasedIndexing ? 1 : 0)
      : 1;
    return Math.max(pdfPageCount, maxFieldPage);
  }, [sessionData.page_count, fields, usesZeroBasedIndexing]);

  // Filter fields for current signer
  const signerFields = useMemo(() =>
    fields.filter(f => f.signer_id === sessionData.signer_id),
    [fields, sessionData.signer_id]);

  const requiredFields = useMemo(() =>
    signerFields.filter(f => f.required)
      .sort((a, b) => (a.page - b.page) || (a.y - b.y)),
    [signerFields]);

  const completedFields = useMemo(() =>
    signatures.filter(s => requiredFields.some(f => f.id === s.field_id)),
    [signatures, requiredFields]);

  // Calculate progress
  const progress = requiredFields.length > 0
    ? (completedFields.length / requiredFields.length) * 100
    : 100;

  const allRequiredFieldsCompleted = completedFields.length === requiredFields.length;

  // Find next incomplete required field
  const nextIncompleteField = useMemo(() => {
    return requiredFields.find(f => !signatures.some(s => s.field_id === f.id));
  }, [requiredFields, signatures]);

  // ==================== FIELD CLICK HANDLERS ====================

  const handleFieldClick = useCallback((field: SignerField) => {
    setCurrentField(field);
    setError(null);

    switch (field.type) {
      case 'signature':
      case 'initials':
        setShowSignatureDialog(true);
        break;
      case 'text':
        // Pre-populate with existing value if editing
        const existingText = signatures.find(s => s.field_id === field.id)?.value || '';
        setTextInput(existingText);
        setShowTextDialog(true);
        break;
      case 'date':
        const existingDate = signatures.find(s => s.field_id === field.id)?.value || '';
        setDateInput(existingDate);
        setShowDateDialog(true);
        break;
      case 'checkbox':
        // Toggle immediately
        handleCheckboxToggle(field);
        break;
      case 'auto_date':
        // Auto-date fields are auto-populated on submit — show as pre-filled
        {
          const now = new Date().toLocaleDateString('en-ZA', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
          });
          setSignatures(prev => {
            const existing = prev.find(s => s.field_id === field.id);
            if (existing) return prev.map(s => s.field_id === field.id ? { ...s, value: now } : s);
            return [...prev, { field_id: field.id, type: 'auto_date', value: now }];
          });
        }
        break;
      case 'dropdown':
        {
          const existingDropdown = signatures.find(s => s.field_id === field.id)?.value || '';
          setDropdownValue(existingDropdown);
          setShowDropdownDialog(true);
        }
        break;
    }
  }, [signatures]);

  const handleCheckboxToggle = useCallback((field: SignerField) => {
    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === field.id);
      if (existing) {
        // Toggle: if currently checked, uncheck (remove)
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

  const handleSignatureSave = useCallback((signatureData: string) => {
    if (!currentField) return;

    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === currentField.id);
      if (existing) {
        return prev.map(s =>
          s.field_id === currentField.id
            ? { ...s, value: signatureData }
            : s
        );
      }
      return [...prev, {
        field_id: currentField.id,
        type: currentField.type,
        value: signatureData
      }];
    });

    setShowSignatureDialog(false);
    setCurrentField(null);
  }, [currentField]);

  const handleTextSave = useCallback(() => {
    if (!currentField || !textInput.trim()) return;

    setSignatures(prev => {
      const existing = prev.find(s => s.field_id === currentField.id);
      if (existing) {
        return prev.map(s =>
          s.field_id === currentField.id ? { ...s, value: textInput.trim() } : s
        );
      }
      return [...prev, { field_id: currentField.id, type: 'text', value: textInput.trim() }];
    });

    setShowTextDialog(false);
    setCurrentField(null);
    setTextInput('');
  }, [currentField, textInput]);

  const handleDateSave = useCallback(() => {
    if (!currentField || !dateInput) return;

    // Format date nicely for display
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
        el.classList.add('ring-4', 'ring-primary/50');
        setTimeout(() => el.classList.remove('ring-4', 'ring-primary/50'), 1000);
      }
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }, [nextIncompleteField]);

  // ==================== SUBMIT ====================

  const handleFinishClick = useCallback(() => {
    if (!allRequiredFieldsCompleted) {
      setError('Please complete all required fields before submitting');
      scrollToNextField();
      return;
    }
    // Show ECTA consent dialog before final submit
    setShowConsentDialog(true);
  }, [allRequiredFieldsCompleted, scrollToNextField]);

  const handleFinalSubmit = useCallback(async () => {
    if (!consentAccepted) return;

    setShowConsentDialog(false);
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitSignature(token, signatures);
      if (result.success) {
        onComplete();
      } else {
        setError(result.error || 'Failed to submit signature. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [consentAccepted, token, signatures, submitSignature, onComplete]);

  const handleRejectSubmit = useCallback(() => {
    if (!rejectReason.trim()) return;
    setShowRejectDialog(false);
    onReject(rejectReason);
  }, [rejectReason, onReject]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));

  return (
    <div className="flex flex-col h-screen bg-gray-100/50">
      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="bg-white border-b h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3 overflow-hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Document Details</SheetTitle>
                <SheetDescription>
                  {envelope_title}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Progress</h4>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {completedFields.length} of {requiredFields.length} required fields completed
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Signer</h4>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                      {sessionData.signer_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{sessionData.signer_name}</p>
                      <p className="text-xs text-gray-500">{sessionData.signer_email}</p>
                    </div>
                  </div>
                </div>
                {/* Mobile Decline Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSidebarOpen(false);
                    setShowRejectDialog(true);
                  }}
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  disabled={isSubmitting}
                >
                  Decline to Sign
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2.5 min-w-0">
            {/* Brand Icon */}
            <div className="h-8 w-8 hidden md:flex rounded-lg bg-indigo-600 text-white items-center justify-center shadow-sm flex-shrink-0">
              <FileText className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-base font-semibold truncate max-w-[180px] md:max-w-md text-gray-900">
                {envelope_title}
              </h1>
              <p className="text-[11px] text-gray-500 hidden md:block">
                Review and sign this document
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Desktop Progress */}
          <div className="hidden md:flex items-center mr-2">
            <div className="text-right mr-3">
              <p className="text-xs font-medium text-gray-900">
                {completedFields.length}/{requiredFields.length} completed
              </p>
              <Progress value={progress} className="h-1.5 w-28 mt-1" />
            </div>
          </div>

          {/* Mobile Progress */}
          <div className="md:hidden flex items-center gap-1.5 mr-1">
            <span className="text-xs font-medium text-gray-600">
              {completedFields.length}/{requiredFields.length}
            </span>
            <Progress value={progress} className="h-1.5 w-14" />
          </div>

          {/* Desktop Decline */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRejectDialog(true)}
            className="hidden md:flex text-gray-500 hover:text-red-600 hover:bg-red-50"
            disabled={isSubmitting}
          >
            Decline
          </Button>

          {/* Finish Button */}
          <Button
            onClick={handleFinishClick}
            disabled={!allRequiredFieldsCompleted || isSubmitting || isFieldsLocked}
            className={`transition-all text-sm h-9 md:h-10 px-4 md:px-6 ${
              allRequiredFieldsCompleted && !isFieldsLocked
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md'
                : 'bg-gray-400'
            }`}
          >
            {isSubmitting ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                <span className="hidden md:inline">Processing</span>
              </div>
            ) : isFieldsLocked ? (
              <div className="contents">
                <Lock className="h-4 w-4 mr-1.5" />
                <span className="hidden md:inline">Locked</span>
              </div>
            ) : (
              <div className="contents">
                <span>Finish</span>
                <Check className="h-4 w-4 ml-1.5" />
              </div>
            )}
          </Button>
        </div>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 bg-gray-100/50 scroll-smooth relative"
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

          <div className="flex flex-col items-center gap-8 pb-32 min-h-full">
            {/* Zoom Controls Floating */}
            <div className="fixed bottom-6 left-6 z-30 bg-white shadow-lg border rounded-full p-1 hidden md:flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomOut} disabled={zoom <= 50}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={handleZoomIn} disabled={zoom >= 200}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile Zoom Controls — smaller, bottom-left */}
            <div className="fixed bottom-20 left-3 z-30 bg-white/90 shadow-lg border rounded-full p-0.5 flex md:hidden items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomOut} disabled={zoom <= 50}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[10px] font-medium w-8 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleZoomIn} disabled={zoom >= 200}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Render All Pages - Continuous Scroll */}
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

              const pageFields = signerFields.filter(f =>
                usesZeroBasedIndexing
                  ? f.page === (pageNumber - 1)
                  : f.page === pageNumber
              );

              // Use actual PDF page dimensions when available, fall back to A4 aspect ratio
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
                    // Use aspect-ratio instead of fixed height — when maxWidth: 100%
                    // constrains the width on mobile, the height shrinks proportionally
                    // so the PDF maintains its natural proportions.
                    aspectRatio: `${dim.width} / ${dim.height}`,
                  } : {
                    width: `${zoom}%`,
                    maxWidth: '1000px',
                    aspectRatio: '1 / 1.414',
                    minHeight: '300px',
                  }}
                >
                  {/* Page Indicator */}
                  <div className="absolute -left-12 top-0 text-xs text-gray-400 font-medium hidden xl:block">
                    Page {pageNumber}
                  </div>

                  {/* Document Content - PDF Page via pdf.js Canvas */}
                  {sessionData.document_url && dim ? (
                    <div className="absolute inset-0 overflow-hidden bg-white z-0">
                      <canvas
                        ref={setCanvasRef(pageNumber)}
                        className="absolute top-0 left-0"
                        style={{ width: '100%', height: '100%' }}
                      />
                      {/* Transparent overlay to intercept clicks for fields */}
                      <div className="absolute inset-0 z-[1]" />
                    </div>
                  ) : !sessionData.document_url ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-100 pointer-events-none border border-gray-100 z-0">
                      <FileText className="h-32 w-32 mb-4" strokeWidth={1} />
                      <p className="text-lg font-medium text-gray-300">Page {pageNumber}</p>
                      <p className="text-sm text-gray-300">Document preview not available</p>
                    </div>
                  ) : null}

                  {/* Fields Overlay Container */}
                  <div className="absolute inset-0 z-10 pointer-events-none">
                    {pageFields.map((field) => {
                      const signature = signatures.find(s => s.field_id === field.id);
                      return (
                        <div id={`field-${field.id}`} key={field.id} className="absolute inset-0 pointer-events-none">
                          <FieldHighlight
                            field={field}
                            zoom={zoom}
                            isFilled={!!signature}
                            filledValue={signature?.value}
                            locked={isFieldsLocked}
                            onClick={() => handleFieldClick(field)}
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

        {/* ==================== FLOATING "START / NEXT" BUTTON ==================== */}
        <div className="fixed bottom-8 right-8 z-40">
          <AnimatePresence>
            {!allRequiredFieldsCompleted && !isFieldsLocked && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
              >
                <Button
                  size="lg"
                  onClick={scrollToNextField}
                  className="shadow-xl bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-semibold rounded-full px-8 h-14 text-lg"
                >
                  {signatures.length === 0 ? 'Start' : 'Next'}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ==================== SIGNATURE DIALOG ==================== */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pen className="h-5 w-5 text-indigo-600" />
              {currentField?.type === 'signature' ? 'Create Your Signature' :
                currentField?.type === 'initials' ? 'Create Your Initials' :
                  'Sign Document'}
            </DialogTitle>
            <DialogDescription>
              Draw, type, or upload your {currentField?.type || 'signature'}. This will be applied to the document.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <SignatureCanvas
              onSave={handleSignatureSave}
              onCancel={() => {
                setShowSignatureDialog(false);
                setCurrentField(null);
              }}
              type={currentField?.type || 'signature'}
              existingValue={signatures.find(s => s.field_id === currentField?.id)?.value}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ==================== TEXT INPUT DIALOG ==================== */}
      <Dialog open={showTextDialog} onOpenChange={(open) => {
        setShowTextDialog(open);
        if (!open) setCurrentField(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Type className="h-5 w-5 text-indigo-600" />
              Enter Text
            </DialogTitle>
            <DialogDescription>
              Type the requested information for this field.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="text-field-input">Text Value</Label>
              <Input
                id="text-field-input"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter text..."
                className="text-base"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput.trim()) handleTextSave();
                }}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setShowTextDialog(false);
              setCurrentField(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleTextSave}
              disabled={!textInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
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
              Select Date
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
                className="text-base"
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
            <Button variant="outline" onClick={() => {
              setShowDateDialog(false);
              setCurrentField(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleDateSave}
              disabled={!dateInput}
              className="bg-indigo-600 hover:bg-indigo-700"
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
              Select an Option
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
                onClick={() => setDropdownValue(option)}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
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
            <Button variant="outline" onClick={() => {
              setShowDropdownDialog(false);
              setCurrentField(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleDropdownSave}
              disabled={!dropdownValue}
              className="bg-indigo-600 hover:bg-indigo-700"
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
              Confirm Your Signature
            </DialogTitle>
            <DialogDescription>
              Please review the following before completing your signature.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Summary */}
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

            {/* Legal Consent */}
            <div className="border rounded-lg p-4 bg-white">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Electronic Signature Consent</h4>
              <div className="text-xs text-gray-600 space-y-2 max-h-32 overflow-y-auto pr-2">
                <p>
                  By checking the box below and clicking "Submit Signature", I confirm and agree that:
                </p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    I have reviewed the document in its entirety and understand its contents.
                  </li>
                  <li>
                    I intend my electronic signature to have the same legal effect as a handwritten signature,
                    in accordance with the Electronic Communications and Transactions Act 25 of 2002 (ECTA) of South Africa.
                  </li>
                  <li>
                    I consent to conducting this transaction electronically and acknowledge that my signature
                    is legally binding.
                  </li>
                  <li>
                    I understand that a record of this signing, including timestamp, IP address, and device
                    information, will be maintained for audit purposes.
                  </li>
                </ol>
              </div>
            </div>

            {/* Consent Checkbox */}
            <div className="flex items-start gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <UICheckbox
                id="ecta-consent"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="ecta-consent" className="text-sm text-gray-800 cursor-pointer leading-snug">
                I have read and agree to the above. I confirm this is my signature and I intend to
                electronically sign this document.
              </Label>
            </div>
          </div>

          <DialogFooter className="mt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setShowConsentDialog(false);
              setConsentAccepted(false);
            }}>
              Go Back
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={!consentAccepted || isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="contents">
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  Submit Signature
                </div>
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
              Decline to Sign
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={!rejectReason.trim()}
              variant="destructive"
            >
              Decline Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}