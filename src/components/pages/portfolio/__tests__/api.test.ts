/**
 * portfolio/api.ts — unit tests
 *
 * Uses vi.stubGlobal('fetch', ...) so the API layer never hits the network.
 * getSupabaseClient is mocked to return a fake session token.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Supabase mock ────────────────────────────────────────────────────────────
// Must be declared before vi.mock calls (hoisted by Vitest).
const mockGetSession = vi.fn();

vi.mock('../../../../utils/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

// Also stub the supabase/info module so BASE URLs resolve without env vars
vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'test-project-id',
  publicAnonKey: 'anon-key',
  supabaseUrl: 'https://test-project-id.supabase.co',
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { fetchPortfolioSummary, bookMeeting, uploadDocument } from '../api';
import type { BookMeetingInput, UploadDocumentInput } from '../api';

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  // Default: authenticated session
  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'test-token' } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── fetchPortfolioSummary ────────────────────────────────────────────────────
describe('fetchPortfolioSummary', () => {
  it('returns portfolio data on success', async () => {
    const mockData = {
      clientData: {
        firstName: 'Jane',
        lastName: 'Doe',
        memberNumber: 'M001',
        totalWealthValue: 100000,
        lastUpdated: '2025-01-01',
        riskTolerance: 'medium',
        financialScore: 80,
      },
      financialOverview: {},
      recommendations: [],
      recentDocuments: [],
      upcomingEvents: [],
      productHoldings: [],
      adviserDetails: {
        name: 'Adviser',
        email: 'a@example.com',
        phone: '0820000000',
        fspReference: 'FSP001',
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: mockData })),
    );

    const result = await fetchPortfolioSummary('client-123');
    expect(result).toEqual(mockData);
  });

  it('includes the Authorization header in the fetch call', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await fetchPortfolioSummary('client-abc').catch(() => {});
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('client-abc');
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-token',
    });
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse('Unauthorized', false, 401)),
    );

    await expect(fetchPortfolioSummary('client-123')).rejects.toThrow(
      /Failed to fetch portfolio summary \(401\)/,
    );
  });

  it('throws when success flag is false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: false, error: 'Not found' })),
    );

    await expect(fetchPortfolioSummary('client-123')).rejects.toThrow('Not found');
  });

  it('throws generic message when success:false and no error field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: false })));

    await expect(fetchPortfolioSummary('client-123')).rejects.toThrow(
      'Failed to fetch portfolio summary',
    );
  });

  it('falls back to publicAnonKey when getSession throws', async () => {
    mockGetSession.mockRejectedValue(new Error('session error'));
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', mockFetch);

    await fetchPortfolioSummary('client-xyz').catch(() => {});
    const [, options] = mockFetch.mock.calls[0];
    expect((options as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer anon-key',
    });
  });

  it('throws when fetch itself throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchPortfolioSummary('client-123')).rejects.toThrow();
  });
});

// ── bookMeeting ──────────────────────────────────────────────────────────────
const baseInput: BookMeetingInput = {
  meetingType: 'Financial Review',
  preferredTime: 'morning',
  format: 'video',
  notes: 'Please review retirement plan',
  clientId: 'client-123',
  clientName: 'Jane Doe',
};

describe('bookMeeting', () => {
  it('returns { success: true } on 200 ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: true })));
    const result = await bookMeeting(baseInput);
    expect(result).toEqual({ success: true });
  });

  it('sets correct start/end times for morning preferred time', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await bookMeeting({ ...baseInput, preferredTime: 'morning' });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.startTime).toBe('09:00');
    expect(body.endTime).toBe('10:00');
  });

  it('sets correct start/end times for afternoon preferred time', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await bookMeeting({ ...baseInput, preferredTime: 'afternoon' });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.startTime).toBe('13:00');
    expect(body.endTime).toBe('14:00');
  });

  it('sets correct start/end times for evening preferred time', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await bookMeeting({ ...baseInput, preferredTime: 'evening' });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.startTime).toBe('17:00');
    expect(body.endTime).toBe('18:00');
  });

  it('returns { success: false } on non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse('Server Error', false, 500)),
    );

    const result = await bookMeeting(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/500/);
  });

  it('returns { success: false } and error message on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    const result = await bookMeeting(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network down');
  });

  it('returns { success: false } with generic message for non-Error throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

    const result = await bookMeeting(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error while booking meeting');
  });

  it('uses description from notes when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await bookMeeting({ ...baseInput, notes: 'My custom note' });
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.description).toBe('My custom note');
  });
});

// ── uploadDocument ───────────────────────────────────────────────────────────
const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });

const uploadInput: UploadDocumentInput = {
  file: mockFile,
  title: 'Test Document',
  category: 'identity',
  userId: 'user-001',
};

describe('uploadDocument', () => {
  it('returns { success: true } on successful upload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: true })));

    const result = await uploadDocument(uploadInput);
    expect(result).toEqual({ success: true });
  });

  it('POSTs to the correct URL with userId', async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse({ success: true }));
    vi.stubGlobal('fetch', mockFetch);

    await uploadDocument(uploadInput);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('user-001/upload');
  });

  it('returns { success: false } on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse('Forbidden', false, 403)));

    const result = await uploadDocument(uploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/403/);
  });

  it('returns { success: false } when result.success is false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFetchResponse({ success: false, error: 'File too large' })),
    );

    const result = await uploadDocument(uploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('File too large');
  });

  it('returns generic Upload failed message when result.success is false and no error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse({ success: false })));

    const result = await uploadDocument(uploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Upload failed');
  });

  it('returns { success: false } on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await uploadDocument(uploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('returns generic message for non-Error network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('unexpected'));

    const result = await uploadDocument(uploadInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error while uploading document');
  });
});
