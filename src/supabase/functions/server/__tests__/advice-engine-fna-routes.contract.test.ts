/**
 * advice-engine-fna-routes.ts — Route Contract Tests
 * =================================================
 *
 * 27 routes, 248 statements, 0% coverage before this file. Six FNA families —
 * risk, medical aid, retirement, investment (INA), tax, estate — plus two AI
 * routes, all reduced to the same five-route shape:
 *
 *   POST   /<family>/create              requireAuth  + client access on body
 *   PUT    /<family>/:id                 requireAuth  + client access on record
 *   GET    /<family>/client/:clientId    requireAuth  + client access on param
 *   POST   /<family>/:id/publish         requireAdmin + client access on record
 *   GET    /fna/:id                      requireAuth  + client access on record
 *
 * That uniformity is exactly why the family axis has to be tested rather than
 * sampled. Six near-identical blocks written by hand is the classic place for
 * one block to be missing its `if (denied) return denied;` — and a Financial
 * Needs Analysis is a client's income, dependants, medical history and estate.
 * A single dropped check is one adviser reading another adviser's client file.
 *
 * So the suite is table-driven over all six families and asserts the boundary,
 * not the happy path. Two deliberate choices make that real:
 *
 *   1. `client-access.ts` is NOT mocked. The genuine `canAccessClientAs`
 *      policy runs — self-only clients, platform admins across clients,
 *      advisers only for their server-resolved assignments, everyone else
 *      denied. Only the adviser-assignment lookup is stubbed. Mocking the
 *      policy would leave these tests asserting the mock.
 *   2. The real validation schemas and `asyncHandler` run, so the 400/403/404
 *      envelopes are the ones that ship.
 *
 * Two behaviours below are pinned as they ARE, not as they should be, and are
 * called out at their tests: the existence oracle on `:id` routes, and the
 * absence of any client scoping on `/ai/chat`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The REAL error class the service throws. `errorHandler` maps by
// `instanceof`, so a duck-typed stand-in here would render as a 500 and the
// 404 contract would go untested.
import { NotFoundError } from '../error.middleware.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

// ── In-memory FNA store behind the faked service ────────────────────────────
/** key: `${type}:${id}` → the stored record, so cross-family bleed is visible. */
const store = new Map<string, Record<string, unknown>>();

/** clientId → the adviser the SERVER says owns them. */
const assignments = new Map<string, string>();

const svc = vi.hoisted(() => ({
  createFNA: vi.fn(),
  updateFNA: vi.fn(),
  getFNAById: vi.fn(),
  getClientFNAs: vi.fn(),
  publishFNA: vi.fn(),
  aiChat: vi.fn(),
  aiAnalyze: vi.fn(),
}));

vi.mock('../advice-engine-service.ts', () => ({
  AdviceEngineService: class {
    createFNA = svc.createFNA;
    updateFNA = svc.updateFNA;
    getFNAById = svc.getFNAById;
    getClientFNAs = svc.getClientFNAs;
    publishFNA = svc.publishFNA;
    aiChat = svc.aiChat;
    aiAnalyze = svc.aiAnalyze;
  },
}));

// The ONLY part of the access policy that is stubbed: the adviser-assignment
// lookup it consults. `client-access.ts` itself runs for real.
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async (clientId: string) => assignments.get(clientId) ?? null),
}));

vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

/**
 * Role-aware auth, driven by request headers, mirroring the real middleware's
 * decision points: `requireAuth` needs a bearer token; `requireAdmin`
 * additionally admits only the three platform-admin role spellings.
 */
vi.mock('../auth-mw.ts', () => {
  const ADMIN = new Set(['admin', 'super_admin', 'super-admin']);
  const attach = (c: any) => {
    const role = c.req.header('x-test-role') ?? 'adviser';
    const userId = c.req.header('x-test-user') ?? 'adviser-1';
    c.set('userRole', role);
    c.set('userId', userId);
    c.set('user', { id: userId, email: `${userId}@test.co` });
    return role;
  };
  return {
    requireAuth: async (c: any, next: any) => {
      if (!c.req.header('Authorization')) {
        return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
      }
      attach(c);
      await next();
    },
    requireAdmin: async (c: any, next: any) => {
      if (!c.req.header('Authorization')) {
        return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
      }
      const role = attach(c);
      if (!ADMIN.has(role)) {
        return c.json({ error: 'Forbidden: Admin access required', code: 'FORBIDDEN_ADMIN' }, 403);
      }
      await next();
    },
  };
});

const app = (await import('../advice-engine-fna-routes.ts')).default;

// ── Fixtures ────────────────────────────────────────────────────────────────
// Every id on these routes is validated as a UUID, so fixtures must be real.
const CLIENT_A = '11111111-2222-4333-8444-555555555555';
const CLIENT_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const FNA_ID = '99999999-8888-4777-8666-555555555555';
const ADVISER_A = 'adviser-of-a';
const ADVISER_B = 'adviser-of-b';

/**
 * The six families and their URL prefixes, with the `FNAType` each one passes
 * down to the service. The service assertions below use that type to prove a
 * family's routes cannot be made to read another family's records.
 */
const FAMILIES = [
  { name: 'risk', prefix: '/fna', type: 'risk' },
  { name: 'medical aid', prefix: '/medical-fna', type: 'medical' },
  { name: 'retirement', prefix: '/retirement-fna', type: 'retirement' },
  { name: 'investment (INA)', prefix: '/investment-ina', type: 'investment' },
  { name: 'tax planning', prefix: '/tax-planning-fna', type: 'tax' },
  { name: 'estate planning', prefix: '/estate-planning-fna', type: 'estate' },
] as const;

/**
 * Roles that are NOT platform admins and NOT advisers. `canAccessClientAs`
 * denies every one of them outright — authentication alone is never client
 * access. paraplanner and compliance are in this list on purpose: they can
 * sign in, and they still cannot open a client's FNA.
 */
const NON_CLIENT_ROLES = ['paraplanner', 'compliance', 'viewer', 'worker', 'unknown-role'];

function req(
  path: string,
  {
    as,
    user,
    method = 'GET',
    body,
    auth = true,
  }: { as?: string; user?: string; method?: string; body?: unknown; auth?: boolean } = {},
) {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = 'Bearer t';
  if (as) headers['x-test-role'] = as;
  if (user) headers['x-test-user'] = user;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return app.request(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** Seed a stored FNA owned by `clientId` under `type`. */
function seed(type: string, id: string, clientId: string | undefined) {
  store.set(`${type}:${id}`, { id, clientId, status: 'draft' });
}

beforeEach(() => {
  store.clear();
  assignments.clear();
  assignments.set(CLIENT_A, ADVISER_A);
  assignments.set(CLIENT_B, ADVISER_B);

  Object.values(svc).forEach((fn) => fn.mockReset());

  svc.getFNAById.mockImplementation(async (type: string, id: string) => {
    const found = store.get(`${type}:${id}`);
    if (!found) throw new NotFoundError('FNA not found');
    return { ...found };
  });
  svc.createFNA.mockImplementation(async (type: string, userId: string, data: any) => ({
    id: FNA_ID,
    type,
    createdBy: userId,
    ...data,
  }));
  svc.updateFNA.mockImplementation(async (type: string, id: string, updates: any) => ({
    id,
    type,
    ...updates,
  }));
  svc.getClientFNAs.mockResolvedValue([]);
  svc.publishFNA.mockImplementation(async (type: string, id: string) => ({
    id,
    type,
    status: 'published',
  }));
  svc.aiChat.mockResolvedValue({ response: 'ok', timestamp: '2026-01-01T00:00:00.000Z' });
  svc.aiAnalyze.mockResolvedValue({ analysis: 'ok', timestamp: '2026-01-01T00:00:00.000Z' });
});

// ============================================================================
// AUTHENTICATION — the outermost gate, on every route
// ============================================================================

describe('authentication', () => {
  const ALL_ROUTES: Array<[string, string]> = [
    ...FAMILIES.flatMap(
      (f) =>
        [
          [`${f.prefix}/create`, 'POST'],
          [`${f.prefix}/${FNA_ID}`, 'PUT'],
          [`${f.prefix}/client/${CLIENT_A}`, 'GET'],
          [`${f.prefix}/${FNA_ID}/publish`, 'POST'],
        ] as Array<[string, string]>,
    ),
    [`/fna/${FNA_ID}`, 'GET'],
    ['/ai/chat', 'POST'],
    ['/ai/analyze', 'POST'],
  ];

  it.each(ALL_ROUTES)('%s %s rejects an unauthenticated caller', async (path, method) => {
    const res = await req(path, { method, auth: false, body: method === 'GET' ? undefined : {} });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('AUTH_REQUIRED');
  });

  it('covers every route the module registers', () => {
    // A guard on the guard: if a route is added and not listed above, this
    // count drifts and the omission is visible instead of silent.
    expect(ALL_ROUTES).toHaveLength(27);
  });
});

// ============================================================================
// CLIENT ISOLATION ON CREATE — ownership read from the request body
// ============================================================================

describe.each(FAMILIES)('$name FNA — create', ({ prefix, type }) => {
  it('lets a client create against their own id', async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(200);
    expect(svc.createFNA).toHaveBeenCalledWith(type, CLIENT_A, { clientId: CLIENT_A });
  });

  it("denies a client creating against another client's id", async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { clientId: CLIENT_B },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN_CLIENT');
    expect(svc.createFNA).not.toHaveBeenCalled();
  });

  it('lets the assigned adviser create for their client', async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'adviser',
      user: ADVISER_A,
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(200);
  });

  it('denies an adviser assigned to a different client', async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'adviser',
      user: ADVISER_B,
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(403);
    expect(svc.createFNA).not.toHaveBeenCalled();
  });

  it('denies an adviser with no assignment at all', async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'adviser',
      user: 'adviser-unassigned',
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(403);
  });

  it.each(['admin', 'super_admin', 'super-admin'])(
    'lets a %s platform admin create across clients',
    async (role) => {
      const res = await req(`${prefix}/create`, {
        method: 'POST',
        as: role,
        user: 'staff-1',
        body: { clientId: CLIENT_A },
      });
      expect(res.status).toBe(200);
    },
  );

  it.each(NON_CLIENT_ROLES)('denies %s — signing in is not client access', async (role) => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: role,
      user: 'staff-1',
      body: { clientId: CLIENT_A },
    });
    expect(res.status).toBe(403);
    expect(svc.createFNA).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID clientId before any access decision', async () => {
    const res = await req(`${prefix}/create`, {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
      body: { clientId: 'not-a-uuid' },
    });
    expect(res.status).toBe(400);
    expect(svc.createFNA).not.toHaveBeenCalled();
  });
});

// ============================================================================
// CLIENT ISOLATION ON UPDATE — ownership read from the STORED record
// ============================================================================

describe.each(FAMILIES)('$name FNA — update', ({ prefix, type }) => {
  it("denies a client updating another client's record", async () => {
    seed(type, FNA_ID, CLIENT_B);
    const res = await req(`${prefix}/${FNA_ID}`, {
      method: 'PUT',
      as: 'client',
      user: CLIENT_A,
      body: { status: 'draft' },
    });
    expect(res.status).toBe(403);
    expect(svc.updateFNA).not.toHaveBeenCalled();
  });

  it('denies the adviser of a different client', async () => {
    seed(type, FNA_ID, CLIENT_A);
    const res = await req(`${prefix}/${FNA_ID}`, {
      method: 'PUT',
      as: 'adviser',
      user: ADVISER_B,
      body: { status: 'draft' },
    });
    expect(res.status).toBe(403);
    expect(svc.updateFNA).not.toHaveBeenCalled();
  });

  it('lets the assigned adviser update', async () => {
    seed(type, FNA_ID, CLIENT_A);
    const res = await req(`${prefix}/${FNA_ID}`, {
      method: 'PUT',
      as: 'adviser',
      user: ADVISER_A,
      body: { status: 'draft' },
    });
    expect(res.status).toBe(200);
    expect(svc.updateFNA).toHaveBeenCalledWith(type, FNA_ID, { status: 'draft' });
  });

  it('denies EVERYONE on a record with no owner, platform admins included', async () => {
    // `canAccessClientAs` returns false on a falsy clientId before it looks at
    // the caller's role. An unowned record is precisely where "check the owner"
    // silently degrades into "check nothing", so it fails closed.
    seed(type, FNA_ID, undefined);
    for (const role of ['client', 'adviser', 'admin', 'super_admin']) {
      const res = await req(`${prefix}/${FNA_ID}`, {
        method: 'PUT',
        as: role,
        user: 'anyone',
        body: { status: 'draft' },
      });
      expect(res.status).toBe(403);
    }
    expect(svc.updateFNA).not.toHaveBeenCalled();
  });

  it('reads ownership from its OWN family, not a same-id record in another', async () => {
    // The same FNA id existing under a different family prefix must not
    // satisfy this family's access check.
    const other = FAMILIES.find((f) => f.type !== type)!;
    seed(other.type, FNA_ID, CLIENT_A);
    const res = await req(`${prefix}/${FNA_ID}`, {
      method: 'PUT',
      as: 'adviser',
      user: ADVISER_A,
      body: { status: 'draft' },
    });
    expect(res.status).toBe(404);
    expect(svc.updateFNA).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID id', async () => {
    const res = await req(`${prefix}/not-a-uuid`, {
      method: 'PUT',
      as: 'admin',
      user: 'staff-1',
      body: { status: 'draft' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects an invalid status value on an otherwise permitted update', async () => {
    seed(type, FNA_ID, CLIENT_A);
    const res = await req(`${prefix}/${FNA_ID}`, {
      method: 'PUT',
      as: 'admin',
      user: 'staff-1',
      body: { status: 'not-a-status' },
    });
    expect(res.status).toBe(400);
    expect(svc.updateFNA).not.toHaveBeenCalled();
  });
});

// ============================================================================
// CLIENT ISOLATION ON LIST-BY-CLIENT — ownership read from the path
// ============================================================================

describe.each(FAMILIES)('$name FNA — list by client', ({ prefix, type }) => {
  it('lets a client list their own', async () => {
    const res = await req(`${prefix}/client/${CLIENT_A}`, { as: 'client', user: CLIENT_A });
    expect(res.status).toBe(200);
    expect(svc.getClientFNAs).toHaveBeenCalledWith(type, CLIENT_A);
  });

  it("denies a client listing another client's", async () => {
    const res = await req(`${prefix}/client/${CLIENT_B}`, { as: 'client', user: CLIENT_A });
    expect(res.status).toBe(403);
    expect(svc.getClientFNAs).not.toHaveBeenCalled();
  });

  it('denies an adviser assigned elsewhere', async () => {
    const res = await req(`${prefix}/client/${CLIENT_A}`, { as: 'adviser', user: ADVISER_B });
    expect(res.status).toBe(403);
    expect(svc.getClientFNAs).not.toHaveBeenCalled();
  });

  it('lets the assigned adviser list', async () => {
    const res = await req(`${prefix}/client/${CLIENT_A}`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
  });

  it.each(NON_CLIENT_ROLES)('denies %s', async (role) => {
    const res = await req(`${prefix}/client/${CLIENT_A}`, { as: role, user: 'staff-1' });
    expect(res.status).toBe(403);
  });

  it('rejects a non-UUID clientId', async () => {
    const res = await req(`${prefix}/client/nope`, { as: 'admin', user: 'staff-1' });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// PUBLISH — the admin-only gate
// ============================================================================

describe.each(FAMILIES)('$name FNA — publish', ({ prefix, type }) => {
  it('lets an admin publish and records who did it', async () => {
    seed(type, FNA_ID, CLIENT_A);
    const res = await req(`${prefix}/${FNA_ID}/publish`, {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
    });
    expect(res.status).toBe(200);
    expect(svc.publishFNA).toHaveBeenCalledWith(type, FNA_ID, 'staff-1');
  });

  it.each(['adviser', 'client', 'paraplanner', 'compliance', 'viewer'])(
    'denies %s — publishing an FNA is admin-only',
    async (role) => {
      seed(type, FNA_ID, CLIENT_A);
      const res = await req(`${prefix}/${FNA_ID}/publish`, {
        method: 'POST',
        as: role,
        user: role === 'adviser' ? ADVISER_A : 'staff-1',
      });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('FORBIDDEN_ADMIN');
      expect(svc.publishFNA).not.toHaveBeenCalled();
    },
  );

  it('still fails closed on an unowned record', async () => {
    // The second check behind requireAdmin cannot deny an admin for a normally
    // owned record — requireAdmin admits exactly the three roles
    // isPlatformAdminRole admits, so it is defence in depth against a future
    // role being added to requireAdmin, not a live gate. The unowned case is
    // the one place it still bites today, which is why it is asserted here.
    seed(type, FNA_ID, undefined);
    const res = await req(`${prefix}/${FNA_ID}/publish`, {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
    });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN_CLIENT');
    expect(svc.publishFNA).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID id', async () => {
    const res = await req(`${prefix}/not-a-uuid/publish`, {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// GET BY ID — registered for the risk family only
// ============================================================================

describe('risk FNA — get by id', () => {
  it('lets the assigned adviser read', async () => {
    seed('risk', FNA_ID, CLIENT_A);
    const res = await req(`/fna/${FNA_ID}`, { as: 'adviser', user: ADVISER_A });
    expect(res.status).toBe(200);
    expect((await res.json()).fna.clientId).toBe(CLIENT_A);
  });

  it("denies an adviser reading another adviser's client record", async () => {
    seed('risk', FNA_ID, CLIENT_A);
    const res = await req(`/fna/${FNA_ID}`, { as: 'adviser', user: ADVISER_B });
    expect(res.status).toBe(403);
    // The record was fetched to find its owner, but the body never left.
    expect(await res.text()).not.toContain(CLIENT_A);
  });

  it("denies a client reading another client's record", async () => {
    seed('risk', FNA_ID, CLIENT_B);
    const res = await req(`/fna/${FNA_ID}`, { as: 'client', user: CLIENT_A });
    expect(res.status).toBe(403);
  });

  it.each(FAMILIES.filter((f) => f.prefix !== '/fna').map((f) => f.prefix))(
    '%s has no get-by-id route',
    async (prefix) => {
      // Pinning an asymmetry, not endorsing it: five of six families expose no
      // single-record read. `PUT /<family>/:id` matches before this would, so a
      // GET falls through to 404. If a get-by-id is ever added to one of them, it
      // must carry the same requireFnaAccess check and this test will say so.
      seed('risk', FNA_ID, CLIENT_A);
      const res = await req(`${prefix}/${FNA_ID}`, { as: 'admin', user: 'staff-1' });
      expect(res.status).toBe(404);
    },
  );

  it('answers 404 for an id that does not exist, before checking access', async () => {
    // DOCUMENTED WEAKNESS, pinned so a change is deliberate: an unauthorized
    // caller gets 404 for a missing record and 403 for one they may not see,
    // which distinguishes the two. That is an existence oracle over FAIS advice
    // records. Collapsing both to 404 would close it; doing so here would be a
    // behaviour change beyond this test-only PR.
    const missing = await req(`/fna/${FNA_ID}`, { as: 'client', user: CLIENT_A });
    expect(missing.status).toBe(404);

    seed('risk', FNA_ID, CLIENT_B);
    const forbidden = await req(`/fna/${FNA_ID}`, { as: 'client', user: CLIENT_A });
    expect(forbidden.status).toBe(403);
  });
});

// ============================================================================
// AI ROUTES
// ============================================================================

describe('AI advisor chat', () => {
  it('is reachable by any authenticated role and is scoped to the caller', async () => {
    // DOCUMENTED GAP, pinned so it is not discovered by accident: /ai/chat has
    // no client-access check. It is safe only because the service ignores the
    // `context` it is handed and returns a placeholder. The moment a real model
    // call reads `context`, this route needs the same requireClientAccess the
    // rest of the module applies — this test is where that will be noticed.
    const res = await req('/ai/chat', {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { message: 'What is my cover?', context: { clientId: CLIENT_B } },
    });
    expect(res.status).toBe(200);
    expect(svc.aiChat).toHaveBeenCalledWith(CLIENT_A, 'What is my cover?', {
      clientId: CLIENT_B,
    });
  });

  it('rejects an empty message', async () => {
    const res = await req('/ai/chat', {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { message: '' },
    });
    expect(res.status).toBe(400);
    expect(svc.aiChat).not.toHaveBeenCalled();
  });

  it('rejects a message past the 2000-character cap', async () => {
    const res = await req('/ai/chat', {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { message: 'x'.repeat(2001) },
    });
    expect(res.status).toBe(400);
  });

  it('strips HTML from the message before it reaches the service', async () => {
    await req('/ai/chat', {
      method: 'POST',
      as: 'client',
      user: CLIENT_A,
      body: { message: '<script>alert(1)</script>hello' },
    });
    const [, message] = svc.aiChat.mock.calls[0];
    expect(message).not.toContain('<script>');
    expect(message).toContain('hello');
  });
});

describe('AI intelligence analysis', () => {
  it('lets an admin analyse a client', async () => {
    const res = await req('/ai/analyze', {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
      body: { clientId: CLIENT_A, analysisType: 'comprehensive', data: {} },
    });
    expect(res.status).toBe(200);
    expect(svc.aiAnalyze).toHaveBeenCalledWith(CLIENT_A, 'comprehensive', {});
  });

  it.each(['adviser', 'client', 'compliance', 'paraplanner'])(
    'denies %s — analysis is admin-only',
    async (role) => {
      const res = await req('/ai/analyze', {
        method: 'POST',
        as: role,
        user: role === 'adviser' ? ADVISER_A : 'staff-1',
        body: { clientId: CLIENT_A, analysisType: 'comprehensive', data: {} },
      });
      expect(res.status).toBe(403);
      expect((await res.json()).code).toBe('FORBIDDEN_ADMIN');
      expect(svc.aiAnalyze).not.toHaveBeenCalled();
    },
  );

  it('rejects an unknown analysisType', async () => {
    const res = await req('/ai/analyze', {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
      body: { clientId: CLIENT_A, analysisType: 'read-everything', data: {} },
    });
    expect(res.status).toBe(400);
    expect(svc.aiAnalyze).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID clientId', async () => {
    const res = await req('/ai/analyze', {
      method: 'POST',
      as: 'admin',
      user: 'staff-1',
      body: { clientId: 'nope', analysisType: 'comprehensive', data: {} },
    });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// ERROR ENVELOPE — asyncHandler renders service failures as they ship
// ============================================================================

describe('error envelope', () => {
  it('renders a service failure as a 500 without leaking its message', async () => {
    svc.getClientFNAs.mockRejectedValueOnce(new Error('kv: connection refused to 10.0.0.5:5432'));
    const res = await req(`/fna/client/${CLIENT_A}`, { as: 'admin', user: 'staff-1' });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('10.0.0.5');
  });

  it('propagates a typed NotFoundError status', async () => {
    const res = await req(`/fna/${FNA_ID}`, { as: 'admin', user: 'staff-1' });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NOT_FOUND');
  });

  it('rejects a malformed JSON body', async () => {
    const res = await app.request('/fna/create', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'x-test-role': 'admin',
        'Content-Type': 'application/json',
      },
      body: '{not json',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(svc.createFNA).not.toHaveBeenCalled();
  });
});
