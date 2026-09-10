/**
 * Canonical public site origin. All sitemap entries, canonical tags, OG URLs,
 * and server-emitted links should use this host so they match the URL that
 * returns 200 without a cross-host redirect.
 */
export const SITE_ORIGIN = 'https://www.navigatewealth.co' as const;

/**
 * Apex origin (no `www`). This is a DIFFERENT origin from {@link SITE_ORIGIN},
 * and crucially it is OUTSIDE the installed PWA's scope - the PWA's manifest is
 * served from the `www` host with `scope: "/"`, so Android mints a WebAPK whose
 * intent filter covers every `www` path and none of the apex.
 *
 * Use this ONLY for links sent to users out-of-band (e.g. article notification
 * emails) that must open on the public website rather than inside the
 * portal-only PWA. Everything else should keep using {@link SITE_ORIGIN}.
 *
 * IMPORTANT - the apex must *serve* these pages, never redirect them to `www`.
 * Android applies installed-app link capture to server redirects as well as to
 * the tapped URL, so an apex link that 301s to `www` lands right back inside the
 * app's scope and is handed to the PWA anyway. That is what made emailed article
 * links bounce between the browser and the app in an endless loading loop. See
 * the `/resources/article/` exclusion on the apex redirect in `vercel.json`, and
 * `docs/runbooks/deployment.md` for the Vercel domain setup this depends on.
 */
export const SITE_ORIGIN_APEX = 'https://navigatewealth.co' as const;

/**
 * Hostname of {@link SITE_ORIGIN_APEX}. The apex is a browser-only escape host:
 * it exists so emailed article links resolve somewhere the installed PWA can
 * never capture. Code that must behave differently there (no service worker, no
 * install prompt - see `src/utils/pwa/escapeHost.ts`) compares against this.
 */
export const SITE_ORIGIN_APEX_HOST = 'navigatewealth.co' as const;

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
