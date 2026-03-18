import React from 'react';
import { getOptimizedFallbackUrl, getOptimizedSrcSet } from '../../utils/optimizedImages';

type ResponsiveImageProps = {
  imageKey: string;
  alt: string;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
  /** Optional fallback if optimized assets are missing. */
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
};

export function ResponsiveImage({
  imageKey,
  alt,
  className,
  sizes = '100vw',
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  width,
  height,
  fallbackSrc,
  onLoad,
  onError,
}: ResponsiveImageProps) {
  const fallback = fallbackSrc ?? getOptimizedFallbackUrl(imageKey);

  return (
    <picture>
      <source type="image/avif" srcSet={getOptimizedSrcSet(imageKey, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={getOptimizedSrcSet(imageKey, 'webp')} sizes={sizes} />
      <img
        src={fallback}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading={loading}
        decoding={decoding}
        // React uses `fetchPriority` attribute casing.
        fetchPriority={fetchPriority}
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );
}

