/**
 * advice-engine-roa-routes.ts — Route Contract Tests
 * =================================================
 *
 * Record of Advice: 24 routes, 286 statements, and 0% coverage before this
 * file. It is the highest-value uncovered surface in the edge function, for a
 * reason that is not about the statement count: RoA drafts are FAIS advice
 * records tied to a named client, and the module carries a four-predicate
 * authorization matrix that decides who may read them.
 *
 *   canUseRoA              super_admin, admin, adviser, paraplanner, compliance
 *   canManageRoAContracts  super_admin only
 *   canReviewAllRoADrafts  super_admin, admin, compliance
 *   canAccessRoADraft      a reviewer, or the draft's own adviser/creator/updater
 *
 * A mistake in any of those is one adviser reading another adviser's client
 * advice. So these tests are written to pin the BOUNDARY, not to walk the happy
 * path — the auth mock is role-aware (driven by request headers) so each case
 * asserts what a specific role can and cannot reach. Asserting only 200s here
 * would raise the coverage number while checking nothing that matters.
 *
 * `asyncHandler` and the real validation schema are used rather than stubbed, so
 * the error envelope and param validation are exercised as they ship.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

// ── In-memory draft store, shared by the fake service ───────────────────────
const drafts = new Map<string, Record<string, unknown>>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const svc = vi.hoisted(() => ({
  listDrafts: vi.fn(),
  getDraft: vi.fn(),
  saveDraft: vi.fn(),
  deleteDraft: vi.fn(),
  submitDraft: vi.fn(),
  validateDraft: vi.fn(),
  compileDraft: vi.fn(),
  finaliseDraft: vi.fn(),
  generateDocuments: vi.fn(),
  getGeneratedDocument: vi.fn(),
  cloneDraftFromFinal: vi.fn(),
  uploadEvidence: vi.fn(),
  listClientFiles: vi.fn(),
  listContracts: vi.fn(),
  getContract: vi.fn(),
  saveContract: vi.fn(),
  publishContract: vi.fn(),
  archiveContract: vi.fn(),
  getSchemaFormat: vi.fn(),
  listLegacyModules: vi.fn(),
  startConversations: vi.fn(),
  getConversation: vi.fn(),
  getProgress: vi.fn(),
  sendMessage: vi.fn(),
  saveNarrative: vi.fn(),
  complete: vi.fn(),
  uploadFile: vi.fn(),
  buildClientContext: vi.fn(),
}));

vi.mock('../advice-engine-roa-service.ts', () => ({
  AdviceEngineRoAService: class {
    listDrafts = svc.listDrafts;
    getDraft = svc.getDraft;
    saveDraft = svc.saveDraft;
    deleteDraft = svc.deleteDraft;
    submitDraft = svc.submitDraft;
    validateDraft = svc.validateDraft;
    compileDraft = svc.compileDraft;
    finaliseDraft = svc.finaliseDraft;
    generateDocuments = svc.generateDocuments;
    getGeneratedDocument = svc.getGeneratedDocument;
    cloneDraftFromFinal = svc.cloneDraftFromFinal;
    uploadEvidence = svc.uploadEvidence;
    listClientFiles = svc.listClientFiles;
  },
}));

vi.mock('../advice-engine-roa-contract-service.ts', () => ({
  AdviceEngineRoAContractService: class {
    listContracts = svc.listContracts;
    getContract = svc.getContract;
    saveContract = svc.saveContract;
    publishContract = svc.publishContract;
    archiveContract = svc.archiveContract;
    getSchemaFormat = svc.getSchemaFormat;
    listLegacyModules = svc.listLegacyModules;
  },
}));

vi.mock('../advice-engine-roa-conversation.ts', () => ({
  AdviceEngineRoAConversationService: class {
    startConversations = svc.startConversations;
    getConversation = svc.getConversation;
    getProgress = svc.getProgress;
    sendMessage = svc.sendMessage;
    saveNarrative = svc.saveNarrative;
    complete = svc.complete;
    uploadFile = svc.uploadFile;
  },
  sanitiseConversationRecord: (r: unknown) => r,
}));

vi.mock('../advice-engine-roa-service-helpers.ts', () => ({
  buildClientContext: svc.buildClientContext,
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

// Runtime issue reporting writes to KV from the real error middleware.
vi.mock('../quality-issues-runtime-server.ts', () => ({ scheduleRuntimeServerIssue: vi.fn() }));

/**
 * Role-aware auth. Driven by headers so a single mount can be exercised as any
 * role — the point of the file. A header-only mock that always returned one
 * role would make every authz assertion below vacuous.
 */
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }
    const role = c.req.header('x-test-role') ?? 'adviser';
    const userId = c.req.header('x-test-user') ?? 'adviser-1';
    c.set('userRole', role);
    c.set('userId', userId);
    c.set('user', { id: userId, email: `${userId}@test.co` });
    await next();
  },
}));

const app = (await import('../advice-engine-roa-routes.ts')).default;

/** Request helper: `as` sets the acting role and user. */
function req(
  path: string,
  {
    as,
    user,
    method = 'GET',
    body,
    auth = true,
  }: {
    as?: string;
    user?: string;
    method?: string;
    body?: unknown;
    auth?: boolean;
  } = {},
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

const ADVICE_ROLES = ['super_admin', 'admin', 'adviser', 'paraplanner', 'compliance'];
const NON_ADVICE_ROLES = ['client', 'worker', 'supplier', 'contractor', 'unknown-role'];
const REVIEWER_ROLES = ['super_admin', 'admin', 'compliance'];

/** clientId is validated as a UUID, so fixtures must be real ones. */
const CLIENT_ID = '11111111-2222-4333-8444-555555555555';

beforeEach(() => {
  drafts.clear();
  Object.values(svc).forEach((fn) => fn.mockReset());
  svc.listDrafts.mockResolvedValue([]);
  svc.listClientFiles.mockResolvedValue([]);
  svc.listContracts.mockResolvedValue([]);
  svc.buildClientContext.mockResolvedValue({ clientId: CLIENT_ID });
  svc.getDraft.mockImplementation(async (id: string) => clone(drafts.get(id) ?? null));
});

describe('authentication', () => {
  it.each([
    ['/roa/drafts', 'GET'],
    ['/roa/modules', 'GET'],
    ['/roa/module-contracts', 'GET'],
    [`/roa/client/${CLIENT_ID}/context`, 'GET'],
    [`/roa/client/${CLIENT_ID}/files`, 'GET'],
  ])('%s %s requires an Authorization header', async (path, method) => {
    const res = await req(path, { method, auth: false });
    expect(res.status).toBe(401);
  });
});

describe('canUseRoA — who may touch advice records at all', () => {
  it.each(ADVICE_ROLES)('%s is admitted', async (role) => {
    const res = await req('/roa/drafts', { as: role });
    expect(res.status).toBe(200);
  });

  it.each(NON_ADVICE_ROLES)('%s is refused with FORBIDDEN_ADVICE', async (role) => {
    const res = await req('/roa/drafts', { as: role });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN_ADVICE' });
  });

  it('refuses a non-advice role on the client context route too', async () => {
    const res = await req(`/roa/client/${CLIENT_ID}/context`, { as: 'client' });
    expect(res.status).toBe(403);
  });
});

describe('draft listing is scoped to the acting adviser', () => {
  // The security property: a non-reviewer cannot widen their own scope by
  // passing ?adviserId. The route overrides the query param with their userId.
  it('forces a non-reviewer to their own userId even when they ask for another', async () => {
    const res = await req('/roa/drafts?adviserId=someone-else', {
      as: 'adviser',
      user: 'adviser-1',
    });

    expect(res.status).toBe(200);
    expect(svc.listDrafts).toHaveBeenCalledWith(
      expect.objectContaining({ adviserId: 'adviser-1' }),
    );
  });

  it.each(['paraplanner', 'adviser'])('%s cannot widen scope', async (role) => {
    await req('/roa/drafts?adviserId=victim', { as: role, user: 'me' });
    expect(svc.listDrafts).toHaveBeenCalledWith(expect.objectContaining({ adviserId: 'me' }));
  });

  it.each(REVIEWER_ROLES)('%s may query another adviser explicitly', async (role) => {
    await req('/roa/drafts?adviserId=adviser-9', { as: role, user: 'reviewer-1' });
    expect(svc.listDrafts).toHaveBeenCalledWith(
      expect.objectContaining({ adviserId: 'adviser-9' }),
    );
  });

  it('passes status and clientId filters through', async () => {
    await req(`/roa/drafts?status=submitted&clientId=${CLIENT_ID}`, { as: 'admin' });
    expect(svc.listDrafts).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'submitted', clientId: CLIENT_ID }),
    );
  });
});

describe('canAccessRoADraft — one adviser must not read another’s record', () => {
  beforeEach(() => {
    drafts.set('d-mine', { id: 'd-mine', adviserId: 'adviser-1' });
    drafts.set('d-theirs', { id: 'd-theirs', adviserId: 'adviser-2' });
    drafts.set('d-created', { id: 'd-created', createdBy: 'adviser-1' });
    drafts.set('d-updated', { id: 'd-updated', updatedBy: 'adviser-1' });
  });

  it('allows the owning adviser', async () => {
    const res = await req('/roa/drafts/d-mine', { as: 'adviser', user: 'adviser-1' });
    expect(res.status).toBe(200);
  });

  it.each(['d-created', 'd-updated'])('allows via %s attribution', async (id) => {
    const res = await req(`/roa/drafts/${id}`, { as: 'adviser', user: 'adviser-1' });
    expect(res.status).toBe(200);
  });

  it('refuses another adviser’s draft with FORBIDDEN_ROA_DRAFT', async () => {
    const res = await req('/roa/drafts/d-theirs', { as: 'adviser', user: 'adviser-1' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN_ROA_DRAFT' });
  });

  it.each(REVIEWER_ROLES)('%s may read any adviser’s draft', async (role) => {
    const res = await req('/roa/drafts/d-theirs', { as: role, user: 'reviewer-1' });
    expect(res.status).toBe(200);
  });

  it('refuses a paraplanner another adviser’s draft (advice role, not reviewer)', async () => {
    const res = await req('/roa/drafts/d-theirs', { as: 'paraplanner', user: 'pp-1' });
    expect(res.status).toBe(403);
  });
});

describe('canManageRoAContracts — module contracts are super-admin only', () => {
  beforeEach(() => {
    svc.saveContract.mockResolvedValue({ moduleId: 'm1' });
    svc.publishContract.mockResolvedValue({ moduleId: 'm1', status: 'published' });
    svc.archiveContract.mockResolvedValue({ moduleId: 'm1', status: 'archived' });
    svc.getContract.mockResolvedValue({ moduleId: 'm1' });
    svc.getSchemaFormat.mockReturnValue({ format: 'v1' });
  });

  it('lets super_admin write a contract', async () => {
    const res = await req('/roa/module-contracts', {
      as: 'super_admin',
      method: 'POST',
      body: { moduleId: 'm1' },
    });
    expect(res.status).toBe(200);
  });

  it.each(['admin', 'compliance', 'adviser', 'paraplanner'])(
    '%s may NOT write a contract even though it may use RoA',
    async (role) => {
      const res = await req('/roa/module-contracts', {
        as: role,
        method: 'POST',
        body: { moduleId: 'm1' },
      });
      expect(res.status).toBe(403);
    },
  );

  it.each(['admin', 'adviser'])('%s may NOT publish a contract', async (role) => {
    const res = await req('/roa/module-contracts/m1/publish', { as: role, method: 'POST' });
    expect(res.status).toBe(403);
  });

  it.each(['admin', 'adviser'])('%s may NOT archive a contract', async (role) => {
    const res = await req('/roa/module-contracts/m1/archive', { as: role, method: 'POST' });
    expect(res.status).toBe(403);
  });

  it('lets any advice role READ contracts', async () => {
    const res = await req('/roa/module-contracts', { as: 'adviser' });
    expect(res.status).toBe(200);
  });
});

describe('draft lifecycle routes reach the service', () => {
  beforeEach(() => {
    drafts.set('d1', { id: 'd1', adviserId: 'adviser-1' });
    svc.saveDraft.mockResolvedValue({ id: 'd1' });
    svc.submitDraft.mockResolvedValue({ id: 'd1', status: 'submitted' });
    svc.validateDraft.mockResolvedValue({ valid: true, issues: [] });
    svc.compileDraft.mockResolvedValue({ compiled: true });
    svc.deleteDraft.mockResolvedValue(undefined);
  });

  it('POST /roa/drafts stamps the acting user as adviserId', async () => {
    const res = await req('/roa/drafts', {
      as: 'adviser',
      user: 'adviser-7',
      method: 'POST',
      body: { clientId: CLIENT_ID },
    });

    expect(res.status).toBe(200);
    // The route must not let a caller claim a different adviserId in the body.
    expect(svc.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ adviserId: 'adviser-7' }),
      expect.objectContaining({ id: 'adviser-7' }),
    );
  });

  it('POST /roa/drafts overrides an adviserId supplied in the body', async () => {
    await req('/roa/drafts', {
      as: 'adviser',
      user: 'adviser-7',
      method: 'POST',
      body: { clientId: CLIENT_ID, adviserId: 'someone-else' },
    });

    expect(svc.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ adviserId: 'adviser-7' }),
      expect.anything(),
    );
  });

  it('POST /roa/drafts/:id/submit reaches the service for the owner', async () => {
    const res = await req('/roa/drafts/d1/submit', {
      as: 'adviser',
      user: 'adviser-1',
      method: 'POST',
      body: {},
    });
    expect(res.status).toBe(200);
  });

  it('POST /roa/drafts/:id/validate reaches the service for the owner', async () => {
    const res = await req('/roa/drafts/d1/validate', {
      as: 'adviser',
      user: 'adviser-1',
      method: 'POST',
      body: {},
    });
    expect(res.status).toBe(200);
  });

  it('refuses submit on a draft the caller does not own', async () => {
    drafts.set('d-other', { id: 'd-other', adviserId: 'adviser-9' });
    const res = await req('/roa/drafts/d-other/submit', {
      as: 'adviser',
      user: 'adviser-1',
      method: 'POST',
      body: {},
    });
    expect(res.status).toBe(403);
  });
});

describe('client context and files', () => {
  it('GET /roa/client/:clientId/context builds context for an advice role', async () => {
    const res = await req(`/roa/client/${CLIENT_ID}/context`, { as: 'adviser' });
    expect(res.status).toBe(200);
    expect(svc.buildClientContext).toHaveBeenCalled();
  });

  it('GET /roa/client/:clientId/files lists files for an advice role', async () => {
    const res = await req(`/roa/client/${CLIENT_ID}/files`, { as: 'adviser' });
    expect(res.status).toBe(200);
    expect(svc.listClientFiles).toHaveBeenCalledWith(CLIENT_ID);
  });
});

describe('module listing', () => {
  it('GET /roa/modules returns legacy modules for an advice role', async () => {
    svc.listLegacyModules.mockResolvedValue([{ id: 'legacy-1' }]);
    const res = await req('/roa/modules', { as: 'adviser' });
    expect(res.status).toBe(200);
  });

  it('GET /roa/module-contracts/schema returns the schema format', async () => {
    svc.getSchemaFormat.mockReturnValue({ format: 'v1' });
    const res = await req('/roa/module-contracts/schema', { as: 'adviser' });
    expect(res.status).toBe(200);
  });
});
