/**
 * advice-engine-routes.ts — Route Contract / Characterization Tests (Phase 5)
 * ============================================================================
 *
 * Locks the HTTP-level contracts of advice-engine-routes.ts BEFORE the Phase 5
 * decomposition splits the 1,210-line file into mounted sub-apps. Mounts the
 * real Hono app and asserts: that auth-guarded routes 401 without a Bearer
 * token, that every route group stays MOUNTED (a dropped sub-app mount would
 * surface as a 404), and key response-envelope shapes for representative routes.
 *
 * Mocks only the IO boundary: quiet logger, requireAuth/requireAdmin enforcing
 * the Authorization header, pass-through asyncHandler, stubbed service classes,
 * mocked validation schemas, and kv_store / Supabase for transitive safety.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => clone(kvStore.get(k) ?? null)),
  set: vi.fn(async (k: string, v: unknown) => {
    kvStore.set(k, clone(v));
  }),
  del: vi.fn(async (k: string) => {
    kvStore.delete(k);
  }),
  mget: vi.fn(async (ks: string[]) => ks.map((k) => clone(kvStore.get(k) ?? null))),
  getByPrefix: vi.fn(async (p: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push(clone(v)));
    return out;
  }),
  listByPrefix: vi.fn(async (p: string) => {
    const out: { key: string; value: unknown }[] = [];
    kvStore.forEach((v, k) => k.startsWith(p) && out.push({ key: k, value: clone(v) }));
    return out;
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    c.set('userId', 'u1');
    c.set('userRole', 'admin');
    c.set('user', { id: 'u1', email: 'test@example.com' });
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    if (c.get('userRole') !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    c.set('userId', 'u1');
    c.set('userRole', 'admin');
    c.set('user', { id: 'u1', email: 'test@example.com' });
    await next();
  },
}));

vi.mock('../error.middleware.ts', () => ({ asyncHandler: (fn: any) => fn }));

const mockFna = { id: 'fna-1', type: 'risk', clientId: 'c1' };
const mockDraft = { id: 'd1', adviserId: 'u1', createdBy: 'u1', status: 'draft' };
const mockContract = { id: 'mod-1', status: 'active', moduleId: 'risk' };

vi.mock('../advice-engine-service.ts', () => ({
  AdviceEngineService: vi.fn().mockImplementation(() => ({
    createFNA: vi.fn().mockResolvedValue(mockFna),
    updateFNA: vi.fn().mockResolvedValue(mockFna),
    getClientFNAs: vi.fn().mockResolvedValue([mockFna]),
    getFNAById: vi.fn().mockResolvedValue(mockFna),
    publishFNA: vi.fn().mockResolvedValue({ ...mockFna, published: true }),
    aiChat: vi.fn().mockResolvedValue({ reply: 'Test reply', suggestions: [] }),
    aiAnalyze: vi.fn().mockResolvedValue({ analysis: 'Test analysis', insights: [] }),
  })),
}));

vi.mock('../advice-engine-roa-service.ts', () => ({
  AdviceEngineRoAService: vi.fn().mockImplementation(() => ({
    buildClientContext: vi.fn().mockResolvedValue({ clientId: 'c1', adviserId: 'u1' }),
    listDrafts: vi.fn().mockResolvedValue([mockDraft]),
    listClientFiles: vi.fn().mockResolvedValue([]),
    saveDraft: vi.fn().mockResolvedValue(mockDraft),
    getDraft: vi.fn().mockResolvedValue(mockDraft),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
    cloneDraftFromFinal: vi.fn().mockResolvedValue({ ...mockDraft, id: 'd2' }),
    submitDraft: vi.fn().mockResolvedValue({ ...mockDraft, status: 'submitted' }),
    validateDraft: vi.fn().mockResolvedValue({ ...mockDraft, validationResults: [] }),
    uploadEvidence: vi.fn().mockResolvedValue({ ...mockDraft, moduleEvidence: {} }),
    compileDraft: vi.fn().mockResolvedValue({
      ...mockDraft,
      compiledOutput: {},
      validationResults: [],
    }),
    generateDocuments: vi.fn().mockResolvedValue({ ...mockDraft, generatedDocuments: [] }),
    finaliseDraft: vi.fn().mockResolvedValue({ ...mockDraft, generatedDocuments: [] }),
    getGeneratedDocument: vi.fn().mockResolvedValue({ id: 'doc-1', draftId: 'd1', url: 'test' }),
  })),
}));

vi.mock('../advice-engine-roa-contract-service.ts', () => ({
  AdviceEngineRoAContractService: vi.fn().mockImplementation(() => ({
    listLegacyModules: vi.fn().mockResolvedValue([]),
    getSchemaFormat: vi.fn().mockReturnValue({}),
    listContracts: vi.fn().mockResolvedValue([mockContract]),
    getContract: vi.fn().mockResolvedValue(mockContract),
    saveContract: vi.fn().mockResolvedValue(mockContract),
    publishContract: vi.fn().mockResolvedValue({ ...mockContract, status: 'active' }),
    archiveContract: vi.fn().mockResolvedValue({ ...mockContract, status: 'archived' }),
  })),
}));

vi.mock('../advice-engine-validation.ts', () => ({
  CreateRiskFNASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateRiskFNASchema: { parse: vi.fn((v) => v) },
  CreateMedicalFNASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateMedicalFNASchema: { parse: vi.fn((v) => v) },
  CreateRetirementFNASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateRetirementFNASchema: { parse: vi.fn((v) => v) },
  CreateInvestmentINASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateInvestmentINASchema: { parse: vi.fn((v) => v) },
  CreateTaxFNASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateTaxFNASchema: { parse: vi.fn((v) => v) },
  CreateEstateFNASchema: { parse: vi.fn((v) => ({ ...v, clientId: v?.clientId ?? 'c1' })) },
  UpdateEstateFNASchema: { parse: vi.fn((v) => v) },
  FNAIdParamSchema: { parse: vi.fn(() => ({ id: 'fna-1' })) },
  ClientIdParamSchema: { parse: vi.fn(() => ({ clientId: 'c1' })) },
  AIChatRequestSchema: { parse: vi.fn(() => ({ message: 'Hello', context: {} })) },
  AIAnalysisRequestSchema: {
    parse: vi.fn(() => ({ clientId: 'c1', analysisType: 'risk', data: {} })),
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ data: [], error: null }) }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

import adviceEngine from '../advice-engine-routes.ts';

beforeEach(() => {
  kvStore.clear();
});

const AUTH = { headers: { Authorization: 'Bearer test-token' } };

describe('advice-engine-routes.ts route contracts', () => {
  it('GET /unknown-path returns 404', async () => {
    const res = await adviceEngine.request('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });

  // ---- Auth-guarded routes: 401 without an Authorization header ----
  const AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    // Risk FNA
    ['POST', '/fna/create', { method: 'POST', body: '{}' }],
    ['PUT', '/fna/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/fna/client/c1'],
    ['GET', '/fna/fna-1'],
    ['POST', '/fna/fna-1/publish', { method: 'POST', body: '{}' }],
    // Medical FNA
    ['POST', '/medical-fna/create', { method: 'POST', body: '{}' }],
    ['PUT', '/medical-fna/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/medical-fna/client/c1'],
    ['POST', '/medical-fna/fna-1/publish', { method: 'POST', body: '{}' }],
    // Retirement FNA
    ['POST', '/retirement-fna/create', { method: 'POST', body: '{}' }],
    ['PUT', '/retirement-fna/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/retirement-fna/client/c1'],
    ['POST', '/retirement-fna/fna-1/publish', { method: 'POST', body: '{}' }],
    // Investment INA
    ['POST', '/investment-ina/create', { method: 'POST', body: '{}' }],
    ['PUT', '/investment-ina/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/investment-ina/client/c1'],
    ['POST', '/investment-ina/fna-1/publish', { method: 'POST', body: '{}' }],
    // Tax FNA
    ['POST', '/tax-planning-fna/create', { method: 'POST', body: '{}' }],
    ['PUT', '/tax-planning-fna/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/tax-planning-fna/client/c1'],
    ['POST', '/tax-planning-fna/fna-1/publish', { method: 'POST', body: '{}' }],
    // Estate FNA
    ['POST', '/estate-planning-fna/create', { method: 'POST', body: '{}' }],
    ['PUT', '/estate-planning-fna/fna-1', { method: 'PUT', body: '{}' }],
    ['GET', '/estate-planning-fna/client/c1'],
    ['POST', '/estate-planning-fna/fna-1/publish', { method: 'POST', body: '{}' }],
    // AI
    ['POST', '/ai/chat', { method: 'POST', body: '{}' }],
    ['POST', '/ai/analyze', { method: 'POST', body: '{}' }],
    // RoA
    ['GET', '/roa/client/c1/context'],
    ['GET', '/roa/modules'],
    ['GET', '/roa/module-contracts/schema'],
    ['GET', '/roa/module-contracts'],
    ['GET', '/roa/module-contracts/mod-1'],
    ['POST', '/roa/module-contracts', { method: 'POST', body: '{}' }],
    ['PUT', '/roa/module-contracts/mod-1', { method: 'PUT', body: '{}' }],
    ['POST', '/roa/module-contracts/mod-1/publish', { method: 'POST', body: '{}' }],
    ['POST', '/roa/module-contracts/mod-1/archive', { method: 'POST', body: '{}' }],
    ['GET', '/roa/drafts'],
    ['GET', '/roa/client/c1/files'],
    ['POST', '/roa/drafts', { method: 'POST', body: '{}' }],
    ['GET', '/roa/drafts/d1'],
    ['PUT', '/roa/drafts/d1', { method: 'PUT', body: '{}' }],
    ['DELETE', '/roa/drafts/d1', { method: 'DELETE' }],
    ['POST', '/roa/drafts/d1/clone-from-final', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/submit', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/validate', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/evidence', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/compile', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/generate', { method: 'POST', body: '{}' }],
    ['POST', '/roa/drafts/d1/finalise', { method: 'POST', body: '{}' }],
    ['GET', '/roa/documents/doc-1/download'],
  ];
  for (const [label, path, init] of AUTH_GUARDED) {
    it(`${label} ${path} returns 401 without Authorization header`, async () => {
      const res = await adviceEngine.request(path, init as RequestInit);
      expect(res.status).toBe(401);
    });
  }

  // ---- FNA happy-path shapes ----
  it('POST /fna/create returns { fna } with id', async () => {
    const res = await adviceEngine.request('/fna/create', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ clientId: 'c1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fna: { id: string } };
    expect(body.fna.id).toBe('fna-1');
  });

  it('GET /fna/client/:clientId returns { fnas }', async () => {
    const res = await adviceEngine.request('/fna/client/c1', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fnas: unknown[] };
    expect(Array.isArray(body.fnas)).toBe(true);
  });

  it('GET /fna/:id returns { fna }', async () => {
    const res = await adviceEngine.request('/fna/fna-1', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fna: { id: string } };
    expect(body.fna.id).toBe('fna-1');
  });

  it('POST /medical-fna/create returns { fna }', async () => {
    const res = await adviceEngine.request('/medical-fna/create', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ clientId: 'c1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { fna: unknown };
    expect(body.fna).toBeDefined();
  });

  it('POST /investment-ina/create returns { ina }', async () => {
    const res = await adviceEngine.request('/investment-ina/create', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ clientId: 'c1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ina: unknown };
    expect(body.ina).toBeDefined();
  });

  // ---- AI happy-path shapes ----
  it('POST /ai/chat returns a reply', async () => {
    const res = await adviceEngine.request('/ai/chat', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ message: 'Hello', context: {} }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reply: string };
    expect(typeof body.reply).toBe('string');
  });

  // ---- RoA happy-path shapes ----
  it('GET /roa/modules returns { modules }', async () => {
    const res = await adviceEngine.request('/roa/modules', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { modules: unknown[] };
    expect(Array.isArray(body.modules)).toBe(true);
  });

  it('GET /roa/module-contracts returns { contracts }', async () => {
    const res = await adviceEngine.request('/roa/module-contracts', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { contracts: unknown[] };
    expect(Array.isArray(body.contracts)).toBe(true);
  });

  it('GET /roa/drafts returns { drafts }', async () => {
    const res = await adviceEngine.request('/roa/drafts', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { drafts: unknown[] };
    expect(Array.isArray(body.drafts)).toBe(true);
  });

  it('POST /roa/drafts returns { draft }', async () => {
    const res = await adviceEngine.request('/roa/drafts', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ clientId: 'c1' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { draft: { id: string } };
    expect(body.draft.id).toBe('d1');
  });

  it('GET /roa/drafts/:draftId returns { draft }', async () => {
    const res = await adviceEngine.request('/roa/drafts/d1', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { draft: { id: string } };
    expect(body.draft.id).toBe('d1');
  });

  it('DELETE /roa/drafts/:draftId returns 204', async () => {
    const res = await adviceEngine.request('/roa/drafts/d1', { ...AUTH, method: 'DELETE' });
    expect(res.status).toBe(204);
  });

  it('POST /roa/drafts/:draftId/compile returns { draft, compilation, validation }', async () => {
    const res = await adviceEngine.request('/roa/drafts/d1/compile', {
      ...AUTH,
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { draft: unknown; compilation: unknown; validation: unknown };
    expect(body.draft).toBeDefined();
    expect(body.compilation).toBeDefined();
    expect(body.validation).toBeDefined();
  });

  it('GET /roa/documents/:documentId/download returns { document }', async () => {
    const res = await adviceEngine.request('/roa/documents/doc-1/download', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: { id: string } };
    expect(body.document.id).toBe('doc-1');
  });

  // ---- Every route group stays MOUNTED (not 404) ----
  const MOUNTED: ReadonlyArray<readonly [string, string]> = [
    ['POST', '/fna/create'],
    ['GET', '/fna/client/c1'],
    ['POST', '/medical-fna/create'],
    ['POST', '/retirement-fna/create'],
    ['POST', '/investment-ina/create'],
    ['GET', '/investment-ina/client/c1'],
    ['POST', '/tax-planning-fna/create'],
    ['POST', '/estate-planning-fna/create'],
    ['POST', '/ai/chat'],
    ['GET', '/roa/modules'],
    ['GET', '/roa/module-contracts'],
    ['GET', '/roa/drafts'],
    ['GET', '/roa/client/c1/files'],
  ];
  for (const [label, path] of MOUNTED) {
    it(`${label} ${path} is mounted (not 404)`, async () => {
      const res = await adviceEngine.request(path, {
        ...AUTH,
        ...(label !== 'GET' && label !== 'DELETE' ? { method: label, body: '{}' } : {}),
      });
      expect(res.status).not.toBe(404);
    });
  }
});
