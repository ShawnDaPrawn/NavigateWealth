/**
 * The site's share images: the 1200×630 pictures social networks and
 * messaging apps show when a page is linked (og:image / twitter:image).
 *
 * The PNGs live in public/brand-assets/share/. They are drawn from the
 * "Share" boards of the Website Redesign canvas — ShareBrand for the site
 * default, ShareService for each service page, filled with that page's own
 * hero kicker, heading and description — and rendered with the canvas's
 * runtime, so they are static files, not generated per request.
 *
 * The older brand-assets/navigate-wealth-og.png stays where it is: the build's
 * static SEO (scripts/seo) still names it.
 */
import { SITE_ORIGIN } from '@/utils/siteOrigin';

export const SHARE_IMAGE_DIR = '/brand-assets/share';

/** Every share image is this size. */
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** The site default (ShareBrand). */
export const BRAND_SHARE_IMAGE_PATH = `${SHARE_IMAGE_DIR}/navigate-wealth.png`;

/** One per service page, keyed by the page's seoKey (seo-config.ts). */
export const SERVICE_SHARE_IMAGE_PATHS: Readonly<Record<string, string>> = {
  'retirement-planning': `${SHARE_IMAGE_DIR}/retirement-planning.png`,
  'risk-management': `${SHARE_IMAGE_DIR}/risk-management.png`,
  'investment-management': `${SHARE_IMAGE_DIR}/investment-management.png`,
  'tax-planning': `${SHARE_IMAGE_DIR}/tax-planning.png`,
  'estate-planning': `${SHARE_IMAGE_DIR}/estate-planning.png`,
  'financial-planning': `${SHARE_IMAGE_DIR}/financial-planning.png`,
  'medical-aid': `${SHARE_IMAGE_DIR}/medical-aid.png`,
  'employee-benefits': `${SHARE_IMAGE_DIR}/employee-benefits.png`,
};

/** The absolute URL of a service page's share image, if it has one. */
export function serviceShareImage(seoKey: string): string | undefined {
  const path = SERVICE_SHARE_IMAGE_PATHS[seoKey];
  return path ? `${SITE_ORIGIN}${path}` : undefined;
}

/** True for any of the share images above, whose dimensions are known. */
export function isShareImage(url: string): boolean {
  return url.startsWith(`${SITE_ORIGIN}${SHARE_IMAGE_DIR}/`);
}
