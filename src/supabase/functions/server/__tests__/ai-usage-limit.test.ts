/**
 * AI usage limit — the properties that decide whether it is worth having.
 * =======================================================================
 *
 * The middleware runs on the PARENT app, ahead of the lazy import and
 * therefore ahead of the sub-router's own `requireAuth`. That ordering is what
 * makes two of these tests load-bearing rather than incidental:
 *
 *   - it must be safe on an unauthenticated request (no `c.get('userId')`);
 *   - it must not throttle reads, which cost nothing at the provider.
 *
 * And the third: it FAILS CLOSED. A limiter that cannot consult its counter
 * refusing the request is the correct direction for a spend cap — the failure
 * mode of the alternative is an unbounded third-party bill during exactly the
 * outage nobody is watching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => undefined } });

const checkRateLimit = vi.hoisted(() =>
  vi.fn(async () => ({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
    blocked: false,
  })),
);
vi.mock('../rateLimiter.ts', () => ({ checkRateLimit }));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { Hono } from 'npm:hono';
import { aiUsageLimit } from '../ai-usage-limit';

/** A bearer token carrying `sub`. The signature is never inspected. */
function bearer(sub: string): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `Bearer ${b64({ alg: 'HS256' })}.${b64({ sub })}.sig`;
}

function appWithLimiter() {
  const app = new Hono();
  app.use('*', aiUsageLimit({ surface: 'test-surface' }));
  app.all('/x', (c) => c.json({ ok: true }));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60_000),
    blocked: false,
  });
});

describe('aiUsageLimit', () => {
  it('meters writes and attaches the rate-limit headers', async () => {
    const res = await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { Authorization: bearer('user-1') },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('10');
    expect(checkRateLimit).toHaveBeenCalled();
  });

  it('does NOT meter reads — a GET costs nothing at the provider', async () => {
    const res = await appWithLimiter().request('/x', {
      method: 'GET',
      headers: { Authorization: bearer('user-1') },
    });

    expect(res.status).toBe(200);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('keys the user dimensions on the token subject, per surface', async () => {
    await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { Authorization: bearer('user-1'), 'x-forwarded-for': '203.0.113.9' },
    });

    const actions = checkRateLimit.mock.calls.map((call) => [call[0], call[1]]);
    expect(actions).toEqual([
      ['usr:user-1', 'ai_burst:test-surface'],
      ['usr:user-1', 'ai_daily:test-surface'],
      ['ip:203.0.113.9', 'ai_daily_ip'],
    ]);
  });

  it('falls back to the IP dimension alone when there is no readable token', async () => {
    // The middleware runs before the sub-router's auth, so it MUST cope with a
    // request that carries no usable token rather than throwing on one.
    const res = await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });

    expect(res.status).toBe(200);
    expect(checkRateLimit.mock.calls.map((call) => call[0])).toEqual(['ip:203.0.113.9']);
  });

  it('answers 429 with Retry-After once a dimension is exhausted', async () => {
    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 300_000),
      blocked: true,
    });

    const res = await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { Authorization: bearer('user-1') },
    });

    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ code: 'AI_USAGE_LIMIT' });
  });

  it('stops at the first exhausted dimension instead of burning the rest', async () => {
    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 300_000),
      blocked: true,
    });

    await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { Authorization: bearer('user-1') },
    });

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  it('FAILS CLOSED when the counter cannot be consulted', async () => {
    // `checkRateLimit` already returns allowed:false on its own failure; this
    // pins that the middleware honours that rather than treating an error as
    // permission to spend.
    checkRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      blocked: true,
    });

    const res = await appWithLimiter().request('/x', {
      method: 'POST',
      headers: { Authorization: bearer('user-1') },
    });

    expect(res.status).toBe(429);
  });
});
