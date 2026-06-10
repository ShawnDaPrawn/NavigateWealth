/**
 * Applications / update-status / auto-content — Auth Enforcement Contract Tests
 * =============================================================================
 *
 * Locks the authentication + ownership contracts added for SECURITY-AUDIT
 * findings C-8 (unauthenticated /applications/*), H-8 (unauthenticated
 * POST /profile/update-status) and H-10 (unauthenticated /auto-content/*).
 *
 * Contract under test:
 *   - No Authorization header            → 401
 *   - Client token, another user's data  → 403
 *   - Client token, own data             → 200
 *   - Admin token, any user's data       → 200 ("on behalf of" flows)
 *   - Non-admin privileged status change → 403 (no self-approval)
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/applications-auth.contract.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── Deno runtime shim ────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

// ── Auth middleware (token-aware fake) ───────────────────────────────────────
// Tokens map to fixed identities so each test can pick its caller:
//   client-token  → client-1 (role client)
//   client2-token → client-2 (role client)
//   admin-token   → admin-1  (role admin)
const authMocks = vi.hoisted(() => {
  const USERS: Record<string, { id: string; role: string }> = {
    'client-token': { id: 'client-1', role: 'client' },
    'client2-token': { id: 'client-2', role: 'client' },
    'admin-token': { id: 'admin-1', role: 'admin' },
  };

  const resolve = (c: any) => {
    const header: string = c.req.header('Authorization') ?? '';
    if (!header.startsWith('Bearer ')) return null;
    return USERS[header.slice('Bearer '.length)] ?? null;
  };

  const requireAuth = vi.fn(async (c: any, next: any) => {
    const user = resolve(c);
    if (!user) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    c.set('user', { id: user.id });
    c.set('userId', user.id);
    c.set('userRole', user.role);
    await next();
  });

  const requireAdmin = vi.fn(async (c: any, next: any) => {
    const user = resolve(c);
    if (!user) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'super-admin') {
      return c.json({ error: 'Forbidden: Admin access required', code: 'FORBIDDEN_ADMIN' }, 403);
    }
    c.set('user', { id: user.id });
    c.set('userId', user.id);
    c.set('userRole', user.role);
    await next();
  });

  return { requireAuth, requireAdmin };
});

vi.mock('../auth-mw.ts', () => ({
  requireAuth: authMocks.requireAuth,
  requireAdmin: authMocks.requireAdmin,
}));

// ── Quiet logger ─────────────────────────────────────────────────────────────
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── In-memory KV (update-status profile reads/writes) ───────────────────────
const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, clone(value));
  }),
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
  getByPrefix: vi.fn(async () => []),
}));

// ── Applications service (in-memory) ─────────────────────────────────────────
// app-client-1 is owned by client-1; everything else is unknown.
vi.mock('../client-applications-service.ts', () => ({
  clientApplicationsService: {
    getOrCreate: vi.fn(async (userId: string) => ({ id: `app-${userId}`, user_id: userId })),
    getByUserId: vi.fn(async (userId: string) => ({
      id: `app-${userId}`,
      user_id: userId,
      status: 'in_progress',
    })),
    getById: vi.fn(async (id: string) =>
      id === 'app-client-1' ? { id, user_id: 'client-1', status: 'in_progress' } : null,
    ),
    saveProgress: vi.fn(async () => undefined),
    submit: vi.fn(async () => ({ application: { id: 'app-client-1', status: 'submitted' } })),
    saveStep: vi.fn(async () => ({ saved: true })),
    getStep: vi.fn(async () => ({ data: {} })),
    getAllSteps: vi.fn(async () => []),
  },
}));

// ── Auto-content service stub ────────────────────────────────────────────────
vi.mock('../auto-content-service.ts', () => ({
  AutoContentService: {
    seedAllConfigs: vi.fn(async () => []),
  },
}));

// ── Apps under test (import AFTER mocks) ─────────────────────────────────────
import applicationsApp from '../client-applications-routes.ts';
import statusApp from '../client-management-status-routes.ts';
import autoContentApp from '../auto-content-routes.ts';

const json = { 'Content-Type': 'application/json' };
const asClient1 = { ...json, Authorization: 'Bearer client-token' };
const asClient2 = { ...json, Authorization: 'Bearer client2-token' };
const asAdmin = { ...json, Authorization: 'Bearer admin-token' };

beforeEach(() => {
  kvStore.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// /applications/* (SECURITY-AUDIT C-8)
// ─────────────────────────────────────────────────────────────────────────────
describe('client-applications-routes auth enforcement (C-8)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const saveRes = await applicationsApp.request('/save-progress', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ userId: 'client-1', applicationData: { a: 1 } }),
    });
    expect(saveRes.status).toBe(401);

    const getRes = await applicationsApp.request('/client-1');
    expect(getRes.status).toBe(401);

    const stepsRes = await applicationsApp.request('/steps/app-client-1');
    expect(stepsRes.status).toBe(401);
  });

  it("forbids a client from reading another user's application", async () => {
    const res = await applicationsApp.request('/client-1', { headers: asClient2 });
    expect(res.status).toBe(403);
  });

  it("forbids a client from saving progress on another user's application", async () => {
    const res = await applicationsApp.request('/save-progress', {
      method: 'POST',
      headers: asClient2,
      body: JSON.stringify({ userId: 'client-1', applicationData: { a: 1 } }),
    });
    expect(res.status).toBe(403);
  });

  it("forbids a client from submitting another user's application", async () => {
    const res = await applicationsApp.request('/submit', {
      method: 'POST',
      headers: asClient2,
      body: JSON.stringify({ userId: 'client-1' }),
    });
    expect(res.status).toBe(403);
  });

  it('forbids step access for an application owned by someone else', async () => {
    const saveStepRes = await applicationsApp.request('/step/2', {
      method: 'POST',
      headers: asClient2,
      body: JSON.stringify({
        applicationId: 'app-client-1',
        data: { a: 1 },
        completedBy: { type: 'client', userId: 'client-2' },
      }),
    });
    expect(saveStepRes.status).toBe(403);

    const getStepRes = await applicationsApp.request('/step/app-client-1/2', {
      headers: asClient2,
    });
    expect(getStepRes.status).toBe(403);

    const allStepsRes = await applicationsApp.request('/steps/app-client-1', {
      headers: asClient2,
    });
    expect(allStepsRes.status).toBe(403);
  });

  it('returns 404 for an unknown application id', async () => {
    const res = await applicationsApp.request('/steps/app-unknown', { headers: asAdmin });
    expect(res.status).toBe(404);
  });

  it('allows a client to manage their own application', async () => {
    const saveRes = await applicationsApp.request('/save-progress', {
      method: 'POST',
      headers: asClient1,
      body: JSON.stringify({ userId: 'client-1', applicationData: { a: 1 } }),
    });
    expect(saveRes.status).toBe(200);

    const getRes = await applicationsApp.request('/client-1', { headers: asClient1 });
    expect(getRes.status).toBe(200);

    const stepsRes = await applicationsApp.request('/steps/app-client-1', { headers: asClient1 });
    expect(stepsRes.status).toBe(200);
  });

  it('allows an admin to act on behalf of any user', async () => {
    const saveRes = await applicationsApp.request('/save-progress', {
      method: 'POST',
      headers: asAdmin,
      body: JSON.stringify({ userId: 'client-1', applicationData: { a: 1 } }),
    });
    expect(saveRes.status).toBe(200);

    const getRes = await applicationsApp.request('/client-1', { headers: asAdmin });
    expect(getRes.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /profile/update-status (SECURITY-AUDIT H-8)
// ─────────────────────────────────────────────────────────────────────────────
describe('update-status auth enforcement (H-8)', () => {
  const profileKey = 'user_profile:client-1:personal_info';

  beforeEach(() => {
    kvStore.set(profileKey, { accountStatus: 'in_progress', metadata: {} });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ userId: 'client-1', accountStatus: 'application_in_progress' }),
    });
    expect(res.status).toBe(401);
  });

  it("forbids a client from updating another user's status", async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asClient2,
      body: JSON.stringify({ userId: 'client-1', accountStatus: 'application_in_progress' }),
    });
    expect(res.status).toBe(403);
  });

  it('forbids a client from self-approving (privileged status)', async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asClient1,
      body: JSON.stringify({ userId: 'client-1', accountStatus: 'approved' }),
    });
    expect(res.status).toBe(403);
    // Profile must be untouched
    expect((kvStore.get(profileKey) as { accountStatus: string }).accountStatus).toBe(
      'in_progress',
    );
  });

  it('rejects an invalid accountType from a client', async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asClient1,
      body: JSON.stringify({
        userId: 'client-1',
        accountStatus: 'application_in_progress',
        accountType: 'super_admin',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('allows a client to set their own onboarding status', async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asClient1,
      body: JSON.stringify({
        userId: 'client-1',
        accountStatus: 'application_in_progress',
        accountType: 'personal',
      }),
    });
    expect(res.status).toBe(200);
    expect((kvStore.get(profileKey) as { accountStatus: string }).accountStatus).toBe(
      'application_in_progress',
    );
  });

  it('allows an admin to set a privileged status', async () => {
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asAdmin,
      body: JSON.stringify({ userId: 'client-1', accountStatus: 'approved' }),
    });
    expect(res.status).toBe(200);
    expect((kvStore.get(profileKey) as { accountStatus: string }).accountStatus).toBe('approved');
  });

  it('returns 404 when the profile does not exist', async () => {
    kvStore.clear();
    const res = await statusApp.request('/update-status', {
      method: 'POST',
      headers: asClient1,
      body: JSON.stringify({ userId: 'client-1', accountStatus: 'application_in_progress' }),
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// /auto-content/* (SECURITY-AUDIT H-10)
// ─────────────────────────────────────────────────────────────────────────────
describe('auto-content auth enforcement (H-10)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await autoContentApp.request('/configs');
    expect(res.status).toBe(401);
  });

  it('rejects non-admin users with 403', async () => {
    const res = await autoContentApp.request('/configs', { headers: asClient1 });
    expect(res.status).toBe(403);
  });

  it('allows admins', async () => {
    const res = await autoContentApp.request('/configs', { headers: asAdmin });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
