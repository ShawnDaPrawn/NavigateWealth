/**
 * social-assets-routes.ts — Route Contract Tests
 * ==============================================
 *
 * The thing worth pinning is the auth split:
 *   - **requireAdmin** on every human-facing route (batches, assets, settings,
 *     playbooks) — the kill switch and the routines' instructions live here;
 *   - **cron OR admin** on the two jobs: the scheduled caller has a Vault token
 *     and no session, the "Run now" button has a session and no token, and
 *     both must work while an anonymous caller must not.
 *
 * Validation is real (zod); the service is stubbed. Every route registered on
 * the router must appear in ROUTE_TABLE, so a new route cannot land without a
 * tier decision.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, routeRegistrations, DEFAULT_TEST_USER } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const svc = vi.hoisted(() => ({
  listBatches: vi.fn(async () => [{ id: 'b1', week_key: '2026-W38' }]),
  getBatch: vi.fn(async () => ({ batch: { id: 'b1', week_key: '2026-W38' }, assets: [] })),
  listAssets: vi.fn(async () => []),
  updateAsset: vi.fn(async () => ({ id: 'a1', state: 'rejected' })),
  getSettings: vi.fn(async () => ({ id: 'default', enabled: true })),
  updateSettings: vi.fn(async () => ({ id: 'default', enabled: false })),
  listPlaybooks: vi.fn(async () => [{ id: 'generate' }, { id: 'schedule' }]),
  updatePlaybook: vi.fn(async () => ({ id: 'generate', version: 2 })),
  renderPendingImages: vi.fn(async () => ({
    dryRun: true,
    scanned: 0,
    rendered: 0,
    failed: 0,
    skipped: 0,
    details: [],
  })),
  syncBufferStatuses: vi.fn(async () => ({
    dryRun: true,
    checked: 0,
    published: 0,
    failed: 0,
    unchanged: 0,
    errors: [],
  })),
}));

const cron = vi.hoisted(() => ({ authorized: false }));

vi.mock('../social-assets-service.ts', () => svc);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAuth: makeRoleGate(['admin', 'client'], 'AUTH_REQUIRED'),
    requireAdmin: makeRoleGate(['admin'], 'ADMIN_REQUIRED'),
  };
});
vi.mock('../cron-auth.ts', () => ({
  isAuthorizedCronRequest: async () => cron.authorized,
}));
vi.mock('../ai-usage-limit.ts', () => ({
  aiUsageLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import app from '../social-assets-routes.ts';

beforeEach(() => {
  vi.clearAllMocks();
  cron.authorized = false;
});

const ROUTE_TABLE: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path: string;
  tier: 'admin' | 'cron-or-admin';
  body?: unknown;
}[] = [
  { method: 'POST', path: '/jobs/render-images', tier: 'cron-or-admin', body: {} },
  { method: 'POST', path: '/jobs/sync-buffer', tier: 'cron-or-admin', body: {} },
  { method: 'GET', path: '/batches', tier: 'admin' },
  { method: 'GET', path: '/batches/2026-W38', tier: 'admin' },
  { method: 'GET', path: '/assets', tier: 'admin' },
  { method: 'PATCH', path: '/assets/a1', tier: 'admin', body: { state: 'rejected' } },
  { method: 'GET', path: '/settings', tier: 'admin' },
  { method: 'PUT', path: '/settings', tier: 'admin', body: { enabled: false } },
  { method: 'GET', path: '/playbooks', tier: 'admin' },
  { method: 'PUT', path: '/playbooks/generate', tier: 'admin', body: { instructions: 'x' } },
];

describe('route inventory', () => {
  it('every registered route has a tier decision in ROUTE_TABLE', () => {
    // Hono registers one entry per middleware on a route, so dedupe by method+path.
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    const tabled = ROUTE_TABLE.map(
      (r) =>
        `${r.method} ${r.path.replace(/2026-W38|a1|generate/, (m) =>
          m === '2026-W38' ? ':weekKey' : m === 'a1' ? ':id' : ':id',
        )}`,
    );
    for (const route of registered) {
      expect(tabled, `untabled route ${route}`).toContain(route);
    }
    expect(registered.length).toBe(ROUTE_TABLE.length);
  });
});

describe('auth tiers', () => {
  for (const route of ROUTE_TABLE) {
    it(`${route.method} ${route.path} rejects an anonymous caller`, async () => {
      const res = await request(app, route.path, {
        method: route.method,
        body: route.body,
        auth: false,
      });
      expect(res.status).toBe(401);
    });

    it(`${route.method} ${route.path} accepts an admin session`, async () => {
      const res = await request(app, route.path, {
        method: route.method,
        body: route.body,
        as: 'admin',
      });
      expect([200, 201]).toContain(res.status);
    });

    if (route.tier === 'admin') {
      it(`${route.method} ${route.path} refuses a client session`, async () => {
        const res = await request(app, route.path, {
          method: route.method,
          body: route.body,
          as: 'client',
        });
        expect(res.status).toBe(403);
      });
    } else {
      it(`${route.method} ${route.path} accepts the cron token with no session`, async () => {
        cron.authorized = true;
        const res = await request(app, route.path, {
          method: route.method,
          body: route.body,
          auth: false,
        });
        expect(res.status).toBe(200);
      });
    }
  }
});

describe('jobs', () => {
  it('render-images defaults to a dry run and passes the parsed options through', async () => {
    cron.authorized = true;
    const res = await request(app, '/jobs/render-images', { method: 'POST', auth: false, raw: '' });
    expect(res.status).toBe(200);
    expect(svc.renderPendingImages).toHaveBeenCalledWith({ dryRun: true, maxImages: 12 });
  });

  it('render-images honours an explicit live run', async () => {
    const res = await request(app, '/jobs/render-images', {
      method: 'POST',
      as: 'admin',
      body: { dryRun: false, maxImages: 3 },
    });
    expect(res.status).toBe(200);
    expect(svc.renderPendingImages).toHaveBeenCalledWith({ dryRun: false, maxImages: 3 });
  });

  it('render-images rejects an out-of-range maxImages', async () => {
    const res = await request(app, '/jobs/render-images', {
      method: 'POST',
      as: 'admin',
      body: { maxImages: 500 },
    });
    expect(res.status).toBe(400);
    expect(svc.renderPendingImages).not.toHaveBeenCalled();
  });

  it('sync-buffer defaults to a dry run', async () => {
    cron.authorized = true;
    await request(app, '/jobs/sync-buffer', { method: 'POST', auth: false, body: {} });
    expect(svc.syncBufferStatuses).toHaveBeenCalledWith({ dryRun: true, maxPosts: 50 });
  });
});

describe('reads and writes', () => {
  it('rejects a malformed week key before touching the service', async () => {
    const res = await request(app, '/batches/week-38', { as: 'admin' });
    expect(res.status).toBe(400);
    expect(svc.getBatch).not.toHaveBeenCalled();
  });

  it('validates asset list filters', async () => {
    const res = await request(app, '/assets?channel=facebook', { as: 'admin' });
    expect(res.status).toBe(400);
    const ok = await request(app, '/assets?week=2026-W38&channel=x&state=generated&limit=5', {
      as: 'admin',
    });
    expect(ok.status).toBe(200);
    expect(svc.listAssets).toHaveBeenCalledWith({
      week: '2026-W38',
      channel: 'x',
      state: 'generated',
      limit: 5,
    });
  });

  it('PATCH asset needs a state or retryImage and stamps the admin as actor', async () => {
    const bad = await request(app, '/assets/a1', { method: 'PATCH', as: 'admin', body: {} });
    expect(bad.status).toBe(400);
    const good = await request(app, '/assets/a1', {
      method: 'PATCH',
      as: 'admin',
      body: { retryImage: true },
    });
    expect(good.status).toBe(200);
    expect(svc.updateAsset).toHaveBeenCalledWith('a1', { retryImage: true }, DEFAULT_TEST_USER);
  });

  it('PUT settings validates slot strings and forbids an empty patch', async () => {
    const empty = await request(app, '/settings', { method: 'PUT', as: 'admin', body: {} });
    expect(empty.status).toBe(400);
    const badSlot = await request(app, '/settings', {
      method: 'PUT',
      as: 'admin',
      body: { preferred_slots: { x: ['monday 9am'] } },
    });
    expect(badSlot.status).toBe(400);
    const good = await request(app, '/settings', {
      method: 'PUT',
      as: 'admin',
      body: { enabled: false, preferred_slots: { x: ['tue 08:00'] } },
    });
    expect(good.status).toBe(200);
    expect(svc.updateSettings).toHaveBeenCalledWith(
      { enabled: false, preferred_slots: { x: ['tue 08:00'] } },
      DEFAULT_TEST_USER,
    );
  });

  it('PUT playbook only knows generate and schedule', async () => {
    const unknown = await request(app, '/playbooks/other', {
      method: 'PUT',
      as: 'admin',
      body: { title: 't' },
    });
    expect(unknown.status).toBe(404);
    const good = await request(app, '/playbooks/schedule', {
      method: 'PUT',
      as: 'admin',
      body: { title: 't' },
    });
    expect(good.status).toBe(200);
    expect(svc.updatePlaybook).toHaveBeenCalledWith('schedule', { title: 't' }, DEFAULT_TEST_USER);
  });
});
