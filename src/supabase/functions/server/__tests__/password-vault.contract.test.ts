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
const keyRpc = vi.hoisted(() => vi.fn());
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    rpc: keyRpc,
    from: () => ({
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
import mcp from '../password-vault-mcp.ts';
import { AdminAuditService } from '../admin-audit-service.ts';

const input = {
  name: 'Portal',
  url: 'https://example.org/login',
  username: 'test-user-1',
  password: 'surrounded secret ',
  notes: 'private note',
};
const admin = (path: string, method = 'GET', body?: unknown) =>
  request(app, path, { method, body, as: 'super_admin' });
const call = (
  token: string,
  method: string,
  params?: unknown,
  extra: Record<string, string> = {},
) =>
  mcp.request('/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params }),
  });
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
  it('rejects the entire batch on invalid input or missing encryption key', async () => {
    expect(
      (await admin('/', 'POST', { entries: [input, { ...input, url: 'file:///tmp' }] })).status,
    ).toBe(400);
    // A fresh isolate must fail closed even if another isolate has already cached its key.
    vi.resetModules();
    const coldVault = (await import('../password-vault-routes.ts')).default;
    keyRpc.mockResolvedValueOnce({ data: null });
    expect(
      (
        await request(coldVault, '/', {
          as: 'super_admin',
          method: 'POST',
          body: { entries: [input] },
        })
      ).status,
    ).toBe(503);
    expect(kvStore.size).toBe(0);
  });
  it('stores encrypted fields, reveals only explicitly, and restricts each MCP token to one record', async () => {
    expect(
      (
        await admin('/', 'POST', {
          entries: [input, { ...input, name: 'Other', password: 'another secret' }],
        })
      ).status,
    ).toBe(201);
    const serialized = JSON.stringify([...kvStore.values()]);
    for (const field of Object.values(input)) expect(serialized).not.toContain(field);
    const items = await list();
    const item = items.find((i: { name: string }) => i.name === 'Portal');
    const other = items.find((i: { name: string }) => i.name === 'Other');
    expect(item).not.toHaveProperty('password');
    expect(item).not.toHaveProperty('notes');
    const detail = await admin('/' + item.id + '/reveal', 'POST');
    expect(detail.headers.get('cache-control')).toBe('no-store');
    expect(await detail.json()).toMatchObject(input);
    const tokenResponse = await admin('/' + item.id + '/connect', 'POST', {
      revision: item.revision,
    });
    expect(tokenResponse.status).toBe(201);
    const { token } = await tokenResponse.json();
    expect(JSON.stringify([...kvStore.values()])).not.toContain(token);
    expect((await call(token.replace(item.id, other.id), 'tools/list')).status).toBe(401);
    expect(
      (await call(token, 'tools/list', {}, { Origin: 'https://unknown.example' })).status,
    ).toBe(403);
    const init = await call(token, 'initialize', { protocolVersion: '2025-06-18' });
    expect((await init.json()).result.protocolVersion).toBe('2025-06-18');
    expect(
      (await (await call(token, 'tools/list')).json()).result.tools.map(
        (t: { name: string }) => t.name,
      ),
    ).toEqual(['get_credential']);
    const result = await call(token, 'tools/call', { name: 'get_credential', arguments: {} });
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(JSON.parse((await result.json()).result.content[0].text)).toEqual({
      url: input.url,
      username: input.username,
      password: input.password,
    });
    expect(
      (
        await (
          await call(token, 'tools/call', { name: 'get_credential', arguments: { id: other.id } })
        ).json()
      ).error.code,
    ).toBe(-32602);
    expect(
      (await admin('/' + item.id, 'PUT', { revision: item.revision, credential: input })).status,
    ).toBe(409);
    const current = (await list()).find((i: { id: string }) => i.id === item.id);
    expect(
      (await admin('/' + item.id + '/revoke', 'POST', { revision: current.revision })).status,
    ).toBe(200);
    expect((await call(token, 'tools/list')).status).toBe(401);
    expect(JSON.stringify(vi.mocked(AdminAuditService.record).mock.calls)).not.toContain(
      input.password,
    );
  });
  it('supports editing, rotating, expiring and deleting a connected login', async () => {
    await admin('/', 'POST', { entries: [input] });
    const [item] = await list();
    const path = '/' + item.id;
    await admin(path, 'PUT', {
      revision: item.revision,
      credential: { ...input, password: 'changed' },
    });
    expect((await (await admin(path + '/reveal', 'POST')).json()).password).toBe('changed');
    const issue = async () =>
      (
        await (
          await admin(path + '/connect', 'POST', { revision: (await list())[0].revision })
        ).json()
      ).token;
    const old = await issue();
    const token = await issue();
    expect((await call(old, 'ping')).status).toBe(401);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 91 * 86400000);
      expect((await call(token, 'ping')).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
    const initialized = await mcp.request('/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(initialized.status).toBe(202);
    await admin(path, 'DELETE');
    expect((await call(token, 'tools/list')).status).toBe(401);
    expect(await list()).toEqual([]);
  });
});
