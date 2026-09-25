/**
 * Policy documents and policy extraction — who may reach another client's data.
 * ===========================================================================
 *
 * Both routers took a `clientId` from the caller (query, body or form field)
 * behind nothing but `requireAuth`, which any self-registered client passes.
 * The sibling `/policies` CRUD checked ownership; these two did not, so a
 * client could fetch a signed URL to any other client's policy schedule,
 * replace or delete it, read the AI-extracted policy data, or spend the firm's
 * AI budget on a provider-wide re-extraction.
 *
 *   - Policy DOCUMENTS are reached from the client's own service pages as well
 *     as the admin panel, so they use the shared client-access policy: self,
 *     platform admin, or the client's assigned adviser.
 *   - Policy EXTRACTION is only ever called from the admin panel, so every
 *     route is admin-only. That is pinned by walking the router's own route
 *     table, so a route added later without the guard fails here too.
 *
 * Real: route wiring, the client-access policy, the in-memory KV. Stubbed: the
 * auth guards (role-aware stand-ins), storage, and the adviser lookup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

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
    from: () => ({ select: () => ({ like: () => ({ data: [], error: null }) }) }),
    storage: {
      from: () => ({ createSignedUrl: storage.createSignedUrl, remove: storage.remove }),
    },
  }),
}));
vi.mock('../integrations-document-storage.ts', () => ({
  POLICY_DOC_BUCKET: 'policy-documents',
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

const { kvStore, request, multipart, routeRegistrations } =
  await import('./helpers/contract-harness.ts');
const documents = (await import('../integrations-policy-documents-routes.ts')).default;
const extraction = (await import('../integrations-policy-extraction-routes.ts')).default;

const POLICIES_A = 'policies:client:client-a';
const seedPolicyOfA = () =>
  kvStore.set(POLICIES_A, [
    { id: 'p1', clientId: 'client-a', document: { storageKey: 'client-a/p1.pdf' } },
  ]);

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  seedPolicyOfA();
});

describe('policy documents — download', () => {
  const download = (as: string, user: string) =>
    request(documents, '/policy-documents/download?policyId=p1&clientId=client-a', { as, user });

  it('refuses another client, and mints no signed URL', async () => {
    const res = await download('client', 'client-b');
    expect(res.status).toBe(403);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses an adviser who is not assigned to the client', async () => {
    const res = await download('adviser', 'some-other-adviser');
    expect(res.status).toBe(403);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['the client themself', 'client', 'client-a'],
    ['their assigned adviser', 'adviser', 'adviser-of-a'],
    ['an admin', 'admin', 'admin-1'],
  ])('allows %s', async (_label, as, user) => {
    const res = await download(as, user);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ url: 'https://signed/doc.pdf' });
  });
});

describe('policy documents — changes', () => {
  it("refuses another client replacing a client's document", async () => {
    const form = multipart([
      { name: 'file', value: '%PDF-1.4', filename: 'x.pdf', type: 'application/pdf' },
      { name: 'policyId', value: 'p1' },
      { name: 'clientId', value: 'client-a' },
      { name: 'uploadedBy', value: 'client-b' },
    ]);
    const res = await request(documents, '/policy-documents/upload', {
      as: 'client',
      user: 'client-b',
      method: 'POST',
      form,
    });
    expect(res.status).toBe(403);
    expect(storage.replacePolicyDocumentForPolicy).not.toHaveBeenCalled();
  });

  it("refuses another client deleting a client's document, and leaves it in place", async () => {
    const res = await request(documents, '/policy-documents', {
      as: 'client',
      user: 'client-b',
      method: 'DELETE',
      body: { policyId: 'p1', clientId: 'client-a' },
    });
    expect(res.status).toBe(403);
    expect(storage.remove).not.toHaveBeenCalled();
    expect((kvStore.get(POLICIES_A) as Array<{ document?: unknown }>)[0].document).toBeDefined();
  });

  it('lets the client remove their own document', async () => {
    const res = await request(documents, '/policy-documents', {
      as: 'client',
      user: 'client-a',
      method: 'DELETE',
      body: { policyId: 'p1', clientId: 'client-a' },
    });
    expect(res.status).toBe(200);
    expect(storage.remove).toHaveBeenCalledWith(['client-a/p1.pdf']);
  });
});

describe('policy extraction — admin only', () => {
  const routes = routeRegistrations(extraction)
    .filter((r) => r.method !== 'ALL')
    .map((r) => [r.method, r.path] as const)
    .filter(([m, p], i, all) => all.findIndex(([m2, p2]) => m2 === m && p2 === p) === i);

  it('walks every route the router registers', () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it.each(routes)('refuses a signed-in client: %s %s', async (method, path) => {
    const res = await request(
      extraction,
      `${path}?policyId=p1&clientId=client-a&leftId=l&rightId=r&providerId=x`,
      {
        as: 'client',
        user: 'client-a',
        method,
        ...(method === 'GET' ? {} : { body: { policyId: 'p1', clientId: 'client-a' } }),
      },
    );
    expect(res.status).toBe(403);
  });

  it('still serves an admin', async () => {
    const res = await request(extraction, '/provider-terminology', { as: 'admin' });
    expect(res.status).toBe(200);
  });
});
