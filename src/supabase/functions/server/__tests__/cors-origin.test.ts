/**
 * cors-origin.ts — shared allow-list for hand-built Responses
 * ===========================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `createApp()` puts a CORS allow-list in front of every route, but a handler
 * that returns its own `new Response(...)` writes its own headers and bypasses
 * it. Five did, each sending `Access-Control-Allow-Origin: '*'`: the client
 * overview PDF, the e-sign audit CSV, the advisor SSE stream, the policy
 * re-extraction NDJSON stream, and the public Vasco stream.
 *
 * These tests pin the two properties that matter: a hand-built response answers
 * exactly the origins the middleware would answer (no wider), and the redirect
 * helper — which decides where a signup confirmation link lands — fails CLOSED
 * where CORS deliberately fails open.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/cors-origin.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const denoEnv = new Map<string, string>();

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => denoEnv.get(key) } });
});

beforeEach(() => {
  denoEnv.clear();
  vi.restoreAllMocks();
});

const SITE = 'https://www.navigatewealth.co';
const APEX = 'https://navigatewealth.co';
const EVIL = 'https://evil.example';

async function mod() {
  return await import('../cors-origin.ts');
}

describe('resolveResponseOrigin — mirrors the createApp() cors() callback', () => {
  it('echoes an allow-listed origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', `${SITE}, ${APEX}`);
    const { resolveResponseOrigin } = await mod();
    expect(resolveResponseOrigin(APEX)).toBe(APEX);
  });

  it('refuses an origin outside the allow-list', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    const { resolveResponseOrigin } = await mod();
    expect(resolveResponseOrigin(EVIL)).toBeNull();
  });

  it('refuses a request with no Origin header', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    const { resolveResponseOrigin } = await mod();
    expect(resolveResponseOrigin(undefined)).toBeNull();
    expect(resolveResponseOrigin(null)).toBeNull();
    expect(resolveResponseOrigin('')).toBeNull();
  });

  it('falls back to reflection when the env var is unset — same fail-OPEN as the middleware', async () => {
    // Pinned deliberately: the middleware reflects rather than breaking every
    // browser client, and a hand-built response must not be stricter than the
    // middleware or the same deploy would answer two different ways.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { resolveResponseOrigin } = await mod();
    expect(resolveResponseOrigin(EVIL)).toBe(EVIL);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NW_ALLOWED_ORIGINS'));
  });

  it('treats a separators-only allow-list as a misconfiguration, not a lock-down', async () => {
    // This used to deny EVERY origin, silently — a whole-site outage from a
    // typo, indistinguishable from a deliberate lock-down, while `""` (which
    // means the same thing) reflected. The two now behave alike; see the note
    // on resolveAllowedOrigins. ERROR rather than WARN because, unlike an
    // unset variable, this input means someone tried to configure a list.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    denoEnv.set('NW_ALLOWED_ORIGINS', ' , ,');
    const { resolveResponseOrigin } = await mod();

    expect(resolveResponseOrigin(APEX)).toBe(APEX);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('NW_ALLOWED_ORIGINS'));
    error.mockRestore();
  });

  it('still fails CLOSED for a redirect target on the same input', async () => {
    // The asymmetry is the point: reflecting an origin back in a CORS header is
    // defence-in-depth, but sending a user to one is account takeover. A
    // misconfigured allow-list must not become "any redirect is fine".
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    denoEnv.set('NW_ALLOWED_ORIGINS', ' , ,');
    const { isTrustedRedirectOrigin } = await mod();

    expect(isTrustedRedirectOrigin(APEX)).toBe(false);
    expect(isTrustedRedirectOrigin(EVIL)).toBe(false);
    error.mockRestore();
  });
});

describe('corsResponseHeaders — what a stream/download actually sends', () => {
  it('sets the allow header for an allow-listed origin, and always varies on Origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    const { corsResponseHeaders } = await mod();
    expect(corsResponseHeaders(SITE)).toEqual({
      'Access-Control-Allow-Origin': SITE,
      Vary: 'Origin',
    });
  });

  it('omits the allow header entirely for a disallowed origin — the absence IS the deny', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    const { corsResponseHeaders } = await mod();
    const headers = corsResponseHeaders(EVIL);
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(headers.Vary).toBe('Origin');
  });

  it('never emits a wildcard, whatever the configuration', async () => {
    // The regression this whole module exists to prevent.
    const { corsResponseHeaders } = await mod();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const allow of [undefined, '', ' , ,', SITE, `${SITE},${APEX}`]) {
      denoEnv.delete('NW_ALLOWED_ORIGINS');
      if (allow !== undefined) denoEnv.set('NW_ALLOWED_ORIGINS', allow);
      for (const origin of [SITE, APEX, EVIL, undefined]) {
        expect(corsResponseHeaders(origin)['Access-Control-Allow-Origin']).not.toBe('*');
      }
    }
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('isTrustedRedirectOrigin — where a confirmation link may land', () => {
  it('accepts an allow-listed origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', `${SITE}, ${APEX}`);
    const { isTrustedRedirectOrigin } = await mod();
    expect(isTrustedRedirectOrigin(APEX)).toBe(true);
  });

  it('rejects an attacker-supplied origin', async () => {
    denoEnv.set('NW_ALLOWED_ORIGINS', SITE);
    const { isTrustedRedirectOrigin } = await mod();
    expect(isTrustedRedirectOrigin(EVIL)).toBe(false);
  });

  it('fails CLOSED when the allow-list is unset, unlike CORS', async () => {
    // The asymmetry is the point. CORS reflects when unconfigured because
    // failing closed there breaks every browser client. This path hands someone
    // a URL carrying a session token, so an unconfigured deploy must trust
    // nothing rather than everything — the caller substitutes the site URL.
    const { isTrustedRedirectOrigin } = await mod();
    expect(isTrustedRedirectOrigin(EVIL)).toBe(false);
    expect(isTrustedRedirectOrigin(SITE)).toBe(false);
  });

  it('does not warn — an unset allow-list here is handled, not a misconfiguration to shout about', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { isTrustedRedirectOrigin } = await mod();
    isTrustedRedirectOrigin(SITE);
    expect(warn).not.toHaveBeenCalled();
  });
});
