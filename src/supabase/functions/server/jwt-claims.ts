/**
 * Unverified reads of claims from an access token.
 * ================================================
 *
 * WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT
 * ---------------------------------------------
 * These functions decode the payload segment of a JWT and return a claim.
 * They do NOT check the signature, and nothing here may ever be the reason a
 * request is treated as authenticated. Every caller either:
 *
 *   - has ALREADY had the same token verified by `auth.getUser(token)`, and is
 *     re-reading a claim from bytes that were proven authentic
 *     (`readTokenIssuedAt`, called from `auth-mw.ts` and `fna-auth.ts`); or
 *
 *   - is using the value only to pick a rate-limit bucket for a request that
 *     is about to be verified downstream, where a forged value buys a counter
 *     for a request that will be rejected before it can cost anything
 *     (`readTokenSubject`, called from `ai-usage-limit.ts`).
 *
 * If a third kind of caller ever appears, that is the moment to stop and check
 * which of those two it is. "It is only a hint" is how an unverified claim
 * becomes an authorization decision.
 *
 * WHY IT IS ITS OWN MODULE
 * ------------------------
 * It started inside `auth-mw.ts`. That gave `session-revocation.ts` a reason
 * to import the auth middleware for a nine-line pure function — and, more
 * sharply, it broke every contract test that stubs `../auth-mw.ts` with a
 * partial mock, because those mocks export the two guards they need and
 * nothing else. A leaf module with no imports of its own is mockable by
 * nobody and needs stubbing by no one.
 *
 * @module server/jwt-claims
 */

/**
 * Decode a JWT's payload segment. Returns null for anything that is not a
 * three-segment token with a base64url-encoded JSON object in the middle.
 */
function decodePayload(token: string): Record<string, unknown> | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;
  try {
    // base64url → base64, then restore the padding `atob` requires.
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The `iat` (issued-at) claim, in SECONDS, or null when it cannot be read.
 *
 * Used to compare a token against the account's `sessionsValidFrom` watermark
 * — see `enforceAccountSecurity` — so null means "cannot tell", and every
 * caller treats that as fail-open rather than as a revoked session.
 */
export function readTokenIssuedAt(token: string | undefined): number | null {
  if (!token) return null;
  const payload = decodePayload(token);
  const iat = payload?.iat;
  return typeof iat === 'number' && Number.isFinite(iat) ? iat : null;
}

/**
 * The `sub` (subject / user id) claim, or null when it cannot be read.
 *
 * Takes the whole `Authorization` header rather than a bare token, because its
 * one caller has the header and nothing else at that point in the chain.
 * Truncated at 64 characters: the value goes into a rate-limit key, and a key
 * built from an attacker-supplied string needs a bound.
 */
export function readTokenSubject(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader?.toLowerCase().startsWith('bearer ')) return null;
  const payload = decodePayload(authorizationHeader.slice(7).trim());
  const sub = payload?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub.slice(0, 64) : null;
}
