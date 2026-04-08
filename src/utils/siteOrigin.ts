/**
 * Canonical public site origin. All sitemap entries, canonical tags, OG URLs,
 * and server-emitted links should use this host so they match the URL that
 * returns 200 without a cross-host redirect (apex → www).
 */
export const SITE_ORIGIN = 'https://www.navigatewealth.co' as const;

export function siteAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}
