/**
 * A sign-in request from an AI tool (Claude, ChatGPT) waiting for approval.
 *
 * `public/broker-authorize.js` stores the OAuth request in session storage and
 * sends the person to the Password Manager's AI agents tab. When they were
 * logged out, the login page brings them back to plain `/admin` instead, so
 * the admin page checks for a waiting request and opens the tab itself.
 *
 * Light on purpose: the admin frame imports it, so it must not import a
 * module barrel (see moduleLoaders.ts, "SHELL ENTRIES").
 */
export const CONSENT_KEY = 'nw-broker-consent';

/** The waiting OAuth request's parameters, or null. Expired requests are cleared. */
export function pendingConsent(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value.expires > Date.now() && typeof value.params?.client_id === 'string')
      return value.params;
    sessionStorage.removeItem(CONSENT_KEY);
  } catch {
    /* Storage may be unavailable; there is then nothing to approve. */
  }
  return null;
}

export function clearConsent() {
  try {
    sessionStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
}

/** Where a waiting sign-in request is approved. */
export const CONSENT_ADDRESS = { module: 'password-manager', tab: 'agents' } as const;
