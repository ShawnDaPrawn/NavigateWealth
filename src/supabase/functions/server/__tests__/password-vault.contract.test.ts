// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { kvStore, request, routeRegistrations } from './helpers/contract-harness.ts';
import type { VaultEntry } from '../repositories/password-vault.ts';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../auth-mw.ts', async () => ({
  requireSuperAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['super_admin'],
    'FORBIDDEN',
    'client',
  ),
}));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: vi.fn() } }));
// The unlock gate has its own suite (vault-unlock.test.ts); here the vault is open.
vi.mock('../vault-unlock.ts', () => ({
  requireUnlocked: (_c: unknown, next: () => Promise<void>) => next(),
  lockState: async () => ({
    unlocked: true,
    twoFactorEnabled: true,
    twoFactorRequired: true,
    expiresAt: null,
  }),
  unlock: async () => ({
    unlocked: true,
    twoFactorEnabled: true,
    twoFactorRequired: true,
    expiresAt: null,
  }),
  lock: async () => undefined,
}));
const keyRpc = vi.hoisted(() => vi.fn());
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    rpc: keyRpc,
    from: () => ({
      insert: ({ key, value }: { key: string; value: unknown }) => {
        if (kvStore.has(key)) return { error: { code: '23505' } };
        kvStore.set(key, value);
        return { error: null };
      },
      update: ({ value }: { value: VaultEntry }) => ({
        eq: (_key: string, key: string) => ({
          eq: (_revision: string, revision: string) => ({
            select: () => {
              const current = kvStore.get(key) as VaultEntry | undefined;
              if (current?.revision !== revision) return { data: [], error: null };
              kvStore.set(key, value);
              return { data: [{ key }], error: null };
            },
          }),
        }),
      }),
    }),
  }),
}));
import app from '../password-vault-routes.ts';
import { AdminAuditService } from '../admin-audit-service.ts';

const input = {
  serviceId: 'navigate-wealth',
  name: 'Portal',
  url: 'https://example.org/login',
  username: 'test-user-1',
  password: 'surrounded secret ',
  notes: 'private note',
};
const admin = (path: string, method = 'GET', body?: unknown) =>
  request(app, path, { method, body, as: 'super_admin' });
const list = async () => (await (await admin('/')).json()).items;
beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  keyRpc.mockResolvedValue({ data: randomBytes(32).toString('base64') });
  vi.stubGlobal('Deno', { env: { get: () => undefined } });
});

describe('password vault', () => {
  it('requires a super admin session on every management action', async () => {
    for (const { method, path } of routeRegistrations(app).filter((r) => r.method !== 'ALL')) {
      expect((await request(app, path.replace(':id', 'id'), { method, auth: false })).status).toBe(
        401,
      );
      expect((await request(app, path.replace(':id', 'id'), { method, as: 'admin' })).status).toBe(
        403,
      );
    }
  });
  it('rejects the entire batch on invalid input, an unknown service or a missing key', async () => {
    expect(
      (await admin('/', 'POST', { entries: [input, { ...input, url: 'file:///tmp' }] })).status,
    ).toBe(400);
    expect(
      (await admin('/', 'POST', { entries: [{ ...input, serviceId: 'no-such-service' }] })).status,
    ).toBe(400);
    expect([...kvStore.keys()].some((k) => k.startsWith('password-vault:'))).toBe(false);
    // A fresh isolate must fail closed even if another isolate has already cached its key.
    vi.resetModules();
    const coldVault = (await import('../password-vault-routes.ts')).default;
    keyRpc.mockResolvedValueOnce({ data: null });
    kvStore.clear();
    expect(
      (
        await request(coldVault, '/', {
          as: 'super_admin',
          method: 'POST',
          body: { entries: [input] },
        })
      ).status,
    ).toBe(503);
    expect([...kvStore.keys()].some((k) => k.startsWith('password-vault:'))).toBe(false);
  });
  it('stores every field encrypted and reveals only on request', async () => {
    expect(
      (
        await admin('/', 'POST', {
          entries: [input, { ...input, name: 'Other', password: 'another secret' }],
        })
      ).status,
    ).toBe(201);
    const serialized = JSON.stringify([...kvStore.values()]);
    for (const field of [input.name, input.url, input.username, input.password, input.notes])
      expect(serialized).not.toContain(field);
    const item = (await list()).find((i: { name: string }) => i.name === 'Portal');
    expect(item).not.toHaveProperty('password');
    expect(item).not.toHaveProperty('notes');
    expect(item).toMatchObject({ serviceId: 'navigate-wealth', aiUse: 'ask' });
    const detail = await admin('/' + item.id + '/reveal', 'POST');
    expect(detail.headers.get('cache-control')).toBe('no-store');
    expect(await detail.json()).toMatchObject(input);
    expect(JSON.stringify(vi.mocked(AdminAuditService.record).mock.calls)).not.toContain(
      input.password,
    );
  });
  it('keeps the saved password and notes when an edit leaves them out, and refuses stale edits', async () => {
    await admin('/', 'POST', { entries: [input] });
    const [item] = await list();
    const path = '/' + item.id;
    const { password: _p, notes: _n, ...rest } = input;
    expect(
      (
        await admin(path, 'PUT', {
          revision: item.revision,
          credential: { ...rest, password: '', name: 'Renamed', aiUse: 'allowed' },
        })
      ).status,
    ).toBe(200);
    expect(await (await admin(path + '/reveal', 'POST')).json()).toMatchObject({
      name: 'Renamed',
      aiUse: 'allowed',
      password: input.password,
      notes: input.notes,
    });
    expect(
      (await admin(path, 'PUT', { revision: item.revision, credential: { ...rest, password: '' } }))
        .status,
    ).toBe(409);
    const [current] = await list();
    await admin(path, 'PUT', {
      revision: current.revision,
      credential: { ...rest, password: 'changed', notes: '' },
    });
    expect(await (await admin(path + '/reveal', 'POST')).json()).toMatchObject({
      password: 'changed',
      notes: '',
    });
  });
  it('deletes a login together with the skills written for it alone', async () => {
    await admin('/', 'POST', { entries: [input] });
    const [item] = await list();
    const skill = (credentialId: string | null) => ({
      name: credentialId ? 'Own' : 'Shared',
      whenToUse: '',
      instructions: 'Do the thing.',
      serviceId: 'navigate-wealth',
      credentialId,
    });
    expect((await admin('/skills', 'POST', skill(item.id))).status).toBe(201);
    expect((await admin('/skills', 'POST', skill(null))).status).toBe(201);
    expect((await admin('/' + item.id, 'DELETE')).status).toBe(200);
    expect(await list()).toEqual([]);
    const left = (await (await admin('/skills')).json()).items as { name: string }[];
    expect(left.map((s) => s.name)).toEqual(['Shared']);
  });
});
