/**
 * Canonical public site origin. All sitemap entries, canonical tags, OG URLs,
 * and server-emitted links should use this host so they match the URL that
 * returns 200 without a cross-host redirect.
 */
export const SITE_ORIGIN = 'https://www.navigatewealth.co' as const;

/**
 * Apex origin (no `www`). This is a DIFFERENT origin from {@link SITE_ORIGIN},
 * and crucially it is OUTSIDE the installed PWA's scope (the PWA is registered
 * only for the `www` host). Links pointing here are therefore never captured by
 * the installed app - the device always opens them in the browser - and the
 * apex to www 301 (see vercel.json) then resolves to the canonical page as an
 * in-browser navigation, which does not re-trigger link capture.
 *
 * Use this ONLY for links that are sent to users out-of-band (e.g. article
 * notification emails) and must open on the public website rather than inside
 * the portal-only PWA. Everything else should keep using {@link SITE_ORIGIN}.
 */
export const SITE_ORIGIN_APEX = 'https://navigatewealth.co' as const;

export function siteAbsoluteUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}

const NAVIGATE_WEALTH_WEB_HOSTS = new Set([
  'navigatewealth.co',
  'www.navigatewealth.co',
  'navigatewealth.co.za',
  'www.navigatewealth.co.za',
]);

function toOfficialSiteUrl(url: URL): string {
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return `${SITE_ORIGIN}${path}${url.search}${url.hash}`;
}

export function normalizeNavigateWealthUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  try {
    const url = new URL(trimmed);
    if (NAVIGATE_WEALTH_WEB_HOSTS.has(url.hostname.toLowerCase())) {
      return toOfficialSiteUrl(url);
    }
    return trimmed;
  } catch {
    // Allow admin-entered URLs such as "navigatewealth.co.za/contact".
  }

  try {
    const url = new URL(`https://${trimmed}`);
    if (NAVIGATE_WEALTH_WEB_HOSTS.has(url.hostname.toLowerCase())) {
      return toOfficialSiteUrl(url);
    }
  } catch {
    // Non-web URLs such as mailto: and tel: should be left untouched.
  }

  return trimmed;
}
