import { useEffect } from 'react';

/**
 * Custom hook to preload images for better tab switching performance
 * 
 * This hook preloads images by creating invisible Image objects in the browser,
 * which triggers the browser to download and cache them. When users switch tabs,
 * the images are already cached and display instantly.
 * 
 * @param imageUrls - Array of image URLs to preload
 * @param priority - Whether to preload images immediately (default: true)
 * 
 * @example
 * ```tsx
 * useImagePreload([
 *   lifeCoverImage,
 *   disabilityCoverImage,
 *   severeIllnessCoverImage
 * ]);
 * ```
 */
export function useImagePreload(imageUrls: string[], priority: boolean = true) {
  useEffect(() => {
    if (!priority || imageUrls.length === 0) return;

    const preloadImages: HTMLImageElement[] = [];

    imageUrls.forEach((url) => {
      if (!url) return;
      
      const img = new Image();
      // Preload images with high priority for better performance
      img.fetchpriority = 'high';
      img.src = url;
      preloadImages.push(img);
    });

    // Cleanup function to prevent memory leaks
    return () => {
      preloadImages.forEach((img) => {
        img.src = '';
      });
    };
  }, [imageUrls, priority]);
}

/**
 * Alternative approach using link preload tags in the document head
 * This method is more aggressive and can be better for critical images
 * 
 * @param imageUrls - Array of image URLs to preload
 * @param priority - Whether to preload images immediately (default: true)
 */
export function useImagePreloadWithLinks(imageUrls: string[], priority: boolean = true) {
  useEffect(() => {
    if (!priority || imageUrls.length === 0) return;

    const links: HTMLLinkElement[] = [];

    imageUrls.forEach((url) => {
      if (!url) return;

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.fetchpriority = 'high';
      document.head.appendChild(link);
      links.push(link);
    });

    // Cleanup function
    return () => {
      links.forEach((link) => {
        document.head.removeChild(link);
      });
    };
  }, [imageUrls, priority]);
}
