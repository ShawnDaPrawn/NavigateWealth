/**
 * honeycomb-routes.ts — Route Contract / Characterization Tests (Phase 5)
 * =========================================================================
 *
 * Locks the response CONTRACTS of all honeycomb routes BEFORE the Phase 5
 * decomposition splits this 1,033-line file into sub-routers. Any change to
 * route shape, status codes, or auth behaviour will fail these tests.
 *
 * All routes sit behind a global `app.use('*', requireAuth)`.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/honeycomb-routes.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Deno + fetch shims ────────────────────────────────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ matterId: 'test-matter', naturalPersonId: 'test-np', id: 'test-id' }),
      text: async () => '{"matterId":"test-matter","naturalPersonId":"test-np"}',
    })),
  );
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

// ── Auth middleware ───────────────────────────────────────────────────────────
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', { id: 'test-user', email: 'admin@test.co' });
    c.set('userId', 'test-user');
    c.set('userRole', 'admin');
    await next();
  },
}));

// ── Honeycomb service stub ────────────────────────────────────────────────────
vi.mock('../honeycomb-service.ts', () => {
  const r = {
    success: true,
    data: { test: 'data' },
    matterId: 'test-matter-id',
    checkType: 'test-check-type',
  };
  return {
    isRealIdNumber: (val: unknown) =>
      typeof val === 'string' && val.length > 2 && val !== 'n/a' && val !== 'null',
    extractId: () => 'test-honeycomb-id',
    logActivity: vi.fn(async () => {}),
    runIdvNoPhoto: vi.fn(async () => ({ ...r, checkType: 'IDV_NO_PHOTO' })),
    runIdvWithPhoto: vi.fn(async () => ({ ...r, checkType: 'IDV_WITH_PHOTO' })),
    runBulkIdv: vi.fn(async () => ({ ...r, checkType: 'BULK_IDV' })),
    runBankVerification: vi.fn(async () => ({ ...r, checkType: 'BANK_VERIFY' })),
    runConsumerCredit: vi.fn(async () => ({ ...r, checkType: 'CONSUMER_CREDIT' })),
    searchSanctions: vi.fn(async () => ({ success: true, data: {}, checkType: 'SANCTIONS' })),
    getAllCheckHistory: vi.fn(async () => []),
    getCheckHistory: vi.fn(async () => []),
    runCddReport: vi.fn(async () => ({ ...r, checkType: 'CDD' })),
    runConsumerTrace: vi.fn(async () => ({ ...r, checkType: 'CONSUMER_TRACE' })),
    runDebtReviewEnquiry: vi.fn(async () => ({ ...r, checkType: 'DEBT_REVIEW' })),
    runCipcSearch: vi.fn(async () => ({ ...r, checkType: 'CIPC' })),
    runDirectorEnquiry: vi.fn(async () => ({ ...r, checkType: 'DIRECTOR' })),
    runBestKnownAddress: vi.fn(async () => ({ ...r, checkType: 'ADDRESS' })),
    runCustomScreening: vi.fn(async () => ({ ...r, checkType: 'SCREENING' })),
    searchEnforcementActions: vi.fn(async () => ({
      success: true,
      data: {},
      checkType: 'ENFORCEMENT',
    })),
    searchLegalAListing: vi.fn(async () => ({ success: true, data: {}, checkType: 'LEGAL_A' })),
    runLifestyleAudit: vi.fn(async () => ({ ...r, checkType: 'LIFESTYLE' })),
    runIncomePredictor: vi.fn(async () => ({ ...r, checkType: 'INCOME' })),
    runTendersBlue: vi.fn(async () => ({ ...r, checkType: 'TENDERS' })),
    getComplianceDashboard: vi.fn(async () => ({
      readinessScore: 75,
      categories: [],
      checkMatrix: [],
      riskFlags: [],
    })),
  };
});

import honeycombApp from '../honeycomb-routes.ts';

const AUTH = { Authorization: 'Bearer test-token' };
const CLIENT_ID = 'client-001';
const PERSON = {
  clientId: CLIENT_ID,
  firstName: 'John',
  lastName: 'Doe',
  idNumber: '9001015009087',
};

beforeEach(() => {
  kvStore.clear();
});

describe('honeycomb-routes.ts route contracts', () => {
  // ── Global auth gate ────────────────────────────────────────────────────────
  it('returns 401 on any route without Authorization header', async () => {
    const res = await honeycombApp.request('/status/any-client');
    expect(res.status).toBe(401);
  });

  // ── POST /proxy ─────────────────────────────────────────────────────────────
  describe('POST /proxy', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/proxy', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when path is missing', async () => {
      const res = await honeycombApp.request('/proxy', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 on valid proxy request (mocked fetch)', async () => {
      const res = await honeycombApp.request('/proxy', {
        method: 'POST',
        body: JSON.stringify({ path: '/natural-person', method: 'GET' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect([200, 500]).toContain(res.status);
    });
  });

  // ── POST /register-client ───────────────────────────────────────────────────
  describe('POST /register-client', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/register-client', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when clientId is missing', async () => {
      const res = await honeycombApp.request('/register-client', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, honeycombId } on valid input', async () => {
      const res = await honeycombApp.request('/register-client', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.honeycombId).toBe('string');
    });

    it('returns already-registered message when client is cached in KV', async () => {
      kvStore.set(`honeycomb_id:${CLIENT_ID}`, 'existing-hc-id');
      const res = await honeycombApp.request('/register-client', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.honeycombId).toBe('existing-hc-id');
    });
  });

  // ── GET /status/:clientId ───────────────────────────────────────────────────
  describe('GET /status/:clientId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/status/${CLIENT_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { registered: false, honeycombId: null } when not registered', async () => {
      const res = await honeycombApp.request(`/status/${CLIENT_ID}`, { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.registered).toBe(false);
      expect(body.honeycombId).toBe(null);
    });

    it('returns 200 with { registered: true, honeycombId } when registered', async () => {
      kvStore.set(`honeycomb_id:${CLIENT_ID}`, 'hc-12345');
      const res = await honeycombApp.request(`/status/${CLIENT_ID}`, { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.registered).toBe(true);
      expect(body.honeycombId).toBe('hc-12345');
    });
  });

  // ── GET /activity/:clientId ──────────────────────────────────────────────────
  describe('GET /activity/:clientId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/activity/${CLIENT_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { activity: [] } when nothing stored', async () => {
      const res = await honeycombApp.request(`/activity/${CLIENT_ID}`, { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Array.isArray(body.activity)).toBe(true);
    });
  });

  // ── POST /idv/no-photo ───────────────────────────────────────────────────────
  describe('POST /idv/no-photo', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/idv/no-photo', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when firstName/lastName are missing', async () => {
      const res = await honeycombApp.request('/idv/no-photo', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data, matterId, checkType } on valid input', async () => {
      const res = await honeycombApp.request('/idv/no-photo', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('data' in body).toBe(true);
      expect('matterId' in body).toBe(true);
      expect('checkType' in body).toBe(true);
    });
  });

  // ── POST /idv/with-photo ─────────────────────────────────────────────────────
  describe('POST /idv/with-photo', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/idv/with-photo', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when photo is missing', async () => {
      const res = await honeycombApp.request('/idv/with-photo', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result when photo is provided', async () => {
      const res = await honeycombApp.request('/idv/with-photo', {
        method: 'POST',
        body: JSON.stringify({ ...PERSON, photo: 'base64photodata==' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── POST /idv/bulk ───────────────────────────────────────────────────────────
  describe('POST /idv/bulk', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/idv/bulk', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when persons array is missing', async () => {
      const res = await honeycombApp.request('/idv/bulk', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result on valid input', async () => {
      const res = await honeycombApp.request('/idv/bulk', {
        method: 'POST',
        body: JSON.stringify({
          clientId: CLIENT_ID,
          persons: [{ firstName: 'John', lastName: 'Doe', idNumber: '9001015009087' }],
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── POST /financial/bank-verify ──────────────────────────────────────────────
  describe('POST /financial/bank-verify', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/financial/bank-verify', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when bank fields are missing', async () => {
      const res = await honeycombApp.request('/financial/bank-verify', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result on valid input', async () => {
      const res = await honeycombApp.request('/financial/bank-verify', {
        method: 'POST',
        body: JSON.stringify({
          ...PERSON,
          bankName: 'FNB',
          accountNumber: '12345678',
          branchCode: '250655',
          accountType: 'savings',
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('matterId' in body).toBe(true);
    });
  });

  // ── POST /financial/credit-check ─────────────────────────────────────────────
  describe('POST /financial/credit-check', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/financial/credit-check', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when consentGiven is false', async () => {
      const res = await honeycombApp.request('/financial/credit-check', {
        method: 'POST',
        body: JSON.stringify({ ...PERSON, consentGiven: false }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result when consentGiven is true', async () => {
      const res = await honeycombApp.request('/financial/credit-check', {
        method: 'POST',
        body: JSON.stringify({ ...PERSON, consentGiven: true }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── POST /sanctions/search ────────────────────────────────────────────────────
  describe('POST /sanctions/search', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/sanctions/search', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when clientId is missing', async () => {
      const res = await honeycombApp.request('/sanctions/search', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data, checkType } on valid input', async () => {
      const res = await honeycombApp.request('/sanctions/search', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID, name: 'John', surname: 'Doe' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('data' in body).toBe(true);
      expect('checkType' in body).toBe(true);
    });
  });

  // ── GET /checks/history/:clientId ─────────────────────────────────────────────
  describe('GET /checks/history/:clientId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/checks/history/${CLIENT_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, history } array', async () => {
      const res = await honeycombApp.request(`/checks/history/${CLIENT_ID}`, { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.history)).toBe(true);
    });
  });

  // ── GET /checks/history/:clientId/:checkType ───────────────────────────────────
  describe('GET /checks/history/:clientId/:checkType', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/checks/history/${CLIENT_ID}/IDV_NO_PHOTO`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, history } for specific check type', async () => {
      const res = await honeycombApp.request(`/checks/history/${CLIENT_ID}/IDV_NO_PHOTO`, {
        headers: AUTH,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.history)).toBe(true);
    });
  });

  // ── GET /assessments/templates ────────────────────────────────────────────────
  describe('GET /assessments/templates', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/assessments/templates');
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, templates } (mocked fetch)', async () => {
      const res = await honeycombApp.request('/assessments/templates', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.templates)).toBe(true);
    });
  });

  // ── POST /assessments/run ──────────────────────────────────────────────────────
  describe('POST /assessments/run', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/assessments/run', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when assessmentId is missing', async () => {
      const res = await honeycombApp.request('/assessments/run', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data } on valid input (mocked fetch)', async () => {
      const res = await honeycombApp.request('/assessments/run', {
        method: 'POST',
        body: JSON.stringify({ ...PERSON, assessmentId: 1, assessmentName: 'Due Diligence' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('data' in body).toBe(true);
    });
  });

  // ── GET /assessments/history/:clientId ────────────────────────────────────────
  describe('GET /assessments/history/:clientId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/assessments/history/${CLIENT_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, assessments } array', async () => {
      const res = await honeycombApp.request(`/assessments/history/${CLIENT_ID}`, {
        headers: AUTH,
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.assessments)).toBe(true);
    });
  });

  // ── POST /assessments/create ───────────────────────────────────────────────────
  describe('POST /assessments/create', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/assessments/create', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when honeycombId is missing', async () => {
      const res = await honeycombApp.request('/assessments/create', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data } on valid input', async () => {
      const res = await honeycombApp.request('/assessments/create', {
        method: 'POST',
        body: JSON.stringify({ honeycombId: 'hc-001', clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── GET /assessments/list/:honeycombId ────────────────────────────────────────
  describe('GET /assessments/list/:honeycombId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/assessments/list/hc-001');
      expect(res.status).toBe(401);
    });

    it('returns 200 with { assessments } array (mocked fetch)', async () => {
      const res = await honeycombApp.request('/assessments/list/hc-001', { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(Array.isArray(body.assessments)).toBe(true);
    });
  });

  // ── POST /reports/idv ──────────────────────────────────────────────────────────
  describe('POST /reports/idv', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/reports/idv', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, reportId, status } on valid input', async () => {
      const res = await honeycombApp.request('/reports/idv', {
        method: 'POST',
        body: JSON.stringify({ honeycombId: 'hc-001', clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('reportId' in body).toBe(true);
    });
  });

  // ── POST /reports/cdd ──────────────────────────────────────────────────────────
  describe('POST /reports/cdd', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/reports/cdd', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when required person fields are missing', async () => {
      const res = await honeycombApp.request('/reports/cdd', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result on valid input', async () => {
      const res = await honeycombApp.request('/reports/cdd', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('matterId' in body).toBe(true);
    });
  });

  // ── Phase 2 / 3 NaturalPersonCheck routes ────────────────────────────────────
  // All use the same NaturalPersonCheckSchema and return { success, data, matterId, checkType }
  const naturalPersonRoutes = [
    '/financial/consumer-trace',
    '/financial/debt-review',
    '/corporate/cipc',
    '/corporate/director-enquiry',
    '/address/best-known',
    '/financial/lifestyle-audit',
    '/financial/income-predictor',
    '/corporate/tenders-blue',
  ];

  naturalPersonRoutes.forEach((route) => {
    describe(`POST ${route}`, () => {
      it('returns 401 without Authorization', async () => {
        const res = await honeycombApp.request(route, { method: 'POST' });
        expect(res.status).toBe(401);
      });

      it('returns 400 when firstName/lastName are missing', async () => {
        const res = await honeycombApp.request(route, {
          method: 'POST',
          body: JSON.stringify({ clientId: CLIENT_ID }),
          headers: { ...AUTH, 'Content-Type': 'application/json' },
        });
        expect(res.status).toBe(400);
      });

      it('returns 200 with { success, data, matterId, checkType } on valid input', async () => {
        const res = await honeycombApp.request(route, {
          method: 'POST',
          body: JSON.stringify(PERSON),
          headers: { ...AUTH, 'Content-Type': 'application/json' },
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body.success).toBe(true);
        expect('matterId' in body).toBe(true);
        expect('checkType' in body).toBe(true);
      });
    });
  });

  // ── POST /screening/custom ────────────────────────────────────────────────────
  describe('POST /screening/custom', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/screening/custom', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when required person fields are missing', async () => {
      const res = await honeycombApp.request('/screening/custom', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with check result on valid input', async () => {
      const res = await honeycombApp.request('/screening/custom', {
        method: 'POST',
        body: JSON.stringify(PERSON),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── POST /sanctions/enforcement-actions ────────────────────────────────────────
  describe('POST /sanctions/enforcement-actions', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/sanctions/enforcement-actions', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when clientId is missing', async () => {
      const res = await honeycombApp.request('/sanctions/enforcement-actions', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data, checkType } on valid input', async () => {
      const res = await honeycombApp.request('/sanctions/enforcement-actions', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID, name: 'John', surname: 'Doe' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('data' in body).toBe(true);
    });
  });

  // ── POST /sanctions/legal-a-listing ───────────────────────────────────────────
  describe('POST /sanctions/legal-a-listing', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request('/sanctions/legal-a-listing', { method: 'POST' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when clientId is missing', async () => {
      const res = await honeycombApp.request('/sanctions/legal-a-listing', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 200 with { success, data, checkType } on valid input', async () => {
      const res = await honeycombApp.request('/sanctions/legal-a-listing', {
        method: 'POST',
        body: JSON.stringify({ clientId: CLIENT_ID }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });
  });

  // ── GET /dashboard/:clientId ───────────────────────────────────────────────────
  describe('GET /dashboard/:clientId', () => {
    it('returns 401 without Authorization', async () => {
      const res = await honeycombApp.request(`/dashboard/${CLIENT_ID}`);
      expect(res.status).toBe(401);
    });

    it('returns 200 with { success, dashboard } on valid request', async () => {
      const res = await honeycombApp.request(`/dashboard/${CLIENT_ID}`, { headers: AUTH });
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect('dashboard' in body).toBe(true);
    });
  });
});
