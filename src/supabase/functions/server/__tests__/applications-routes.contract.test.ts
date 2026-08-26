/**
 * applications-routes.ts — Admin Applications Contract
 * ====================================================
 *
 * 16 routes at 0% coverage before this file, mounted at `/admin` and gated by a
 * single `adminApp.use('*', requireAdmin)`. They invite prospective clients,
 * approve and decline applications, and — the part that matters — perform
 * irreversible bulk operations on the shared KV store.
 *
 * WHAT WRITING THIS FILE FOUND
 * ----------------------------
 * Two routes were reachable by any user holding the `admin` role and had no
 * business being:
 *
 *   - `GET /debug/all-keys` called `getAllKeys('')`, i.e. `kv.getByPrefix('')`,
 *     which selects `key >= '' AND key < '￿'` across
 *     `kv_store_91ed8379` and returns every VALUE. That table is not
 *     application data: it also holds `portal-credential:*` (provider portal
 *     usernames and passwords, stored in plaintext), `refund-clusters:entity:*`
 *     (tax numbers, bank details), `user_profile:*` and `esign:*`. The
 *     refund-cluster routes are restricted to super admins precisely so an
 *     admin cannot read those records; this route handed the same data to any
 *     admin, unpaginated, from a different module.
 *   - `DELETE /debug/delete-key` and `DELETE /applications/delete` both
 *     forwarded a caller-supplied key to a bare `kv.del(key)` — so a route
 *     named "delete application" could delete a portal credential or a client
 *     profile.
 *
 * Neither had a caller in the SPA or the e2e suite. The two `/debug` routes are
 * gone; the destructive maintenance routes now require super admin, are
 * namespace-scoped, and write a `critical` audit entry. The tests below pin all
 * of that, because a gate with no test is a gate that comes back off.
 *
 * The role for the second gate is read off the context rather than re-resolved:
 * `requireAdmin` has already resolved it from trusted sources only, so the
 * suite's auth mock sets `userRole` the same way the real middleware does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, routeRegistrations } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const svc = vi.hoisted(() => ({
  inviteApplicant: vi.fn(),
  resendInvite: vi.fn(),
  getApplications: vi.fn(),
  getApplicationById: vi.fn(),
  updateApplicationData: vi.fn(),
  approveApplication: vi.fn(),
  declineApplication: vi.fn(),
  getStats: vi.fn(),
  clearApplications: vi.fn(),
  deleteApplication: vi.fn(),
  migrateApplications: vi.fn(),
  deprecateApplications: vi.fn(),
  getDeprecatedApplications: vi.fn(),
  undeprecateApplications: vi.fn(),
  getAllKeys: vi.fn(),
  deleteKey: vi.fn(),
  nuclearClear: vi.fn(),
}));

vi.mock('../applications-service.ts', () => ({ AdminApplicationsService: svc }));

const auditRecord = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../admin-audit-service.ts', () => ({ AdminAuditService: { record: auditRecord } }));

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../auth-mw.ts', async () => ({
  requireAdmin: (await import('./helpers/contract-harness.ts')).makeRoleGate(
    ['admin', 'super_admin', 'super-admin'],
    'FORBIDDEN',
  ),
}));

const app = (await import('../applications-routes.ts')).default;

const APP_ID = 'app-1';
const req = (path: string, opts: Parameters<typeof request>[2] = {}) =>
  request(app, path, { as: 'admin', ...opts });

const NOT_FOUND = 'Application not found';
const INVALID_STATUS = 'Application cannot be processed in current status';
const USER_NOT_FOUND =
  'The user associated with this application no longer exists in the authentication system. The application cannot be processed.';

beforeEach(() => {
  vi.clearAllMocks();
  svc.inviteApplicant.mockResolvedValue({ success: true, applicationId: APP_ID });
  svc.resendInvite.mockResolvedValue({ success: true });
  svc.getApplications.mockResolvedValue({ applications: [], total: 0 });
  svc.getApplicationById.mockResolvedValue({ application: { id: APP_ID } });
  svc.updateApplicationData.mockResolvedValue({ amendments_count: 1 });
  svc.approveApplication.mockResolvedValue(undefined);
  svc.declineApplication.mockResolvedValue(undefined);
  svc.getStats.mockResolvedValue({ total: 0 });
  svc.clearApplications.mockResolvedValue(3);
  svc.deleteApplication.mockResolvedValue(undefined);
  svc.migrateApplications.mockResolvedValue({ migrated: 2, deleted: 1, applications: [] });
  svc.deprecateApplications.mockResolvedValue(2);
  svc.getDeprecatedApplications.mockResolvedValue([]);
  svc.undeprecateApplications.mockResolvedValue(2);
  svc.getAllKeys.mockResolvedValue([]);
  svc.nuclearClear.mockResolvedValue(5);
  auditRecord.mockResolvedValue(undefined);
});

// ============================================================================
// THE DESTRUCTIVE ROUTES — admin is not enough
// ============================================================================

type Destructive = {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  guard: keyof typeof svc;
};

const DESTRUCTIVE: Destructive[] = [
  {
    name: 'clear all applications',
    method: 'DELETE',
    path: '/applications/clear',
    guard: 'clearApplications',
  },
  {
    name: 'delete an application by key',
    method: 'DELETE',
    path: '/applications/delete',
    body: { key: 'application:app-1' },
    guard: 'deleteApplication',
  },
  {
    name: 'migrate applications',
    method: 'POST',
    path: '/applications/migrate',
    body: {},
    guard: 'migrateApplications',
  },
  {
    name: 'nuclear clear',
    method: 'POST',
    path: '/debug/nuclear-clear',
    body: {},
    guard: 'nuclearClear',
  },
];

describe('destructive routes require super admin', () => {
  it.each(DESTRUCTIVE)('$method $path ($name) refuses a plain admin', async (r) => {
    const res = await req(r.path, { method: r.method, body: r.body, as: 'admin' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN_SUPER_ADMIN' });
    // The refusal must be total. A 403 that still ran the deletion would be
    // the worst of both worlds.
    expect(svc[r.guard]).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each(DESTRUCTIVE)('$method $path ($name) refuses an unauthenticated caller', async (r) => {
    const res = await req(r.path, { method: r.method, body: r.body, auth: false });
    expect(res.status).toBe(401);
    expect(svc[r.guard]).not.toHaveBeenCalled();
  });

  describe.each(['super_admin', 'super-admin'])('as %s', (role) => {
    it.each(DESTRUCTIVE)('$method $path ($name) is allowed', async (r) => {
      const res = await req(r.path, { method: r.method, body: r.body, as: role });
      expect(res.status).toBe(200);
      expect(svc[r.guard]).toHaveBeenCalled();
    });
  });

  it.each(DESTRUCTIVE)('$method $path ($name) writes a critical audit entry', async (r) => {
    const res = await req(r.path, {
      method: r.method,
      body: r.body,
      as: 'super_admin',
      user: 'sa-7',
    });
    expect(res.status).toBe(200);
    // Irreversible and bulk: if it is not in the audit log, nobody can answer
    // "who deleted the applications" after the fact.
    expect(auditRecord).toHaveBeenCalledTimes(1);
    expect(auditRecord.mock.calls[0][0]).toMatchObject({
      severity: 'critical',
      category: 'bulk_operation',
      actorId: 'sa-7',
      actorRole: 'super_admin',
    });
  });

  it.each(DESTRUCTIVE)('$method $path ($name) records what it removed', async (r) => {
    await req(r.path, { method: r.method, body: r.body, as: 'super_admin' });
    const metadata = (auditRecord.mock.calls[0][0] as { metadata: Record<string, unknown> })
      .metadata;
    expect(Object.keys(metadata).length).toBeGreaterThan(0);
  });

  it.each(['adviser', 'paraplanner', 'compliance', 'client', 'worker'])(
    'a %s does not even reach the second gate',
    async (role) => {
      const res = await req('/applications/clear', { method: 'DELETE', as: role });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' });
    },
  );
});

// ============================================================================
// THE BY-KEY DELETE — scoped to this module's namespace
// ============================================================================

describe('delete by key', () => {
  const del = (key: unknown, as = 'super_admin') =>
    req('/applications/delete', { method: 'DELETE', body: { key }, as });

  it('deletes an application key', async () => {
    const res = await del('application:app-1');
    expect(res.status).toBe(200);
    expect(svc.deleteApplication).toHaveBeenCalledWith('application:app-1');
  });

  it.each([
    ['a portal credential', 'portal-credential:allan-gray:allan-gray-env'],
    ['a refund cluster entity', 'refund-clusters:entity:cl-1:en-1'],
    ['a client profile', 'user_profile:11111111-2222-4333-8444-555555555555:personal_info'],
    ['an e-signature record', 'esign:doc-1'],
    ['an auth log entry', 'auth_log:2026-01-01T00:00:00.000Z:e1'],
    ['every key at once', ''],
    ['a near miss', 'applications:app-1'],
    ['a prefix hidden in the middle', 'x-application:app-1'],
  ])('refuses to delete %s', async (_label, key) => {
    // `deleteApplication` is a bare `kv.del(key)`. Without the prefix check a
    // route named "delete application" reaches every row in a shared table.
    const res = await del(key);
    expect(res.status).toBe(400);
    expect(svc.deleteApplication).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing key', undefined],
    ['a null key', null],
    ['a numeric key', 42],
    ['an object key', { startsWith: () => true }],
    ['an array key', ['application:app-1']],
  ])('refuses %s', async (_label, key) => {
    // The object case is the interesting one: a `key.startsWith(...)` check on
    // an unvalidated body would be satisfied by a caller-supplied method.
    const res = await del(key);
    expect(res.status).toBe(400);
    expect(svc.deleteApplication).not.toHaveBeenCalled();
  });
});

// ============================================================================
// THE ROUTES THAT NO LONGER EXIST
// ============================================================================

describe('removed debug routes', () => {
  it.each([
    ['GET', '/debug/all-keys', undefined],
    ['DELETE', '/debug/delete-key', { key: 'application:a' }],
  ] as const)('%s %s is gone', async (method, path, body) => {
    const res = await req(path, { method, body, as: 'super_admin' });
    expect(res.status).toBe(404);
  });

  it('never dumps the whole store from any surviving route', async () => {
    // The regression this guards: `getAllKeys` is still used by `/debug/kv`,
    // where it is scoped. An unscoped call from anywhere in this module returns
    // every value in `kv_store_91ed8379`, credentials included.
    for (const [method, path, body] of [
      ['GET', '/debug/kv', undefined],
      ['GET', '/applications', undefined],
      ['GET', '/applications/deprecated', undefined],
      ['GET', '/stats', undefined],
    ] as const) {
      await req(path, { method, body, as: 'super_admin' });
    }
    for (const [prefix] of svc.getAllKeys.mock.calls) {
      expect(prefix).toBeTruthy();
      expect(prefix).toBe('application:');
    }
  });

  it('registers exactly the routes this module still owns', () => {
    const registered = routeRegistrations(app)
      .filter((r) => r.method !== 'ALL')
      .map((r) => `${r.method} ${r.path}`);
    expect(new Set(registered)).toEqual(
      new Set([
        'POST /applications/invite',
        'POST /applications/invite/resend',
        'GET /applications',
        'GET /applications/:applicationId',
        'PATCH /applications/:applicationId',
        'POST /applications/:applicationId/approve',
        'POST /applications/:applicationId/decline',
        'GET /stats',
        'DELETE /applications/clear',
        'DELETE /applications/delete',
        'POST /applications/migrate',
        'POST /applications/deprecate',
        'GET /applications/deprecated',
        'POST /applications/undeprecate',
        'GET /debug/kv',
        'POST /debug/nuclear-clear',
      ]),
    );
  });
});

// ============================================================================
// INVITES — the one route that creates an account for someone else
// ============================================================================

describe('invite', () => {
  const invite = (body: Record<string, unknown> = {}) =>
    req('/applications/invite', {
      method: 'POST',
      body: { email: 'client@example.com', firstName: 'Thabo', lastName: 'Mokoena', ...body },
    });

  it('invites a prospective client and returns 201', async () => {
    const res = await invite();
    expect(res.status).toBe(201);
    expect(svc.inviteApplicant).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'client@example.com' }),
      'test-user',
      undefined,
    );
  });

  it('attributes the invite to the acting admin', async () => {
    // The applicant record carries who invited them; taking this from the body
    // instead of the context would let one admin's invites be attributed to
    // another.
    await req('/applications/invite', {
      method: 'POST',
      user: 'admin-42',
      body: {
        email: 'client@example.com',
        firstName: 'Thabo',
        lastName: 'Mokoena',
        invitedBy: 'someone-else',
      },
    });
    expect(svc.inviteApplicant.mock.calls[0][1]).toBe('admin-42');
  });

  it.each([
    ['a malformed email', { email: 'not-an-email' }],
    ['no first name', { firstName: '' }],
    ['no last name', { lastName: '' }],
    ['an over-long first name', { firstName: 'x'.repeat(101) }],
  ])('refuses an invite with %s', async (_label, over) => {
    const res = await invite(over);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
    expect(svc.inviteApplicant).not.toHaveBeenCalled();
  });

  it('reports an address that already has an account as a 409', async () => {
    // Distinct from a validation failure: the caller can act on "already
    // invited" (resend) but not on "invalid".
    svc.inviteApplicant.mockResolvedValue({ success: false, errorCode: 'EMAIL_EXISTS' });
    const res = await invite();
    expect(res.status).toBe(409);
  });

  it('reports any other invite failure as a 400', async () => {
    svc.inviteApplicant.mockResolvedValue({ success: false, errorCode: 'MAIL_SEND_FAILED' });
    expect((await invite()).status).toBe(400);
  });

  it('passes the calling origin through so the invite link points back', async () => {
    const res = await app.request('/applications/invite', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
        origin: 'https://app.navigatewealth.co',
      },
      body: JSON.stringify({
        email: 'client@example.com',
        firstName: 'Thabo',
        lastName: 'Mokoena',
      }),
    });
    expect(res.status).toBe(201);
    expect(svc.inviteApplicant.mock.calls[0][2]).toBe('https://app.navigatewealth.co');
  });

  it('falls back to the referer with its last path segment stripped', async () => {
    // The referer is a page URL; the invite link needs the site root.
    await app.request('/applications/invite', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
        referer: 'https://app.navigatewealth.co/admin/clients',
      },
      body: JSON.stringify({
        email: 'client@example.com',
        firstName: 'Thabo',
        lastName: 'Mokoena',
      }),
    });
    expect(svc.inviteApplicant.mock.calls[0][2]).toBe('https://app.navigatewealth.co/admin');
  });

  it('resends an invite for an existing application', async () => {
    const res = await req('/applications/invite/resend', {
      method: 'POST',
      body: { applicationId: APP_ID },
    });
    expect(res.status).toBe(200);
    expect(svc.resendInvite).toHaveBeenCalledWith(APP_ID, 'test-user', undefined);
  });

  it('refuses a resend with no application id', async () => {
    const res = await req('/applications/invite/resend', { method: 'POST', body: {} });
    expect(res.status).toBe(400);
    expect(svc.resendInvite).not.toHaveBeenCalled();
  });

  it('reports a failed resend as a 400', async () => {
    svc.resendInvite.mockResolvedValue({ success: false, error: 'Application is not invited' });
    const res = await req('/applications/invite/resend', {
      method: 'POST',
      body: { applicationId: APP_ID },
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// DECISIONS — approve, decline, amend
// ============================================================================

describe('application decisions', () => {
  const decide = (verb: 'approve' | 'decline', body: unknown = { reason: 'incomplete' }) =>
    req(`/applications/${APP_ID}/${verb}`, { method: 'POST', body });

  it.each(['approve', 'decline'] as const)('%ss an application', async (verb) => {
    const res = await decide(verb);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, applicationId: APP_ID });
  });

  it.each(['approve', 'decline'] as const)(
    'attributes the %s to the acting admin',
    async (verb) => {
      await req(`/applications/${APP_ID}/${verb}`, {
        method: 'POST',
        user: 'admin-9',
        body: { reason: 'incomplete' },
      });
      const fn = verb === 'approve' ? svc.approveApplication : svc.declineApplication;
      expect(fn.mock.calls[0][1]).toBe('admin-9');
    },
  );

  it('passes the decline reason through', async () => {
    await decide('decline', { reason: 'FICA documents missing' });
    expect(svc.declineApplication.mock.calls[0][2]).toBe('FICA documents missing');
  });

  it.each([
    ['approve', NOT_FOUND, 404],
    ['approve', INVALID_STATUS, 400],
    ['approve', USER_NOT_FOUND, 422],
    ['decline', NOT_FOUND, 404],
    ['decline', INVALID_STATUS, 400],
    ['decline', USER_NOT_FOUND, 422],
  ] as const)('maps a %s failure of "%s" to %i', async (verb, message, status) => {
    // Three distinct causes, three distinct statuses. Collapsing them to 500
    // would make the SPA retry a permanent refusal — the same class of bug as
    // the wills-route 403-reported-as-500 fixed in #237.
    const fn = verb === 'approve' ? svc.approveApplication : svc.declineApplication;
    fn.mockRejectedValue(new Error(message));
    const res = await decide(verb);
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(message);
  });

  it.each(['approve', 'decline'] as const)('reports an unknown %s failure as 500', async (verb) => {
    const fn = verb === 'approve' ? svc.approveApplication : svc.declineApplication;
    fn.mockRejectedValue(new Error('postgres exploded'));
    const res = await decide(verb);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });

  it('amends application data and reports the amendment count', async () => {
    svc.updateApplicationData.mockResolvedValue({ amendments_count: 3 });
    const res = await req(`/applications/${APP_ID}`, {
      method: 'PATCH',
      body: { application_data: { idNumber: '9001015800088' }, amendment_notes: 'corrected ID' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, amendments_count: 3 });
    expect(svc.updateApplicationData).toHaveBeenCalledWith(
      APP_ID,
      { idNumber: '9001015800088' },
      'test-user',
      'corrected ID',
    );
  });

  it.each([
    ['a missing application_data', {}],
    ['a string application_data', { application_data: 'idNumber=1' }],
    ['a null application_data', { application_data: null }],
  ])('refuses an amendment with %s', async (_label, body) => {
    const res = await req(`/applications/${APP_ID}`, { method: 'PATCH', body });
    expect(res.status).toBe(400);
    expect(svc.updateApplicationData).not.toHaveBeenCalled();
  });

  it('maps an amendment to a missing application to 404', async () => {
    svc.updateApplicationData.mockRejectedValue(new Error(NOT_FOUND));
    const res = await req(`/applications/${APP_ID}`, {
      method: 'PATCH',
      body: { application_data: { a: 1 } },
    });
    expect(res.status).toBe(404);
  });
});

// ============================================================================
// READS AND BULK FLAGS
// ============================================================================

describe('reads', () => {
  it('passes the list filters through untouched', async () => {
    await req('/applications?status=submitted&sortBy=created_at&sortOrder=desc');
    expect(svc.getApplications).toHaveBeenCalledWith('submitted', 'created_at', 'desc');
  });

  it('passes undefined filters rather than empty strings', async () => {
    await req('/applications');
    expect(svc.getApplications).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('returns 404 for an application that does not exist', async () => {
    svc.getApplicationById.mockRejectedValue(new Error(NOT_FOUND));
    const res = await req(`/applications/${APP_ID}`);
    expect(res.status).toBe(404);
  });

  it('reports an unexpected read failure as 500', async () => {
    svc.getApplicationById.mockRejectedValue(new Error('timeout'));
    expect((await req(`/applications/${APP_ID}`)).status).toBe(500);
  });

  it('returns the stats under a stats key', async () => {
    svc.getStats.mockResolvedValue({ total: 12, submitted: 3 });
    expect(await (await req('/stats')).json()).toEqual({ stats: { total: 12, submitted: 3 } });
  });

  it('summarises the debug KV view without dumping the records', async () => {
    // `/debug/kv` survives because it is scoped to `application:`. It projects
    // each record down to its identifiers — the applicant's captured data never
    // travels in a debug response.
    svc.getAllKeys.mockResolvedValue([
      {
        id: APP_ID,
        user_id: 'u-1',
        status: 'submitted',
        created_at: '2026-01-01',
        updated_at: '2026-01-02',
        application_data: { idNumber: '9001015800088', bankAccount: '123456789' },
      },
    ]);
    const res = await req('/debug/kv');
    const body = await res.json();
    expect(body).toMatchObject({ total: 1 });
    expect(body.applications[0]).toEqual({
      id: APP_ID,
      user_id: 'u-1',
      status: 'submitted',
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      key: `application:${APP_ID}`,
    });
    expect(JSON.stringify(body)).not.toContain('9001015800088');
  });
});

describe('deprecation flags', () => {
  it.each([
    ['deprecate', '/applications/deprecate', 'deprecateApplications'],
    ['undeprecate', '/applications/undeprecate', 'undeprecateApplications'],
  ] as const)('%ss the ids it is given', async (_label, path, fn) => {
    const res = await req(path, { method: 'POST', body: { applicationIds: ['a', 'b'] } });
    expect(res.status).toBe(200);
    expect(svc[fn]).toHaveBeenCalledWith(['a', 'b']);
  });

  it.each([
    ['/applications/deprecate', 'deprecateApplications'],
    ['/applications/undeprecate', 'undeprecateApplications'],
  ] as const)('%s refuses anything that is not an array', async (path, fn) => {
    for (const applicationIds of [undefined, 'a', 42, { 0: 'a' }, null]) {
      const res = await req(path, { method: 'POST', body: { applicationIds } });
      expect(res.status).toBe(400);
    }
    expect(svc[fn]).not.toHaveBeenCalled();
  });

  it('accepts an empty array as a no-op rather than a refusal', async () => {
    svc.deprecateApplications.mockResolvedValue(0);
    const res = await req('/applications/deprecate', {
      method: 'POST',
      body: { applicationIds: [] },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).deprecated).toBe(0);
  });

  it('lists deprecated applications with a total', async () => {
    svc.getDeprecatedApplications.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const res = await req('/applications/deprecated');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ total: 2 });
  });

  it('serves /applications/deprecated from its own handler, not :applicationId', async () => {
    // Hono matches in registration order. With the parameterised route first,
    // the literal word "deprecated" was captured as an applicationId, this
    // handler never ran, and the request 404'd looking up an application whose
    // id is "deprecated" (§14.2 — the same rule the portal-jobs module
    // documents for /portal-jobs/latest and /portal-jobs/history).
    svc.getDeprecatedApplications.mockResolvedValue([{ id: 'a' }]);
    await req('/applications/deprecated');
    expect(svc.getDeprecatedApplications).toHaveBeenCalledTimes(1);
    expect(svc.getApplicationById).not.toHaveBeenCalled();
  });

  it('still resolves an application whose id is a word', async () => {
    // The fix must not shadow real ids: only the exact literal is special.
    await req('/applications/submitted');
    expect(svc.getApplicationById).toHaveBeenCalledWith('submitted');
  });
});
