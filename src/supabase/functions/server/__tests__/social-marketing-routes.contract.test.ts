/**
 * social-marketing-routes.ts — Route Contract Tests (Buffer-backed)
 * ==================================================================
 *
 * Every route is admin-only: this surface reads the practice's Buffer
 * organisation and can publish to it. Validation is real; the service is
 * stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  multipart,
  request,
  routeRegistrations,
  DEFAULT_TEST_USER,
} from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const media = vi.hoisted(() => ({
  listMedia: vi.fn(async () => [{ storagePath: 'uploads/a.png', url: 'https://cdn/a.png' }]),
  uploadMedia: vi.fn(async () => ({ storagePath: 'uploads/a.png', url: 'https://cdn/a.png' })),
  deleteMedia: vi.fn(async () => undefined),
  // The real guard is a shape check; the route needs it to see the multipart part.
  isUploadedFile: (v: unknown) =>
    typeof v === 'object' && v !== null && typeof (v as File).arrayBuffer === 'function',
}));

vi.mock('../social-marketing-media-service.ts', () => media);

const svc = vi.hoisted(() => ({
  getStatus: vi.fn(async () => ({ configured: true })),
  listChannels: vi.fn(async () => [{ id: 'c1', service: 'linkedin' }]),
  listPosts: vi.fn(async () => [{ id: 'p1' }]),
  composePost: vi.fn(async () => ({ created: [{ channelId: 'c1', postId: 'p1' }], failed: [] })),
  deletePost: vi.fn(async () => undefined),
  getAnalytics: vi.fn(async () => ({ totals: { impressions: 1 } })),
}));

vi.mock('../social-marketing-service.ts', () => svc);
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

import app from '../social-marketing-routes.ts';

const CHANNEL = '6aa09ad0cd8b9c702c32ab6a';
const POST = '6aa09ad0cd8b9c702c32ab6b';

beforeEach(() => {
  vi.clearAllMocks();
});

/** A one-pixel PNG, so the upload route's byte-signature check passes. */
const PNG_BYTES = String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) + 'pixel';

const ROUTE_TABLE: {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
  /** Appended when the request is sent; not part of the registered path. */
  query?: string;
  form?: { body: string; contentType: string };
}[] = [
  { method: 'GET', path: '/status' },
  { method: 'GET', path: '/channels' },
  { method: 'GET', path: '/posts' },
  { method: 'POST', path: '/posts', body: { channelIds: [CHANNEL], text: 'hello' } },
  { method: 'DELETE', path: `/posts/${POST}` },
  { method: 'GET', path: '/analytics' },
  { method: 'GET', path: '/media' },
  {
    method: 'POST',
    path: '/media',
    form: multipart([{ name: 'file', value: PNG_BYTES, filename: 'team.png', type: 'image/png' }]),
  },
  { method: 'DELETE', path: '/media', query: '?storagePath=uploads/a.png' },
];

describe('route inventory and auth', () => {
  it('every registered route is in ROUTE_TABLE', () => {
    // Hono registers one entry per middleware on a route, so dedupe by method+path.
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    const tabled = ROUTE_TABLE.map((r) => `${r.method} ${r.path.replace(POST, ':id')}`);
    for (const route of registered) expect(tabled).toContain(route);
    expect(registered.length).toBe(ROUTE_TABLE.length);
  });

  for (const route of ROUTE_TABLE) {
    it(`${route.method} ${route.path} is admin-only`, async () => {
      const path = `${route.path}${route.query ?? ''}`;
      const send = { method: route.method, body: route.body, form: route.form };
      expect((await request(app, path, { ...send, auth: false })).status).toBe(401);
      expect((await request(app, path, { ...send, as: 'client' })).status).toBe(403);
      const ok = await request(app, path, { ...send, as: 'admin' });
      expect([200, 201]).toContain(ok.status);
    });
  }
});

describe('posts', () => {
  it('passes the date window and channel filter through', async () => {
    const res = await request(
      app,
      `/posts?from=2026-09-14T00:00:00%2B02:00&to=2026-09-21T00:00:00%2B02:00&channelId=${CHANNEL}`,
      { as: 'admin' },
    );
    expect(res.status).toBe(200);
    expect(svc.listPosts).toHaveBeenCalledWith({
      from: '2026-09-14T00:00:00+02:00',
      to: '2026-09-21T00:00:00+02:00',
      channelId: CHANNEL,
    });
  });

  it('rejects a non-ISO window', async () => {
    const res = await request(app, '/posts?from=yesterday', { as: 'admin' });
    expect(res.status).toBe(400);
  });

  it('compose validates the body and stamps the admin', async () => {
    const bad = await request(app, '/posts', {
      method: 'POST',
      as: 'admin',
      body: { channelIds: ['nope'], text: 'x' },
    });
    expect(bad.status).toBe(400);

    const needsDue = await request(app, '/posts', {
      method: 'POST',
      as: 'admin',
      body: { channelIds: [CHANNEL], text: 'x', mode: 'scheduled' },
    });
    expect(needsDue.status).toBe(400);

    const good = await request(app, '/posts', {
      method: 'POST',
      as: 'admin',
      body: {
        channelIds: [CHANNEL],
        text: 'x',
        mode: 'scheduled',
        scheduledAt: '2026-09-15T07:30:00+02:00',
      },
    });
    expect(good.status).toBe(201);
    expect(svc.composePost).toHaveBeenCalledWith(
      expect.objectContaining({ channelIds: [CHANNEL], mode: 'scheduled' }),
      DEFAULT_TEST_USER,
    );
  });

  it('compose answers 502 when nothing could be created', async () => {
    svc.composePost.mockResolvedValueOnce({
      created: [],
      failed: [{ channelId: CHANNEL, platform: 'linkedin', error: 'nope' }],
    });
    const res = await request(app, '/posts', {
      method: 'POST',
      as: 'admin',
      body: { channelIds: [CHANNEL], text: 'x' },
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ success: false });
  });

  it('delete rejects a malformed post id', async () => {
    const res = await request(app, '/posts/not-an-id', { method: 'DELETE', as: 'admin' });
    expect(res.status).toBe(400);
    expect(svc.deletePost).not.toHaveBeenCalled();
  });

  it('analytics coerces days and rejects nonsense', async () => {
    await request(app, '/analytics?days=7', { as: 'admin' });
    expect(svc.getAnalytics).toHaveBeenCalledWith(7);
    const bad = await request(app, '/analytics?days=abc', { as: 'admin' });
    expect(bad.status).toBe(400);
  });
});
