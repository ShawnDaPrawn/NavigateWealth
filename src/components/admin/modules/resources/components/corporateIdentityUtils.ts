/**
 * Pure helpers extracted from CorporateIdentityTab.tsx (Phase 6 god-file split).
 *
 * Dependency-free date + colour helpers — no React, no I/O — lifted out so they
 * can be unit-tested and the 1.8k-line component shrinks toward its rendering
 * responsibility. Tested in corporateIdentityUtils.test.ts.
 */

/** Format an ISO date as "5 Jun 2025"; "Never" for null. */
export function formatDate(d: string | null): string {
  if (!d) return 'Never';
  try {
    return new Date(d).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Unknown';
  }
}

/** Parse a #rrggbb hex colour into its r/g/b components. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Relative luminance (0..1) of a hex colour, weighting green most per the
 * standard perceptual formula — used to choose a readable overlay text colour.
 */
export function getContrastRatio(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance;
}
