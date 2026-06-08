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
