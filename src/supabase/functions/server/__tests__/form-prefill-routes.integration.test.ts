import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const authenticateUser = vi.fn();
const resolveFormPrefill = vi.fn();

vi.mock('../fna-auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fna-auth.ts')>();
  return {
    ...actual,
    authenticateUser: (...args: unknown[]) => authenticateUser(...args),
  };
});

vi.mock('../form-prefill-resolver.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../form-prefill-resolver.ts')>();
  return {
    ...actual,
    resolveFormPrefill: (...args: unknown[]) => resolveFormPrefill(...args),
  };
});

vi.mock('../form-prefill-rate-limit.ts', () => ({
  assertPrefillResolveRateLimit: vi.fn(),
}));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(),
  getByPrefix: vi.fn(),
  set: vi.fn(),
}));

import * as kv from '../kv_store.tsx';
import formPrefillRoutes from '../form-prefill-routes.ts';

const app = new Hono();
app.route('/', formPrefillRoutes);

const clientId = '11111111-1111-1111-1111-111111111111';
const otherClientId = '22222222-2222-2222-2222-222222222222';
const adviserId = '44444444-4444-4444-4444-444444444444';

const authHeader = { Authorization: 'Bearer test-token' };

describe('form-prefill-routes auth matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Establish the assignment these cases always CLAIMED to have. Prefill now
    // follows the shared client-access policy (S16), so "assigned workflow
    // client" has to be true rather than merely named: the resolver reads the
    // client's profile for `adviserId`. Before S16 nothing consulted it, so
    // these tests passed while asserting an adviser could reach a client they
    // had no relationship to — which is the access that turned out to be a
    // bypass of P1.4.
    vi.mocked(kv.get).mockImplementation(async (key: string) =>
      key === `user_profile:${clientId}:personal_info` ? { adviserId } : null,
    );
    resolveFormPrefill.mockResolvedValue({
      formId: 'retirement-fna-step1',
      clientId,
      matches: [],
      unmatchedFormFields: [],
      proposedValues: {},
      resolverVersion: '1.0.0',
    });
  });

  it('returns 401 when auth header is missing', async () => {
    authenticateUser.mockRejectedValue(new Error('Unauthorized'));

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, formId: 'retirement-fna-step1' }),
    });
    expect(res.status).toBe(401);
  });

  it('forbids client role from resolve', async () => {
    authenticateUser.mockResolvedValue({ id: clientId, email: 'c@test.com', role: 'client' });

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, formId: 'retirement-fna-step1' }),
    });
    expect(res.status).toBe(403);
    expect(resolveFormPrefill).not.toHaveBeenCalled();
  });

  it('allows adviser resolve for assigned workflow client', async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, formId: 'retirement-fna-step1' }),
    });
    expect(res.status).toBe(200);
    expect(resolveFormPrefill).toHaveBeenCalledWith(
      clientId,
      'retirement-fna-step1',
      expect.objectContaining({ includePolicies: true }),
    );
  });

  it('forbids an adviser resolving a client they are not assigned to', async () => {
    // The route-level proof of S16. This constant was declared and unused
    // (`_otherClientId`) — the case it was named for could not be written while
    // any adviser could reach any client.
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: otherClientId, formId: 'retirement-fna-step1' }),
    });

    expect(res.status).toBe(403);
    // The PII read never happens — a 403 rendered after resolveFormPrefill ran
    // would have already loaded the profile, keys and policies.
    expect(resolveFormPrefill).not.toHaveBeenCalled();
  });

  it('still lets a platform admin resolve any client', async () => {
    // The constraint on this change: tightening advisers must not touch admins.
    authenticateUser.mockResolvedValue({ id: 'boss', email: 'b@test.com', role: 'super_admin' });

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: otherClientId, formId: 'retirement-fna-step1' }),
    });

    expect(res.status).toBe(200);
  });

  it('rejects invalid formId', async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });

    const res = await app.request('/resolve', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, formId: 'not-a-form' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns prefill audit rows for adviser', async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });
    vi.mocked(kv.getByPrefix).mockResolvedValue([
      {
        clientId,
        formId: 'medical-fna-step1',
        appliedFields: ['currentAge'],
        adminUserId: adviserId,
        timestamp: '2026-05-23T10:00:00.000Z',
        resolverVersion: '1.0.0',
      },
    ]);

    const res = await app.request(`/audit/${clientId}`, {
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].formId).toBe('medical-fna-step1');
  });

  it('normalize-intake with clientId returns prefill payload', async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });
    resolveFormPrefill.mockResolvedValue({
      formId: 'medical-fna-step1',
      clientId,
      matches: [{ formField: 'currentAge', proposedValue: 40, conflict: false }],
      unmatchedFormFields: [],
      proposedValues: { currentAge: 40 },
      resolverVersion: '1.0.0',
    });

    const res = await app.request('/normalize-intake', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'medical',
        clientId,
        inputs: { clientAge: 35 },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.wizardInputs).toBeDefined();
    expect(body.data.prefill?.formId).toBe('medical-fna-step1');
    expect(resolveFormPrefill).toHaveBeenCalled();
  });
});
