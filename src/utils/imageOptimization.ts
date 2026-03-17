/**
 * Image Optimization Utilities
 * Provides functions to optimize image URLs, especially for Unsplash images
 */

export interface ImageOptimizationParams {
  width?: number;
  height?: number;
  quality?: number; // 1-100, default 80
  format?: 'webp' | 'jpg' | 'png' | 'auto';
  fit?: 'crop' | 'scale' | 'max';
  dpr?: 1 | 2 | 3; // Device pixel ratio
}

/**
 * Returns the device pixel ratio, capped at 2 for performance.
 * Safe for SSR (returns 1 when window is unavailable).
 */
function getDeviceDPR(): 1 | 2 {
  if (typeof window === 'undefined') return 1;
  return Math.min(Math.round(window.devicePixelRatio || 1), 2) as 1 | 2;
}

/**
 * Optimizes Unsplash image URLs with performance parameters
 */
export function optimizeUnsplashUrl(
  url: string,
  params: ImageOptimizationParams = {}
): string {
  // Return non-Unsplash URLs as-is
  if (!url.includes('unsplash.com')) {
    return url;
  }

  const {
    width = 800,
    height,
    quality = 80,
    format = 'auto',
    fit = 'crop',
    dpr = getDeviceDPR()
  } = params;

  // Parse existing URL
  const urlObj = new URL(url);
  const searchParams = urlObj.searchParams;

  // Set width
  searchParams.set('w', Math.round(width * dpr).toString());
  
  // Set height if provided
  if (height) {
    searchParams.set('h', Math.round(height * dpr).toString());
  }

  // Set quality (Unsplash uses 'q' parameter)
  searchParams.set('q', quality.toString());

  // Set format - use auto for best browser support
  if (format === 'auto') {
    searchParams.set('auto', 'format');
    searchParams.set('fm', 'webp'); // Prefer WebP
  } else {
    searchParams.set('fm', format);
  }

  // Set fit mode
  searchParams.set('fit', fit);

  // Enable compression
  searchParams.set('compress', 'true');

  // Remove any existing crop parameters to avoid conflicts
  searchParams.delete('crop');

  return urlObj.toString();
}

/**
 * Generates responsive image srcset for Unsplash images
 */
export function generateUnsplashSrcSet(
  url: string,
  baseWidth: number = 800
): string {
  if (!url.includes('unsplash.com')) {
    return '';
  }

  const sizes = [0.5, 1, 1.5, 2]; // Multipliers for different screen densities
  const srcset = sizes
    .map(multiplier => {
      const width = Math.round(baseWidth * multiplier);
      const optimizedUrl = optimizeUnsplashUrl(url, { 
        width,
        quality: 80,
        format: 'auto'
      });
      return `${optimizedUrl} ${width}w`;
    })
    .join(', ');

  return srcset;
}

/**
 * Generates a low-quality placeholder URL for blur-up effect
 */
export function generatePlaceholderUrl(url: string): string {
  if (!url.includes('unsplash.com')) {
    return url;
  }

  return optimizeUnsplashUrl(url, {
    width: 40,
    quality: 30,
    format: 'auto'
  });
}

/**
 * Preloads critical images
 */
export function preloadImage(url: string, priority: 'high' | 'low' | 'auto' = 'auto'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  link.setAttribute('fetchpriority', priority);
  
  // Check if already exists
  const existing = document.querySelector(`link[href="${url}"]`);
  if (!existing) {
    document.head.appendChild(link);
  }
}

/**
 * Determines optimal image width based on container and device
 */
export function getOptimalImageWidth(
  containerWidth?: number,
  maxWidth: number = 2000
): number {
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  
  let targetWidth = containerWidth || screenWidth;
  
  // Cap at max width
  targetWidth = Math.min(targetWidth, maxWidth);
  
  // Account for device pixel ratio (but cap at 2x for performance)
  targetWidth = Math.round(targetWidth * Math.min(dpr, 2));
  
  return targetWidth;
}

/**
 * Image size presets for common use cases
 */
export const IMAGE_PRESETS = {
  hero: { width: 1920, height: 800, quality: 85 },
  card: { width: 600, height: 400, quality: 80 },
  thumbnail: { width: 300, height: 200, quality: 75 },
  avatar: { width: 200, height: 200, quality: 80 },
  icon: { width: 100, height: 100, quality: 75 },
  fullWidth: { width: 1600, quality: 85 },
} as const;

/**
 * Applies a preset to an image URL
 */
export function applyImagePreset(
  url: string,
  preset: keyof typeof IMAGE_PRESETS
): string {
  const presetParams = IMAGE_PRESETS[preset];
  return optimizeUnsplashUrl(url, presetParams);
}

/**
 * Extracts dominant color from Unsplash URL for placeholder
 */
export function getUnsplashDominantColor(url: string): string | null {
  // Unsplash embeds dominant color in some URLs
  // This is a simple extraction - returns null if not found
  const match = url.match(/\?.*color=([A-Fa-f0-9]{6})/);
  return match ? `#${match[1]}` : null;
}