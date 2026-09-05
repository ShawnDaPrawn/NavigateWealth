const OPTIMIZED_WIDTHS = [480, 768, 1024, 1440] as const;

/**
 * Widths for images that never render large: provider logos sit in ~200 CSS px
 * slots (200x100, 160x80, 120x40 at the three call sites), so 200 and 400 cover
 * 1x and 2x. Generating the page widths for them instead would put roughly
 * 2.5 MB of 1024/1440 variants into `public/` that no `sizes` attribute can
 * ever select.
 *
 * Kept in step with LOGO_WIDTHS in scripts/brand/optimize-images.mjs by
 * optimized-image-coverage.test.ts, which asserts the files on disk match what
 * this module says to ask for.
 */
const LOGO_WIDTHS = [200, 400] as const;

export type OptimizedImageFormat = 'avif' | 'webp';
export type OptimizedImageWidth = (typeof OPTIMIZED_WIDTHS)[number] | (typeof LOGO_WIDTHS)[number];

export function getOptimizedWidths() {
  return OPTIMIZED_WIDTHS;
}

export function getLogoWidths() {
  return LOGO_WIDTHS;
}

function baseUrl() {
  // Vite ensures BASE_URL ends with a trailing slash.
  return import.meta.env.BASE_URL || '/';
}

export function getOptimizedImageUrl(
  key: string,
  width: OptimizedImageWidth,
  format: OptimizedImageFormat,
) {
  return `${baseUrl()}img/optimized/${key}-${width}.${format}`;
}

export function getOptimizedSrcSet(
  key: string,
  format: OptimizedImageFormat,
  widths: readonly OptimizedImageWidth[] = OPTIMIZED_WIDTHS,
) {
  return widths.map((w) => `${getOptimizedImageUrl(key, w, format)} ${w}w`).join(', ');
}

/**
 * The <img src> a <picture> falls back to when no <source> matches.
 *
 * Derived from the width list rather than hardcoded, because the second entry
 * is the 2x variant in both sets — 768 for page images, 400 for logos. Hardcoding
 * 768 would 404 for every logo key, since those are only built at 200 and 400.
 */
export function getOptimizedFallbackUrl(
  key: string,
  widths: readonly OptimizedImageWidth[] = OPTIMIZED_WIDTHS,
) {
  // Use webp as <img src> fallback; <source> will try avif first.
  return getOptimizedImageUrl(key, widths[Math.min(1, widths.length - 1)], 'webp');
}
