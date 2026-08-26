/**
 * functionRegion.ts — Edge Function region pinning
 * ================================================
 *
 * This module patches the global `fetch`. That is invasive by nature, so the
 * tests are written around the two ways it could do harm rather than around
 * the happy path:
 *
 *   1. Touching a request it has no business touching — Supabase auth, storage,
 *      PostgREST, a third-party API, an asset load. Anything not aimed at the
 *      Edge Function must come through byte-identical.
 *   2. Losing headers. `fetch` accepts headers as an object, an array of pairs,
 *      or a `Headers` instance, and as a property of a `Request`. A spread
 *      handles exactly one of those four and silently drops the rest — which
 *      would strip `Authorization` and log every user out.
 *
 * Both are asserted below. The happy path is one test; the rest is blast radius.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  DATABASE_REGION,
  FUNCTION_REGION,
  FUNCTION_REGION_HEADERS,
  installFunctionRegionInterceptor,
  resetFunctionRegionInterceptorForTests,
  resolveFunctionRegion,
} from '../functionRegion';

const FUNCTION_URL =
  'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/publications/articles';

let originalFetch: typeof globalThis.fetch;
let seen: Array<{ url: string; headers: Headers }>;
/**
 * Kept separately on purpose. Once the interceptor is installed
 * `globalThis.fetch` is the WRAPPER, so reaching for `.mock` through it is
 * undefined — the mock's own reference is the only way to inspect what
 * actually reached the underlying fetch.
 */
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  seen = [];
  mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    seen.push({ url, headers });
    return new Response('{}', { status: 200 });
  });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetFunctionRegionInterceptorForTests();
  delete (import.meta as unknown as { env: Record<string, unknown> }).env.VITE_NW_FUNCTION_REGION;
});

// ============================================================================
// CONFIGURATION
// ============================================================================

describe('region resolution', () => {
  it('defaults to the database region when unset', () => {
    expect(resolveFunctionRegion(undefined)).toBe(DATABASE_REGION);
    expect(resolveFunctionRegion(null)).toBe(DATABASE_REGION);
  });

  it('treats an empty or whitespace value as unset rather than as "no region"', () => {
    expect(resolveFunctionRegion('')).toBe(DATABASE_REGION);
    expect(resolveFunctionRegion('   ')).toBe(DATABASE_REGION);
  });

  it.each(['auto', 'AUTO', 'Auto', ' auto '])('treats %j as "do not pin"', (value) => {
    // The escape hatch for a regional outage. Case-insensitive and trimmed on
    // purpose: an operator reaching for this during an incident should not
    // have to guess.
    expect(resolveFunctionRegion(value)).toBeNull();
  });

  it('honours an explicit override, trimmed', () => {
    expect(resolveFunctionRegion('eu-west-1')).toBe('eu-west-1');
    expect(resolveFunctionRegion('  eu-west-1  ')).toBe('eu-west-1');
  });

  it('ships pinned to the database region by default', () => {
    // The value the app actually runs with, as built. If someone sets
    // VITE_NW_FUNCTION_REGION in the test env this is the test that notices.
    expect(FUNCTION_REGION).toBe(DATABASE_REGION);
    expect(FUNCTION_REGION_HEADERS).toEqual({ 'x-region': 'us-east-2' });
  });

  it('exposes frozen headers so a caller cannot mutate the shared object', () => {
    expect(Object.isFrozen(FUNCTION_REGION_HEADERS)).toBe(true);
  });
});

// ============================================================================
// WHAT IT TOUCHES — and, more importantly, what it does not
// ============================================================================

describe('the interceptor pins Edge Function requests', () => {
  it('adds x-region to an Edge Function request', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL);
    expect(seen).toHaveLength(1);
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it.each([
    ['Supabase auth', 'https://vpjmdsltwrnpefzcgdmz.supabase.co/auth/v1/token'],
    ['Supabase storage', 'https://vpjmdsltwrnpefzcgdmz.supabase.co/storage/v1/object/x.pdf'],
    ['PostgREST', 'https://vpjmdsltwrnpefzcgdmz.supabase.co/rest/v1/clients'],
    ['a third party', 'https://api.example.com/v1/things'],
    ['a same-origin asset', '/img/optimized/hero-1280.avif'],
    ['a different Supabase function', 'https://other.supabase.co/functions/v1/some-other-fn'],
  ])('leaves %s alone', async (_label, url) => {
    installFunctionRegionInterceptor();
    await fetch(url);
    expect(seen[0].headers.has('x-region')).toBe(false);
  });

  it('does nothing at all when pinning is disabled', async () => {
    const before = globalThis.fetch;
    installFunctionRegionInterceptor(null);
    // fetch must not even be wrapped — no wrapper, no risk.
    expect(globalThis.fetch).toBe(before);
    await fetch(FUNCTION_URL);
    expect(seen[0].headers.has('x-region')).toBe(false);
  });

  it('is idempotent — installing twice does not stack wrappers', async () => {
    installFunctionRegionInterceptor();
    const afterFirst = globalThis.fetch;
    installFunctionRegionInterceptor();
    expect(globalThis.fetch).toBe(afterFirst);
    await fetch(FUNCTION_URL);
    expect(seen).toHaveLength(1);
  });
});

// ============================================================================
// HEADER PRESERVATION — the way this could log everyone out
// ============================================================================

describe('it preserves the caller’s headers in every shape fetch accepts', () => {
  it('object literal', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL, {
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    });
    expect(seen[0].headers.get('authorization')).toBe('Bearer tok');
    expect(seen[0].headers.get('content-type')).toBe('application/json');
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('array of pairs', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL, { headers: [['Authorization', 'Bearer tok']] });
    expect(seen[0].headers.get('authorization')).toBe('Bearer tok');
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('Headers instance', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL, { headers: new Headers({ Authorization: 'Bearer tok' }) });
    expect(seen[0].headers.get('authorization')).toBe('Bearer tok');
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('headers carried on a Request object', async () => {
    installFunctionRegionInterceptor();
    await fetch(new Request(FUNCTION_URL, { headers: { Authorization: 'Bearer tok' } }));
    expect(seen[0].headers.get('authorization')).toBe('Bearer tok');
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('no headers at all', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL);
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('a URL object rather than a string', async () => {
    installFunctionRegionInterceptor();
    await fetch(new URL(FUNCTION_URL), { headers: { Authorization: 'Bearer tok' } });
    expect(seen[0].headers.get('authorization')).toBe('Bearer tok');
    expect(seen[0].headers.get('x-region')).toBe('us-east-2');
  });

  it('does not override an x-region the caller set deliberately', async () => {
    installFunctionRegionInterceptor();
    await fetch(FUNCTION_URL, { headers: { 'x-region': 'ap-southeast-1' } });
    expect(seen[0].headers.get('x-region')).toBe('ap-southeast-1');
  });

  it('leaves the rest of init untouched', async () => {
    installFunctionRegionInterceptor();
    const body = JSON.stringify({ a: 1 });
    await fetch(FUNCTION_URL, { method: 'POST', body, cache: 'no-store' });
    const call = mockFetch.mock.calls[0];
    // Method, body and cache must survive verbatim into the underlying fetch.
    expect((call[1] as RequestInit).method).toBe('POST');
    expect((call[1] as RequestInit).body).toBe(body);
    expect((call[1] as RequestInit).cache).toBe('no-store');
  });
});

// ============================================================================
// THE WRAPPER MUST NOT BE THE FAILURE
// ============================================================================

describe('robustness', () => {
  it('passes a FormData body through without stringifying it', async () => {
    // Multipart uploads (signed wills, e-sign documents, profile documents)
    // rely on the browser setting the boundary. A wrapper that rebuilt the
    // body would break every upload in the app.
    installFunctionRegionInterceptor();
    const fd = new FormData();
    fd.append('file', new Blob(['x']), 'x.pdf');
    await fetch(FUNCTION_URL, { method: 'POST', body: fd });
    const call = mockFetch.mock.calls[0];
    expect((call[1] as RequestInit).body).toBeInstanceOf(FormData);
  });

  it('propagates the underlying rejection rather than swallowing it', async () => {
    installFunctionRegionInterceptor();
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fetch(FUNCTION_URL)).rejects.toThrow('Failed to fetch');
  });

  it('returns the response the underlying fetch returned', async () => {
    installFunctionRegionInterceptor();
    const res = await fetch(FUNCTION_URL);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
  });
});
