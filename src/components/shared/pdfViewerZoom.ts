/**
 * Zoom arithmetic for the PDF preview viewer.
 *
 * Kept apart from the component so it can be tested without a layout engine,
 * and because react-refresh wants component modules to export only components.
 */

/** The zoom levels the +/- buttons step through. */
export const PDF_VIEWER_ZOOM_STOPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2,
] as const;

export const PDF_VIEWER_MIN_ZOOM = PDF_VIEWER_ZOOM_STOPS[0];
export const PDF_VIEWER_MAX_ZOOM = PDF_VIEWER_ZOOM_STOPS[PDF_VIEWER_ZOOM_STOPS.length - 1];

/** Below this viewport width the viewer uses its compact, phone layout. */
export const PDF_VIEWER_COMPACT_BREAKPOINT = 640;

/** Space kept either side of the page, matching the scroll area's padding. */
export function pdfViewerGutter(viewportWidth: number): number {
  return viewportWidth < PDF_VIEWER_COMPACT_BREAKPOINT ? 12 : 32;
}

/**
 * The scale at which a page of `contentWidth` fills `viewportWidth`, less the
 * gutters. Never above 1: on a wide screen "fit" means actual size, not a page
 * blown up past it.
 */
export function fitToWidthScale(contentWidth: number, viewportWidth: number): number {
  if (!(contentWidth > 0) || !(viewportWidth > 0)) return 1;
  const available = viewportWidth - pdfViewerGutter(viewportWidth) * 2;
  const scale = available / contentWidth;
  return Math.min(1, Math.max(PDF_VIEWER_MIN_ZOOM, scale));
}

/**
 * The next zoom stop above (`direction` 1) or below (-1) the current scale.
 * A fitted scale usually sits between stops, so this steps to the nearest one
 * in that direction rather than jumping a whole stop past it.
 */
export function stepZoom(current: number, direction: 1 | -1): number {
  const epsilon = 0.001;
  if (direction === 1) {
    return PDF_VIEWER_ZOOM_STOPS.find((stop) => stop > current + epsilon) ?? PDF_VIEWER_MAX_ZOOM;
  }
  return (
    [...PDF_VIEWER_ZOOM_STOPS].reverse().find((stop) => stop < current - epsilon) ??
    PDF_VIEWER_MIN_ZOOM
  );
}

/**
 * The 1-based number of the page a reader is on: the last page whose top edge
 * has crossed a line a third of the way down the viewport. `pageTops` are in
 * the same coordinate space as `probeY`.
 */
export function currentPageFromTops(pageTops: readonly number[], probeY: number): number {
  let page = 1;
  pageTops.forEach((top, index) => {
    if (top <= probeY) page = index + 1;
  });
  return page;
}
