import { describe, expect, it } from 'vitest';
import {
  PDF_VIEWER_MAX_ZOOM,
  PDF_VIEWER_MIN_ZOOM,
  currentPageFromTops,
  fitToWidthScale,
  pdfViewerGutter,
  stepZoom,
} from '../pdfViewerZoom';

// An A4 page at 96 DPI.
const A4_WIDTH = 794;

describe('fitToWidthScale', () => {
  it('shrinks the page to a phone width, less the gutters', () => {
    const scale = fitToWidthScale(A4_WIDTH, 390);
    expect(scale).toBeCloseTo((390 - 2 * pdfViewerGutter(390)) / A4_WIDTH, 5);
    expect(A4_WIDTH * scale).toBeLessThanOrEqual(390);
  });

  it('never enlarges a page past actual size on a wide screen', () => {
    expect(fitToWidthScale(A4_WIDTH, 1400)).toBe(1);
  });

  it('does not go below the minimum zoom on a very narrow viewport', () => {
    expect(fitToWidthScale(A4_WIDTH, 120)).toBe(PDF_VIEWER_MIN_ZOOM);
  });

  it('falls back to actual size before anything has been measured', () => {
    expect(fitToWidthScale(0, 390)).toBe(1);
    expect(fitToWidthScale(A4_WIDTH, 0)).toBe(1);
  });
});

describe('stepZoom', () => {
  it('steps from a fitted scale to the nearest stop, not a whole stop past it', () => {
    expect(stepZoom(0.46, 1)).toBe(0.5);
    expect(stepZoom(0.46, -1)).toBe(0.33);
  });

  it('moves one stop at a time from a stop', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
  });

  it('stays within the zoom range', () => {
    expect(stepZoom(PDF_VIEWER_MAX_ZOOM, 1)).toBe(PDF_VIEWER_MAX_ZOOM);
    expect(stepZoom(PDF_VIEWER_MIN_ZOOM, -1)).toBe(PDF_VIEWER_MIN_ZOOM);
  });
});

describe('currentPageFromTops', () => {
  const tops = [0, 1100, 2200, 3300];

  it('is page 1 before any other page reaches the probe line', () => {
    expect(currentPageFromTops(tops, 500)).toBe(1);
  });

  it('is the last page whose top has passed the probe line', () => {
    expect(currentPageFromTops(tops, 2300)).toBe(3);
    expect(currentPageFromTops(tops, 9999)).toBe(4);
  });

  it('is page 1 for a document with no measured pages', () => {
    expect(currentPageFromTops([], 100)).toBe(1);
  });
});
