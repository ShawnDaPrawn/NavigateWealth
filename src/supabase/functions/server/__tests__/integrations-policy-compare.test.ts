/**
 * GET /policies/compare — the cross-policy comparison behind the admin client
 * profile. The panel called this route before it existed (404 in the Issue
 * Manager), so this pins that it answers, shapes the rows the panel reads, and
 * stays behind the same client-access policy as /policies.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const SCHEMA = vi.hoisted(() => ({
  categoryId: 'risk_planning',
  fields: [
    { id: 'f1', name: 'Policy Number' },
    { id: 'f2', name: 'premium' },
    { id: 'f3', name: 'Status' },
    { id: 'f4', name: 'Something else' },
  ],
}));

/** What `getByPrefix('config:schema:')` reads. Empty means "no stored schema". */
const schemaQuery = vi.hoisted(() => ({
  data: [] as { value: unknown }[] | null,
  error: null as { message: string } | null,
}));

const storage = vi.hoisted(() => ({
  replacePolicyDocumentForPolicy: vi.fn(async () => ({ storageKey: 'new-key' })),
  remove: vi.fn(async () => ({ error: null })),
  createSignedUrl: vi.fn(async () => ({
    data: { signedUrl: 'https://signed/doc.pdf' },
    error: null,
  })),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', async () => {
  const { makeRoleGate } = await import('./helpers/contract-harness.ts');
  return {
    // requireAuth admits ANY signed-in role — so a route still on it lets a
    // client through, which is exactly what these tests must catch.
    requireAuth: makeRoleGate(['client', 'adviser', 'admin', 'super_admin'], 'AUTH', 'client'),
    requireAdmin: makeRoleGate(['admin', 'super_admin', 'super-admin'], 'FORBIDDEN_ADMIN'),
  };
});
vi.mock('../ai-usage-limit.ts', () => ({
  aiUsageLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
  chargeAiUsage: async () => null,
}));
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: vi.fn(async (clientId: string) =>
    clientId === 'client-a' ? 'adviser-of-a' : null,
  ),
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        like: () => ({ data: schemaQuery.data, error: schemaQuery.error }),
      }),
    }),
    storage: {
      from: () => ({ createSignedUrl: storage.createSignedUrl, remove: storage.remove }),
    },
  }),
}));
vi.mock('../integrations-document-storage.ts', () => ({
  POLICY_DOC_BUCKET: 'policy-documents',
  POLICY_CATEGORY_LABELS: { risk_planning: 'Risk Planning' },
  ensurePolicyDocBucket: vi.fn(async () => undefined),
  replacePolicyDocumentForPolicy: storage.replacePolicyDocumentForPolicy,
}));
vi.mock('../policy-extraction-service.ts', () => ({
  extractPolicyDocument: vi.fn(async () => ({ success: true })),
  getProviderTerminology: vi.fn(async () => null),
  saveProviderTerminology: vi.fn(async () => undefined),
  getAllProviderTerminologies: vi.fn(async () => []),
  buildHistoryEntry: vi.fn(() => ({})),
}));
vi.mock('../integrations-derive.ts', () => ({ recalculateClientTotals: vi.fn(async () => {}) }));

const { kvStore, request } = await import('./helpers/contract-harness.ts');
const policyRoutes = (await import('../integrations-policy-routes.ts')).default;

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  schemaQuery.data = [{ value: SCHEMA }];
  schemaQuery.error = null;
  kvStore.set('policies:client:client-a', [
    {
      id: 'p1',
      clientId: 'client-a',
      categoryId: 'risk_planning',
      providerId: 'prov',
      providerName: 'Acme Life',
      createdAt: '2026-01-01',
      data: { f1: 'POL-1', f2: 1200, f3: '' },
      document: { storageKey: 'k' },
      lockedFields: ['f1'],
    },
    { id: 'p2', clientId: 'client-a', categoryId: 'risk_planning', archived: true, data: {} },
  ]);
});

const compare = (as: string, user: string, clientId = 'client-a') =>
  request(policyRoutes, `/policies/compare?clientId=${clientId}`, { as, user });

describe('GET /policies/compare', () => {
  it('returns active policies with their non-empty key fields', async () => {
    const res = await compare('admin', 'admin-1');
    expect(res.status).toBe(200);
    const { policies } = (await res.json()) as { policies: Record<string, unknown>[] };
    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({
      id: 'p1',
      providerName: 'Acme Life',
      categoryLabel: 'Risk Planning',
      hasDocument: true,
      hasExtraction: false,
      lockedFieldCount: 1,
    });
    expect((policies[0].keyFields as { label: string }[]).map((k) => k.label)).toEqual([
      'Policy Number',
      'Premium',
    ]);
  });

  it('requires a clientId', async () => {
    const res = await request(policyRoutes, '/policies/compare', { as: 'admin', user: 'admin-1' });
    expect(res.status).toBe(400);
  });

  it('refuses another client', async () => {
    const res = await compare('client', 'client-b');
    expect(res.status).toBe(403);
  });

  it('lets the client and their assigned adviser compare, and refuses a different adviser', async () => {
    expect((await compare('client', 'client-a')).status).toBe(200);
    expect((await compare('adviser', 'adviser-of-a')).status).toBe(200);
    expect((await compare('adviser', 'adviser-of-b')).status).toBe(403);
  });

  it('keeps a zero amount, matches a key field by folded name, and drops blanks', async () => {
    schemaQuery.data = [
      {
        value: {
          categoryId: 'risk_planning',
          fields: [
            { id: 'cover', name: '  cover amount ' },
            { id: 'prem', name: 'PREMIUM' },
            { id: 'status', name: 'Status' },
            { id: 'who', name: 'Beneficiary' },
          ],
        },
      },
    ];
    kvStore.set('policies:client:client-a', [
      {
        id: 'p1',
        clientId: 'client-a',
        categoryId: 'risk_planning',
        providerName: 'Acme Life',
        data: { cover: 0, prem: 1200, status: '', who: 'spouse' },
      },
    ]);

    const res = await compare('admin', 'admin-1');
    expect(res.status).toBe(200);
    const { policies } = (await res.json()) as {
      policies: { keyFields: { label: string; value: unknown }[]; totalFieldCount: number }[];
    };
    expect(policies[0].keyFields).toEqual([
      { label: 'Cover Amount', fieldId: 'cover', fieldName: '  cover amount ', value: 0 },
      { label: 'PREMIUM', fieldId: 'prem', fieldName: 'PREMIUM', value: 1200 },
    ]);
    expect(policies[0].totalFieldCount).toBe(4);
  });

  it('reports extraction only once it completed, and keeps a confidence of 0', async () => {
    kvStore.set('policies:client:client-a', [
      {
        id: 'done',
        clientId: 'client-a',
        categoryId: 'not_a_category',
        providerName: 'Done Co',
        data: {},
        extraction: { status: 'completed', confidence: 0 },
      },
      {
        id: 'pending',
        clientId: 'client-a',
        categoryId: 'risk_planning',
        providerName: 'Pending Co',
        data: {},
        extraction: { status: 'pending', confidence: 0.9 },
      },
    ]);

    const res = await compare('admin', 'admin-1');
    const { policies } = (await res.json()) as {
      policies: {
        id: string;
        categoryLabel: string;
        hasDocument: boolean;
        hasExtraction: boolean;
        extractionConfidence: number | null;
      }[];
    };
    expect(policies.map((p) => p.id)).toEqual(['done', 'pending']);
    expect(policies[0]).toMatchObject({
      categoryLabel: 'not_a_category',
      hasDocument: false,
      hasExtraction: true,
      extractionConfidence: 0,
    });
    expect(policies[1]).toMatchObject({
      hasExtraction: false,
      extractionConfidence: null,
    });
  });

  it('falls back to the built-in schema, and a stored schema replaces that default', async () => {
    schemaQuery.data = [];
    kvStore.set('policies:client:client-a', [
      {
        id: 'builtin',
        clientId: 'client-a',
        categoryId: 'risk_planning',
        providerName: 'Acme Life',
        data: { rp_1: 'POL-1', rp_6: 0, rp_2: 1_000_000, rp_7: 'private note' },
      },
    ]);

    const builtin = await compare('admin', 'admin-1');
    const builtinBody = (await builtin.json()) as {
      policies: { keyFields: { label: string; value: unknown }[] }[];
    };
    expect(builtinBody.policies[0].keyFields).toEqual([
      { label: 'Policy Number', fieldId: 'rp_1', fieldName: 'Policy Number', value: 'POL-1' },
      { label: 'Premium', fieldId: 'rp_6', fieldName: 'Premium', value: 0 },
    ]);

    schemaQuery.data = [
      { value: { categoryId: 'risk_planning', fields: [{ id: 'n', name: 'Notes' }] } },
    ];
    kvStore.set('policies:client:client-a', [
      {
        id: 'custom',
        clientId: 'client-a',
        categoryId: 'risk_planning',
        providerName: 'Acme Life',
        data: { n: 'x', rp_6: 99 },
      },
    ]);
    const custom = await compare('admin', 'admin-1');
    const customBody = (await custom.json()) as { policies: { keyFields: unknown[] }[] };
    expect(customBody.policies[0].keyFields).toEqual([]);
  });

  it('answers 500 when the schema read fails, rather than an empty comparison', async () => {
    schemaQuery.error = { message: 'db down' };
    schemaQuery.data = null;
    const res = await compare('admin', 'admin-1');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to build policy comparison' });
  });
});
