import React, { useState, useEffect } from 'react';
import {
  optimizeUnsplashUrl,
  generateUnsplashSrcSet,
  generatePlaceholderUrl,
  getOptimalImageWidth,
  IMAGE_PRESETS
} from '../../utils/imageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchpriority?: 'high' | 'low' | 'auto';
  onLoad?: () => void;
  onError?: () => void;
  preset?: keyof typeof IMAGE_PRESETS;
  blurup?: boolean; // Enable blur-up placeholder effect
}

export function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  fetchpriority = 'auto',
  onLoad,
  onError,
  preset,
  blurup = true
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [placeholderLoaded, setPlaceholderLoaded] = useState(false);

  // Optimize the image URL
  const optimizedSrc = React.useMemo(() => {
    if (preset && src.includes('unsplash.com')) {
      const presetParams = IMAGE_PRESETS[preset];
      return optimizeUnsplashUrl(src, presetParams);
    } else if (width || height) {
      return optimizeUnsplashUrl(src, { 
        width: width || getOptimalImageWidth(width),
        height,
        quality: 80,
        format: 'auto'
      });
    }
    return src;
  }, [src, width, height, preset]);

  // Generate srcset for responsive images
  const srcSet = React.useMemo(() => {
    if (src.includes('unsplash.com') && width) {
      return generateUnsplashSrcSet(src, width);
    }
    return undefined;
  }, [src, width]);

  // Generate placeholder for blur-up effect
  const placeholderSrc = React.useMemo(() => {
    if (blurup && src.includes('unsplash.com')) {
      return generatePlaceholderUrl(src);
    }
    return undefined;
  }, [src, blurup]);

  // Preload placeholder image
  useEffect(() => {
    if (placeholderSrc && !placeholderLoaded) {
      const img = new Image();
      img.src = placeholderSrc;
      img.onload = () => setPlaceholderLoaded(true);
    }
  }, [placeholderSrc, placeholderLoaded]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Determine loading strategy based on priority
  const imageLoading = priority ? 'eager' : loading;
  const imageFetchPriority = priority ? 'high' : fetchpriority;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur-up placeholder */}
      {blurup && placeholderSrc && !isLoaded && !hasError && placeholderLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-105"
          style={{ filter: 'blur(10px)' }}
        />
      )}

      {/* Loading placeholder */}
      {!isLoaded && !hasError && !placeholderLoaded && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
      
      {/* Main image */}
      <img
        src={optimizedSrc}
        srcSet={srcSet}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading={imageLoading}
        decoding={decoding}
        fetchpriority={imageFetchPriority}
        sizes={sizes || (width ? `${width}px` : '100vw')}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          ...(width && height && { aspectRatio: `${width}/${height}` }),
        }}
      />
      
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">
          <span className="text-sm">Failed to load</span>
        </div>
      )}
    </div>
  );
}