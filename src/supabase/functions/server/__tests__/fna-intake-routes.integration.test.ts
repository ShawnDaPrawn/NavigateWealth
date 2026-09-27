import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const authenticateUser = vi.fn();

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: vi.fn(),
}));

vi.mock('../fna-auth.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../fna-auth.ts')>();
  return {
    ...actual,
    authenticateUser: (...args: unknown[]) => authenticateUser(...args),
  };
});

const getActiveIntakeSession = vi.fn();
const getIntakeSession = vi.fn();
const listSubmittedIntakeSessions = vi.fn();
const acceptIntakeSession = vi.fn();
const requestMoreInfo = vi.fn();
const createOrUpdateIntakeDraft = vi.fn();
const submitIntakeSession = vi.fn();

vi.mock('../fna-intake-service.ts', () => ({
  getActiveIntakeSession: (...args: unknown[]) => getActiveIntakeSession(...args),
  getIntakeSession: (...args: unknown[]) => getIntakeSession(...args),
  listSubmittedIntakeSessions: (...args: unknown[]) => listSubmittedIntakeSessions(...args),
  acceptIntakeSession: (...args: unknown[]) => acceptIntakeSession(...args),
  requestMoreInfo: (...args: unknown[]) => requestMoreInfo(...args),
  createOrUpdateIntakeDraft: (...args: unknown[]) => createOrUpdateIntakeDraft(...args),
  submitIntakeSession: (...args: unknown[]) => submitIntakeSession(...args),
  sanitizeIntakeForClient: (session: unknown) => session,
  isFnaIntakeDomain: (domain: string) =>
    ['risk', 'medical', 'retirement', 'investment', 'tax', 'estate'].includes(domain),
}));

// The shared client-access policy is real; only the adviser-assignment lookup
// it depends on is stubbed. The adviser below is assigned to `clientId` only.
const resolveClientAdviserUserId = vi.fn();
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: (...args: unknown[]) => resolveClientAdviserUserId(...args),
}));

vi.mock('../fna-intake-rate-limit.ts', () => ({
  assertIntakeDraftRateLimit: vi.fn(),
  assertIntakeSubmitRateLimit: vi.fn(),
}));

import fnaIntakeRoutes from '../fna-intake-routes.ts';

const app = new Hono();
app.route('/', fnaIntakeRoutes);

const clientId = '11111111-1111-1111-1111-111111111111';
const otherClientId = '22222222-2222-2222-2222-222222222222';
const sessionId = '33333333-3333-3333-3333-333333333333';
const adviserId = '44444444-4444-4444-4444-444444444444';

const authHeader = { Authorization: 'Bearer test-token' };

describe('fna-intake-routes auth matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveIntakeSession.mockResolvedValue(null);
    getIntakeSession.mockResolvedValue(null);
    listSubmittedIntakeSessions.mockResolvedValue([]);
    resolveClientAdviserUserId.mockImplementation(async (id: string) =>
      id === clientId ? adviserId : null,
    );
  });

  it('returns 401 when auth header is missing', async () => {
    authenticateUser.mockRejectedValue(new Error('Unauthorized'));

    const res = await app.request('/retirement/status/' + clientId);
    expect(res.status).toBe(401);
  });

  it('forbids client from queue/list', async () => {
    authenticateUser.mockResolvedValue({ id: clientId, email: 'c@test.com', role: 'client' });

    const res = await app.request('/queue/list', { headers: authHeader });
    expect(res.status).toBe(403);
    expect(listSubmittedIntakeSessions).not.toHaveBeenCalled();
  });

  it('allows an admin the firm-wide queue', async () => {
    authenticateUser.mockResolvedValue({ id: 'admin-1', email: 'ad@test.com', role: 'admin' });
    listSubmittedIntakeSessions.mockResolvedValue([]);

    const res = await app.request('/queue/list', { headers: authHeader });
    expect(res.status).toBe(200);
    expect(listSubmittedIntakeSessions).toHaveBeenCalled();
  });

  it('refuses an adviser the firm-wide queue', async () => {
    // Every submitted intake, for every client. An adviser reaches their own
    // clients' intakes through the per-client routes instead.
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });

    const res = await app.request('/queue/list', { headers: authHeader });
    expect(res.status).toBe(403);
    expect(listSubmittedIntakeSessions).not.toHaveBeenCalled();
  });

  it("refuses an adviser another adviser's client, reads included", async () => {
    // The local helper this file used to carry let ANY adviser through.
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });

    const res = await app.request('/retirement/draft/' + otherClientId, { headers: authHeader });
    expect(res.status).toBe(403);
    expect(getActiveIntakeSession).not.toHaveBeenCalled();
  });

  it('forbids client from reading another client status', async () => {
    authenticateUser.mockResolvedValue({ id: clientId, email: 'c@test.com', role: 'client' });

    const res = await app.request('/retirement/status/' + otherClientId, { headers: authHeader });
    expect(res.status).toBe(403);
    expect(getActiveIntakeSession).not.toHaveBeenCalled();
  });

  it('rejects synthetic admin on draft save', async () => {
    authenticateUser.mockResolvedValue({ id: 'admin', email: 'admin@system', role: 'admin' });

    const res = await app.request('/retirement/draft/' + clientId, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: {} }),
    });
    expect(res.status).toBe(401);
    expect(createOrUpdateIntakeDraft).not.toHaveBeenCalled();
  });

  it('rejects synthetic admin on accept', async () => {
    authenticateUser.mockResolvedValue({ id: 'admin', email: 'admin@system', role: 'admin' });

    const res = await app.request('/session/' + sessionId + '/accept', {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(401);
    expect(acceptIntakeSession).not.toHaveBeenCalled();
  });

  it("refuses an adviser accepting an intake for a client who isn't theirs", async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });
    getIntakeSession.mockResolvedValue({
      id: sessionId,
      clientId: otherClientId,
      domain: 'retirement',
      status: 'submitted',
    });

    for (const action of ['accept', 'request-info']) {
      const res = await app.request('/session/' + sessionId + '/' + action, {
        method: 'POST',
        headers: authHeader,
      });
      expect(res.status, action).toBe(403);
    }
    expect(acceptIntakeSession).not.toHaveBeenCalled();
    expect(requestMoreInfo).not.toHaveBeenCalled();
  });

  it('allows the assigned adviser to accept', async () => {
    authenticateUser.mockResolvedValue({ id: adviserId, email: 'a@test.com', role: 'adviser' });
    getIntakeSession.mockResolvedValue({
      id: sessionId,
      clientId,
      domain: 'retirement',
      status: 'submitted',
    });
    acceptIntakeSession.mockResolvedValue({
      session: { id: sessionId, clientId, domain: 'retirement', status: 'accepted' },
      linkedFnaId: 'fna-1',
    });

    const res = await app.request('/session/' + sessionId + '/accept', {
      method: 'POST',
      headers: authHeader,
    });
    expect(res.status).toBe(200);
    expect(acceptIntakeSession).toHaveBeenCalledWith(sessionId, {
      id: adviserId,
      email: 'a@test.com',
    });
  });

  it('forbids client submit on another client session', async () => {
    authenticateUser.mockResolvedValue({ id: clientId, email: 'c@test.com', role: 'client' });
    getIntakeSession.mockResolvedValue({
      id: sessionId,
      clientId: otherClientId,
      domain: 'retirement',
      status: 'client_draft',
    });

    const res = await app.request('/session/' + sessionId + '/submit', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consentAccepted: true }),
    });
    expect(res.status).toBe(403);
    expect(submitIntakeSession).not.toHaveBeenCalled();
  });
});
