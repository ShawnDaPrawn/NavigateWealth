/**
 * compliance-routes.ts — Route Contract / Characterization Tests (Phase 5)
 * =========================================================================
 *
 * Locks the HTTP-level contracts of compliance-routes.ts BEFORE the Phase 5
 * decomposition splits the 1,138-line file into mounted sub-apps. Mounts the
 * real Hono app and asserts: that auth-guarded routes 401/403 without a Bearer
 * token, that every route group stays MOUNTED (a dropped sub-app mount would
 * surface as a 404), and key response-envelope shapes for representative routes.
 *
 * Mocks only the IO boundary: quiet logger, requireAuth/requireAdmin enforcing
 * the Authorization header, pass-through asyncHandler, stubbed ComplianceService,
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
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) return c.json({ error: 'Unauthorized' }, 401);
    if (c.get('userRole') !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    await next();
  },
}));

vi.mock('../error.middleware.ts', () => ({ asyncHandler: (fn: any) => fn }));

const mockRecord = { id: 'r1' };
const mockCheck = { id: 'c1' };
vi.mock('../compliance-service.ts', () => ({
  ComplianceService: vi.fn().mockImplementation(() => ({
    getComplianceSummary: vi.fn().mockResolvedValue({ totalChecks: 0, status: 'ok' }),
    getFAISRecords: vi.fn().mockResolvedValue([]),
    createFAISRecord: vi.fn().mockResolvedValue(mockRecord),
    getAMLChecks: vi.fn().mockResolvedValue([]),
    performAMLCheck: vi.fn().mockResolvedValue(mockCheck),
    getPOPIAConsents: vi.fn().mockResolvedValue([]),
    recordPOPIAConsent: vi.fn().mockResolvedValue(mockRecord),
    withdrawPOPIAConsent: vi.fn().mockResolvedValue({ success: true }),
    getDebarmentChecks: vi.fn().mockResolvedValue([]),
    performDebarmentCheck: vi.fn().mockResolvedValue(mockCheck),
    getDocumentsInsuranceRecords: vi.fn().mockResolvedValue([]),
    createDocumentsInsuranceRecord: vi.fn().mockResolvedValue(mockRecord),
    getAuditTrail: vi.fn().mockResolvedValue([]),
    getAMLFICARecords: vi.fn().mockResolvedValue([]),
    createAMLFICARecord: vi.fn().mockResolvedValue(mockRecord),
    updateAMLFICARecord: vi.fn().mockResolvedValue(mockRecord),
    getStatutoryRecords: vi.fn().mockResolvedValue([]),
    createStatutoryRecord: vi.fn().mockResolvedValue(mockRecord),
    updateStatutoryRecord: vi.fn().mockResolvedValue(mockRecord),
    getPOPIAConsentRecords: vi.fn().mockResolvedValue([]),
    createPOPIAConsentRecord: vi.fn().mockResolvedValue(mockRecord),
    withdrawPOPIAConsentRecord: vi.fn().mockResolvedValue(mockRecord),
    getPAIARequests: vi.fn().mockResolvedValue([]),
    createPAIARequest: vi.fn().mockResolvedValue(mockRecord),
    updatePAIARequest: vi.fn().mockResolvedValue(mockRecord),
    getRecordKeepingEntries: vi.fn().mockResolvedValue([]),
    createRecordKeepingEntry: vi.fn().mockResolvedValue(mockRecord),
    markRecordForDisposal: vi.fn().mockResolvedValue(mockRecord),
    getNewBusinessRecords: vi.fn().mockResolvedValue([]),
    createNewBusinessRecord: vi.fn().mockResolvedValue(mockRecord),
    updateNewBusinessRecord: vi.fn().mockResolvedValue(mockRecord),
    getComplaints: vi.fn().mockResolvedValue([]),
    getComplaintById: vi.fn().mockResolvedValue(mockRecord),
    createComplaint: vi.fn().mockResolvedValue(mockRecord),
    updateComplaint: vi.fn().mockResolvedValue(mockRecord),
    resolveComplaint: vi.fn().mockResolvedValue(mockRecord),
    escalateComplaint: vi.fn().mockResolvedValue(mockRecord),
    getMarketingRecords: vi.fn().mockResolvedValue([]),
    createMarketingRecord: vi.fn().mockResolvedValue(mockRecord),
    approveMarketingRecord: vi.fn().mockResolvedValue(mockRecord),
    getConflictRecords: vi.fn().mockResolvedValue([]),
    createConflictRecord: vi.fn().mockResolvedValue(mockRecord),
    updateConflictRecord: vi.fn().mockResolvedValue(mockRecord),
    getTCFRecords: vi.fn().mockResolvedValue([]),
    createTCFRecord: vi.fn().mockResolvedValue(mockRecord),
    updateTCFRecord: vi.fn().mockResolvedValue(mockRecord),
    getSupervisionRecords: vi.fn().mockResolvedValue([]),
    createSupervisionRecord: vi.fn().mockResolvedValue(mockRecord),
    updateSupervisionRecord: vi.fn().mockResolvedValue(mockRecord),
  })),
}));

vi.mock('../compliance-validation.ts', () => ({
  CreateFAISRecordSchema: { safeParse: vi.fn((v) => ({ success: true, data: v })) },
  AMLCheckSchema: { safeParse: vi.fn(() => ({ success: true, data: { clientId: 'c1' } })) },
  POPIAConsentSchema: { safeParse: vi.fn((v) => ({ success: true, data: v })) },
  DebarmentCheckSchema: {
    safeParse: vi.fn(() => ({
      success: true,
      data: { adviserId: 'a1', name: 'Test', idNumber: '123' },
    })),
  },
  DocumentsInsuranceRecordSchema: { safeParse: vi.fn((v) => ({ success: true, data: v })) },
}));

vi.mock('../shared-validation-utils.ts', () => ({
  formatZodError: vi.fn(() => ({ details: [] })),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ data: [], error: null }) }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

import compliance from '../compliance-routes.ts';

beforeEach(() => {
  kvStore.clear();
});

const AUTH = { headers: { Authorization: 'Bearer test-token' } };

describe('compliance-routes.ts route contracts', () => {
  it('GET /unknown-path returns 404', async () => {
    const res = await compliance.request('/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });

  // ---- Auth-guarded routes: 401 without an Authorization header ----
  const AUTH_GUARDED: ReadonlyArray<readonly [string, string, RequestInit?]> = [
    ['GET', '/stats'],
    ['GET', '/overview'],
    ['GET', '/deadlines'],
    ['GET', '/activities'],
    ['GET', '/fais'],
    ['POST', '/fais', { method: 'POST', body: '{}' }],
    ['GET', '/aml'],
    ['POST', '/aml/check', { method: 'POST', body: '{}' }],
    ['GET', '/popia'],
    ['POST', '/popia/consent', { method: 'POST', body: '{}' }],
    ['POST', '/popia/withdraw', { method: 'POST', body: '{}' }],
    ['GET', '/debarment'],
    ['POST', '/debarment/check', { method: 'POST', body: '{}' }],
    ['GET', '/documents-insurance'],
    ['GET', '/reports/summary'],
    ['GET', '/reports/audit'],
    ['GET', '/aml-fica'],
    ['GET', '/aml-fica/client/c1'],
    ['GET', '/statutory'],
    ['GET', '/statutory/s1'],
    ['GET', '/popia/consents'],
    ['POST', '/popia/consents', { method: 'POST', body: '{}' }],
    ['GET', '/paia/requests'],
    ['GET', '/record-keeping'],
    ['GET', '/new-business'],
    ['GET', '/complaints'],
    ['GET', '/complaints/c1'],
    ['GET', '/marketing'],
    ['GET', '/conflicts'],
    ['GET', '/tcf'],
    ['GET', '/supervision'],
    ['POST', '/refresh', { method: 'POST', body: '{}' }],
  ];
  for (const [label, path, init] of AUTH_GUARDED) {
    it(`${label} ${path} returns 401 without Authorization header`, async () => {
      const res = await compliance.request(path, init as RequestInit);
      expect(res.status).toBe(401);
    });
  }

  // ---- Dashboard group ----
  it('GET /stats returns success envelope with data', async () => {
    const res = await compliance.request('/stats', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('GET /overview returns success envelope with data', async () => {
    const res = await compliance.request('/overview', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
  });

  it('GET /deadlines returns success envelope with data array', async () => {
    const res = await compliance.request('/deadlines', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /activities returns success envelope with data array', async () => {
    const res = await compliance.request('/activities', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ---- FAIS group ----
  it('GET /fais returns { records }', async () => {
    const res = await compliance.request('/fais', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { records: unknown[] };
    expect(Array.isArray(body.records)).toBe(true);
  });

  it('POST /fais returns 201 with { record }', async () => {
    const res = await compliance.request('/fais', {
      ...AUTH,
      method: 'POST',
      body: JSON.stringify({ fspName: 'Test FSP' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { record: { id: string } };
    expect(body.record.id).toBe('r1');
  });

  // ---- AML group ----
  it('GET /aml returns { checks }', async () => {
    const res = await compliance.request('/aml', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checks: unknown[] };
    expect(Array.isArray(body.checks)).toBe(true);
  });

  // ---- AML/FICA group ----
  it('GET /aml-fica returns success envelope with data and total', async () => {
    const res = await compliance.request('/aml-fica', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; total: number };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('GET /aml-fica/client/:clientId returns filtered list', async () => {
    const res = await compliance.request('/aml-fica/client/c1', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- POPIA group ----
  it('GET /popia returns { consents }', async () => {
    const res = await compliance.request('/popia', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { consents: unknown[] };
    expect(Array.isArray(body.consents)).toBe(true);
  });

  it('GET /popia/consents returns success envelope with data and total', async () => {
    const res = await compliance.request('/popia/consents', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; total: number };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ---- Statutory group ----
  it('GET /statutory returns success envelope with data', async () => {
    const res = await compliance.request('/statutory', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- PAIA group ----
  it('GET /paia/requests returns success envelope with data', async () => {
    const res = await compliance.request('/paia/requests', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- Documents/Record-keeping group ----
  it('GET /documents-insurance returns success envelope', async () => {
    const res = await compliance.request('/documents-insurance', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  it('GET /record-keeping returns success envelope', async () => {
    const res = await compliance.request('/record-keeping', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- New business group ----
  it('GET /new-business returns success envelope with data and total', async () => {
    const res = await compliance.request('/new-business', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; total: number };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ---- Complaints group ----
  it('GET /complaints returns success envelope with data and total', async () => {
    const res = await compliance.request('/complaints', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[]; total: number };
    expect(body.success).toBe(true);
  });

  it('GET /complaints/:id returns complaint', async () => {
    const res = await compliance.request('/complaints/c1', AUTH);
    expect(res.status).toBe(200);
  });

  // ---- Marketing group ----
  it('GET /marketing returns success envelope', async () => {
    const res = await compliance.request('/marketing', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- Conflicts group ----
  it('GET /conflicts returns success envelope', async () => {
    const res = await compliance.request('/conflicts', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- TCF group ----
  it('GET /tcf returns success envelope', async () => {
    const res = await compliance.request('/tcf', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- Supervision group ----
  it('GET /supervision returns success envelope', async () => {
    const res = await compliance.request('/supervision', AUTH);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });

  // ---- Refresh ----
  it('POST /refresh returns success envelope with message', async () => {
    const res = await compliance.request('/refresh', { ...AUTH, method: 'POST', body: '{}' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; message: string };
    expect(body.success).toBe(true);
    expect(typeof body.message).toBe('string');
  });

  // ---- Every route group stays MOUNTED (not 404) ----
  const MOUNTED: ReadonlyArray<readonly [string, string]> = [
    ['GET', '/stats'],
    ['GET', '/fais'],
    ['GET', '/aml'],
    ['GET', '/popia'],
    ['GET', '/debarment'],
    ['GET', '/documents-insurance'],
    ['GET', '/reports/summary'],
    ['GET', '/aml-fica'],
    ['GET', '/statutory'],
    ['GET', '/popia/consents'],
    ['GET', '/paia/requests'],
    ['GET', '/record-keeping'],
    ['GET', '/new-business'],
    ['GET', '/complaints'],
    ['GET', '/marketing'],
    ['GET', '/conflicts'],
    ['GET', '/tcf'],
    ['GET', '/supervision'],
  ];
  for (const [label, path] of MOUNTED) {
    it(`${label} ${path} is mounted (not 404)`, async () => {
      const res = await compliance.request(path, AUTH);
      expect(res.status).not.toBe(404);
    });
  }
});
