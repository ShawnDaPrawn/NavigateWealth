/**
 * URL scrubbing for analytics (SECURITY-AUDIT S8)
 * ================================================
 *
 * Signer links are emailed as `/sign?token=<uuid>`, and that token IS the
 * credential — presenting it is what authenticates a third-party signer to
 * their document. Two analytics pipelines record the full URL of every page
 * view (Google Analytics `page_location`, Vercel Analytics `url`), so the
 * credential was being copied to two third parties on every signer visit, and
 * anyone with access to those dashboards could replay it.
 *
 * This strips the parameters that must never leave the browser. It is applied
 * at the analytics boundary rather than at the point the token is read, because
 * the leak is not specific to one page: any future route that carries a
 * sensitive parameter is covered by the same list.
 *
 * Scrubbing is NOT a substitute for getting the token out of the address bar —
 * browser history and `Referer` still see it — which is why SignerLandingPage
 * also clears it with `history.replaceState` once it has been read. The two
 * measures cover different leak paths and both are required.
 */

/**
 * Query parameters whose VALUES are credentials or direct client identifiers.
 *
 * Matching is case-insensitive. Keep this list narrow and specific: scrubbing
 * a parameter the marketing site relies on (`utm_*`, `ref`) would silently
 * degrade attribution, which is the kind of quiet breakage that gets a
 * safety measure reverted.
 */
const SENSITIVE_QUERY_PARAMS = [
  'token', // e-sign signer access token — the credential itself
  'access_token',
  'refresh_token',
  'code', // OAuth authorization code
  'otp',
  'signature',
  'clientid',
  'client_id',
  'userid',
  'user_id',
];

/** Replacement value, kept non-empty so the parameter's presence stays visible. */
const REDACTED = 'redacted';

/**
 * Return `url` with the value of every sensitive query parameter replaced.
 *
 * Accepts absolute URLs and path-relative strings (`/sign?token=…`), because
 * the two analytics SDKs hand over different shapes. Anything unparseable is
 * returned unchanged — an analytics helper must never throw into a render path.
 */
export function scrubSensitiveUrl(url: string): string {
  if (!url) return url;

  try {
    // A base makes relative inputs parse; it is stripped again below when the
    // caller gave us a relative URL.
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
    const parsed = new URL(url, isAbsolute ? undefined : 'https://placeholder.invalid');

    let changed = false;
    for (const key of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, REDACTED);
        changed = true;
      }
    }

    if (!changed) return url;

    return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** True when the URL carries a parameter that must not reach analytics. */
export function hasSensitiveQueryParam(url: string): boolean {
  return scrubSensitiveUrl(url) !== url;
}
