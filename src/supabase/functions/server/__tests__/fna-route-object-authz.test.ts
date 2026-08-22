/**
 * Cross-client denial, exercised through the real routers (P1.4 / S7).
 * ====================================================================
 *
 * The policy unit tests in fna-object-authz.test.ts prove the rule. These prove
 * it is actually WIRED: the request goes through the real Hono router, the real
 * handler, and the real `fnaErrorResponse` catch, and comes back 403 without
 * having touched the record.
 *
 * Two properties matter and are asserted separately:
 *   1. the stranger gets a 403, and
 *   2. the write never happened — a 403 rendered after `kv.set` would be a
 *      leak dressed as a denial.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const authenticateUser = vi.hoisted(() => vi.fn());
const kvGet = vi.hoisted(() => vi.fn());
const kvSet = vi.hoisted(() => vi.fn());
const kvDel = vi.hoisted(() => vi.fn());
const kvGetByPrefix = vi.hoisted(() => vi.fn());
const resolveAdviser = vi.hoisted(() => vi.fn());

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: vi.fn() }));

vi.mock('../fna-auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fna-auth.ts')>();
  return { ...actual, authenticateUser: (...a: unknown[]) => authenticateUser(...a) };
});

vi.mock('../kv_store.tsx', () => ({
  get: (...a: unknown[]) => kvGet(...a),
  set: (...a: unknown[]) => kvSet(...a),
  del: (...a: unknown[]) => kvDel(...a),
  getByPrefix: (...a: unknown[]) => kvGetByPrefix(...a),
  mget: vi.fn(),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: (...a: unknown[]) => resolveAdviser(...a),
}));

vi.mock('../net-worth-snapshot-service.ts', () => ({
  NetWorthSnapshotService: class {
    autoSnapshotFromKV() {
      return Promise.resolve();
    }
  },
}));

import riskRoutes from '../risk-planning-fna-routes.tsx';
import medicalRoutes from '../medical-fna-routes.tsx';
import retirementRoutes from '../retirement-fna-routes.tsx';

const OWNER = 'client-owner';
const STRANGER = 'client-stranger';
const auth = { Authorization: 'Bearer token' };

function mount(routes: unknown) {
  const app = new Hono();
  app.route('/', routes as Parameters<Hono['route']>[1]);
  return app;
}

function signedInAs(id: string, role: string) {
  authenticateUser.mockResolvedValue({ id, email: `${id}@example.com`, role });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveAdviser.mockResolvedValue(null);
  kvGetByPrefix.mockResolvedValue([]);
});

describe('risk-planning FNA', () => {
  const app = mount(riskRoutes);
  const fna = { id: 'fna-1', clientId: OWNER, status: 'draft', inputData: {} };

  it("403s a stranger reading another client's FNA by id", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/fna-1', { headers: auth });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({ code: 'FORBIDDEN_CLIENT' });
  });

  it('lets the owning client read it', async () => {
    signedInAs(OWNER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/fna-1', { headers: auth });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ success: true });
  });

  it('lets a platform administrator read it', async () => {
    signedInAs('admin-1', 'admin');
    kvGet.mockResolvedValue(fna);

    expect((await app.request('/fna-1', { headers: auth })).status).toBe(200);
  });

  it('403s an adviser who is not the one assigned to the client', async () => {
    signedInAs('adviser-2', 'adviser');
    resolveAdviser.mockResolvedValue('adviser-1');
    kvGet.mockResolvedValue(fna);

    expect((await app.request('/fna-1', { headers: auth })).status).toBe(403);
  });

  it('allows the assigned adviser', async () => {
    signedInAs('adviser-1', 'adviser');
    resolveAdviser.mockResolvedValue('adviser-1');
    kvGet.mockResolvedValue(fna);

    expect((await app.request('/fna-1', { headers: auth })).status).toBe(200);
  });

  it("403s a stranger hard-deleting another client's FNA, without deleting it", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/hard-delete/fna-1', { method: 'DELETE', headers: auth });

    expect(res.status).toBe(403);
    expect(kvDel).not.toHaveBeenCalled();
  });

  it("403s a stranger archiving another client's FNA, without writing it", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/archive/fna-1', { method: 'DELETE', headers: auth });

    expect(res.status).toBe(403);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it("403s a stranger listing another client's FNAs", async () => {
    signedInAs(STRANGER, 'client');

    const res = await app.request(`/client/${OWNER}/list`, { headers: auth });

    expect(res.status).toBe(403);
    expect(kvGet).not.toHaveBeenCalled();
  });

  it('denies a legacy FNA that carries no clientId, even to an administrator', async () => {
    signedInAs('admin-1', 'admin');
    kvGet.mockResolvedValue({ id: 'fna-1', status: 'draft' });

    expect((await app.request('/fna-1', { headers: auth })).status).toBe(403);
  });

  it('still 404s a missing FNA rather than 403ing it', async () => {
    // Ownership is checked AFTER existence, so "not found" does not become
    // "forbidden" for the legitimate owner of a deleted record.
    signedInAs(OWNER, 'client');
    kvGet.mockResolvedValue(null);

    expect((await app.request('/fna-1', { headers: auth })).status).toBe(404);
  });
});

describe('medical FNA', () => {
  const app = mount(medicalRoutes);
  const fna = { id: 'm-1', clientId: OWNER, status: 'draft', inputs: {} };

  it("403s a stranger deleting another client's medical FNA, without deleting it", async () => {
    // This handler went straight to kv.del with nothing loaded, so there was no
    // record to check an owner against. It reads first now.
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/delete/m-1', { method: 'DELETE', headers: auth });

    expect(res.status).toBe(403);
    expect(kvDel).not.toHaveBeenCalled();
  });

  it('lets the owner delete it', async () => {
    signedInAs(OWNER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/delete/m-1', { method: 'DELETE', headers: auth });

    expect(res.status).toBe(200);
    expect(kvDel).toHaveBeenCalledWith('medical-fna:m-1');
  });

  it("403s a stranger reading another client's medical FNA", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    expect((await app.request('/m-1', { headers: auth })).status).toBe(403);
  });

  it("403s a stranger publishing another client's medical FNA", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(fna);

    const res = await app.request('/publish/m-1', { method: 'POST', headers: auth });

    expect(res.status).toBe(403);
    expect(kvSet).not.toHaveBeenCalled();
  });
});

describe('retirement FNA', () => {
  const app = mount(retirementRoutes);
  const session = { id: 'r-1', clientId: OWNER, status: 'draft', inputs: {} };

  it("403s a stranger reading another client's retirement session", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(session);

    expect((await app.request('/r-1', { headers: auth })).status).toBe(403);
  });

  it("403s a stranger publishing another client's retirement session", async () => {
    signedInAs(STRANGER, 'client');
    kvGet.mockResolvedValue(session);

    const res = await app.request('/r-1/publish', { method: 'PUT', headers: auth });

    expect(res.status).toBe(403);
    expect(kvSet).not.toHaveBeenCalled();
  });

  it('lets the owner publish it', async () => {
    signedInAs(OWNER, 'client');
    kvGet.mockResolvedValue(session);

    const res = await app.request('/r-1/publish', { method: 'PUT', headers: auth });

    expect(res.status).toBe(200);
    expect(kvSet).toHaveBeenCalled();
  });
});
