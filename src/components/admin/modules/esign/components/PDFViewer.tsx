/**
 * PDF Viewer Component
 *
 * Renders PDF documents using pdf.js with canvas-based page rendering.
 * Supports zoom controls, vertical scrolling, and drag-and-drop field
 * placement for e-signature workflows.
 *
 * Key fix: Uses pdf.js to detect the actual page count instead of
 * a hardcoded value, ensuring all document pages are displayed.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  FileText,
  Loader2,
  AlertCircle,
  Move,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { EsignField, FieldType, SignerFormData } from '../types';
import { SIGNER_COLORS } from '../constants';

// ── pdf.js bootstrap (npm import — avoids CSP issues with CDN script injection) ──
import * as pdfjsLib from 'pdfjs-dist';

// Configure the web worker source via CDN, dynamically matching the installed library version
// jsdelivr mirrors npm exactly, so every published version is guaranteed to be available
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Standard font data URL — required so pdf.js can resolve built-in PDF fonts
// (e.g. ZapfDingbats, Symbol) that are not available as system fonts in the browser.
const STANDARD_FONT_DATA_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

// ── Types ────────────────────────────────────────────────────────────────

interface PDFViewerProps {
  documentUrl?: string;
  documentName?: string;
  fields?: EsignField[];
  signers?: SignerFormData[];
  onFieldPlace?: (field: Partial<EsignField>) => void;
  /**
   * Update a single field's position/size (multi-update for bulk drag is
   * handled internally via a one-shot callback per dragged field).
   */
  onFieldUpdate?: (fieldId: string, updates: Partial<EsignField>) => void;
  onFieldDelete?: (fieldId: string) => void;
  /**
   * Click handler. The second argument carries modifier-key state so the
   * studio can implement shift-click multi-select without re-binding events
   * here.
   */
  onFieldClick?: (field: EsignField | null, modifiers?: { shiftKey: boolean; metaOrCtrl: boolean }) => void;
  selectedSignerId?: string;
  /** Single-selection (back-compat). Treated as the "primary" selection. */
  selectedFieldId?: string;
  /**
   * Multi-selection set. When provided, takes precedence over `selectedFieldId`
   * for visual highlighting; bulk drag/delete work against this set.
   */
  selectedFieldIds?: Set<string>;
  /**
   * Optional filter — when present, only fields whose `signer_id` is in this
   * set are shown (used by the studio's signer-legend "filter by signer"
   * affordance). Hidden fields remain in state and are still re-rendered when
   * the filter is cleared.
   */
  visibleSignerIds?: Set<string>;
  /** When true, snap field positions/sizes to a grid (Phase 2 alignment). */
  snapToGrid?: boolean;
  /** Grid size in PDF points (default 8). */
  gridSize?: number;
  /**
   * Fired when the user marquee-selects (drag-rectangle on empty page area).
   * The studio replaces its selection with the returned set (or unions with
   * shift held during the drag).
   */
  onMarqueeSelect?: (fieldIds: string[], modifiers: { shiftKey: boolean; metaOrCtrl: boolean }) => void;
  readOnly?: boolean;
  showFields?: boolean;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  /**
   * P2.5 2.3 — fired once per loaded document with the total page count so
   * the studio can offer "Apply to all pages" without re-parsing the PDF.
   */
  onPageCount?: (count: number) => void;
}

type ZoomLevel = 25 | 50 | 75 | 100 | 125 | 150 | 200;

const ZOOM_LEVELS: ZoomLevel[] = [25, 50, 75, 100, 125, 150, 200];

// Fallback A4 size in PDF points — used if a page's mediaBox is unavailable
const DEFAULT_PAGE_WIDTH = 595;
const DEFAULT_PAGE_HEIGHT = 842;

/** Per-page dimension info resolved from the actual PDF */
interface PageInfo {
  pageNumber: number;
  width: number;   // in PDF points
  height: number;  // in PDF points
}

// ── Component ────────────────────────────────────────────────────────────

export function PDFViewer({
  documentUrl,
  documentName = 'Document',
  fields = [],
  signers = [],
  onFieldPlace,
  onFieldUpdate,
  onFieldDelete,
  onFieldClick,
  selectedSignerId,
  selectedFieldId,
  selectedFieldIds,
  visibleSignerIds,
  snapToGrid = true,
  gridSize = 8,
  onMarqueeSelect,
  readOnly = false,
  showFields = true,
  isFullScreen = false,
  onToggleFullScreen,
  onPageCount,
}: PDFViewerProps) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for canvas rendering
  const pdfDocRef = useRef<Record<string, unknown> | null>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());

  // State for dragging / resizing fields
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [dragOverPage, setDragOverPage] = useState<number | null>(null);

  /**
   * Live alignment guides shown during drag. Populated from
   * `handleFieldMouseDown` whenever the dragged field's edge or center comes
   * within `SNAP_TOLERANCE_PCT` of any other field on the same page.
   *
   *   { x?: number; y?: number; pageNumber: number }
   *
   * Values are in PERCENT (matching `EsignField.x/y`).
   */
  const [guides, setGuides] = useState<{ pageNumber: number; xs: number[]; ys: number[] } | null>(null);

  /** Marquee state — page-relative percent rectangle. */
  const [marquee, setMarquee] = useState<{
    pageNumber: number;
    startXPct: number;
    startYPct: number;
    endXPct: number;
    endYPct: number;
    shiftKey: boolean;
    metaOrCtrl: boolean;
  } | null>(null);

  /**
   * Effective selection set used for highlighting. Falls back to a single-id
   * set if the parent only passed the legacy `selectedFieldId`.
   */
  const effectiveSelection = selectedFieldIds ?? new Set(selectedFieldId ? [selectedFieldId] : []);
  const isFieldSelected = (id: string) => effectiveSelection.has(id);
  const isPrimarySelection = (id: string) => id === selectedFieldId;

  // ── Snap helpers ──────────────────────────────────────────────────
  // We snap in PERCENT space (the storage unit) by converting the grid
  // size from PDF points to a per-page percent step. The studio passes
  // `snapToGrid` so users can hold Alt to disable per-drag.
  const snapPctX = (pct: number, pageWidthPts: number): number => {
    if (!snapToGrid || pageWidthPts <= 0) return pct;
    const stepPct = (gridSize / pageWidthPts) * 100;
    return Math.round(pct / stepPct) * stepPct;
  };
  const snapPctY = (pct: number, pageHeightPts: number): number => {
    if (!snapToGrid || pageHeightPts <= 0) return pct;
    const stepPct = (gridSize / pageHeightPts) * 100;
    return Math.round(pct / stepPct) * stepPct;
  };

  // Fields that are visually rendered after applying the optional
  // visible-signer filter from the studio's legend. We always render the
  // full set during search-style filtering; CC recipients have no fields.
  const renderedFields = visibleSignerIds
    ? fields.filter((f) => f.signer_id && visibleSignerIds.has(f.signer_id))
    : fields;

  // ── Load PDF document via pdf.js ───────────────────────────────────

  useEffect(() => {
    if (!documentUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setPages([]);

      try {
        const loadingTask = pdfjsLib.getDocument({
          url: documentUrl,
          withCredentials: false,
          standardFontDataUrl: STANDARD_FONT_DATA_URL,
        });
        const pdf = await loadingTask.promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;

        // Collect page dimensions
        const pageInfos: PageInfo[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          pageInfos.push({ pageNumber: i, width: vp.width, height: vp.height });
        }

        if (!cancelled) {
          setPages(pageInfos);
          setLoading(false);
          // P2.5 2.3 — surface the page count to the parent so it can offer
          // "Apply to all pages" without re-parsing the PDF.
          onPageCount?.(pdf.numPages);
          console.log(`PDF loaded: ${pdf.numPages} page(s) — ${documentUrl.slice(0, 80)}`);
        }
      } catch (err: unknown) {
        console.error('Failed to load PDF:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF document.');
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      // Cancel any in-flight render tasks
      renderTasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* noop */ } });
      renderTasksRef.current.clear();
      // Destroy the PDF document
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [documentUrl]);

  // ── Render pages to canvases ──────────────────────────────────────

  useEffect(() => {
    if (!pdfDocRef.current || pages.length === 0) return;

    const pdf = pdfDocRef.current;
    const scale = zoom / 100;

    // Cancel previous render tasks
    renderTasksRef.current.forEach((task) => { try { task.cancel(); } catch { /* noop */ } });
    renderTasksRef.current.clear();

    pages.forEach(async (info) => {
      const canvas = canvasRefs.current.get(info.pageNumber);
      if (!canvas) return;

      try {
        const page = await pdf.getPage(info.pageNumber);
        const viewport = page.getViewport({ scale });

        // Set canvas size to match the scaled viewport (for crisp rendering)
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
          console.error(`Failed to render page ${info.pageNumber}:`, err);
        }
      }
    });
  }, [pages, zoom]);

  // ── Zoom controls ─────────────────────────────────────────────────

  const handleZoomIn = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[idx + 1]);
  };

  const handleZoomOut = () => {
    const idx = ZOOM_LEVELS.indexOf(zoom);
    if (idx > 0) setZoom(ZOOM_LEVELS[idx - 1]);
  };

  const handleFitToWidth = () => setZoom(100);

  // ── Drag-and-drop field placement ─────────────────────────────────

  const handleDragOver = useCallback(
    (e: React.DragEvent, page: number) => {
      if (readOnly || !onFieldPlace) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverPage(page);
    },
    [readOnly, onFieldPlace],
  );

  const handleDragLeave = useCallback(() => setDragOverPage(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, page: number) => {
      if (readOnly || !onFieldPlace) return;

      e.preventDefault();
      setDragOverPage(null);

      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const { fieldType, signerId } = data;

        const target = e.currentTarget as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const dimensions: Record<string, { width: number; height: number }> = {
          signature: { width: 200, height: 60 },
          initials: { width: 80, height: 40 },
          text: { width: 200, height: 40 },
          date: { width: 120, height: 40 },
          checkbox: { width: 24, height: 24 },
        };

        const { width, height } = dimensions[fieldType as FieldType] || { width: 150, height: 40 };

        const newField: Partial<EsignField> = {
          type: fieldType as FieldType,
          signer_id: signerId || selectedSignerId,
          page,
          x: Math.max(0, Math.min(95, x)),
          y: Math.max(0, Math.min(95, y)),
          width,
          height,
          required: true,
        };

        onFieldPlace(newField);
      } catch (err) {
        console.error('Failed to parse drop data:', err);
      }
    },
    [readOnly, onFieldPlace, selectedSignerId],
  );

  // ── Field drag & resize ───────────────────────────────────────────

  const handleFieldMouseDown = useCallback(
    (e: React.MouseEvent, field: EsignField) => {
      if (readOnly || !onFieldUpdate) return;

      e.stopPropagation();
      e.preventDefault();

      const target = (e.target as HTMLElement).closest('.page-container');
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;

      // Compose the bulk-drag set: every other selected field on the same
      // page moves with the primary field. We capture starting positions
      // up-front so each tick can compute deltas independently — this is
      // both faster and more numerically stable than reading current
      // positions each frame.
      const primaryStart = { id: field.id, x: field.x, y: field.y };
      const bulkStarts: Array<{ id: string; x: number; y: number }> = [];
      effectiveSelection.forEach((selId) => {
        if (selId === field.id) return;
        const f = fields.find((ff) => ff.id === selId);
        if (f && f.page === field.page) bulkStarts.push({ id: f.id, x: f.x, y: f.y });
      });

      // Find the page info so we can snap correctly (snap step is PDF-points
      // → percent of page width/height).
      const pageInfo = pages.find((p) => p.pageNumber === field.page);
      const pageWidthPts = pageInfo?.width || 595;
      const pageHeightPts = pageInfo?.height || 842;

      // Pre-compute the X/Y "magnet" lines from every other field on the
      // same page (left/center/right edges and top/middle/bottom edges).
      // We compare in percent space; SNAP_TOLERANCE_PCT below is half a
      // grid step so the tolerance scales with the configured grid.
      const others = fields.filter((f) => f.page === field.page && f.id !== field.id);
      const magnetXs = new Set<number>();
      const magnetYs = new Set<number>();
      const widthPctOf = (f: EsignField) => (f.width / pageWidthPts) * 100;
      const heightPctOf = (f: EsignField) => (f.height / pageHeightPts) * 100;
      others.forEach((f) => {
        const w = widthPctOf(f);
        const h = heightPctOf(f);
        magnetXs.add(f.x);
        magnetXs.add(f.x + w / 2);
        magnetXs.add(f.x + w);
        magnetYs.add(f.y);
        magnetYs.add(f.y + h / 2);
        magnetYs.add(f.y + h);
      });
      const ownWPct = widthPctOf(field);
      const ownHPct = heightPctOf(field);
      const SNAP_TOLERANCE_PCT = ((gridSize / 2) / pageWidthPts) * 100;

      setDraggingField(field.id);
      setGuides(null);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaPercentX = ((moveEvent.clientX - startX) / rect.width) * 100;
        const deltaPercentY = ((moveEvent.clientY - startY) / rect.height) * 100;

        // Snap is disabled while the user holds Alt (Option). Same convention
        // as Figma / Sketch — gives precise nudging on demand.
        const altDisablesSnap = moveEvent.altKey;

        let nextX = primaryStart.x + deltaPercentX;
        let nextY = primaryStart.y + deltaPercentY;

        // Try magnet snapping FIRST (smart guides), then fall back to grid.
        const guideXs: number[] = [];
        const guideYs: number[] = [];

        if (!altDisablesSnap) {
          // X-axis snap — try left edge, center, right edge against magnets.
          const candidates: Array<{ offset: number; line: number }> = [
            { offset: 0, line: nextX },
            { offset: ownWPct / 2, line: nextX + ownWPct / 2 },
            { offset: ownWPct, line: nextX + ownWPct },
          ];
          for (const cand of candidates) {
            for (const m of magnetXs) {
              if (Math.abs(cand.line - m) <= SNAP_TOLERANCE_PCT) {
                nextX = m - cand.offset;
                guideXs.push(m);
                break;
              }
            }
          }
          // Same for Y.
          const candY: Array<{ offset: number; line: number }> = [
            { offset: 0, line: nextY },
            { offset: ownHPct / 2, line: nextY + ownHPct / 2 },
            { offset: ownHPct, line: nextY + ownHPct },
          ];
          for (const cand of candY) {
            for (const m of magnetYs) {
              if (Math.abs(cand.line - m) <= SNAP_TOLERANCE_PCT) {
                nextY = m - cand.offset;
                guideYs.push(m);
                break;
              }
            }
          }

          // Then quantize to the regular grid.
          nextX = snapPctX(nextX, pageWidthPts);
          nextY = snapPctY(nextY, pageHeightPts);
        }

        // Clamp to page bounds.
        nextX = Math.max(0, Math.min(100 - ownWPct, nextX));
        nextY = Math.max(0, Math.min(100 - ownHPct, nextY));

        const finalDeltaX = nextX - primaryStart.x;
        const finalDeltaY = nextY - primaryStart.y;

        onFieldUpdate(field.id, { x: nextX, y: nextY });

        // Bulk-move every other selected field by the SAME delta as the
        // primary so the relative arrangement is preserved.
        bulkStarts.forEach((b) => {
          const bx = Math.max(0, Math.min(95, b.x + finalDeltaX));
          const by = Math.max(0, Math.min(95, b.y + finalDeltaY));
          onFieldUpdate(b.id, { x: bx, y: by });
        });

        setGuides({
          pageNumber: field.page,
          xs: guideXs,
          ys: guideYs,
        });
      };

      const handleMouseUp = () => {
        setDraggingField(null);
        setGuides(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [readOnly, onFieldUpdate, fields, pages, effectiveSelection, gridSize, snapToGrid],
  );

  // ── Marquee selection ──────────────────────────────────────────────
  // Mouse-down on EMPTY page area starts a rectangle. Releasing the mouse
  // selects every field whose center falls inside the rectangle. Holding
  // shift unions with the existing selection (handled by the studio).
  const handlePageMouseDown = useCallback(
    (e: React.MouseEvent, pageNumber: number) => {
      if (readOnly) return;
      if (!onMarqueeSelect) return;
      // Ignore clicks that originated on a field overlay (those have their
      // own handlers and call stopPropagation).
      const target = e.target as HTMLElement;
      if (target.closest('[data-field-overlay="true"]')) return;
      // Ignore right-click and modifier-clicks that aren't meant for marquee.
      if (e.button !== 0) return;

      const containerEl = (e.currentTarget as HTMLDivElement);
      const rect = containerEl.getBoundingClientRect();
      const startXPct = ((e.clientX - rect.left) / rect.width) * 100;
      const startYPct = ((e.clientY - rect.top) / rect.height) * 100;

      const shiftKey = e.shiftKey;
      const metaOrCtrl = e.metaKey || e.ctrlKey;

      setMarquee({ pageNumber, startXPct, startYPct, endXPct: startXPct, endYPct: startYPct, shiftKey, metaOrCtrl });

      const handleMove = (mv: MouseEvent) => {
        const r = containerEl.getBoundingClientRect();
        const ex = ((mv.clientX - r.left) / r.width) * 100;
        const ey = ((mv.clientY - r.top) / r.height) * 100;
        setMarquee((m) => (m ? { ...m, endXPct: ex, endYPct: ey } : m));
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        setMarquee((current) => {
          if (!current) return null;
          const minX = Math.min(current.startXPct, current.endXPct);
          const maxX = Math.max(current.startXPct, current.endXPct);
          const minY = Math.min(current.startYPct, current.endYPct);
          const maxY = Math.max(current.startYPct, current.endYPct);
          // Tiny rectangles are treated as a click (deselect) — must be
          // larger than ~0.5% on both axes to count as a marquee.
          if (Math.abs(maxX - minX) < 0.5 && Math.abs(maxY - minY) < 0.5) {
            onMarqueeSelect([], { shiftKey: current.shiftKey, metaOrCtrl: current.metaOrCtrl });
            return null;
          }
          const pageInfo = pages.find((p) => p.pageNumber === current.pageNumber);
          const wPts = pageInfo?.width || 595;
          const hPts = pageInfo?.height || 842;
          const hits = fields
            .filter((f) => f.page === current.pageNumber)
            .filter((f) => {
              const wp = (f.width / wPts) * 100;
              const hp = (f.height / hPts) * 100;
              const cx = f.x + wp / 2;
              const cy = f.y + hp / 2;
              return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY;
            })
            .map((f) => f.id);
          onMarqueeSelect(hits, { shiftKey: current.shiftKey, metaOrCtrl: current.metaOrCtrl });
          return null;
        });
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [readOnly, onMarqueeSelect, fields, pages],
  );

  const handleFieldResizeMouseDown = useCallback(
    (e: React.MouseEvent, field: EsignField) => {
      if (readOnly || !onFieldUpdate) return;

      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = field.width;
      const startHeight = field.height;

      setResizingField(field.id);

      const zoomFactor = zoom / 100;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        let nextW = Math.max(20, startWidth + (moveEvent.clientX - startX) / zoomFactor);
        let nextH = Math.max(20, startHeight + (moveEvent.clientY - startY) / zoomFactor);
        // Snap dimensions to the grid so resized fields stay aligned with
        // their neighbours. Hold Alt to disable.
        if (snapToGrid && !moveEvent.altKey) {
          nextW = Math.round(nextW / gridSize) * gridSize;
          nextH = Math.round(nextH / gridSize) * gridSize;
        }
        onFieldUpdate(field.id, { width: nextW, height: nextH });
      };

      const handleMouseUp = () => {
        setResizingField(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [readOnly, onFieldUpdate, zoom, snapToGrid, gridSize],
  );

  // ── Field rendering ───────────────────────────────────────────────

  const getSignerColor = useCallback(
    (signerId: string): string => {
      const idx = signers.findIndex((s) => s.email === signerId);
      return idx >= 0 ? SIGNER_COLORS[idx % SIGNER_COLORS.length].hex : '#6d28d9';
    },
    [signers],
  );

  const getSignerName = useCallback(
    (signerId: string): string => signers.find((s) => s.email === signerId)?.name || 'Unknown',
    [signers],
  );

  const renderField = useCallback(
    (field: EsignField) => {
      const color = getSignerColor(field.signer_id || '');
      const signerName = getSignerName(field.signer_id || '');
      const isSelected = isFieldSelected(field.id);
      const isPrimary = isPrimarySelection(field.id);
      const isRelatedSigner = field.signer_id === selectedSignerId;
      const isDragging = draggingField === field.id;
      const isResizing = resizingField === field.id;

      return (
        <div
          key={field.id}
          data-field-overlay="true"
          className={`absolute border-2 rounded cursor-move hover:shadow-lg transition-all group ${
            isDragging ? 'opacity-50' : ''
          } ${
            isPrimary
              ? 'ring-2 ring-purple-500 ring-offset-2 z-30'
              : isSelected
                ? 'ring-2 ring-purple-300 ring-offset-1 z-20'
                : isRelatedSigner
                  ? 'ring-1 ring-opacity-50'
                  : ''
          }`}
          style={{
            left: `${field.x}%`,
            top: `${field.y}%`,
            width: `${field.width}px`,
            height: `${field.height}px`,
            borderColor: color,
            backgroundColor: `${color}20`,
            zIndex: isDragging || isResizing || isSelected ? 50 : 10,
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onFieldClick?.(field, { shiftKey: e.shiftKey, metaOrCtrl: e.metaKey || e.ctrlKey });
          }}
          onMouseDown={(e) => handleFieldMouseDown(e, field)}
        >
          {/* Hover label */}
          <div
            className="absolute -top-6 left-0 px-2 py-0.5 rounded text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex items-center gap-1 pointer-events-none"
            style={{
              backgroundColor: color,
              transform: `scale(${100 / zoom})`,
              transformOrigin: 'bottom left',
            }}
          >
            <Move className="h-3 w-3" />
            {signerName} — {field.type}
            {field.required && ' *'}
          </div>

          {/* Delete button */}
          {!readOnly && onFieldDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFieldDelete(field.id);
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-50"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          {/* Resize handle */}
          {!readOnly && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center z-40 opacity-0 group-hover:opacity-100 transition-opacity"
              onMouseDown={(e) => handleFieldResizeMouseDown(e, field)}
              style={{ transform: `scale(${100 / zoom})`, transformOrigin: 'bottom right' }}
            >
              <div className="w-2 h-2 bg-white border border-gray-400 rounded-sm" />
            </div>
          )}

          {/* Content placeholder */}
          <div className="w-full h-full flex items-center justify-center text-xs font-medium opacity-50 pointer-events-none">
            {field.type === 'checkbox' ? '☐' : field.type.toUpperCase()}
          </div>
        </div>
      );
    },
    [
      draggingField,
      resizingField,
      selectedSignerId,
      selectedFieldId,
      effectiveSelection,
      readOnly,
      onFieldDelete,
      onFieldClick,
      zoom,
      handleFieldMouseDown,
      handleFieldResizeMouseDown,
      getSignerColor,
      getSignerName,
    ],
  );

  // ── Callback ref for canvas elements ──────────────────────────────

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

  // ── Empty / error states ──────────────────────────────────────────

  if (!documentUrl) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-3">
          <FileText className="h-16 w-16 text-gray-300 mx-auto" />
          <div>
            <h3 className="font-semibold text-lg">No document uploaded</h3>
            <p className="text-sm text-muted-foreground">Upload a PDF document to begin</p>
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <div>
            <h3 className="font-semibold text-lg text-red-900">Failed to load document</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <Button variant="outline" onClick={() => setError(null)}>
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // ── Main render ───────────────────────────────────────────────────

  const scale = zoom / 100;

  return (
    <div
      className="relative w-full h-full bg-gray-100/50 flex flex-col overflow-hidden min-h-0 group/viewer"
      tabIndex={0}
      onKeyDown={(e) => {
        if (effectiveSelection.size === 0 || readOnly || !onFieldUpdate) return;

        // Use BIG steps with shift, GRID-sized steps without (so arrow nudge
        // respects the configured snap grid and feels precise).
        const step = e.shiftKey ? 1.0 : 0.1;

        let dx = 0;
        let dy = 0;
        switch (e.key) {
          case 'ArrowLeft':  dx = -step; break;
          case 'ArrowRight': dx = step; break;
          case 'ArrowUp':    dy = -step; break;
          case 'ArrowDown':  dy = step; break;
          default: return;
        }

        e.preventDefault();
        // Nudge every selected field by the same delta so a multi-select stays
        // visually grouped (matches the bulk-drag behaviour).
        effectiveSelection.forEach((id) => {
          const f = fields.find((ff) => ff.id === id);
          if (!f) return;
          onFieldUpdate(f.id, {
            x: Math.max(0, Math.min(100, f.x + dx)),
            y: Math.max(0, Math.min(100, f.y + dy)),
          });
        });
      }}
    >
      {/* Scroll area */}
      <div
        className={`flex-1 overflow-auto relative ${isFullScreen ? 'p-0' : 'p-8'}`}
        onClick={() => onFieldClick?.(null)}
      >
        <div className="flex flex-col items-center gap-8 min-w-min pb-20">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <span className="ml-2 text-muted-foreground">Loading PDF...</span>
            </div>
          )}

          {!loading &&
            pages.map((info) => {
              const pageNumber = info.pageNumber;
              const isDragOver = dragOverPage === pageNumber;
              const pageFields = renderedFields.filter((f) => f.page === pageNumber);

              // Use actual page dimensions from the PDF
              const pageW = info.width;
              const pageH = info.height;
              const activeMarquee = marquee && marquee.pageNumber === pageNumber ? marquee : null;
              const activeGuides = guides && guides.pageNumber === pageNumber ? guides : null;

              return (
                <div
                  key={pageNumber}
                  style={{
                    width: `${pageW * scale}px`,
                    height: `${pageH * scale}px`,
                    position: 'relative',
                    marginBottom: '2rem',
                  }}
                >
                  {/* Page container — kept at native PDF size and scaled via CSS transform */}
                  <div
                    className={`page-container relative bg-white shadow-xl transition-shadow duration-200 origin-top-left ${
                      isDragOver ? 'ring-4 ring-purple-500 ring-opacity-50' : ''
                    }`}
                    style={{
                      width: `${pageW}px`,
                      height: `${pageH}px`,
                      transform: `scale(${scale})`,
                    }}
                    onDragOver={(e) => handleDragOver(e, pageNumber)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, pageNumber)}
                    onMouseDown={(e) => handlePageMouseDown(e, pageNumber)}
                  >
                    {/* Page number label */}
                    <div
                      className="absolute text-xs text-gray-400 font-medium hidden xl:block"
                      style={{
                        transform: `scale(${100 / zoom})`,
                        transformOrigin: 'top right',
                        right: '105%',
                        top: 0,
                      }}
                    >
                      Page {pageNumber}
                    </div>

                    {/* Canvas — rendered by pdf.js */}
                    <canvas
                      ref={setCanvasRef(pageNumber)}
                      className="absolute inset-0"
                      style={{ width: `${pageW}px`, height: `${pageH}px` }}
                    />

                    {/* Transparent interaction overlay (sits above canvas) */}
                    <div className="absolute inset-0 z-[1]" />

                    {/* Drag-over indicator */}
                    {isDragOver && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="bg-white/90 px-4 py-2 rounded-lg shadow-lg border-2 border-purple-500 border-dashed">
                          <p className="text-sm font-medium text-purple-900">Drop field here</p>
                        </div>
                      </div>
                    )}

                    {/* Field overlays */}
                    {showFields && pageFields.map(renderField)}

                    {/* Smart-guide lines — appear during drag when an edge or
                        center aligns with a neighbour. Pure visual; the snap
                        is already applied to the field positions. */}
                    {activeGuides && activeGuides.xs.length > 0 && activeGuides.xs.map((x, i) => (
                      <div
                        key={`gx-${i}`}
                        className="absolute top-0 bottom-0 pointer-events-none z-40"
                        style={{ left: `${x}%`, width: '1px', backgroundColor: '#a855f7' }}
                      />
                    ))}
                    {activeGuides && activeGuides.ys.length > 0 && activeGuides.ys.map((y, i) => (
                      <div
                        key={`gy-${i}`}
                        className="absolute left-0 right-0 pointer-events-none z-40"
                        style={{ top: `${y}%`, height: '1px', backgroundColor: '#a855f7' }}
                      />
                    ))}

                    {/* Marquee selection rectangle */}
                    {activeMarquee && (
                      <div
                        className="absolute pointer-events-none z-30"
                        style={{
                          left: `${Math.min(activeMarquee.startXPct, activeMarquee.endXPct)}%`,
                          top: `${Math.min(activeMarquee.startYPct, activeMarquee.endYPct)}%`,
                          width: `${Math.abs(activeMarquee.endXPct - activeMarquee.startXPct)}%`,
                          height: `${Math.abs(activeMarquee.endYPct - activeMarquee.startYPct)}%`,
                          backgroundColor: 'rgba(168, 85, 247, 0.12)',
                          border: '1px dashed #a855f7',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

          {/* Page count badge (shown after loading) */}
          {!loading && pages.length > 0 && (
            <div className="text-xs text-gray-400 pb-4">
              {pages.length} {pages.length === 1 ? 'page' : 'pages'} total
            </div>
          )}
        </div>
      </div>

      {/* Floating toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-transform duration-200 translate-y-2 group-hover/viewer:translate-y-0">
        <div className="bg-gray-900/90 backdrop-blur text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-4 border border-white/10">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 border-r border-white/20 pr-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-white/20 text-white"
              onClick={handleZoomOut}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium min-w-[3ch] text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-white/20 text-white"
              onClick={handleZoomIn}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          {/* Page info + fit controls */}
          <div className="flex items-center gap-2">
            {pages.length > 0 && (
              <span className="text-xs text-white/60 mr-1">
                {pages.length} pg{pages.length !== 1 ? 's' : ''}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-white/20 text-white"
              onClick={handleFitToWidth}
            >
              Fit Width
            </Button>
            {onToggleFullScreen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-white/20 text-white ml-2"
                onClick={onToggleFullScreen}
                aria-label={isFullScreen ? 'Exit full screen' : 'Enter full screen'}
              >
                {isFullScreen ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}