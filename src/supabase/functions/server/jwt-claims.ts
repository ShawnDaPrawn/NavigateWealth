/**
 * Unverified reads of claims from an access token.
 * ================================================
 *
 * WHAT THIS IS, AND WHAT IT IS EMPHATICALLY NOT
 * ---------------------------------------------
 * `readTokenIssuedAt` decodes the payload segment of a JWT and returns a
 * claim. It does NOT check the signature, and it may never be the reason a
 * request is treated as authenticated. Its callers — `auth-mw.ts` and
 * `fna-auth.ts` — have ALREADY had the same token verified by
 * `auth.getUser(token)`, so they are re-reading a claim from bytes that were
 * proven authentic moments earlier.
 *
 * THAT IS THE ONLY LEGITIMATE PATTERN HERE, and it is narrower than it first
 * looked. A `readTokenSubject` used to live beside this, reading `sub` from an
 * UNVERIFIED token to pick a rate-limit bucket. The argument was that a forged
 * token only buys a bucket for a request that will be rejected anyway. The
 * argument was wrong: forging a VICTIM's subject spends the victim's
 * allowance, and every one of those requests failing downstream does not give
 * it back. `ai-usage-limit.ts` verifies the token now, and that function is
 * gone rather than left here for the next caller to reach for.
 *
 * So if a new caller wants a claim from a token this module has not seen
 * verified, the answer is to verify it. "It is only a hint" is how an
 * unverified claim becomes an authorization decision.
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
