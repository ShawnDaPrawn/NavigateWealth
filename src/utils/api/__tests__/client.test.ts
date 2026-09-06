import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../../supabase/info', () => ({
  publicAnonKey: 'test-anon-key',
  supabaseUrl: 'https://test.supabase.co',
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
});

describe('Authorization header (P1.1)', () => {
  /**
   * The client used to fall back to `publicAnonKey` whenever there was no
   * session, so every request carried `Authorization: Bearer <anon key>`.
   *
   * That is not a credential — it ships in the browser bundle, and since PR #207
   * no server route authenticates it. Its only effect was to disguise "logged
   * out" as "authenticated with a rejected token", which is how
   * `communication/api.ts`'s file upload came to POST it at a
   * `requireAuth, requireAdmin` route and look wired up while never working.
   *
   * The textual ratchet in anon-key-bearer-ratchet.test.ts cannot pin this:
   * re-adding an unconditional `Bearer ${token}` here would not put the string
   * `publicAnonKey` back in this file. These tests assert the BEHAVIOUR instead.
   */
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ok = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });

  it('sends the session JWT when there is a session', async () => {
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'real-session-jwt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/some/authenticated/route');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer real-session-jwt');
  });

  it('sends NO Authorization header at all when there is no session', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/quote-request/something');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('never sends the public anon key as a bearer', async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/contact-form/submit', { email: 'a@b.c' });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.stringify(options.headers)).not.toContain('test-anon-key');
  });

  it('sends no Authorization header when session retrieval throws', async () => {
    authMocks.getSession.mockRejectedValue(new Error('storage unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/anything');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('lets an explicit caller-supplied Authorization header win', async () => {
    // The signer portal passes its own token; the merge order must not drop it.
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.refreshSession.mockResolvedValue({ data: { session: null }, error: null });
    const fetchMock = ok();
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/anything', { headers: { Authorization: 'Bearer caller-supplied' } });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer caller-supplied');
  });
});

describe('supplied access token (auth-lock avoidance)', () => {
  /**
   * `AdminDataPrefetch` fires its requests from inside an `onAuthStateChange`
   * callback, and auth-js holds its storage-key lock for the whole of every
   * such callback — `AuthContext`'s profile hydration included. Anything that
   * reaches `supabase.auth.getSession()` from there queues behind that
   * hydration, and awaiting the result inside the callback deadlocks against
   * it outright. So a request carrying `accessToken` must make no auth call at
   * all; these tests assert the absence, which is the whole feature.
   *
   * Each case gets a FRESH client module. `api` is a singleton whose refresh
   * mutex (`refreshPromise`) survives for 500ms after a refresh, and a leaked
   * one makes `refreshToken` return early without calling `refreshSession` —
   * which would let "never refreshes" pass on a client that refreshes.
   */
  let freshApi: typeof import('../client').api;
  let FreshAPIError: typeof import('../client').APIError;

  beforeEach(async () => {
    vi.restoreAllMocks();
    // These assertions are about calls NOT happening, so the counters have to
    // start at zero rather than carrying earlier describes' history.
    authMocks.getSession.mockClear();
    authMocks.refreshSession.mockClear();
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'session-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        },
      },
    });
    // A refresh that SUCCEEDS, so a client that refreshes would go on to retry
    // and be caught by the fetch-call count below.
    authMocks.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-token' } },
      error: null,
    });

    vi.resetModules();
    const mod = await import('../client');
    freshApi = mod.api;
    FreshAPIError = mod.APIError;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });

  it('sends the supplied token and never reads the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await freshApi.get('/admin/stats', { accessToken: 'supplied-token' });

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer supplied-token');
    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
  });

  it('does not refresh-and-retry on a 401 with a supplied token', async () => {
    // Refreshing is an auth call, so the one path that could still reach the
    // lock after the token check has to be closed too.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      freshApi.get('/admin/stats', { accessToken: 'stale-token' }),
    ).rejects.toBeInstanceOf(FreshAPIError);

    // One attempt only: a refreshing client would have retried with the new token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authMocks.refreshSession).not.toHaveBeenCalled();
    expect(authMocks.getSession).not.toHaveBeenCalled();
  });

  it('does refresh-and-retry on a 401 WITHOUT a supplied token', async () => {
    // The counterpart of the case above — it is what proves that test is
    // measuring the token guard and not simply a client that never refreshes.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await freshApi.get('/admin/stats');

    expect(authMocks.refreshSession).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still reads the session when no token is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await freshApi.get('/admin/stats');

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer session-token');
    expect(authMocks.getSession).toHaveBeenCalled();
  });

  it('does not leak the token into the fetch options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await freshApi.get('/admin/stats', { accessToken: 'supplied-token' });

    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('accessToken');
  });
});
