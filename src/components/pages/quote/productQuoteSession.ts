/**
 * Session persistence for the quote funnel's "quote details" step
 * (/get-quote/:service), and the quote URLs search engines may index.
 *
 * Moved verbatim out of `ProductQuotePage.tsx` so the redesigned page keeps
 * the details form's answers under the same key and indexes the same URLs.
 */

// ── Session persistence ───────────────────────────────────────────────────────
export const SESSION_KEY = 'nw_product_quote';
/** Quote URLs Google is allowed to index. Keep in sync with vercel.json. */
export const INDEXABLE_QUOTE_SERVICES = new Set(['medical-aid']);

export function loadSession(service: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(`${SESSION_KEY}_${service}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSession(service: string, data: Record<string, string>) {
  try {
    sessionStorage.setItem(`${SESSION_KEY}_${service}`, JSON.stringify(data));
  } catch {
    /* non-critical */
  }
}
