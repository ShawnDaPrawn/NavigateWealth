import { OptimizedImage } from './OptimizedImage';
import { ResponsiveImage } from './ResponsiveImage';
import { logoKeyForSrc } from './assets/provider-logos';
import { getLogoWidths } from '../../utils/optimizedImages';

type ProviderLogoProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
};

/**
 * A provider logo, served from its generated AVIF/WebP variants.
 *
 * WHY THIS EXISTS. The sixteen logos in `provider-logos.ts` are 2000x1000 PNG
 * exports totalling 4.9 MB, and they render in slots no wider than 200 CSS px.
 * They reached the browser at full size because `OptimizedImage` only builds a
 * srcSet for `unsplash.com` URLs — for a bundled asset it emits a bare <img>
 * with whatever it was handed. Nothing failed; the logos looked right and the
 * bytes were simply spent.
 *
 * The lookup is by source URL rather than a `logoKey` threaded through every
 * provider data structure, because those logos flow through eleven importers
 * and several shapes (`homePageData.providers`, `quote/constants`, props passed
 * into `GetQuoteModal` and `PartnerMarquee`). One registry lookup at the render
 * site covers all of them without touching the data.
 */
export function ProviderLogo({
  src,
  alt,
  width,
  height,
  className,
  sizes,
  loading = 'lazy',
}: ProviderLogoProps) {
  const logoKey = logoKeyForSrc(src);

  // A logo from outside the bundled registry — a provider record loaded from
  // the database, say — has no generated variants. It keeps the plain <img>
  // path rather than pointing <source> at files that were never built, which
  // would 404 every source and fall back silently.
  if (!logoKey) {
    return (
      <OptimizedImage
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        sizes={sizes}
        loading={loading}
      />
    );
  }

  return (
    <ResponsiveImage
      imageKey={logoKey}
      fallbackSrc={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      widths={getLogoWidths()}
      loading={loading}
    />
  );
}
