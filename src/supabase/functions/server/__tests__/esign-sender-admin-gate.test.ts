/**
 * E-sign — the sender side is staff-only.
 * =======================================
 *
 * Every sender route authenticated with `getAuthContext`, which any signed-in
 * user passes, and most scoped the data only to the caller's "firm" — which,
 * for a client with no firm in `app_metadata`, is their own user id. So a
 * self-registered client could run a complete sender account: upload a PDF,
 * brand it, email signing requests to anyone from the platform, and mint v1
 * API keys and webhooks. Bulk void and bulk remind had no role check at all,
 * templates and campaigns were global, and the consent text every signer sees
 * could be republished by anyone.
 *
 * The sender routes now require an admin. What stays open is listed below with
 * the reason — anything NOT on that list must refuse a signed-in client. The
 * list is checked against the router's own route table, so a sender route
 * added later without a guard fails here rather than shipping open.
 */
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../esign-scheduler.ts', () => ({ startExpirySweepScheduler: () => undefined }));
vi.mock('../esign-rate-limit.ts', () => ({
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('../idempotency.ts', () => ({
  requireIdempotency: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  class AuthError extends Error {
    constructor(
      message: string,
      public statusCode = 401,
      public code = 'AUTH_ERROR',
    ) {
      super(message);
    }
  }
  return {
    AuthError,
    // Handlers that authenticate for themselves see whoever the headers say.
    getAuthContext: async (c: { req: { header: (n: string) => string | undefined } }) => {
      if (!c.req.header('Authorization')) throw new AuthError('Unauthorized', 401);
      const id = c.req.header('x-test-user') ?? 'client-1';
      return {
        user: { id },
        userId: id,
        role: c.req.header('x-test-role') ?? 'client',
        token: 't',
      };
    },
    requireAuth: makeRoleGate(['client', 'adviser', 'admin', 'super_admin'], 'AUTH', 'client'),
    requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN'),
    requireSuperAdmin: makeRoleGate(['super_admin', 'super-admin'], 'FORBIDDEN_SUPER_ADMIN'),
  };
});

const { request, routeRegistrations, kvStore } = await import('./helpers/contract-harness.ts');
const esign = (await import('../esign-routes.ts')).default;

/** Routes that are NOT staff-only, and why. Matched on method + path pattern. */
const OPEN: Array<[RegExp, string]> = [
  [/^(ALL|GET) (\/|\/health)?$/, 'service descriptor'],
  [/^[A-Z]+ \/(signer|sign-by-token)\b/, 'signer access-token flow — the token is the credential'],
  [/^POST \/verify-hash$/, 'public document-integrity check'],
  [/^GET \/consent\/active$/, 'the consent text shown to every signer'],
  [/^[A-Z]+ \/me\//, "the caller's own notification settings"],
  [/^[A-Z]+ \/cron\//, 'scheduler endpoints — cron token, not a session'],
  [/^[A-Z]+ \/v1\//, 'public REST API — API-key auth'],
  [/^GET \/clients\/:clientId\/envelopes$/, "a client's own envelope list (client-access checked)"],
  [
    /^GET \/envelopes\/:envelopeId\/(download|audit|document|certificate)$/,
    'client e-sign history page reads (envelope ownership checked)',
  ],
];

const isOpen = (key: string) => OPEN.some(([re]) => re.test(key));

const routes = [
  ...new Set(
    routeRegistrations(esign)
      .filter((r) => r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`),
  ),
];
const guarded = routes.filter((k) => !isOpen(k));

describe('e-sign sender routes are staff-only', () => {
  it('walks a route table of the expected size', () => {
    expect(routes.length).toBeGreaterThan(100);
    expect(guarded.length).toBeGreaterThan(80);
  });

  it('keeps every open-route exemption pointing at a real route', () => {
    for (const [re, why] of OPEN.slice(1)) {
      expect(
        routes.some((k) => re.test(k)),
        `exemption for "${why}" matches nothing`,
      ).toBe(true);
    }
  });

  it.each(guarded)('%s refuses a signed-in client', async (key) => {
    const [method, path] = key.split(' ');
    const res = await request(esign, path.replace(/:[A-Za-z_]+/g, 'x'), {
      as: 'client',
      user: 'client-1',
      method,
      ...(method === 'GET' || method === 'DELETE' ? {} : { body: {} }),
    });
    expect(res.status).toBe(403);
  });
});

describe('webhook delivery replay', () => {
  // A firm is the admin's `app_metadata.firm_id`, else their user id — which is
  // what the auth stub above hands back, so 'admin-a' is firm 'admin-a'.
  const seedDead = (id: string, firm: string) =>
    kvStore.set(`esign:webhook:delivery:${id}`, {
      id,
      firm_id: firm,
      subscription_id: 'sub-1',
      event_id: 'evt-1',
      event_type: 'envelope.completed',
      payload: {},
      attempts: 8,
      status: 'dead',
      next_attempt_at: '2026-09-01T00:00:00.000Z',
      last_error: 'HTTP 500',
      created_at: '2026-09-01T00:00:00.000Z',
    });
  const stored = (id: string) =>
    kvStore.get(`esign:webhook:delivery:${id}`) as { status: string; attempts: number };

  it("leaves another firm's delivery untouched and reports it as absent", async () => {
    kvStore.clear();
    seedDead('d-other', 'admin-b');
    const res = await request(esign, '/webhooks/deliveries/d-other/replay', {
      as: 'admin',
      user: 'admin-a',
      method: 'POST',
      body: {},
    });
    expect(res.status).toBe(404);
    // It used to be re-queued first and refused second.
    expect(stored('d-other')).toMatchObject({ status: 'dead', attempts: 8 });
  });

  it("re-queues the caller's own firm's delivery", async () => {
    kvStore.clear();
    seedDead('d-own', 'admin-a');
    const res = await request(esign, '/webhooks/deliveries/d-own/replay', {
      as: 'admin',
      user: 'admin-a',
      method: 'POST',
      body: {},
    });
    expect(res.status).toBe(200);
    expect(stored('d-own')).toMatchObject({ status: 'pending', attempts: 0 });
  });
});
