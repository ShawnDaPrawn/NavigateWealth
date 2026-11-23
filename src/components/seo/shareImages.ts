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

/**
 * The other public pages with a card of their own, keyed by path. Drawn by
 * scripts/seo/generate-share-images.mjs in the ShareService and ShareBrand
 * layouts from each page's hero copy. The prerendered head names the same
 * files (scripts/seo/seo-static-data.mjs, `ogImage`); share-images.test.ts
 * keeps the two lists equal.
 */
export const PAGE_SHARE_IMAGE_PATHS: Readonly<Record<string, string>> = {
  '/services': `${SHARE_IMAGE_DIR}/services.png`,
  '/resources': `${SHARE_IMAGE_DIR}/resources.png`,
  '/about': `${SHARE_IMAGE_DIR}/about.png`,
  '/team': `${SHARE_IMAGE_DIR}/team.png`,
  '/contact': `${SHARE_IMAGE_DIR}/contact.png`,
  '/schedule-consultation': `${SHARE_IMAGE_DIR}/consultation.png`,
  '/contact/consultation': `${SHARE_IMAGE_DIR}/consultation.png`,
  '/why-us': `${SHARE_IMAGE_DIR}/why-us.png`,
  '/get-quote': `${SHARE_IMAGE_DIR}/get-quote.png`,
  '/get-quote/medical-aid': `${SHARE_IMAGE_DIR}/medical-aid.png`,
  '/solutions/individuals': `${SHARE_IMAGE_DIR}/individuals.png`,
  '/solutions/businesses': `${SHARE_IMAGE_DIR}/businesses.png`,
  '/solutions/advisers': `${SHARE_IMAGE_DIR}/advisers.png`,
  '/ask-vasco': `${SHARE_IMAGE_DIR}/ask-vasco.png`,
  '/careers': `${SHARE_IMAGE_DIR}/careers.png`,
  '/press': `${SHARE_IMAGE_DIR}/press.png`,
  '/legal': `${SHARE_IMAGE_DIR}/legal.png`,
};

/** Every newsletter issue shares this card. */
export const NEWSLETTER_SHARE_IMAGE_PATH = `${SHARE_IMAGE_DIR}/newsletter.png`;

/**
 * The absolute URL of the card for a page, from its canonical URL (or path),
 * if the page has one of its own.
 */
export function pageShareImage(canonicalUrlOrPath: string | undefined): string | undefined {
  if (!canonicalUrlOrPath) return undefined;
  const path = canonicalUrlOrPath.startsWith(SITE_ORIGIN)
    ? canonicalUrlOrPath.slice(SITE_ORIGIN.length) || '/'
    : canonicalUrlOrPath;
  const normalised = path.length > 1 ? path.replace(/\/+$/, '') : path;
  const image = PAGE_SHARE_IMAGE_PATHS[normalised];
  if (image) return `${SITE_ORIGIN}${image}`;
  if (normalised.startsWith('/resources/newsletter/')) {
    return `${SITE_ORIGIN}${NEWSLETTER_SHARE_IMAGE_PATH}`;
  }
  return undefined;
}

/** The absolute URL of a service page's share image, if it has one. */
export function serviceShareImage(seoKey: string): string | undefined {
  const path = SERVICE_SHARE_IMAGE_PATHS[seoKey];
  return path ? `${SITE_ORIGIN}${path}` : undefined;
}

/** True for any of the share images above, whose dimensions are known. */
export function isShareImage(url: string): boolean {
  return url.startsWith(`${SITE_ORIGIN}${SHARE_IMAGE_DIR}/`);
}
