/**
 * client/communication/api.ts — unit tests
 *
 * Mocks:
 *   - utils/api (api.get / api.post)
 *   - utils/supabase/client (createClient → auth.getSession)
 *   - fetch (via vi.stubGlobal) for fetchPreferences / updatePreferences
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock api util ────────────────────────────────────────────────────────────
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../../../utils/api', () => ({
  api: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
  },
}));

// ── Mock Supabase client ─────────────────────────────────────────────────────
const mockGetSession = vi.fn();

vi.mock('../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: (...a: unknown[]) => mockGetSession(...a) },
  }),
}));

// ── Mock supabase info ───────────────────────────────────────────────────────
vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'test-project-id',
  publicAnonKey: 'anon-key',
  supabaseUrl: 'https://test-project-id.supabase.co',
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { fetchInbox, markAsRead, fetchPreferences, updatePreferences } from '../api';
import type { CommunicationSettings } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  // Default: authenticated session with token
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'user-token' } },
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── fetchInbox ────────────────────────────────────────────────────────────────
describe('fetchInbox', () => {
  it('returns mapped Communication objects on success', async () => {
    const rawMessages = [
      {
        id: 'msg-1',
        sender_name: 'Jane Adviser',
        sender_role: 'Adviser',
        subject: 'Your FNA is ready',
        content: 'Please review',
        category: 'FNA Available',
        created_at: '2025-03-01T10:00:00Z',
        read: false,
        priority: 'high',
      },
    ];
    mockApiGet.mockResolvedValue({ messages: rawMessages });

    const result = await fetchInbox();
    expect(mockApiGet).toHaveBeenCalledWith('/communication/inbox');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('msg-1');
    expect(result[0].from).toBe('Jane Adviser');
    expect(result[0].fromRole).toBe('Adviser');
    expect(result[0].subject).toBe('Your FNA is ready');
    expect(result[0].message).toBe('Please review');
    expect(result[0].category).toBe('FNA Available');
    expect(result[0].read).toBe(false);
    expect(result[0].priority).toBe('high');
    expect(result[0].timestamp).toBeInstanceOf(Date);
  });

  it('falls back to default values for missing DTO fields', async () => {
    const rawMessages = [
      {
        id: 'msg-2',
        subject: 'Hello',
      },
    ];
    mockApiGet.mockResolvedValue({ messages: rawMessages });

    const result = await fetchInbox();
    expect(result[0].from).toBe('Navigate Wealth');
    expect(result[0].fromRole).toBe('System');
    expect(result[0].message).toBe('');
    expect(result[0].category).toBe('General');
    expect(result[0].read).toBe(false);
    expect(result[0].priority).toBe('normal');
  });

  it('returns empty array when messages field is missing', async () => {
    mockApiGet.mockResolvedValue({});

    const result = await fetchInbox();
    expect(result).toEqual([]);
  });

  it('propagates errors from the api client', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    await expect(fetchInbox()).rejects.toThrow('Network error');
  });

  it('uses from field when sender_name is missing', async () => {
    const rawMessages = [{ id: 'msg-3', from: 'Admin', subject: 'Hi' }];
    mockApiGet.mockResolvedValue({ messages: rawMessages });

    const result = await fetchInbox();
    expect(result[0].from).toBe('Admin');
  });

  it('uses message field when content is missing', async () => {
    const rawMessages = [{ id: 'msg-4', subject: 'Hi', message: 'Hello there' }];
    mockApiGet.mockResolvedValue({ messages: rawMessages });

    const result = await fetchInbox();
    expect(result[0].message).toBe('Hello there');
  });
});

// ── markAsRead ────────────────────────────────────────────────────────────────
describe('markAsRead', () => {
  it('calls api.post with the correct endpoint', async () => {
    mockApiPost.mockResolvedValue(undefined);
    await markAsRead('msg-999');
    expect(mockApiPost).toHaveBeenCalledWith('/communication/read/msg-999');
  });

  it('propagates errors from the api client', async () => {
    mockApiPost.mockRejectedValue(new Error('Post error'));
    await expect(markAsRead('msg-1')).rejects.toThrow('Post error');
  });
});

// ── fetchPreferences ──────────────────────────────────────────────────────────
describe('fetchPreferences', () => {
  it('returns null when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await fetchPreferences();
    expect(result).toBeNull();
  });

  it('returns CommunicationSettings on success', async () => {
    const prefs: CommunicationSettings = {
      transactional: { email: true, sms: true },
      marketing: { email: false, sms: false },
      frequency: 'realtime',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: prefs })),
    );

    const result = await fetchPreferences();
    expect(result).toEqual(prefs);
  });

  it('returns null when response success is false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: false })));

    const result = await fetchPreferences();
    expect(result).toBeNull();
  });

  it('returns null when data is missing from response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: null })),
    );

    const result = await fetchPreferences();
    expect(result).toBeNull();
  });

  it('uses defaults when optional fields are missing from data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: {} })),
    );

    const result = await fetchPreferences();
    expect(result).toEqual({
      transactional: { email: true, sms: true },
      marketing: { email: false, sms: false },
      frequency: 'realtime',
    });
  });

  it('includes Authorization header in the fetch call', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await fetchPreferences();
    const [, options] = mockFetch.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer user-token',
    });
  });
});

// ── updatePreferences ─────────────────────────────────────────────────────────
describe('updatePreferences', () => {
  const preferences: CommunicationSettings = {
    transactional: { email: true, sms: false },
    marketing: { email: true, sms: true },
    frequency: 'daily',
  };

  it('resolves without error on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: true })));

    await expect(updatePreferences(preferences)).resolves.toBeUndefined();
  });

  it('sends a PUT request with JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await updatePreferences(preferences);
    const [, options] = mockFetch.mock.calls[0];
    expect((options as RequestInit).method).toBe('PUT');
    expect(JSON.parse((options as RequestInit).body as string)).toEqual(preferences);
  });

  it('throws when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    await expect(updatePreferences(preferences)).rejects.toThrow('Not authenticated');
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ error: 'Forbidden' }, false, 403)),
    );

    await expect(updatePreferences(preferences)).rejects.toThrow('Forbidden');
  });

  it('throws generic message when error field is missing and response not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({}, false, 500)));

    await expect(updatePreferences(preferences)).rejects.toThrow(
      'Failed to save communication preferences',
    );
  });
});
