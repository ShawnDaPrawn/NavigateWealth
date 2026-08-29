import {
  getOptimizedFallbackUrl,
  getOptimizedSrcSet,
  type OptimizedImageWidth,
} from '../../utils/optimizedImages';

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
  /**
   * Which generated widths to offer. Defaults to the page widths; pass
   * `getLogoWidths()` for images that never render above ~200 CSS px, so the
   * srcset does not advertise variants that were never built.
   */
  widths?: readonly OptimizedImageWidth[];
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
  widths,
  onLoad,
  onError,
}: ResponsiveImageProps) {
  const fallback = fallbackSrc ?? getOptimizedFallbackUrl(imageKey, widths);

  return (
    <picture>
      <source
        type="image/avif"
        srcSet={getOptimizedSrcSet(imageKey, 'avif', widths)}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={getOptimizedSrcSet(imageKey, 'webp', widths)}
        sizes={sizes}
      />
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
