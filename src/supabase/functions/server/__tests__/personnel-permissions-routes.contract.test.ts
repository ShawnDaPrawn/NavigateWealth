/**
 * Personnel permissions and the audit trail behind them — contract tests
 * ======================================================================
 *
 * This is the app's own access-control panel: the routes that decide what every
 * member of staff can see and do, and the audit trail that records who changed
 * it. Three properties make it worth pinning rather than assuming:
 *
 *  1. **Empty means no access, not full access.** `getPermissions` returns null
 *     for anyone never granted anything, and the capability check has to read
 *     that as "no", not as "unrestricted".
 *  2. **Except when a module IS granted with no capability list** — then it is
 *     deliberately full access within that module, for backwards compatibility
 *     with permission sets written before capabilities existed. That exception
 *     is the one place a missing value widens access, so it is asserted
 *     explicitly rather than left to be discovered.
 *  3. **The super-admin bypass is by email**, against an allowlist, and it
 *     short-circuits before any stored permission is read.
 *
 * Real collaborators: PermissionsService, PermissionAuditService and the real
 * super-admin allowlist, all against the in-memory KV. Only the Supabase auth
 * client (which resolves the bearer token) and the personnel service's own
 * network dependencies are stubbed.
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
vi.mock('../email-service.tsx', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  createEmailTemplate: () => '<html></html>',
  getFooterSettings: vi.fn(async () => ({})),
}));

import { kvStore } from './helpers/contract-harness.ts';
import { PermissionsService } from '../personnel-permissions-service.ts';
import { PermissionAuditService } from '../permission-audit-service.ts';
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

/** Grants the caller the capability every guarded route in this file requires. */
const grantManagePermissions = (personnelId: string) =>
  PermissionsService.setPermissions(
    personnelId,
    { personnel: { access: true, capabilities: ['manage_permissions'] } },
    'seed',
  );

/** One audit entry, in the shape `recordChange` actually takes. */
const recordFor = (targetPersonnelId: string, module: string) =>
  PermissionAuditService.recordChange({
    targetPersonnelId,
    changedByPersonnelId: 'admin-1',
    action: 'update',
    changes: [{ module, type: 'access_granted' }],
  });

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
});

describe('the audit entry key', () => {
  it('keeps both records when one person is changed twice in the same millisecond', async () => {
    // The key was `audit:permissions:{timestamp}:{targetId}` and the entry's own
    // id was `{timestamp}:{targetId}` too — neither unique. Two changes to the
    // same person inside one millisecond collided and `kv.set` upserts, so one
    // audit record was silently lost. Found while writing this file; the
    // end-of-key scanner in timestamp-key-collision.test.ts did not catch it
    // because the timestamp sits in the MIDDLE of this key.
    //
    // The clock is frozen so the collision is certain rather than a matter of
    // luck.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const first = await recordFor('p2', 'compliance');
      const second = await recordFor('p2', 'personnel');

      expect(second.id).not.toBe(first.id);
      expect(first.timestamp).toBe(second.timestamp);

      const entries = await PermissionAuditService.getForPersonnel('p2');
      expect(entries).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the capability check', () => {
  it('denies someone who has never been granted anything', async () => {
    // `getPermissions` returns null for a member of staff with no stored set.
    // Reading that as "unrestricted" would hand a new hire the whole app.
    await expect(PermissionsService.hasCapability('nobody', 'personnel', 'manage')).resolves.toBe(
      false,
    );
    await expect(PermissionsService.hasModuleAccess('nobody', 'personnel')).resolves.toBe(false);
  });

  it('denies a module that is stored but switched off', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: false, capabilities: ['manage_permissions'] } },
      'admin',
    );

    await expect(
      PermissionsService.hasCapability('p1', 'personnel', 'manage_permissions'),
    ).resolves.toBe(false);
  });

  it('grants a capability that is listed', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['manage_permissions'] } },
      'admin',
    );

    await expect(
      PermissionsService.hasCapability('p1', 'personnel', 'manage_permissions'),
    ).resolves.toBe(true);
  });

  it('denies a capability that is not listed', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['view'] } },
      'admin',
    );

    await expect(
      PermissionsService.hasCapability('p1', 'personnel', 'manage_permissions'),
    ).resolves.toBe(false);
  });

  it('treats an EMPTY capability list on a granted module as full access', async () => {
    // The one place a missing value widens rather than narrows access, kept for
    // permission sets written before capabilities existed. Asserted explicitly
    // because it is the opposite of the rule above it.
    await PermissionsService.setPermissions('p1', { personnel: { access: true } }, 'admin');

    await expect(
      PermissionsService.hasCapability('p1', 'personnel', 'manage_permissions'),
    ).resolves.toBe(true);
  });

  it('always grants "view" on a module that is switched on', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['something_else'] } },
      'admin',
    );

    await expect(PermissionsService.hasCapability('p1', 'personnel', 'view')).resolves.toBe(true);
  });

  it('does not leak a capability across modules', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['manage_permissions'] } },
      'admin',
    );

    await expect(
      PermissionsService.hasCapability('p1', 'compliance', 'manage_permissions'),
    ).resolves.toBe(false);
  });

  it('recognises the super admin by email, case-insensitively', async () => {
    expect(PermissionsService.isSuperAdmin(SUPER_ADMIN_EMAIL)).toBe(true);
    expect(PermissionsService.isSuperAdmin(SUPER_ADMIN_EMAIL.toUpperCase())).toBe(true);
    expect(PermissionsService.isSuperAdmin('someone.else@example.co.za')).toBe(false);
    expect(PermissionsService.isSuperAdmin('')).toBe(false);
  });
});

describe('setPermissions', () => {
  it('merges module by module rather than replacing the whole set', async () => {
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['a'] } },
      'admin',
    );

    const merged = await PermissionsService.setPermissions(
      'p1',
      { compliance: { access: true, capabilities: ['b'] } },
      'admin',
    );

    // Granting compliance must not silently revoke personnel.
    expect(Object.keys(merged.modules).sort()).toEqual(['compliance', 'personnel']);
    expect(merged.modules.personnel.capabilities).toEqual(['a']);
  });

  it("replaces a module's capability list wholesale rather than merging it", async () => {
    // Deliberate: removing a capability has to be possible, and a merge would
    // make revocation impossible through this API.
    await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['a', 'b'] } },
      'admin',
    );

    const updated = await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true, capabilities: ['a'] } },
      'admin',
    );

    expect(updated.modules.personnel.capabilities).toEqual(['a']);
  });

  it('records who made the change and when', async () => {
    const result = await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true } },
      'admin-42',
    );

    expect(result.updatedBy).toBe('admin-42');
    expect(result.updatedAt).toBeTruthy();
  });

  it('normalises a missing capability list to an empty array', async () => {
    const result = await PermissionsService.setPermissions(
      'p1',
      { personnel: { access: true } },
      'admin',
    );

    expect(result.modules.personnel.capabilities).toEqual([]);
  });
});

describe('GET /permissions/me', () => {
  it('requires authentication', async () => {
    expect((await call('/permissions/me')).status).toBe(401);
  });

  it('reports an empty set for a user with nothing granted', async () => {
    // Not an error: a new member of staff legitimately has no permissions yet,
    // and the sidebar has to render something.
    const body = await json(await call('/permissions/me', { auth: asUser('p1', 'adviser') }));

    expect(body.data).toMatchObject({
      personnelId: 'p1',
      modules: {},
      isSuperAdmin: false,
      updatedAt: null,
      updatedBy: null,
    });
  });

  it("reports the caller's own stored permissions", async () => {
    await PermissionsService.setPermissions(
      'p1',
      { compliance: { access: true, capabilities: ['review'] } },
      'admin',
    );

    const body = await json(await call('/permissions/me', { auth: asUser('p1', 'adviser') }));

    expect(body.data.modules.compliance).toMatchObject({
      access: true,
      capabilities: ['review'],
    });
    expect(body.data.isSuperAdmin).toBe(false);
  });

  it('short-circuits for the super admin without reading a stored set', async () => {
    const body = await json(
      await call('/permissions/me', { auth: asUser('boss', 'super_admin', SUPER_ADMIN_EMAIL) }),
    );

    expect(body.data).toMatchObject({ isSuperAdmin: true, modules: {} });
  });

  it('needs no capability of its own — anyone may read their own permissions', async () => {
    // Requiring `manage_permissions` here would lock every non-admin out of
    // their own sidebar.
    expect((await call('/permissions/me', { auth: asUser('p1', 'client') })).status).toBe(200);
  });
});

describe('the guarded permission routes', () => {
  const GUARDED: Array<[string, string, RequestInit]> = [
    ['GET', '/permissions/all', {}],
    ['GET', '/permissions/p2', {}],
    ['GET', '/audit/permissions/p2', {}],
    ['PUT', '/permissions/p2', { method: 'PUT', body: JSON.stringify({ modules: {} }) }],
  ];

  it.each(GUARDED)('%s %s rejects an unauthenticated caller', async (_m, path, init) => {
    expect((await call(path, init)).status).toBe(401);
  });

  it.each(GUARDED)('%s %s rejects a non-admin role outright', async (_m, path, init) => {
    // The role gate runs before the capability gate, so an adviser is refused
    // even if a permission set somehow granted them the capability.
    await grantManagePermissions('adviser-1');

    const res = await call(path, { ...init, auth: asUser('adviser-1', 'adviser') });

    expect(res.status).toBe(403);
  });

  it.each(GUARDED)('%s %s rejects an admin without the capability', async (_m, path, init) => {
    const res = await call(path, { ...init, auth: asUser('admin-1', 'admin') });

    expect(res.status).toBe(403);
    expect((await json(res)).error).toMatch(/manage_permissions/);
  });

  it.each(GUARDED)('%s %s admits an admin who holds the capability', async (_m, path, init) => {
    await grantManagePermissions('admin-1');

    const res = await call(path, { ...init, auth: asUser('admin-1', 'admin') });

    expect(res.status).toBe(200);
  });

  it.each(GUARDED)('%s %s admits the super admin with nothing stored', async (_m, path, init) => {
    const res = await call(path, {
      ...init,
      auth: asUser('boss', 'super_admin', SUPER_ADMIN_EMAIL),
    });

    expect(res.status).toBe(200);
  });
});

describe('GET /permissions/:personnelId', () => {
  it('does not shadow the literal /permissions/me and /permissions/all routes', async () => {
    // `/permissions/me` and `/permissions/all` are registered first on purpose.
    // Registered the other way round, both would be read as a personnel id —
    // and `/permissions/me` would then require the manage capability.
    await grantManagePermissions('admin-1');
    const auth = asUser('admin-1', 'admin');

    expect((await json(await call('/permissions/me', { auth }))).data.personnelId).toBe('admin-1');
    expect(Array.isArray((await json(await call('/permissions/all', { auth }))).data)).toBe(true);
  });

  it('returns an empty set for a person with nothing granted', async () => {
    await grantManagePermissions('admin-1');

    const body = await json(await call('/permissions/p2', { auth: asUser('admin-1', 'admin') }));

    expect(body.data).toMatchObject({ personnelId: 'p2', modules: {} });
  });
});

describe('PUT /permissions/:personnelId', () => {
  const adminAuth = async () => {
    await grantManagePermissions('admin-1');
    return asUser('admin-1', 'admin');
  };

  it('stores the change and records who made it', async () => {
    const auth = await adminAuth();

    const body = await json(
      await call('/permissions/p2', {
        method: 'PUT',
        auth,
        body: JSON.stringify({ modules: { compliance: { access: true } } }),
      }),
    );

    expect(body.data).toMatchObject({ personnelId: 'p2', updatedBy: 'admin-1' });
    await expect(PermissionsService.getPermissions('p2')).resolves.toMatchObject({
      modules: { compliance: { access: true } },
    });
  });

  it('rejects a body with no modules object', async () => {
    const auth = await adminAuth();

    const res = await call('/permissions/p2', {
      method: 'PUT',
      auth,
      body: JSON.stringify({ notModules: true }),
    });

    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/modules object is required/);
  });

  it('writes an audit entry naming the actor, the subject and the change', async () => {
    // Who granted whom what, and when. Without this the permission set is a
    // current-state snapshot with no history behind it.
    const auth = await adminAuth();

    await call('/permissions/p2', {
      method: 'PUT',
      auth,
      body: JSON.stringify({ modules: { compliance: { access: true } } }),
    });

    // The audit write is deliberately fire-and-forget so it cannot delay the
    // response, so let the microtask queue drain before reading it back.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const entries = await PermissionAuditService.getForPersonnel('p2');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({
      targetPersonnelId: 'p2',
      changedByPersonnelId: 'admin-1',
    });
  });

  it('does not fail the request when the audit write fails', async () => {
    // The permission change is the operation the admin asked for; losing its
    // history is bad but refusing the change would be worse.
    const auth = await adminAuth();
    const spy = vi
      .spyOn(PermissionAuditService, 'recordDiff')
      .mockRejectedValue(new Error('audit store down'));
    try {
      const res = await call('/permissions/p2', {
        method: 'PUT',
        auth,
        body: JSON.stringify({ modules: { compliance: { access: true } } }),
      });

      expect(res.status).toBe(200);
      await expect(PermissionsService.getPermissions('p2')).resolves.toMatchObject({
        modules: { compliance: { access: true } },
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('GET /audit/permissions/:personnelId', () => {
  it('returns the trail for one person, newest first', async () => {
    await grantManagePermissions('admin-1');
    await recordFor('p2', 'compliance');
    await recordFor('p2', 'personnel');
    await recordFor('other', 'compliance');

    const body = await json(
      await call('/audit/permissions/p2', { auth: asUser('admin-1', 'admin') }),
    );

    expect(body.data).toHaveLength(2);
    expect(
      body.data.every((e: { targetPersonnelId: string }) => e.targetPersonnelId === 'p2'),
    ).toBe(true);
  });

  it('honours the limit query parameter', async () => {
    await grantManagePermissions('admin-1');
    for (let index = 0; index < 5; index++) {
      await recordFor('p2', `module-${index}`);
    }

    const body = await json(
      await call('/audit/permissions/p2?limit=2', { auth: asUser('admin-1', 'admin') }),
    );

    expect(body.data).toHaveLength(2);
  });

  it('returns an empty trail for someone never changed', async () => {
    await grantManagePermissions('admin-1');

    const body = await json(
      await call('/audit/permissions/nobody', { auth: asUser('admin-1', 'admin') }),
    );

    expect(body.data).toEqual([]);
  });
});
