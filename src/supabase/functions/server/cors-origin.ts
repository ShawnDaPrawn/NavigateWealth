/**
 * Shared CORS / trusted-origin resolution.
 * ========================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `createApp()` installs a Hono `cors()` middleware that answers every request
 * from an allow-list. But a handler that returns a hand-built `new Response(...)`
 * — an SSE stream, an NDJSON stream, a PDF or CSV download — sets its own
 * headers, and five of them shipped `Access-Control-Allow-Origin: '*'`, quietly
 * overriding the allow-list on exactly the routes that carry client documents.
 *
 * Nothing was directly exploitable: those routes authenticate with a bearer
 * token in the `Authorization` header rather than a cookie, so a third-party
 * page cannot ride a signed-in user's session the way `*` + cookies would let
 * it. It was still the allow-list disagreeing with itself, and the kind of
 * disagreement that stops being harmless the day one of those routes starts
 * accepting a cookie.
 *
 * So the allow-list lives here, and both callers read it from one place.
 *
 * A NOTE ON THE WORDING BELOW
 * ---------------------------
 * This file deliberately does not spell any of the bare identifiers in
 * router-auth-guard.ts's AUTH_MARKERS set. That test decides
 * whether a router is authenticated by walking its import tree and regex-ing
 * the source, so a marker name sitting in a *comment* here would make every
 * importer read as guarded — including the public signup router, which is not.
 * Refer to the middleware by module, not by function name.
 *
 * @module server/cors-origin
 */

/**
 * Resolve the CORS allow-list from the environment.
 *
 * Moved verbatim from `create-app.ts` (behaviour deliberately unchanged — see
 * the fail-open note and the separators-only sharp edge below, both pinned by
 * create-app.test.ts).
 *
 * IMPORTANT — fail-OPEN fallback (deliberately):
 *   When `NW_ALLOWED_ORIGINS` is unset we reflect any origin and log a
 *   prominent warning every boot. CORS is defence-in-depth — every
 *   non-health route still requires a valid bearer token (see the auth
 *   middleware in auth-mw.ts), so a permissive CORS default cannot by itself
 *   leak data. Failing
 *   closed on CORS would silently break every browser client (the
 *   incident captured on 2026-04-18 — dashboard "Network error" + super-
 *   admin lockout). Operators MUST set the env var before relying on the
 *   strict allow-list as a security boundary (Guidelines §12.4 / Phase 0.3),
 *   e.g. NW_ALLOWED_ORIGINS="https://www.navigatewealth.co,https://navigatewealth.co".
 *
 * THE FORMER SHARP EDGE, NOW RESOLVED:
 *   unset, empty-string, and separators-only (`" , ,"`) all mean "nothing
 *   usable was configured", and all three now take the same path: permissive
 *   reflection plus a loud log line. The third used to parse to an EMPTY
 *   allow-list and deny EVERY origin — silently, and indistinguishably from a
 *   deliberate lock-down, from what is a typo every time. Nobody spells "allow
 *   nothing" that way.
 *
 *   It logs at ERROR rather than WARN: unlike an unset variable, this input
 *   means someone TRIED to configure an allow-list and it is not in effect.
 *
 *   Failing the boot was the other candidate and is the wrong trade here. CORS
 *   is not the authorization boundary on this server, so a typo in this
 *   variable must not be able to take production down — which is the exact
 *   incident the fail-open fallback above exists to prevent.
 *
 *   NOTE: `isTrustedRedirectOrigin` below is deliberately NOT changed by this.
 *   It fails CLOSED, so a separators-only value there means "trust nothing",
 *   which is already the safe answer and needs no special case.
 */
export function resolveAllowedOrigins(): string[] | null {
  const raw = Deno.env.get('NW_ALLOWED_ORIGINS');
  if (!raw) {
    console.warn(
      '[CORS] NW_ALLOWED_ORIGINS is not set — falling back to permissive ' +
        'origin reflection. Set NW_ALLOWED_ORIGINS to lock this down ' +
        '(see Guidelines §12.4).',
    );
    return null;
  }

  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    console.error(
      '[CORS] NW_ALLOWED_ORIGINS is set but contains no usable origins ' +
        `(received ${JSON.stringify(raw)}). Treating as unset — falling back to ` +
        'permissive origin reflection. Fix the variable to restore the allow-list.',
    );
    return null;
  }

  return origins;
}

/**
 * The value a hand-built `Response` should put in `Access-Control-Allow-Origin`,
 * or `null` when the origin is not allowed and the header must be omitted.
 *
 * Mirrors the `origin` callback `createApp()` hands to Hono's `cors()`, so a
 * streamed or downloaded response answers precisely the origins the middleware
 * would have answered — no wider, no narrower.
 */
export function resolveResponseOrigin(requestOrigin: string | null | undefined): string | null {
  if (!requestOrigin) return null;
  const allowedOrigins = resolveAllowedOrigins();
  if (!allowedOrigins) return requestOrigin; // permissive fallback (see above)
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

/**
 * CORS headers for a hand-built `Response`, ready to spread into a header bag.
 *
 * Returns `{}` for a disallowed origin — an absent `Access-Control-Allow-Origin`
 * is what makes the browser refuse the response, so omitting it is the deny.
 *
 * `Vary: Origin` is always set: the response body is identical across origins
 * but this header is not, and a cache that missed that would serve one origin's
 * allow header to another. Hono's `cors()` does the same for middleware-handled
 * responses.
 *
 * Usage:
 *   return new Response(stream, {
 *     headers: {
 *       'Content-Type': 'text/event-stream',
 *       ...corsResponseHeaders(c.req.header('origin')),
 *     },
 *   });
 */
export function corsResponseHeaders(
  requestOrigin: string | null | undefined,
): Record<string, string> {
  const origin = resolveResponseOrigin(requestOrigin);
  if (!origin) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
  };
}

/**
 * Is this origin one we are willing to send a user *back* to?
 *
 * Used for `emailRedirectTo` on the signup confirmation link. That link is the
 * thing that proves ownership of an address and unlocks the account, so the URL
 * it lands on must not be chosen by whoever called the signup endpoint — the
 * `Origin` header is attacker-controlled, and a confirmation link pointed at an
 * attacker's page hands them the auth token in the callback fragment.
 *
 * Unlike CORS this fails CLOSED: an unrecognised origin returns false and the
 * caller substitutes the canonical site URL. A wrong-but-canonical redirect is
 * a support ticket; an attacker-chosen one is account takeover, and there is no
 * "breaks every browser client" argument on this path to trade against it.
 * When the allow-list is unset we therefore trust nothing rather than trusting
 * everything.
 */
export function isTrustedRedirectOrigin(requestOrigin: string | null | undefined): boolean {
  if (!requestOrigin) return false;
  const raw = Deno.env.get('NW_ALLOWED_ORIGINS');
  if (!raw) return false; // fail CLOSED — see above
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(requestOrigin);
}
