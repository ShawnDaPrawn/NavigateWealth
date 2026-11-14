/**
 * social-partners-routes.ts — Route Contract Tests
 * ================================================
 *
 * Partner advertisers: admin-only CRUD over an in-memory KV, with real
 * validation, the UTM referral link, unique referral codes and 404s.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore, request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
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

import app from '../social/social-partners-routes.ts';
import { buildReferralLink } from '../social/social-partners-service.ts';

const ID = '3f2b8c1e-5d4a-4b6e-9a7c-1e2d3f4a5b6c';
const VALID = { name: 'Pretoria Property Group', referralCode: 'ppg', contactEmail: 'a@b.co' };

beforeEach(() => {
  kvStore.clear();
});

describe('route inventory and auth', () => {
  const TABLE = [
    { method: 'GET', path: '/' },
    { method: 'POST', path: '/', body: VALID },
    { method: 'PUT', path: `/${ID}`, body: { notes: 'x' } },
    { method: 'DELETE', path: `/${ID}` },
  ] as const;

  it('every registered route is tabled', () => {
    const registered = [
      ...new Set(
        routeRegistrations(app)
          .filter((r) => r.method !== 'ALL')
          .map((r) => `${r.method} ${r.path}`),
      ),
    ];
    expect(registered.sort()).toEqual(['DELETE /:id', 'GET /', 'POST /', 'PUT /:id'].sort());
    expect(TABLE.length).toBe(registered.length);
  });

  for (const route of TABLE) {
    it(`${route.method} ${route.path} is admin-only`, async () => {
      const send = { method: route.method, body: 'body' in route ? route.body : undefined };
      expect((await request(app, route.path, { ...send, auth: false })).status).toBe(401);
      expect((await request(app, route.path, { ...send, as: 'client' })).status).toBe(403);
    });
  }
});

describe('partners CRUD', () => {
  it('creates a partner with a UTM referral link and lists it', async () => {
    const res = await request(app, '/', { method: 'POST', as: 'admin', body: VALID });
    expect(res.status).toBe(201);
    const created = (await res.json()).data;
    expect(created.referralLink).toBe(buildReferralLink('ppg'));
    expect(created.referralLink).toContain('utm_content=ppg');
    expect(created.status).toBe('active');

    const list = await (await request(app, '/', { as: 'admin' })).json();
    expect(list.data.map((p: { name: string }) => p.name)).toEqual(['Pretoria Property Group']);
  });

  it('rejects a missing name, a bad email and a bad referral code', async () => {
    const res = await request(app, '/', {
      method: 'POST',
      as: 'admin',
      body: { name: '', contactEmail: 'nope', referralCode: 'Bad Code!' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.errors)).toEqual(
      expect.arrayContaining(['name', 'contactEmail', 'referralCode']),
    );
  });

  it('refuses a referral code another partner already uses', async () => {
    await request(app, '/', { method: 'POST', as: 'admin', body: VALID });
    const res = await request(app, '/', {
      method: 'POST',
      as: 'admin',
      body: { ...VALID, name: 'Other' },
    });
    expect(res.status).toBe(409);
  });

  it('updates a partner and rebuilds the link when the code changes', async () => {
    const created = (
      await (await request(app, '/', { method: 'POST', as: 'admin', body: VALID })).json()
    ).data;
    const res = await request(app, `/${created.id}`, {
      method: 'PUT',
      as: 'admin',
      body: { referralCode: 'ppg-2', status: 'paused' },
    });
    expect(res.status).toBe(200);
    const updated = (await res.json()).data;
    expect(updated.status).toBe('paused');
    expect(updated.referralLink).toContain('utm_content=ppg-2');
    expect(updated.name).toBe('Pretoria Property Group');
  });

  it('answers 404 for an unknown partner and 400 for a malformed id', async () => {
    expect((await request(app, `/${ID}`, { method: 'DELETE', as: 'admin' })).status).toBe(404);
    expect(
      (await request(app, `/${ID}`, { method: 'PUT', as: 'admin', body: { notes: 'x' } })).status,
    ).toBe(404);
    expect((await request(app, '/not-a-uuid', { method: 'DELETE', as: 'admin' })).status).toBe(400);
  });

  it('deletes a partner', async () => {
    const created = (
      await (await request(app, '/', { method: 'POST', as: 'admin', body: VALID })).json()
    ).data;
    expect((await request(app, `/${created.id}`, { method: 'DELETE', as: 'admin' })).status).toBe(
      200,
    );
    const list = await (await request(app, '/', { as: 'admin' })).json();
    expect(list.data).toEqual([]);
  });
});
