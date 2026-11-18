/**
 * NwImage — every photograph on the Navigator site goes through this.
 *
 * - `alt` is required, so a page cannot ship an image without one. Pass ''
 *   only for a decorative copy whose meaning is already in the text beside it.
 * - With an `imageKey`, the optimised AVIF/WebP variants are offered first and
 *   the original asset is the fallback, as ResponsiveImage does elsewhere.
 * - `hiddenBelow` stops phones downloading a picture the layout hides at that
 *   width: a 1×1 placeholder wins the <picture> source match below it, so the
 *   full-size file is never requested there. CSS hiding alone does not stop an
 *   eager image loading.
 * - Every photograph gets the one colour grade (`nw-photo`).
 */
import { getOptimizedSrcSet } from '../../utils/optimizedImages';

const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

interface NwImageProps {
  src: string;
  alt: string;
  imageKey?: string;
  sizes?: string;
  className?: string;
  /** Above-the-fold image: load eagerly at high priority. */
  priority?: boolean;
  width?: number;
  height?: number;
  hiddenBelow?: number;
}

export function NwImage({
  src,
  alt,
  imageKey,
  sizes = '100vw',
  className,
  priority = false,
  width,
  height,
  hiddenBelow,
}: NwImageProps) {
  // React 18 does not know the camel-cased `fetchPriority` prop: it warns and
  // leaves the attribute off, so the browser never sees the hint. The
  // lower-case attribute passes straight through to the DOM.
  const priorityHint = priority ? ({ fetchpriority: 'high' } as Record<string, string>) : null;
  return (
    <picture>
      {hiddenBelow ? <source media={`(max-width: ${hiddenBelow}px)`} srcSet={BLANK_PIXEL} /> : null}
      {imageKey ? (
        <>
          <source type="image/avif" srcSet={getOptimizedSrcSet(imageKey, 'avif')} sizes={sizes} />
          <source type="image/webp" srcSet={getOptimizedSrcSet(imageKey, 'webp')} sizes={sizes} />
        </>
      ) : null}
      <img
        src={src}
        alt={alt}
        className={className ? `nw-photo ${className}` : 'nw-photo'}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        {...priorityHint}
      />
    </picture>
  );
}
