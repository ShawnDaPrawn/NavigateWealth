/**
 * Personnel › Client book › Bulk reassign, through the real route and auth
 * middleware with the KV store in memory.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authUsers } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => (key === 'SUPER_ADMIN_EMAILS' ? '' : `test-${key}`) },
  };
  return { authUsers: new Map<string, Record<string, unknown>>() };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = authUsers.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
      admin: {
        listUsers: async () => ({ data: { users: [] }, error: null }),
        createUser: async () => ({ data: { user: null }, error: null }),
        inviteUserByEmail: async () => ({ data: { user: null }, error: null }),
        updateUserById: async () => ({ data: { user: null }, error: null }),
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
    from: () => ({
      select: () => ({ data: [], error: null }),
      insert: async () => ({ error: null }),
    }),
  }),
}));
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  createEmailTemplate: () => '<html></html>',
  getFooterSettings: vi.fn(async () => ({})),
}));

import { kvStore } from './helpers/contract-harness.ts';
import app from '../client-management-personnel-routes.ts';

/** From the real allowlist in constants.ts — not invented for the test. */
const SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';

const asUser = (id: string, role: string, email = `${id}@example.co.za`) => {
  const token = `token-${id}`;
  authUsers.set(token, { id, email, app_metadata: { role }, user_metadata: {} });
  return `Bearer ${token}`;
};

const call = (path: string, init: RequestInit & { auth?: string } = {}) => {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (auth) headers.set('Authorization', auth);
  if (rest.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return app.request(path, { ...rest, headers });
};

const json = async (res: Response) => (await res.json()) as any;

const staff = (id: string, status = 'active', role = 'adviser') =>
  kvStore.set(`personnel:profile:${id}`, {
    id,
    email: `${id}@example.co.za`,
    firstName: id,
    lastName: 'Staff',
    role,
    status,
    commissionSplit: 0.7,
    createdAt: 'x',
    updatedAt: 'x',
  });

const client = (id: string, profile: Record<string, unknown>) =>
  kvStore.set(`user_profile:${id}:personal_info`, profile);

const reassign = (
  from: string,
  body: unknown,
  auth = asUser('owner', 'super_admin', SUPER_ADMIN_EMAIL),
) => call(`/${from}/clients/reassign`, { method: 'POST', body: JSON.stringify(body), auth });

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
});

describe('POST /:id/clients/reassign', () => {
  it('moves only the clients currently assigned to the source adviser', async () => {
    await staff('naledi');
    await staff('ruan');
    await client('c1', { adviserId: 'naledi', firstName: 'A' });
    await client('c2', { personalInformation: { adviserId: 'naledi', firstName: 'B' } });
    await client('c3', { adviserId: 'someone-else' });

    const res = await reassign('naledi', {
      toPersonnelId: 'ruan',
      clientIds: ['c1', 'c2', 'c3', 'gone'],
    });
    expect(res.status).toBe(200);
    const { data } = await json(res);
    expect(data.reassigned).toEqual(['c1', 'c2']);
    expect(data.skipped).toEqual([
      { clientId: 'c3', reason: 'not_assigned' },
      { clientId: 'gone', reason: 'not_found' },
    ]);

    expect(kvStore.get('user_profile:c1:personal_info')).toMatchObject({
      adviserId: 'ruan',
      adviserAssigned: true,
      firstName: 'A',
    });
    expect(kvStore.get('user_profile:c2:personal_info')).toMatchObject({
      adviserId: 'ruan',
      personalInformation: { adviserId: 'ruan', firstName: 'B' },
    });
    expect(kvStore.get('user_profile:c3:personal_info')).toMatchObject({
      adviserId: 'someone-else',
    });
    // Audited.
    expect([...kvStore.keys()].some((k) => k.startsWith('audit:admin:'))).toBe(true);
  });

  it('is for the super admin only', async () => {
    await staff('naledi');
    await staff('ruan');
    const res = await reassign(
      'naledi',
      { toPersonnelId: 'ruan', clientIds: ['c1'] },
      asUser('a1', 'admin'),
    );
    expect(res.status).toBe(403);
  });

  it('refuses an inactive target, the same person, and an empty selection', async () => {
    await staff('naledi');
    await staff('pending-one', 'pending');
    expect(
      (await reassign('naledi', { toPersonnelId: 'pending-one', clientIds: ['c1'] })).status,
    ).toBe(400);
    expect((await reassign('naledi', { toPersonnelId: 'naledi', clientIds: ['c1'] })).status).toBe(
      400,
    );
    expect((await reassign('naledi', { toPersonnelId: 'x', clientIds: [] })).status).toBe(400);
    expect((await reassign('nobody', { toPersonnelId: 'naledi', clientIds: ['c1'] })).status).toBe(
      404,
    );
  });

  it('refuses a target whose role cannot open an assigned client', async () => {
    await staff('naledi');
    await client('c1', { adviserId: 'naledi' });
    for (const role of ['compliance', 'paraplanner', 'viewer']) {
      await staff(`t-${role}`, 'active', role);
      const res = await reassign('naledi', { toPersonnelId: `t-${role}`, clientIds: ['c1'] });
      expect(res.status).toBe(400);
    }
    expect(kvStore.get('user_profile:c1:personal_info')).toMatchObject({ adviserId: 'naledi' });
    await staff('boss', 'active', 'admin');
    expect((await reassign('naledi', { toPersonnelId: 'boss', clientIds: ['c1'] })).status).toBe(
      200,
    );
  });
});
