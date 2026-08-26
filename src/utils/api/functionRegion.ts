/**
 * Edge Function region pinning
 * ===========================
 *
 * Supabase runs an Edge Function in the region nearest the CALLER, but the
 * database lives in exactly one region — `us-east-2` for this project. So a
 * request from Johannesburg executes in Paris (`eu-west-3`) and then makes
 * every database round trip across the Atlantic, sequentially, at ~90 ms each.
 *
 * Measured against 24 hours of real traffic, one route, split by the region
 * that served it — same code, same database, same query:
 *
 *   us-east-2   same region as the DB    43 calls   p50 1,484 ms
 *   us-east-1   ~600 km                  93 calls   p50 1,657 ms
 *   us-west-1   continental              30 calls   p50 2,148 ms
 *   eu-west-3   transatlantic             4 calls   p50 2,860 ms
 *
 * p50 rises monotonically with distance from the database. The app's users are
 * in South Africa and land on `eu-west-3`, so they pay roughly 1,376 ms per
 * request for the geography alone. Full measurement and the queries to re-run
 * it: docs/runbooks/edge-function-latency.md.
 *
 * Sending `x-region` tells the Supabase gateway which region to run the
 * function in. The client then pays ONE long trip instead of N shorter ones,
 * and N is greater than 1 on every route that reads more than a single key.
 *
 * The pin target is `us-east-1`, NOT the database's own `us-east-2`: Supabase
 * does not accept `us-east-2` in `x-region` (see SUPPORTED_FUNCTION_REGIONS
 * below). `us-east-1` is the nearest region it does accept, and the table
 * above measures it at p50 1,657 ms — so this recovers roughly 1,200 ms of the
 * ~1,376 ms, not all of it.
 *
 * ── The trade-off, from Supabase's own documentation ──────────────────────
 *
 *   "When you explicitly specify a region via the `x-region` header, requests
 *    will NOT be automatically re-routed to another region. During outages,
 *    consider temporarily changing to a different region."
 *
 * Pinning buys latency and gives up automatic failover. That is why the value
 * is read from an environment variable rather than hard-coded: during a
 * regional outage it can be repointed, or the pin dropped entirely, by
 * changing `VITE_NW_FUNCTION_REGION` and redeploying the SPA — no code change,
 * no review cycle. Set it to `auto` (or empty) to stop sending the header and
 * fall back to Supabase's nearest-caller routing.
 *
 * ── Why this is an interceptor and not a header spread at each call site ──
 *
 * The first attempt at this patched the api client and each auth-header
 * helper. An audit killed that approach: **58 files** set an
 * `Authorization: Bearer` header for the Edge Function, across ~96 sites —
 * four different `getAuthHeaders` helpers, two `AUTH_HEADERS` module
 * constants, and dozens of inline object literals in page components.
 *
 * Patching them individually fails in the one way that matters. A single
 * missed site does not merely stay slow: it sends that request to a different
 * region from all the others, so the app runs split across two regions with
 * no single place to correct it. That is worse than not pinning at all, and
 * "we patched all 96, honest" is not a property anyone can verify later or
 * that survives the next call site someone adds.
 *
 * So the header is added once, at the fetch boundary, to requests aimed at the
 * Edge Function and nothing else. New call sites are covered whether or not
 * their author has read this file.
 *
 * `x-region` is on the function's CORS allow-list (see `create-app.ts`, shipped
 * ahead of this change), so it does not trip a preflight.
 */

/** The region the Postgres database runs in. Reported by `get_project`. */
export const DATABASE_REGION = 'us-east-2';

/**
 * The regions Supabase accepts in `x-region`, verbatim from its documentation.
 *
 * **`us-east-2` is not in this list.** The database lives there, but Edge
 * Functions cannot be pinned there — the nearest supported region is
 * `us-east-1` (N. Virginia), a few hundred kilometres away. The first draft of
 * this file defaulted to `DATABASE_REGION` on the assumption that the two sets
 * were the same, which would have put an unsupported value on the header of
 * every request in the app.
 *
 * A configured region is validated against this list precisely so that mistake
 * cannot be made again by hand.
 */
export const SUPPORTED_FUNCTION_REGIONS = Object.freeze([
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ca-central-1',
  'us-east-1',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'sa-east-1',
]);

/**
 * Nearest supported region to the database.
 *
 * The measurement in the header comment puts `us-east-1` at p50 1,657 ms
 * against `us-east-2`'s 1,484 ms — so pinning here recovers most, not all, of
 * the transatlantic cost. `us-east-1` also carries the largest sample in that
 * table (93 calls), which makes it the better-evidenced of the two.
 */
export const DEFAULT_FUNCTION_REGION = 'us-east-1';

/**
 * Resolve a configured value to a region, or `null` for "do not pin".
 *
 * `auto` and the empty string both mean "do not pin", so an operator reaching
 * for the escape hatch during a regional outage does not have to guess a magic
 * value. Pure and exported so it can be tested without reloading the module.
 */
export function resolveFunctionRegion(configured: string | undefined | null): string | null {
  const value = (configured ?? '').trim();
  if (value === '') return DEFAULT_FUNCTION_REGION;
  if (value.toLowerCase() === 'auto') return null;
  if (!SUPPORTED_FUNCTION_REGIONS.includes(value)) {
    // Fall back rather than throw: a bad environment variable must not brick
    // the app. Loud, because a silently ignored pin is the failure that looks
    // like success.
    console.warn(
      `[functionRegion] VITE_NW_FUNCTION_REGION="${value}" is not a region Supabase ` +
        `accepts in x-region. Falling back to ${DEFAULT_FUNCTION_REGION}. ` +
        `Supported: ${SUPPORTED_FUNCTION_REGIONS.join(', ')}, or "auto" to disable pinning.`,
    );
    return DEFAULT_FUNCTION_REGION;
  }
  return value;
}

export const FUNCTION_REGION: string | null = resolveFunctionRegion(
  import.meta.env?.VITE_NW_FUNCTION_REGION,
);

/**
 * Header fragment to spread into any request aimed at the Edge Function.
 *
 * Empty when pinning is disabled, so spreading it is always safe and the
 * caller never needs a conditional.
 */
export const FUNCTION_REGION_HEADERS: Readonly<Record<string, string>> =
  FUNCTION_REGION === null ? Object.freeze({}) : Object.freeze({ 'x-region': FUNCTION_REGION });

/** Convenience for callers holding a headers object they want to augment. */
export function withFunctionRegion<T extends Record<string, string>>(
  headers: T,
): T & Record<string, string> {
  return { ...headers, ...FUNCTION_REGION_HEADERS };
}

// ============================================================================
// INTERCEPTOR
// ============================================================================

/**
 * URL prefix every Edge Function request shares. Anything else is left alone —
 * this must not touch Supabase auth/storage/PostgREST calls, third-party APIs,
 * Vite's own dev requests, or asset loads.
 */
const FUNCTION_URL_MARKER = '/functions/v1/make-server-91ed8379';

/** Set once installed, so a double install cannot stack wrappers. */
let installed = false;

/** Extract a URL string from any of fetch's accepted first-argument shapes. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Add `x-region` to Edge Function requests, globally.
 *
 * Idempotent, and a no-op when pinning is disabled or `fetch` is unavailable
 * (SSR, the static SEO pass, a non-browser test environment). Must be called
 * explicitly rather than on import so importing the constants above never has
 * a side effect — tests that mock `fetch` are unaffected unless they opt in.
 *
 * An `x-region` already present on the request is preserved: a deliberate
 * per-call choice outranks the global default.
 *
 * `region` defaults to `FUNCTION_REGION` and exists so tests can drive both
 * the enabled and disabled paths directly. `import.meta.env.VITE_*` is a
 * compile-time substitution, so it cannot be reassigned from a test — relying
 * on that is what made five assertions here pass for the wrong reason before
 * this seam existed. App code should call it with no argument.
 */
export function installFunctionRegionInterceptor(region: string | null = FUNCTION_REGION): void {
  if (installed) return;
  if (region === null) return;
  if (typeof globalThis.fetch !== 'function') return;

  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = function pinnedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string;
    try {
      url = urlOf(input);
    } catch {
      // Never let this wrapper be the reason a request fails.
      return original(input as RequestInfo, init);
    }

    if (!url.includes(FUNCTION_URL_MARKER)) return original(input as RequestInfo, init);

    // `Headers` merges correctly across all three input shapes (object,
    // array-of-pairs, Headers) where a spread would silently drop two of them.
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (!headers.has('x-region')) headers.set('x-region', region);

    return original(input as RequestInfo, { ...init, headers });
  } as typeof fetch;

  installed = true;
}

/** Test seam: forget that the interceptor was installed. Not for app code. */
export function resetFunctionRegionInterceptorForTests(): void {
  installed = false;
}
