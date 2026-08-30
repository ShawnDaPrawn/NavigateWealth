/**
 * Drop-placement math — the transform behind drag-and-drop field placement.
 *
 * Pins the three fixes to the drop path:
 *   1. the field is CENTERED on the cursor (previously its top-left landed
 *      under the pointer, so every drop looked offset down-right),
 *   2. grid snap applies AT drop time (previously the first nudge snapped
 *      and the field visibly jumped),
 *   3. the clamp is size-aware (previously Math.min(95, x) let wide fields
 *      overflow the page and disagreed with the drag-move clamp).
 */

import { describe, it, expect } from 'vitest';
import {
  computeDropPosition,
  defaultDimensionsFor,
  DEFAULT_FIELD_DIMENSIONS,
} from '../placementMath';

// A4 page rendered 1:1 (rect size == page points) — the common case.
const a4 = {
  rect: { left: 0, top: 0, width: 595, height: 842 },
  pageWidthPts: 595,
  pageHeightPts: 842,
};

describe('computeDropPosition', () => {
  it('centers the field on the cursor (snap off)', () => {
    const { x, y } = computeDropPosition({
      ...a4,
      clientX: 297.5, // 50% across
      clientY: 421, // 50% down
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: false,
      gridSize: 8,
    });
    const wPct = (200 / 595) * 100;
    const hPct = (60 / 842) * 100;
    expect(x).toBeCloseTo(50 - wPct / 2, 5);
    expect(y).toBeCloseTo(50 - hPct / 2, 5);
  });

  it('accounts for a CSS-scaled page container (zoomed studio)', () => {
    // Same drop point relative to the page, but the container is rendered
    // at 50% zoom and offset by scroll — the percent result must match the
    // unzoomed case because clientX and rect.left are both viewport-based.
    const { x } = computeDropPosition({
      clientX: 100 + 297.5 / 2,
      clientY: 40 + 421 / 2,
      rect: { left: 100, top: 40, width: 595 / 2, height: 842 / 2 },
      pageWidthPts: 595,
      pageHeightPts: 842,
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: false,
      gridSize: 8,
    });
    expect(x).toBeCloseTo(50 - ((200 / 595) * 100) / 2, 5);
  });

  it('quantizes to the same grid the drag-move path uses', () => {
    const gridSize = 8;
    const { x, y } = computeDropPosition({
      ...a4,
      clientX: 300,
      clientY: 400,
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: true,
      gridSize,
    });
    const stepX = (gridSize / 595) * 100;
    const stepY = (gridSize / 842) * 100;
    expect(Math.abs(x / stepX - Math.round(x / stepX))).toBeLessThan(1e-9);
    expect(Math.abs(y / stepY - Math.round(y / stepY))).toBeLessThan(1e-9);
  });

  it('clamps size-aware so the whole field stays on the page', () => {
    const { x, y } = computeDropPosition({
      ...a4,
      clientX: 594, // hugging the right edge
      clientY: 841, // hugging the bottom edge
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: false,
      gridSize: 8,
    });
    expect(x).toBeCloseTo(100 - (200 / 595) * 100, 5);
    expect(y).toBeCloseTo(100 - (60 / 842) * 100, 5);
  });

  it('clamps to 0 at the top-left, never negative', () => {
    const { x, y } = computeDropPosition({
      ...a4,
      clientX: 1,
      clientY: 1,
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: false,
      gridSize: 8,
    });
    expect(x).toBe(0);
    expect(y).toBe(0);
  });

  it('survives a zero-sized rect and unknown page size without NaN', () => {
    const { x, y } = computeDropPosition({
      clientX: 10,
      clientY: 10,
      rect: { left: 0, top: 0, width: 0, height: 0 },
      pageWidthPts: 0,
      pageHeightPts: 0,
      fieldWidthPts: 200,
      fieldHeightPts: 60,
      snapToGrid: true,
      gridSize: 8,
    });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe('defaultDimensionsFor', () => {
  it('covers every palette field type explicitly', () => {
    for (const type of Object.keys(DEFAULT_FIELD_DIMENSIONS)) {
      const dims = defaultDimensionsFor(type);
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    }
  });

  it('falls back for unknown types instead of throwing', () => {
    expect(defaultDimensionsFor('mystery')).toEqual({ width: 150, height: 40 });
  });
});
