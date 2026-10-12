/**
 * GET /profile/client-record/:userId — one client's current entry.
 *
 * An open client profile reads this instead of the client-list row it was
 * opened from, so it never shows an old name, status or email (2026-10-12).
 * Pinned here, with the REAL visibility rules:
 *   - it is admin-only;
 *   - its entry is exactly the one GET /all-users returns for that user, so
 *     the list and an open profile cannot disagree about the shape;
 *   - a user Client Management would not list (unknown, personnel, declined)
 *     answers 404, and an auth outage answers 500 rather than "not found".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ kv: null as unknown }));

vi.mock('../kv_store.tsx', async () => {
  const { makeKvMock } = await import('./helpers/contract-harness.ts');
  const kv = makeKvMock();
  harness.kv = kv;
  return kv;
});
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    requireAdmin: makeRoleGate(['admin', 'super_admin'], 'ADMIN_REQUIRED'),
    requireSuperAdmin: makeRoleGate(['super_admin'], 'SUPER_ADMIN_REQUIRED'),
  };
});

type AuthUser = {
  id: string;
  email: string;
  created_at: string;
  user_metadata: Record<string, unknown>;
};
const auth = vi.hoisted(() => ({
  users: new Map<string, unknown>(),
  outage: false,
}));
vi.mock('../client-management-utils.ts', () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => {
          if (auth.outage) {
            return { data: { user: null }, error: { status: 503, message: 'unavailable' } };
          }
          const user = auth.users.get(id);
          return user
            ? { data: { user }, error: null }
            : { data: { user: null }, error: { status: 404, message: 'User not found' } };
        }),
      },
    },
  }),
}));
vi.mock('../auth-admin-list-users.ts', () => ({
  listAllAuthUsers: vi.fn(async () => [...auth.users.values()]),
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const app = (await import('../client-management-user-admin-routes.ts')).default;

const AUTH = { Authorization: 'Bearer t' };
const getRecord = (id: string, headers: Record<string, string> = AUTH) =>
  app.request(`/client-record/${id}`, { headers });

function addClient(user: AuthUser, profile: Record<string, unknown> | null, security?: object) {
  auth.users.set(user.id, user);
  if (profile) kvStore.set(`user_profile:${user.id}:personal_info`, profile);
  if (security) kvStore.set(`security:${user.id}`, security);
}

const AARON: AuthUser = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  email: 'aaron@example.com',
  created_at: '2026-01-02T00:00:00.000Z',
  user_metadata: { firstName: 'Aaron', surname: 'Teng' },
};

beforeEach(() => {
  kvStore.clear();
  auth.users.clear();
  auth.outage = false;
});

describe('GET /client-record/:userId', () => {
  it('is admin-only', async () => {
    addClient(AARON, { firstName: 'Aaron', lastName: 'Teng' });
    expect((await getRecord(AARON.id, {})).status).toBe(401);
    expect((await getRecord(AARON.id, { ...AUTH, 'x-test-role': 'client' })).status).toBe(403);
  });

  it("returns exactly the client's GET /all-users entry", async () => {
    addClient(
      AARON,
      {
        firstName: 'Aaron',
        lastName: 'Teng',
        applicationNumber: 'NW-0042',
        applicationStatus: 'approved',
        accountStatus: 'active',
      },
      { suspended: true },
    );
    addClient(
      { ...AARON, id: '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', email: 'other@example.com' },
      { firstName: 'Other', lastName: 'Person' },
    );

    const res = await getRecord(AARON.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; user: Record<string, unknown> };
    expect(body.success).toBe(true);

    const list = (await (await app.request('/all-users', { headers: AUTH })).json()) as {
      users: Record<string, unknown>[];
    };
    expect(body.user).toEqual(list.users.find((u) => u.id === AARON.id));
    expect(body.user).toMatchObject({
      id: AARON.id,
      email: AARON.email,
      application_number: 'NW-0042',
      application_status: 'approved',
      suspended: true,
    });
  });

  it('reads the current KV values, not a copy', async () => {
    addClient(AARON, { firstName: 'Aaron', lastName: 'Teng', applicationStatus: 'submitted' });
    kvStore.set(`user_profile:${AARON.id}:personal_info`, {
      firstName: 'Aaron',
      lastName: 'Teng-Smith',
      applicationStatus: 'approved',
    });

    const body = (await (await getRecord(AARON.id)).json()) as { user: Record<string, unknown> };
    expect(body.user).toMatchObject({
      name: 'Aaron Teng-Smith',
      application_status: 'approved',
      profile: { lastName: 'Teng-Smith' },
    });
  });

  it('answers 404 for a user that does not exist', async () => {
    expect((await getRecord('00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('answers 404 for an id that is not an auth user id at all', async () => {
    expect((await getRecord('client_1')).status).toBe(404);
  });

  it('answers 404 for a member of staff, as the list leaves them out', async () => {
    addClient(AARON, { firstName: 'Aaron', lastName: 'Teng' });
    kvStore.set(`personnel:profile:${AARON.id}`, { id: AARON.id });
    expect((await getRecord(AARON.id)).status).toBe(404);
  });

  it('answers 404 for a declined client, as the list leaves them out', async () => {
    addClient(AARON, { firstName: 'Aaron', lastName: 'Teng', applicationStatus: 'declined' });
    expect((await getRecord(AARON.id)).status).toBe(404);
  });

  it('answers 500, not "not found", when the auth service fails', async () => {
    addClient(AARON, { firstName: 'Aaron', lastName: 'Teng' });
    auth.outage = true;
    expect((await getRecord(AARON.id)).status).toBe(500);
  });
});
