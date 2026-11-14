/** Reporting › New report: saved custom report definitions, through the real routes. */
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
import app from '../reporting-routes.ts';


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

const admin = () => asUser('admin-1', 'admin');
const post = (payload: unknown, auth = admin()) =>
  call('/definitions', { method: 'POST', body: JSON.stringify(payload), auth });

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
});

describe('saved custom reports', () => {
  it('saves a definition, lists it and deletes it', async () => {
    const res = await post({
      name: 'Adviser book',
      category: 'clients',
      dataSource: 'personal-clients',
      columns: ['First Name', 'Last Name', 'Email', 'Email'],
    });
    expect(res.status).toBe(201);
    const { data } = await json(res);
    expect(data).toMatchObject({
      name: 'Adviser book',
      dataSource: 'personal-clients',
      columns: ['First Name', 'Last Name', 'Email'],
      format: 'xlsx',
      createdBy: 'admin-1',
    });
    expect(kvStore.has(`reporting:definitions:${data.id}`)).toBe(true);

    const list = await json(await call('/definitions', { auth: admin() }));
    expect(list.data.map((d: { name: string }) => d.name)).toEqual(['Adviser book']);

    expect(
      (await call(`/definitions/${data.id}`, { method: 'DELETE', auth: admin() })).status,
    ).toBe(200);
    expect(
      (await call(`/definitions/${data.id}`, { method: 'DELETE', auth: admin() })).status,
    ).toBe(404);
  });

  it('validates the definition', async () => {
    expect(
      (
        await post({
          name: '',
          category: 'clients',
          dataSource: 'personal-clients',
          columns: ['A'],
        })
      ).status,
    ).toBe(400);
    expect(
      (await post({ name: 'X', category: 'clients', dataSource: 'everything', columns: ['A'] }))
        .status,
    ).toBe(400);
    expect(
      (await post({ name: 'X', category: 'clients', dataSource: 'personal-clients', columns: [] }))
        .status,
    ).toBe(400);
  });

  it('is for admins only', async () => {
    const res = await post(
      { name: 'X', category: 'clients', dataSource: 'personal-clients', columns: ['A'] },
      asUser('client-1', 'client'),
    );
    expect(res.status).toBe(403);
  });
});
