/**
 * Session persistence for the quote gateway contact step (shared URL: /get-quote/:service/contact).
 */

import type { QuoteContactDetails } from './types';

export const QUOTE_GATEWAY_SESSION_KEY = 'nw_quote_gateway';

export function loadGatewaySession(): Partial<QuoteContactDetails> {
  try {
    const raw = sessionStorage.getItem(QUOTE_GATEWAY_SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveGatewaySession(data: Partial<QuoteContactDetails>) {
  try {
    sessionStorage.setItem(QUOTE_GATEWAY_SESSION_KEY, JSON.stringify(data));
  } catch {
    /* non-critical */
  }
}

export function clearGatewaySession() {
  try {
    sessionStorage.removeItem(QUOTE_GATEWAY_SESSION_KEY);
  } catch {
    /* non-critical */
  }
}
