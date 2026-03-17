import { useEffect } from 'react';
import { optimizeUnsplashUrl } from '../utils/imageOptimization';

/**
 * Hook to automatically optimize image URLs in the DOM
 * This can be used to optimize images that aren't wrapped in OptimizedImage component
 */
export function useImageOptimization(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    // Find all img tags with Unsplash URLs that aren't already optimized
    const images = document.querySelectorAll('img[src*="unsplash.com"]');
    
    images.forEach((img) => {
      const imgElement = img as HTMLImageElement;
      const currentSrc = imgElement.src;
      
      // Skip if already has optimization parameters
      if (currentSrc.includes('auto=format') && currentSrc.includes('q=')) {
        return;
      }

      // Get image dimensions from element or attributes
      const width = imgElement.width || imgElement.offsetWidth || 800;
      const height = imgElement.height || imgElement.offsetHeight;

      // Optimize the URL (DPR is now handled automatically by optimizeUnsplashUrl)
      const optimizedSrc = optimizeUnsplashUrl(currentSrc, {
        width,
        height: height || undefined,
        quality: 85,
        format: 'auto'
      });

      // Update src if different
      if (optimizedSrc !== currentSrc) {
        imgElement.src = optimizedSrc;
      }
    });
  }, [enabled]);
}

/**
 * Hook for preloading critical images
 */
export function usePreloadImages(imageUrls: string[], priority: 'high' | 'low' | 'auto' = 'high') {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];

    imageUrls.forEach(url => {
      // Skip if already preloaded
      if (document.querySelector(`link[href="${url}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      link.setAttribute('fetchpriority', priority);
      
      document.head.appendChild(link);
      links.push(link);
    });

    // Cleanup
    return () => {
      links.forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [imageUrls, priority]);
}

/**
 * Hook for lazy loading images with Intersection Observer
 */
export function useLazyLoadImages(rootMargin: string = '200px') {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            
            // Load the actual image
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            
            // Load srcset if available
            if (img.dataset.srcset) {
              img.srcset = img.dataset.srcset;
              img.removeAttribute('data-srcset');
            }
            
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01
      }
    );

    // Observe all images with data-src
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => observer.observe(img));

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);
}