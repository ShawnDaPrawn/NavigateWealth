const OPTIMIZED_WIDTHS = [480, 768, 1024, 1440] as const;

export type OptimizedImageFormat = 'avif' | 'webp';

export function getOptimizedWidths() {
  return OPTIMIZED_WIDTHS;
}

function baseUrl() {
  // Vite ensures BASE_URL ends with a trailing slash.
  return import.meta.env.BASE_URL || '/';
}

export function getOptimizedImageUrl(
  key: string,
  width: (typeof OPTIMIZED_WIDTHS)[number],
  format: OptimizedImageFormat,
) {
  return `${baseUrl()}img/optimized/${key}-${width}.${format}`;
}

export function getOptimizedSrcSet(key: string, format: OptimizedImageFormat) {
  return OPTIMIZED_WIDTHS.map((w) => `${getOptimizedImageUrl(key, w, format)} ${w}w`).join(', ');
}

export function getOptimizedFallbackUrl(key: string) {
  // Use webp as <img src> fallback; <source> will try avif first.
  return getOptimizedImageUrl(key, 768, 'webp');
}

