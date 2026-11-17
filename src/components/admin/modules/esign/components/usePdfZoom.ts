/**
 * Zoom for the e-sign PDF viewer.
 *
 * Owns the zoom level, "fit width", the zoom buttons and ctrl+scroll / pinch.
 * Split out of PDFViewer.tsx. The viewer renders each page at its NATIVE CSS
 * size inside a container scaled by `zoom / 100`; this hook only decides the
 * number and keeps the view steady while it changes.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fitWidthZoom } from './placementMath';

/** Zoom stops for the +/- buttons, in percent. Ctrl+scroll moves freely between them. */
export const ZOOM_STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const ZOOM_MIN = ZOOM_STEPS[0];
const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1];
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z)));

/** Horizontal padding of the scroll area (p-8 on both sides), in CSS px. */
const SCROLL_PADDING_X = 64;

/**
 * @param pageWidths each page's width in PDF points (empty until loaded)
 * @param loading    re-binds the wheel listener once the scroll area mounts
 */
export function usePdfZoom(pageWidths: number[], loading: boolean) {
  const [zoom, setZoom] = useState<number>(100);
  // 'width' keeps the document fitted to the canvas as it resizes, until the
  // sender zooms by hand. The viewer used to open at a fixed 100%.
  const [fitMode, setFitMode] = useState<'width' | null>('width');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /**
   * Where to hold the view steady across a zoom change: a point on a page
   * (as fractions of that page) and where it sat inside the scroll area.
   */
  const zoomAnchorRef = useRef<{
    pageNumber: number;
    fx: number;
    fy: number;
    ax: number;
    ay: number;
  } | null>(null);

  // ── Zoom ──────────────────────────────────────────────────────────
  //
  // Zooming keeps the point you were looking at (the middle of the view, or
  // the pointer for ctrl+scroll) where it was, so the document zooms in place
  // rather than sliding away.

  const captureAnchor = useCallback((clientX?: number, clientY?: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ax = clientX !== undefined ? clientX - rect.left : el.clientWidth / 2;
    const ay = clientY !== undefined ? clientY - rect.top : el.clientHeight / 2;
    const px = el.scrollLeft + ax;
    const py = el.scrollTop + ay;
    let best: { pageNumber: number; fx: number; fy: number } | null = null;
    pageWrapRefs.current.forEach((wrap, pageNumber) => {
      if (best) return;
      const top = wrap.offsetTop;
      const h = wrap.offsetHeight;
      if (py >= top && py <= top + h + 32) {
        best = {
          pageNumber,
          fx: wrap.offsetWidth > 0 ? (px - wrap.offsetLeft) / wrap.offsetWidth : 0,
          fy: h > 0 ? (py - top) / h : 0,
        };
      }
    });
    if (best)
      zoomAnchorRef.current = {
        ...(best as { pageNumber: number; fx: number; fy: number }),
        ax,
        ay,
      };
  }, []);

  const applyZoom = useCallback(
    (next: number, pointer?: { x: number; y: number }) => {
      const z = clampZoom(next);
      if (z === zoomRef.current) return;
      captureAnchor(pointer?.x, pointer?.y);
      setZoom(z);
    },
    [captureAnchor],
  );

  // After the DOM reflects a new zoom, scroll so the anchored point is back
  // under the same spot.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const el = scrollRef.current;
    if (!anchor || !el) return;
    zoomAnchorRef.current = null;
    const wrap = pageWrapRefs.current.get(anchor.pageNumber);
    if (!wrap) return;
    el.scrollLeft = wrap.offsetLeft + anchor.fx * wrap.offsetWidth - anchor.ax;
    el.scrollTop = wrap.offsetTop + anchor.fy * wrap.offsetHeight - anchor.ay;
  }, [zoom]);

  const handleZoomIn = () => {
    setFitMode(null);
    const next = ZOOM_STEPS.find((z) => z > zoom) ?? ZOOM_MAX;
    applyZoom(next);
  };

  const handleZoomOut = () => {
    setFitMode(null);
    const next = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? ZOOM_MIN;
    applyZoom(next);
  };

  const widestPage = useMemo(() => pageWidths.reduce((m, w) => Math.max(m, w), 0), [pageWidths]);

  const handleFitToWidth = useCallback(() => {
    const el = scrollRef.current;
    if (!el || widestPage <= 0) return;
    setFitMode('width');
    applyZoom(
      fitWidthZoom(el.clientWidth - SCROLL_PADDING_X, widestPage, { min: ZOOM_MIN, max: ZOOM_MAX }),
    );
  }, [widestPage, applyZoom]);

  // Fit mode follows the canvas as it resizes (sidebars, window size).
  useEffect(() => {
    if (fitMode !== 'width' || widestPage <= 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const fit = () =>
      setZoom(
        fitWidthZoom(el.clientWidth - SCROLL_PADDING_X, widestPage, {
          min: ZOOM_MIN,
          max: ZOOM_MAX,
        }),
      );
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMode, widestPage]);

  // Ctrl/Cmd + scroll and trackpad pinch (which browsers report as a
  // ctrl+wheel) zoom the DOCUMENT around the pointer. Left alone they zoomed
  // the whole browser page — the whole studio shrank, not the PDF.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setFitMode(null);
      const factor = Math.exp(-e.deltaY * 0.002);
      applyZoom(zoomRef.current * factor, { x: e.clientX, y: e.clientY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom, loading]);

  return {
    zoom,
    fitMode,
    setFitMode,
    scrollRef,
    pageWrapRefs,
    handleZoomIn,
    handleZoomOut,
    handleFitToWidth,
  };
}
