import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../../supabase/info', () => ({
  publicAnonKey: 'test-anon-key',
  supabaseUrl: 'https://test.supabase.co',
  projectId: 'test-project',
}));

vi.mock('../../supabase/client', () => ({
  createClient: () => ({
    auth: authMocks,
  }),
}));

import { APIError, api } from '../client';

describe('APIClient retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'test-access-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not retry non-idempotent requests when retries are disabled', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      api.post('/consultation/request', { name: 'Test User' }, { retryTransientFailures: false }),
    ).rejects.toBeInstanceOf(APIError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('retryTransientFailures');
  });

  it('waits for session hydration before sending a request when a persisted session exists', async () => {
    // Simulate a logged-in user whose session is still hydrating: storage has the
    // Supabase token, but getSession() returns null for the first couple of calls
    // and then resolves to a real session.
    window.localStorage.setItem('sb-test-project-auth-token', '{"access_token":"x"}');
    authMocks.getSession
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValue({
        data: {
          session: {
            access_token: 'hydrated-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
      });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/some/endpoint');

    // The request must have gone out with the hydrated session token, NOT the anon key.
    const authHeader = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(authHeader.Authorization).toBe('Bearer hydrated-token');

    window.localStorage.removeItem('sb-test-project-auth-token');
  });
});
