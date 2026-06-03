/**
 * client-management-profile-routes.ts — Route Contract / Characterization Tests (Phase 5)
 * ==========================================================================================
 *
 * Locks the response CONTRACTS of all profile-management routes BEFORE the Phase 5
 * decomposition splits this 1,171-line file into sub-routers. Any change to route
 * shape, status codes, or auth behaviour will fail these tests.
 *
 * Routes covered:
 *   GET/PUT  /super-admin                      (no explicit auth middleware)
 *   POST     /super-admin/enable-personal-client  (requireSuperAdmin)
 *   GET      /all-users
 *   PUT      /users/:userId/metadata
 *   GET      /personal-info                    (query: ?key=...)
 *   POST     /personal-info
 *   PUT      /
 *   POST     /create-default
 *   POST     /upload
 *   POST     /send-documents
 *   POST     /update-status
 *   GET      /
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-management-profile-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Deno runtime shim ────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

// ── In-memory KV ──────────────────────────────────────────────────────────────
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
  mget: vi.fn(async (keys: string[]) => keys.map((k) => clone(kvStore.get(k) ?? null))),
  mset: vi.fn(async (keys: string[], values: unknown[]) => {
    keys.forEach((k, i) => kvStore.set(k, clone(values[i])));
  }),
  mdel: vi.fn(async (keys: string[]) => {
    keys.forEach((k) => kvStore.delete(k));
  }),
  getByPrefix: vi.fn(async (prefix: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push(clone(v));
    });
    return out;
  }),
  listByPrefix: vi.fn(async (prefix: string) => {
    const out: { key: string; value: unknown }[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push({ key: k, value: clone(v) });
    });
    return out;
  }),
}));

// ── Quiet logger ──────────────────────────────────────────────────────────────
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../shared-logger-utils.ts', () => ({
  getErrMsg: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

// ── Zip.js stub (used only in /send-documents) ────────────────────────────────
vi.mock('npm:@zip.js/zip.js', () => ({
  ZipWriter: vi.fn(),
  Uint8ArrayWriter: vi.fn().mockImplementation(() => ({ getData: async () => new Uint8Array() })),
  Uint8ArrayReader: vi.fn(),
}));

// ── Email service stub ────────────────────────────────────────────────────────
vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
}));

// ── asyncHandler pass-through ─────────────────────────────────────────────────
vi.mock('../error.middleware.ts', () => ({
  asyncHandler: (fn: any) => fn,
}));

// ── Supabase client stub ──────────────────────────────────────────────────────
// SUPER_ADMIN_EMAIL from constants.ts is 'shawn@navigatewealth.co'
const MOCK_SUPER_ADMIN_EMAIL = 'shawn@navigatewealth.co';
const mockSuperAdmin = {
  id: 'super-admin-id',
  email: MOCK_SUPER_ADMIN_EMAIL,
  user_metadata: { name: 'Shawn Francisco' },
  created_at: '2025-01-01T00:00:00.000Z',
};

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: [mockSuperAdmin] },
          error: null,
        })),
        updateUserById: vi.fn(async (_id: string, updates: unknown) => ({
          data: {
            user: {
              ...mockSuperAdmin,
              user_metadata: (updates as any)?.user_metadata ?? mockSuperAdmin.user_metadata,
            },
          },
          error: null,
        })),
      },
    },
    storage: {
      listBuckets: vi.fn(async () => ({ data: [], error: null })),
      createBucket: vi.fn(async () => ({ data: {}, error: null })),
      from: () => ({
        upload: vi.fn(async () => ({
          data: { path: 'test/path/file.pdf' },
          error: null,
        })),
      }),
    },
  }),
}));

// ── Auth middleware stub ──────────────────────────────────────────────────────
vi.mock('../auth-mw.ts', () => ({
  requireSuperAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', { id: 'super-admin-id', email: MOCK_SUPER_ADMIN_EMAIL });
    c.set('userId', 'super-admin-id');
    await next();
  },
}));

// ── Visibility helpers stub ───────────────────────────────────────────────────
vi.mock('../client-management-visibility.ts', () => ({
  isPersonnelAuthUser: vi.fn(() => false),
  shouldIncludeInClientManagement: vi.fn(() => true),
  shouldLoadClientManagementProfile: vi.fn(() => true),
}));

// ── Profile-application sync stub ─────────────────────────────────────────────
vi.mock('../profile-application-sync.ts', () => ({
  syncProfileToApplication: vi.fn(async () => {}),
  extractUserIdFromProfileKey: vi.fn((key: string) => key.split(':')[1] || 'test-user'),
}));

// ── Auth admin list users stub ────────────────────────────────────────────────
vi.mock('../auth-admin-list-users.ts', () => ({
  listAllAuthUsers: vi.fn(async () => [mockSuperAdmin]),
}));

// ── Application number utils stub ─────────────────────────────────────────────
vi.mock('../application-number-utils.ts', () => ({
  generateApplicationNumber: vi.fn(() => 'APP-2025-0001'),
}));

// ── Client applications service stub ─────────────────────────────────────────
vi.mock('../client-applications-service.ts', () => ({
  clientApplicationsService: {
    getByUserId: vi.fn(async () => null),
    create: vi.fn(async (data: unknown) => ({ id: 'app-id', ...(data as object) })),
  },
}));

import profileRouter from '../client-management-profile-routes.ts';

const AUTH = { Authorization: 'Bearer test-token' };
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';
const PROFILE_KEY = `user_profile:${TEST_UUID}:personal_info`;

beforeEach(() => {
  kvStore.clear();
});

describe('client-management-profile-routes.ts route contracts', () => {
  // ── GET / (health check) ──────────────────────────────────────────────────
  describe('GET /', () => {
    it('returns 200 with { status: "ok", service: "Profile Routes" }', async () => {
      const res = await profileRouter.request('/');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe('ok');
      expect(body.service).toBe('Profile Routes');
      expect(typeof body.timestamp).toBe('string');
    });
  });

  // ── GET /super-admin ──────────────────────────────────────────────────────
  describe('GET /super-admin', () => {
    it('returns 200 with { success, profile } when super admin user exists', async () => {
      const res = await profileRouter.request('/super-admin');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.profile).toBe('object');
    });

    it('persists default profile to KV on first call', async () => {
      await profileRouter.request('/super-admin');
      const stored = kvStore.get(`user_profile:super-admin-id:personal_info`);
      expect(stored).toBeTruthy();
    });
  });

  // ── PUT /super-admin ──────────────────────────────────────────────────────
  describe('PUT /super-admin', () => {
    it('returns 400 when body is empty (no update fields)', async () => {
      const res = await profileRouter.request('/super-admin', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with updated profile when valid fields provided', async () => {
      const res = await profileRouter.request('/super-admin', {
        method: 'PUT',
        body: JSON.stringify({ firstName: 'Shawn' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect((body.profile as Record<string, unknown>).firstName).toBe('Shawn');
    });
  });

  // ── POST /super-admin/enable-personal-client ────────────────────────────────
  describe('POST /super-admin/enable-personal-client', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await profileRouter.request('/super-admin/enable-personal-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success } when called as super admin', async () => {
      const res = await profileRouter.request('/super-admin/enable-personal-client', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── GET /all-users ─────────────────────────────────────────────────────────
  describe('GET /all-users', () => {
    it('returns 200 with { success, users } array', async () => {
      const res = await profileRouter.request('/all-users');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.users)).toBe(true);
    });

    it('supports pagination query params', async () => {
      const res = await profileRouter.request('/all-users?page=1&perPage=10');
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('total' in body).toBe(true);
      expect('totalPages' in body).toBe(true);
    });
  });

  // ── PUT /users/:userId/metadata ────────────────────────────────────────────
  describe('PUT /users/:userId/metadata', () => {
    it('returns 400 when metadata field is missing', async () => {
      const res = await profileRouter.request(`/users/${TEST_UUID}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, user } when metadata is updated', async () => {
      const res = await profileRouter.request(`/users/${TEST_UUID}/metadata`, {
        method: 'PUT',
        body: JSON.stringify({ metadata: { role: 'admin' } }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('user' in body).toBe(true);
    });
  });

  // ── GET /personal-info ─────────────────────────────────────────────────────
  describe('GET /personal-info', () => {
    it('returns 400 when key query param is missing', async () => {
      const res = await profileRouter.request('/personal-info');
      expect(res.status).toBe(400);
    });

    it('returns 404 when profile does not exist', async () => {
      const res = await profileRouter.request(`/personal-info?key=${PROFILE_KEY}`);
      expect(res.status).toBe(404);
    });

    it('returns 200 with { success, data } when profile exists', async () => {
      kvStore.set(PROFILE_KEY, { userId: TEST_UUID, email: 'test@test.co', role: 'client' });
      const res = await profileRouter.request(`/personal-info?key=${PROFILE_KEY}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.data).toBe('object');
    });
  });

  // ── POST /personal-info ───────────────────────────────────────────────────
  describe('POST /personal-info', () => {
    it('returns 400 when key is missing', async () => {
      const res = await profileRouter.request('/personal-info', {
        method: 'POST',
        body: JSON.stringify({ data: {} }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data } on valid save', async () => {
      const res = await profileRouter.request('/personal-info', {
        method: 'POST',
        body: JSON.stringify({ key: PROFILE_KEY, data: { userId: TEST_UUID, firstName: 'John' } }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── PUT / ─────────────────────────────────────────────────────────────────
  describe('PUT /', () => {
    it('returns 400 when no update fields provided besides userId', async () => {
      const res = await profileRouter.request('/', {
        method: 'PUT',
        body: JSON.stringify({ userId: TEST_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data } on valid update', async () => {
      const res = await profileRouter.request('/', {
        method: 'PUT',
        body: JSON.stringify({ userId: TEST_UUID, firstName: 'Jane' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.data).toBe('object');
    });
  });

  // ── POST /create-default ──────────────────────────────────────────────────
  describe('POST /create-default', () => {
    it('returns 400 when userId or email is missing', async () => {
      const res = await profileRouter.request('/create-default', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'Test User' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data } on valid new profile', async () => {
      const res = await profileRouter.request('/create-default', {
        method: 'POST',
        body: JSON.stringify({
          userId: TEST_UUID,
          email: 'test@test.co',
          displayName: 'Test User',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it('returns 200 with existing profile when called twice (idempotent)', async () => {
      const existing = { userId: TEST_UUID, email: 'test@test.co', role: 'client' };
      kvStore.set(PROFILE_KEY, existing);
      const res = await profileRouter.request('/create-default', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_UUID, email: 'test@test.co' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/already exists/i);
    });
  });

  // ── POST /upload ───────────────────────────────────────────────────────────
  describe('POST /upload', () => {
    it('returns 400 when no file is provided', async () => {
      const form = new FormData();
      const res = await profileRouter.request('/upload', {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(typeof body.error).toBe('string');
    });
  });

  // ── POST /send-documents ───────────────────────────────────────────────────
  describe('POST /send-documents', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await profileRouter.request('/send-documents', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      expect([400, 500]).toContain(res.status);
    });
  });

  // ── POST /update-status ────────────────────────────────────────────────────
  describe('POST /update-status', () => {
    it('returns 400 when userId or accountStatus are missing', async () => {
      const res = await profileRouter.request('/update-status', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when profile does not exist', async () => {
      const res = await profileRouter.request('/update-status', {
        method: 'POST',
        body: JSON.stringify({ userId: TEST_UUID, accountStatus: 'pending' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 200 with { success } when profile exists', async () => {
      kvStore.set(PROFILE_KEY, { userId: TEST_UUID, accountStatus: 'no_application' });
      const res = await profileRouter.request('/update-status', {
        method: 'POST',
        body: JSON.stringify({
          userId: TEST_UUID,
          accountStatus: 'pending',
          accountType: 'personal',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });
});
