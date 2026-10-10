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
    from: () => ({ select: () => ({ like: () => ({ data: [{ value: SCHEMA }], error: null }) }) }),
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
});
