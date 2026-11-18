/**
 * A provider logo at the size it is shown. The bundled logos are 2000×1000
 * PNG exports; this offers their generated 200/400px AVIF and WebP variants
 * first (as ProviderLogo does), keeps the PNG only as the last fallback, and
 * always loads lazily. Logos skip the photograph grade NwImage applies.
 */
import { logoKeyForSrc } from '../../components/shared/assets/provider-logos';
import { getLogoWidths, getOptimizedSrcSet } from '../../utils/optimizedImages';

interface NwLogoProps {
  src: string;
  alt: string;
  /** Rendered width in CSS px, for the browser's pick from the srcset. */
  sizes?: string;
  className?: string;
}

export function NwLogo({ src, alt, sizes = '150px', className }: NwLogoProps) {
  const logoKey = logoKeyForSrc(src);
  const widths = getLogoWidths();
  return (
    <picture>
      {logoKey ? (
        <>
          <source
            type="image/avif"
            srcSet={getOptimizedSrcSet(logoKey, 'avif', widths)}
            sizes={sizes}
          />
          <source
            type="image/webp"
            srcSet={getOptimizedSrcSet(logoKey, 'webp', widths)}
            sizes={sizes}
          />
        </>
      ) : null}
      <img
        src={src}
        alt={alt}
        className={className}
        width={200}
        height={100}
        loading="lazy"
        decoding="async"
      />
    </picture>
  );
}
