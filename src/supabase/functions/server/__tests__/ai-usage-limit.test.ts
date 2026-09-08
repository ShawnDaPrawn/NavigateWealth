/**
 * AI usage limit — the properties that decide whether it is worth having.
 * =======================================================================
 *
 * The guard is registered AFTER each route's own auth, so the principal it
 * charges is the `userId` that auth already verified. Three properties carry
 * the design, and each of the first two replaced a wrong answer:
 *
 *   - it charges only a VERIFIED principal. Reading an unverified `sub` claim
 *     let anyone who knew a victim's UUID spend the victim's daily allowance
 *     on requests that fail downstream — the failures do not refund the quota.
 *   - it does not throttle reads, which cost nothing at the provider.
 *   - it FAILS CLOSED. A limiter that cannot consult its counter refusing the
 *     request is the right direction for a spend cap; the alternative is an
 *     unbounded third-party bill during exactly the outage nobody is watching.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });

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
import { aiUsageLimit, chargeAiUsage } from '../ai-usage-limit';

/**
 * An app shaped like a real route: an auth middleware that puts a verified
 * `userId` on the context, THEN the limiter. Registering them the other way
 * round is the mistake the limiter degrades silently on, so the fixture makes
 * the ordering explicit.
 */
function appWithLimiter(userId?: string) {
  const app = new Hono();
  if (userId !== undefined) {
    app.use('*', async (c, next) => {
      c.set('userId', userId);
      await next();
    });
  }
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
  it('meters writes for an authenticated caller and attaches the headers', async () => {
    const res = await appWithLimiter('user-1').request('/x', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('10');
    expect(checkRateLimit).toHaveBeenCalled();
  });

  it('does NOT meter reads — a GET costs nothing at the provider', async () => {
    const res = await appWithLimiter('user-1').request('/x', { method: 'GET' });

    expect(res.status).toBe(200);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('meters IP first, then the verified user, per surface', async () => {
    await appWithLimiter('user-1').request('/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });

    // IP first: it is the only bound on an unauthenticated flood, and it costs
    // nothing to apply ahead of the account dimensions.
    expect(checkRateLimit.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ['ip:203.0.113.9', 'ai_daily_ip'],
      ['usr:user-1', 'ai_burst:test-surface'],
      ['usr:user-1', 'ai_daily:test-surface'],
    ]);
  });

  it('charges NO user bucket when auth has not established a principal', async () => {
    // The finding that replaced an unverified `sub` read. A caller the route's
    // auth has not vouched for must not be able to move a named user's
    // counters — the requests it attaches to fail downstream and the quota
    // never comes back.
    const res = await appWithLimiter().request('/x', {
      method: 'POST',
      headers: {
        // Deliberately present, and deliberately ignored.
        Authorization: 'Bearer forged.claiming.victim',
        'x-forwarded-for': '203.0.113.9',
      },
    });

    expect(res.status).toBe(200); // the route's own auth is what rejects it
    expect(checkRateLimit.mock.calls.map((call) => call[0])).toEqual(['ip:203.0.113.9']);
  });

  it('answers 429 with Retry-After once a dimension is exhausted', async () => {
    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 300_000),
      blocked: true,
    });

    const res = await appWithLimiter('user-1').request('/x', { method: 'POST' });

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

    await appWithLimiter('user-1').request('/x', { method: 'POST' });

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

    const res = await appWithLimiter('user-1').request('/x', { method: 'POST' });

    expect(res.status).toBe(429);
  });
});

describe('chargeAiUsage — for routers that authenticate inside the handler', () => {
  it('returns null under the limit and a 429 over it', async () => {
    const app = new Hono();
    app.post('/y', async (c) => {
      const refusal = await chargeAiUsage(c, { surface: 'in-handler', userId: 'user-9' });
      return refusal ?? c.json({ ok: true });
    });

    expect((await app.request('/y', { method: 'POST' })).status).toBe(200);

    checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
      blocked: true,
    });
    expect((await app.request('/y', { method: 'POST' })).status).toBe(429);
  });
});
