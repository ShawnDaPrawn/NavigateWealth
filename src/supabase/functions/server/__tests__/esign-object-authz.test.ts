/**
 * Object-level authorization on e-sign download/audit (P1.4 / S6)
 * ==============================================================
 *
 * Eight handlers did this:
 *
 *     const _ctx = await getAuthContext(c);
 *
 * — authenticate, then discard the answer. The underscore is the tell. Any
 * authenticated user could fetch ANY envelope's signed PDF, audit trail,
 * completion certificate, evidence pack or field definitions by supplying
 * someone else's envelope id. These are legally binding signatures over client
 * financial documents, so that is a cross-tenant leak: authentication was never
 * the control, ownership is.
 *
 * `assertFirmAccess` already existed (PR #207) and was wired to nothing.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/esign-object-authz.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

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

const getEnvelopeDetails = vi.fn();
vi.mock('../esign-services.ts', () => ({
  getEnvelopeDetails: (...a: unknown[]) => getEnvelopeDetails(...a),
  getAuditTrail: vi.fn(async () => []),
}));

vi.mock('../esign-storage.ts', () => ({
  initializeStorageBuckets: vi.fn(async () => {}),
  downloadDocument: vi.fn(async () => null),
  getDocumentUrl: vi.fn(async () => 'https://x/doc'),
  getCertificateUrl: vi.fn(async () => 'https://x/cert'),
}));

vi.mock('../api-key-service.ts', () => ({ resolveApiKey: vi.fn(async () => null) }));

const { requireOwnedEnvelope, firmScopeResponse } = await import('../esign-route-helpers.ts');
const { FirmScopeError } = await import('../esign-firm-scope.ts');

/** A user in firm-alpha, and one in firm-beta. */
const alpha = { id: 'user-a', app_metadata: { firm_id: 'firm-alpha' } };
const beta = { id: 'user-b', app_metadata: { firm_id: 'firm-beta' } };
/** No firm in app_metadata — resolveFirmId falls back to the user id. */
const standalone = { id: 'user-solo', app_metadata: {} };

beforeEach(() => {
  getEnvelopeDetails.mockReset();
});

describe('requireOwnedEnvelope', () => {
  it('returns the envelope to a caller in the owning firm', async () => {
    getEnvelopeDetails.mockResolvedValue({ id: 'env-1', firm_id: 'firm-alpha' });
    await expect(requireOwnedEnvelope(alpha, 'env-1')).resolves.toMatchObject({ id: 'env-1' });
  });

  it('DENIES a caller from another firm', async () => {
    // The whole finding, in one assertion: user-b knows env-1's id and is
    // perfectly well authenticated. That used to be enough.
    getEnvelopeDetails.mockResolvedValue({ id: 'env-1', firm_id: 'firm-alpha' });
    await expect(requireOwnedEnvelope(beta, 'env-1')).rejects.toBeInstanceOf(FirmScopeError);
  });

  it('returns null for a missing envelope, so the route can 404', async () => {
    // Distinct from a denial: a 403 on a non-existent id would confirm to an
    // attacker which envelope ids exist.
    getEnvelopeDetails.mockResolvedValue(null);
    await expect(requireOwnedEnvelope(alpha, 'nope')).resolves.toBeNull();
  });

  it('denies an envelope carrying no firm_id, rather than failing open', async () => {
    getEnvelopeDetails.mockResolvedValue({ id: 'legacy-1' });
    await expect(requireOwnedEnvelope(alpha, 'legacy-1')).rejects.toBeInstanceOf(FirmScopeError);
  });

  it('denies an envelope whose firm_id is empty', async () => {
    getEnvelopeDetails.mockResolvedValue({ id: 'env-2', firm_id: '' });
    await expect(requireOwnedEnvelope(alpha, 'env-2')).rejects.toBeInstanceOf(FirmScopeError);
  });

  it('scopes a standalone user to their own id, not to a shared bucket', async () => {
    // resolveFirmId falls back to user.id, so two users without app_metadata
    // firm ids must NOT be able to read each other's envelopes.
    getEnvelopeDetails.mockResolvedValue({ id: 'env-3', firm_id: 'user-solo' });
    await expect(requireOwnedEnvelope(standalone, 'env-3')).resolves.toMatchObject({
      id: 'env-3',
    });
    await expect(
      requireOwnedEnvelope({ id: 'other', app_metadata: {} }, 'env-3'),
    ).rejects.toBeInstanceOf(FirmScopeError);
  });

  it('ignores a firm_id planted in client-editable user_metadata', async () => {
    // The S12 class of bug: authorization must never read user_metadata.
    const spoofer = {
      id: 'user-x',
      app_metadata: {},
      user_metadata: { firm_id: 'firm-alpha' },
    } as { id: string; app_metadata?: Record<string, unknown> };
    getEnvelopeDetails.mockResolvedValue({ id: 'env-1', firm_id: 'firm-alpha' });
    await expect(requireOwnedEnvelope(spoofer, 'env-1')).rejects.toBeInstanceOf(FirmScopeError);
  });
});

describe('firmScopeResponse', () => {
  const context = () =>
    ({ json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }) }) as never;

  it('maps a firm-scope denial to a 403 that leaks nothing', async () => {
    const res = firmScopeResponse(context(), new FirmScopeError()) as unknown as {
      body: { error: string };
      status: number;
    };
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('passes other errors through so their own handling still runs', () => {
    expect(firmScopeResponse(context(), new Error('something else'))).toBeNull();
  });
});
