/**
 * Pure placement math for drag-and-drop field placement.
 *
 * Extracted from `PDFViewer.handleDrop` so the drop transform is unit-
 * testable — the drop path was previously unguarded and had three placement
 * defects: the field's TOP-LEFT landed under the cursor (the user aims with
 * the middle of the drag ghost, so every drop looked offset down-right),
 * grid snap only applied on the first post-drop nudge (visible jump), and
 * the clamp ignored the field's own size so wide fields overflowed the
 * right/bottom page edges.
 *
 * Coordinate contract (canonical, see `esign-pdf.service.ts`):
 *   x/y    — percent of page (0–100), y measured from the top
 *   width/height — PDF points
 */

import type { FieldType } from '../types';

/**
 * Default size per field type, in PDF points. Single source of truth for
 * the palette drop path (previously an inline map inside `handleDrop` that
 * silently fell back to 150×40 for any type it didn't list).
 */
export const DEFAULT_FIELD_DIMENSIONS: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 200, height: 60 },
  initials: { width: 80, height: 40 },
  text: { width: 200, height: 40 },
  date: { width: 120, height: 40 },
  checkbox: { width: 24, height: 24 },
  attachment: { width: 200, height: 60 },
  auto_date: { width: 120, height: 40 },
  dropdown: { width: 160, height: 40 },
  radio: { width: 160, height: 40 },
  note: { width: 220, height: 60 },
};

export function defaultDimensionsFor(type: string): { width: number; height: number } {
  return DEFAULT_FIELD_DIMENSIONS[type as FieldType] ?? { width: 150, height: 40 };
}

export interface DropPlacementInput {
  /** Pointer position at drop time (viewport coordinates). */
  clientX: number;
  clientY: number;
  /** Visual bounding box of the (possibly CSS-scaled) page container. */
  rect: { left: number; top: number; width: number; height: number };
  /** Real page size in PDF points. */
  pageWidthPts: number;
  pageHeightPts: number;
  /** Size of the field being placed, in PDF points. */
  fieldWidthPts: number;
  fieldHeightPts: number;
  /** Grid snapping — same semantics as the drag-move path. */
  snapToGrid: boolean;
  /** Grid step in PDF points. */
  gridSize: number;
}

/**
 * Where a dropped field's top-left lands, in percent of the page.
 *
 * The field is CENTERED on the cursor (matching what the user aims at),
 * quantized to the same grid the drag-move path uses, then clamped so the
 * whole field stays on the page.
 */
export function computeDropPosition(input: DropPlacementInput): { x: number; y: number } {
  const {
    clientX,
    clientY,
    rect,
    pageWidthPts,
    pageHeightPts,
    fieldWidthPts,
    fieldHeightPts,
    snapToGrid,
    gridSize,
  } = input;

  const safeW = pageWidthPts > 0 ? pageWidthPts : 595;
  const safeH = pageHeightPts > 0 ? pageHeightPts : 842;

  // Cursor as percent of the page. getBoundingClientRect() reflects the
  // CSS scale, and clientX/rect.left are both viewport-relative, so zoom
  // and scroll cancel out here.
  const cursorXPct = rect.width > 0 ? ((clientX - rect.left) / rect.width) * 100 : 0;
  const cursorYPct = rect.height > 0 ? ((clientY - rect.top) / rect.height) * 100 : 0;

  const wPct = (fieldWidthPts / safeW) * 100;
  const hPct = (fieldHeightPts / safeH) * 100;

  // Center on the cursor.
  let x = cursorXPct - wPct / 2;
  let y = cursorYPct - hPct / 2;

  // Same grid quantization as drag-move (percent step derived from the
  // point grid), so a dropped field does not jump on its first nudge.
  if (snapToGrid && gridSize > 0) {
    const stepX = (gridSize / safeW) * 100;
    const stepY = (gridSize / safeH) * 100;
    x = Math.round(x / stepX) * stepX;
    y = Math.round(y / stepY) * stepY;
  }

  // Size-aware clamp — identical rule to the drag-move path
  // (`100 - ownWPct`), so drop and drag agree at the page edges.
  x = Math.max(0, Math.min(100 - wPct, x));
  y = Math.max(0, Math.min(100 - hPct, y));

  return { x, y };
}

/**
 * Smallest width or height a field may have, in PDF points (~2mm). Small
 * enough for a tick box or a single line of a dense form. Was 20pt, and with
 * the 8pt grid snapping on by default no field could be under 24pt (8.5mm),
 * so a name field could not fit a typical form box.
 */
export const MIN_FIELD_PT = 6;

const PT_PER_MM = 72 / 25.4;

/** PDF points to millimetres. */
export const ptToMm = (pt: number): number => pt / PT_PER_MM;
/** Millimetres to PDF points. */
export const mmToPt = (mm: number): number => mm * PT_PER_MM;
/** A percent-of-page position to millimetres from that page edge. */
export const pctToMm = (pct: number, pageSizePt: number): number =>
  ptToMm((pct / 100) * pageSizePt);
/** Millimetres from a page edge to a percent-of-page position. */
export const mmToPct = (mm: number, pageSizePt: number): number =>
  pageSizePt > 0 ? (mmToPt(mm) / pageSizePt) * 100 : 0;

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface FieldRectPts {
  /** Left and top edges, in points from the page's top-left corner. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Resize a field rectangle by dragging one of its eight handles. All values
 * are PDF points. The opposite edge stays put; the result never shrinks
 * below MIN_FIELD_PT and never leaves the page.
 *
 * `snap` (grid step in points, or 0) quantises the MOVING edge only, so the
 * fixed edge is never pulled off the box the sender lined it up with.
 */
export function resizeRect(
  start: FieldRectPts,
  handle: ResizeHandle,
  dxPts: number,
  dyPts: number,
  page: { width: number; height: number },
  snap = 0,
): FieldRectPts {
  const q = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : v);
  let left = start.left;
  let top = start.top;
  let right = start.left + start.width;
  let bottom = start.top + start.height;

  if (handle.includes('w')) left = Math.min(q(left + dxPts), right - MIN_FIELD_PT);
  if (handle.includes('e')) right = Math.max(q(right + dxPts), left + MIN_FIELD_PT);
  if (handle.includes('n')) top = Math.min(q(top + dyPts), bottom - MIN_FIELD_PT);
  if (handle.includes('s')) bottom = Math.max(q(bottom + dyPts), top + MIN_FIELD_PT);

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(page.width, right);
  bottom = Math.min(page.height, bottom);

  return {
    left,
    top,
    width: Math.max(MIN_FIELD_PT, right - left),
    height: Math.max(MIN_FIELD_PT, bottom - top),
  };
}

/**
 * The zoom (percent) at which the widest page fills `availablePx`, clamped
 * to the viewer's zoom range.
 */
export function fitWidthZoom(
  availablePx: number,
  widestPagePts: number,
  range: { min: number; max: number } = { min: 25, max: 300 },
): number {
  if (!(availablePx > 0) || !(widestPagePts > 0)) return 100;
  const z = Math.floor((availablePx / widestPagePts) * 100);
  return Math.min(range.max, Math.max(range.min, z));
}
