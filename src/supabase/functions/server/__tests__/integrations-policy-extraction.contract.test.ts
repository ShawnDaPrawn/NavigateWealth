/**
 * integrations.tsx — policy-extraction route contracts
 * ====================================================
 *
 * Split out of integrations-routes.contract.test.ts, which had grown past the
 * 1,000-line max-lines budget. These nine describes cover the whole
 * /policy-extraction surface — extract, result, history, compare, apply,
 * lock-fields, quality-stats and bulk-reextract — and are the only ones that
 * need the policy-extraction-service mock.
 *
 * The Deno/IO mocks below are repeated rather than shared: `vi.mock` is hoisted
 * per test file, so a shared helper's mocks would not apply to this file's
 * imports. Duplication is the cost of splitting a mocked contract suite.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/integrations-policy-extraction.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Deno runtime shim (handlers read Deno.env) ──────────────────────────────
beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

// ── In-memory KV (same pattern as esign-happy-path) ─────────────────────────
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

// ── Quiet logger ────────────────────────────────────────────────────────────
vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Auth middleware: enforce the header, otherwise pass a fake admin user ────
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
  requireAdmin: async (c: any, next: any) => {
    if (!c.req.header('Authorization')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    c.set('user', { id: 'test-user', email: 'admin@test.co' });
    c.set('userId', 'test-user');
    c.set('userRole', 'admin');
    await next();
  },
}));

// ── Supabase client stub ─────────────────────────────────────────────────────
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ like: () => ({ data: [], error: null }) }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: 'https://test-signed-url/doc.pdf' },
          error: null,
        })),
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  }),
}));

// ── Document storage stub ────────────────────────────────────────────────────
vi.mock('../integrations-document-storage.ts', () => ({
  POLICY_DOC_BUCKET: 'policy-documents',
  POLICY_CATEGORY_LABELS: {
    risk_planning: 'Risk Planning',
    medical_aid: 'Medical Aid',
    retirement_planning: 'Retirement Planning',
    investments: 'Investments',
    employee_benefits: 'Employee Benefits',
    tax_planning: 'Tax Planning',
    estate_planning: 'Estate Planning',
  },
  ensurePolicyDocBucket: vi.fn(async () => {}),
  uploadEstateDocumentForClient: vi.fn(async () => ({
    storageKey: 'test/estate-doc.pdf',
    fileName: 'estate.pdf',
    documentType: 'last_will_scanned',
    uploadedAt: '2025-01-01T00:00:00.000Z',
    uploadedBy: 'test@test.com',
    mimeType: 'application/pdf',
    sizeBytes: 100,
  })),
  replacePolicyDocumentForPolicy: vi.fn(async () => ({
    storageKey: 'test/policy-doc.pdf',
    fileName: 'uploaded.pdf',
    documentType: 'policy_schedule',
    uploadedAt: '2025-01-01T00:00:00.000Z',
    uploadedBy: 'test@test.com',
    mimeType: 'application/pdf',
    sizeBytes: 100,
  })),
}));

// ── Policy extraction service stub ───────────────────────────────────────────
vi.mock('../policy-extraction-service.ts', () => ({
  extractPolicyDocument: vi.fn(async () => ({
    extraction: {
      status: 'completed',
      extractedAt: '2025-01-01T00:00:00.000Z',
      confidence: 0.9,
      extractedData: { field1: 'value1' },
      appliedFields: [],
      validationWarnings: [],
    },
    fieldMappings: [],
  })),
  getProviderTerminology: vi.fn(async () => ({
    providerId: 'p1',
    providerName: 'Test Provider',
    benefitMappings: {},
    productMappings: {},
  })),
  saveProviderTerminology: vi.fn(async () => {}),
  getAllProviderTerminologies: vi.fn(async () => ({})),
  generateExtractionDiff: vi.fn(),
  buildHistoryEntry: vi.fn(() => ({
    id: 'hist-1',
    extractedAt: '2025-01-01T00:00:00.000Z',
    confidence: 0.8,
    fieldMappingsSnapshot: [],
  })),
}));

import integrationsApp from '../integrations.tsx';

const AUTH = { Authorization: 'Bearer test-token' };

beforeEach(() => {
  kvStore.clear();
});

describe('integrations.tsx policy-extraction route contracts', () => {
  // ── POST /policy-extraction/extract ───────────────────────────────────────
  describe('POST /policy-extraction/extract', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/policy-extraction/extract', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when policyId or clientId is missing', async () => {
      const res = await integrationsApp.request('/policy-extraction/extract', {
        method: 'POST',
        body: JSON.stringify({ clientId: 'c1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Missing policyId or clientId' });
    });

    it('returns 404 when policy is not found', async () => {
      const res = await integrationsApp.request('/policy-extraction/extract', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'ghost', clientId: 'c1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 400 when policy has no document', async () => {
      kvStore.set('policies:client:c1', [{ id: 'p1', clientId: 'c1', data: {} }]);
      const res = await integrationsApp.request('/policy-extraction/extract', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: expect.stringContaining('Upload a document'),
      });
    });

    it('returns 200 with extraction result when policy has a document', async () => {
      kvStore.set('policies:client:c1', [
        {
          id: 'p1',
          clientId: 'c1',
          data: {},
          document: { storageKey: 'test/doc.pdf', fileName: 'doc.pdf' },
        },
      ]);
      const res = await integrationsApp.request('/policy-extraction/extract', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.extraction).toBeDefined();
      expect(Array.isArray(body.fieldMappings)).toBe(true);
      expect(Array.isArray(body.diff)).toBe(true);
    });
  });

  // ── GET /policy-extraction/result ─────────────────────────────────────────
  describe('GET /policy-extraction/result', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/result?policyId=p1&clientId=c1',
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when policyId or clientId is missing', async () => {
      const res = await integrationsApp.request('/policy-extraction/result?policyId=p1', {
        headers: AUTH,
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when policy is not found', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/result?policyId=ghost&clientId=c1',
        { headers: AUTH },
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when no extraction result exists', async () => {
      kvStore.set('policies:client:c1', [{ id: 'p1', clientId: 'c1', data: {} }]);
      const res = await integrationsApp.request(
        '/policy-extraction/result?policyId=p1&clientId=c1',
        { headers: AUTH },
      );
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: 'No extraction result available' });
    });

    it('returns 200 with extraction data', async () => {
      kvStore.set('policies:client:c1', [
        {
          id: 'p1',
          clientId: 'c1',
          data: {},
          extraction: {
            status: 'completed',
            extractedAt: '2025-01-01T00:00:00.000Z',
            confidence: 0.9,
          },
        },
      ]);
      const res = await integrationsApp.request(
        '/policy-extraction/result?policyId=p1&clientId=c1',
        { headers: AUTH },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.extraction).toMatchObject({ status: 'completed' });
    });
  });

  // ── GET /policy-extraction/history ────────────────────────────────────────
  describe('GET /policy-extraction/history', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/history?policyId=p1&clientId=c1',
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when params are missing', async () => {
      const res = await integrationsApp.request('/policy-extraction/history?policyId=p1', {
        headers: AUTH,
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when policy not found', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/history?policyId=ghost&clientId=c1',
        { headers: AUTH },
      );
      expect(res.status).toBe(404);
    });

    it('returns 200 with empty history array when policy has no history', async () => {
      kvStore.set('policies:client:c1', [{ id: 'p1', clientId: 'c1', data: {} }]);
      const res = await integrationsApp.request(
        '/policy-extraction/history?policyId=p1&clientId=c1',
        { headers: AUTH },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.history)).toBe(true);
      expect(body.history).toHaveLength(0);
      expect(body.currentExtraction).toBeNull();
    });
  });

  // ── GET /policy-extraction/compare ────────────────────────────────────────
  describe('GET /policy-extraction/compare', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/compare?policyId=p1&clientId=c1&leftId=h1&rightId=h2',
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 when required params are missing', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/compare?policyId=p1&clientId=c1&leftId=h1',
        { headers: AUTH },
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when policy not found', async () => {
      const res = await integrationsApp.request(
        '/policy-extraction/compare?policyId=ghost&clientId=c1&leftId=h1&rightId=h2',
        { headers: AUTH },
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 when leftId is not in history', async () => {
      kvStore.set('policies:client:c1', [
        { id: 'p1', clientId: 'c1', data: {}, extractionHistory: [] },
      ]);
      const res = await integrationsApp.request(
        '/policy-extraction/compare?policyId=p1&clientId=c1&leftId=no-such&rightId=current',
        { headers: AUTH },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── POST /policy-extraction/apply ─────────────────────────────────────────
  describe('POST /policy-extraction/apply', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/policy-extraction/apply', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1', fieldsToApply: {} }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when required params are missing', async () => {
      const res = await integrationsApp.request('/policy-extraction/apply', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when policy not found', async () => {
      const res = await integrationsApp.request('/policy-extraction/apply', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'ghost', clientId: 'c1', fieldsToApply: {} }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 200 and reports applied fields', async () => {
      kvStore.set('policies:client:c1', [{ id: 'p1', clientId: 'c1', data: {} }]);
      const res = await integrationsApp.request('/policy-extraction/apply', {
        method: 'POST',
        body: JSON.stringify({
          policyId: 'p1',
          clientId: 'c1',
          fieldsToApply: { field1: 'value1' },
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.appliedFields)).toBe(true);
    });
  });

  // ── POST /policy-extraction/lock-fields ───────────────────────────────────
  describe('POST /policy-extraction/lock-fields', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/policy-extraction/lock-fields', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1', fieldIds: ['f1'], action: 'lock' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when action is invalid', async () => {
      const res = await integrationsApp.request('/policy-extraction/lock-fields', {
        method: 'POST',
        body: JSON.stringify({ policyId: 'p1', clientId: 'c1', fieldIds: ['f1'], action: 'bad' }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when policy not found', async () => {
      const res = await integrationsApp.request('/policy-extraction/lock-fields', {
        method: 'POST',
        body: JSON.stringify({
          policyId: 'ghost',
          clientId: 'c1',
          fieldIds: ['f1'],
          action: 'lock',
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(404);
    });

    it('returns 200 with updated lockedFields array', async () => {
      kvStore.set('policies:client:c1', [{ id: 'p1', clientId: 'c1', data: {} }]);
      const res = await integrationsApp.request('/policy-extraction/lock-fields', {
        method: 'POST',
        body: JSON.stringify({
          policyId: 'p1',
          clientId: 'c1',
          fieldIds: ['f1', 'f2'],
          action: 'lock',
        }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.lockedFields).toContain('f1');
      expect(body.lockedFields).toContain('f2');
    });
  });

  // ── GET /policy-extraction/quality-stats ──────────────────────────────────
  describe('GET /policy-extraction/quality-stats', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/policy-extraction/quality-stats');
      expect(res.status).toBe(401);
    });

    it('returns 200 with numeric overview shape when no policies exist', async () => {
      const res = await integrationsApp.request('/policy-extraction/quality-stats', {
        headers: AUTH,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(typeof body.overview.totalPolicies).toBe('number');
      expect(typeof body.overview.totalExtractions).toBe('number');
      expect(Array.isArray(body.providerStats)).toBe(true);
      expect(Array.isArray(body.lowConfidenceFields)).toBe(true);
      expect(Array.isArray(body.timeline)).toBe(true);
    });
  });

  // ── POST /policy-extraction/bulk-reextract ────────────────────────────────
  describe('POST /policy-extraction/bulk-reextract', () => {
    it('returns 401 without an Authorization header', async () => {
      const res = await integrationsApp.request('/policy-extraction/bulk-reextract', {
        method: 'POST',
        body: JSON.stringify({ providerId: 'p1' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 when providerId is missing', async () => {
      const res = await integrationsApp.request('/policy-extraction/bulk-reextract', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'Missing providerId' });
    });

    it('returns 200 streaming response for a valid dry-run request', async () => {
      const res = await integrationsApp.request('/policy-extraction/bulk-reextract', {
        method: 'POST',
        body: JSON.stringify({ providerId: 'p1', dryRun: true }),
        headers: { ...AUTH, 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(200);
    });
  });
});
