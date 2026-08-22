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
