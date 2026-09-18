/**
 * social-channel-assets-routes.ts — route contract tests.
 *
 * This surface has two kinds of caller: the admin browser and an outside agent
 * holding an integration token. The gate is the thing worth pinning — that the
 * token works without a session, that a wrong token does not, and that neither
 * a missing credential nor a client role gets in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { multipart, request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const svc = vi.hoisted(() => ({
  addChannelAsset: vi.fn(async () => ({ id: 'a1', channel: 'instagram', media_type: 'image' })),
  listChannelAssets: vi.fn(async () => [{ id: 'a1' }]),
  getChannelAsset: vi.fn(async () => ({ id: 'a1' })),
  updateChannelAsset: vi.fn(async () => ({ id: 'a1' })),
  markChannelAssetUsed: vi.fn(async () => ({ id: 'a1', status: 'used' })),
  deleteChannelAsset: vi.fn(async () => undefined),
  channelAssetSummary: vi.fn(async () => ({
    linkedin: { available: 1, used: 0, archived: 0, total: 1 },
    instagram: { available: 0, used: 0, archived: 0, total: 0 },
    x: { available: 0, used: 0, archived: 0, total: 0 },
  })),
}));

const auth = vi.hoisted(() => ({
  verifySocialAssetsToken: vi.fn(async (candidate: string) => candidate === 'the-real-token'),
}));

const cron = vi.hoisted(() => ({ isAuthorizedCronRequest: vi.fn(async () => false) }));

vi.mock('../social-channel-assets-service.ts', () => svc);
vi.mock('../social-channel-assets-auth.ts', () => auth);
vi.mock('../cron-auth.ts', () => cron);
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

import app from '../social-channel-assets-routes.ts';

const TOKEN_HEADER = 'x-nw-social-assets-token';
const ASSET = '3f4a1b2c-5d6e-4f7a-8b9c-0d1e2f3a4b5c';
const PNG = String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) + 'pixel';

beforeEach(() => {
  vi.clearAllMocks();
  cron.isAuthorizedCronRequest.mockResolvedValue(false);
  auth.verifySocialAssetsToken.mockImplementation(async (c: string) => c === 'the-real-token');
});

const ROUTES: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string }[] = [
  { method: 'GET', path: '/channels' },
  { method: 'GET', path: '/assets' },
  { method: 'POST', path: '/assets' },
  { method: 'GET', path: '/assets/:id' },
  { method: 'PATCH', path: '/assets/:id' },
  { method: 'POST', path: '/assets/:id/used' },
  { method: 'DELETE', path: '/assets/:id' },
];

describe('route inventory', () => {
  it('registers exactly the documented routes', () => {
    // Hono records one entry per middleware, so dedupe by method+path, and the
    // router-wide gate registers as ALL.
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    const expected = ROUTES.map((r) => `${r.method} ${r.path}`);
    for (const route of registered) expect(expected).toContain(route);
    expect(registered.length).toBe(ROUTES.length);
  });
});

describe('the gate', () => {
  it('turns away a caller with no credential at all', async () => {
    const res = await request(app, '/assets', { auth: false });
    expect(res.status).toBe(401);
  });

  it('turns away a signed-in client, who is not an admin', async () => {
    expect((await request(app, '/assets', { as: 'client' })).status).toBe(403);
  });

  it('lets the admin browser through on its session', async () => {
    const res = await request(app, '/assets', { as: 'admin' });
    expect(res.status).toBe(200);
    expect(svc.listChannelAssets).toHaveBeenCalled();
  });

  it('lets an agent through on the integration token, with no session', async () => {
    const res = await app.request('/assets', {
      method: 'GET',
      headers: { [TOKEN_HEADER]: 'the-real-token' },
    });
    expect(res.status).toBe(200);
    expect(auth.verifySocialAssetsToken).toHaveBeenCalledWith('the-real-token');
  });

  it('does not accept a wrong token as a credential', async () => {
    const res = await app.request('/assets', {
      method: 'GET',
      headers: { [TOKEN_HEADER]: 'guessed' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts the shared cron token, for a scheduled job', async () => {
    cron.isAuthorizedCronRequest.mockResolvedValue(true);
    const res = await app.request('/assets', { method: 'GET' });
    expect(res.status).toBe(200);
  });
});

describe('adding an asset', () => {
  it('takes a multipart file and records who sent it', async () => {
    const form = multipart([
      { name: 'channel', value: 'instagram' },
      { name: 'caption', value: 'Two-pot explained' },
      { name: 'tags', value: 'retirement, two-pot' },
      { name: 'file', value: PNG, filename: 'chart.png', type: 'image/png' },
    ]);
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 'the-real-token', 'Content-Type': form.contentType },
      body: form.body,
    });
    expect(res.status).toBe(201);

    const [input] = svc.addChannelAsset.mock.calls[0];
    expect(input).toMatchObject({
      channel: 'instagram',
      caption: 'Two-pot explained',
      tags: ['retirement', 'two-pot'],
      // An agent's upload is attributed to it without having to say so.
      source: 'chatgpt',
      agent: 'integration',
    });
    expect(input.bytes).toBeInstanceOf(Uint8Array);
  });

  it('takes a JSON sourceUrl for an agent that only has a link', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 'the-real-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'linkedin',
        sourceUrl: 'https://example.test/a.png',
        altText: 'A chart',
      }),
    });
    expect(res.status).toBe(201);
    expect(svc.addChannelAsset).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'linkedin', sourceUrl: 'https://example.test/a.png' }),
    );
  });

  it('refuses a request with neither a file nor a sourceUrl', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 'the-real-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'x' }),
    });
    expect(res.status).toBe(400);
    expect(svc.addChannelAsset).not.toHaveBeenCalled();
  });

  it('refuses an unknown channel', async () => {
    const res = await app.request('/assets', {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 'the-real-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'facebook', sourceUrl: 'https://example.test/a.png' }),
    });
    expect(res.status).toBe(400);
    expect(svc.addChannelAsset).not.toHaveBeenCalled();
  });

  it('attributes an admin upload to the admin, not to the integration', async () => {
    const form = multipart([
      { name: 'channel', value: 'x' },
      { name: 'file', value: PNG, filename: 'a.png', type: 'image/png' },
    ]);
    const res = await request(app, '/assets', {
      method: 'POST',
      as: 'admin',
      form,
    });
    expect(res.status).toBe(201);
    expect(svc.addChannelAsset.mock.calls[0][0].source).toMatch(/^admin/);
  });
});

describe('the rest of the surface', () => {
  it('filters the list', async () => {
    await request(app, '/assets?channel=instagram&status=available&mediaType=video', {
      as: 'admin',
    });
    expect(svc.listChannelAssets).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'instagram', status: 'available', mediaType: 'video' }),
    );
  });

  it('marks an asset used, which is how a routine stops reusing it', async () => {
    const res = await app.request(`/assets/${ASSET}/used`, {
      method: 'POST',
      headers: { [TOKEN_HEADER]: 'the-real-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ bufferPostId: 'bufpost1' }),
    });
    expect(res.status).toBe(200);
    expect(svc.markChannelAssetUsed).toHaveBeenCalledWith(ASSET, 'bufpost1', 'integration');
  });

  it('updates the editable fields', async () => {
    const res = await request(app, `/assets/${ASSET}`, {
      method: 'PATCH',
      as: 'admin',
      body: { caption: 'Better copy', status: 'archived' },
    });
    expect(res.status).toBe(200);
    expect(svc.updateChannelAsset).toHaveBeenCalledWith(
      ASSET,
      expect.objectContaining({ caption: 'Better copy', status: 'archived' }),
      expect.stringMatching(/^admin/),
    );
  });

  it('rejects an id that is not a uuid rather than passing it on', async () => {
    for (const path of [`/assets/not-a-uuid`, `/assets/not-a-uuid/used`]) {
      const res = await request(app, path, { method: 'GET', as: 'admin' });
      expect([400, 404]).toContain(res.status);
    }
    expect(svc.getChannelAsset).not.toHaveBeenCalled();
  });

  it('deletes', async () => {
    const res = await request(app, `/assets/${ASSET}`, { method: 'DELETE', as: 'admin' });
    expect(res.status).toBe(200);
    expect(svc.deleteChannelAsset).toHaveBeenCalledWith(ASSET);
  });

  it('reports the three channels and their counts', async () => {
    const res = await request(app, '/channels', { as: 'admin' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string; available: number }> };
    expect(body.data.map((c) => c.id)).toEqual(['linkedin', 'instagram', 'x']);
    expect(body.data[0].available).toBe(1);
  });
});
