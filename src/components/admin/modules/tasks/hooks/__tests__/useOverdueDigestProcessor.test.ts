/**
 * Tests for useOverdueDigestProcessor hook.
 *
 * Strategy: use fake timers and mock the api client, supabase client, and
 * logger. Use renderHook because the hook uses useEffect.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

const mockGetSession = vi.fn();

vi.mock('../../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

vi.mock('../../../../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useOverdueDigestProcessor } from '../useOverdueDigestProcessor';

// ── Constants mirrored from source ────────────────────────────────────────────

const INITIAL_DELAY_MS = 30_000;
const POLL_INTERVAL_MS = 30 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSession(token: string | null = 'test-token') {
  const session = token ? { access_token: token } : null;
  mockGetSession.mockResolvedValue({ data: { session } });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOverdueDigestProcessor — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire immediately on mount — waits for initial delay', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS - 1);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fires the digest check after the initial delay', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).toHaveBeenCalledWith('/tasks-digest/status');
  });

  it('fires again after the first poll interval', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    renderHook(() => useOverdueDigestProcessor());

    // initial timeout + one poll interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    // initial call + 1 interval tick = 2 total
    expect(mockApiGet).toHaveBeenCalledTimes(2);
  });

  it('clears timers on unmount so no further calls occur', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    const { unmount } = renderHook(() => useOverdueDigestProcessor());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS * 2 + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does not start timers when enabled is false', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    renderHook(() => useOverdueDigestProcessor({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('useOverdueDigestProcessor — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the API call when there is no active session', async () => {
    setupSession(null);

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('skips when access_token is empty', async () => {
    setupSession('');

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ── Digest logic ──────────────────────────────────────────────────────────────

describe('useOverdueDigestProcessor — digest logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call POST when digest was already sent today', async () => {
    mockApiGet.mockResolvedValue({ alreadySentToday: true });

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('calls POST /tasks-digest/send-overdue when digest not yet sent', async () => {
    mockApiGet.mockResolvedValue({ alreadySentToday: false });
    mockApiPost.mockResolvedValue({ success: true, sent: false, reason: 'no_overdue_tasks' });

    renderHook(() => useOverdueDigestProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiPost).toHaveBeenCalledWith('/tasks-digest/send-overdue');
  });

  it('calls onDigestSent with the overdue count when sent is true', async () => {
    mockApiGet.mockResolvedValue({ alreadySentToday: false });
    mockApiPost.mockResolvedValue({ success: true, sent: true, overdue_count: 5 });
    const onDigestSent = vi.fn();

    renderHook(() => useOverdueDigestProcessor({ onDigestSent }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onDigestSent).toHaveBeenCalledWith(5);
  });

  it('does not call onDigestSent when sent is false', async () => {
    mockApiGet.mockResolvedValue({ alreadySentToday: false });
    mockApiPost.mockResolvedValue({ success: true, sent: false, reason: 'no_overdue_tasks' });
    const onDigestSent = vi.fn();

    renderHook(() => useOverdueDigestProcessor({ onDigestSent }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onDigestSent).not.toHaveBeenCalled();
  });

  it('does not call onDigestSent when overdue_count is 0', async () => {
    mockApiGet.mockResolvedValue({ alreadySentToday: false });
    mockApiPost.mockResolvedValue({ success: true, sent: true, overdue_count: 0 });
    const onDigestSent = vi.fn();

    renderHook(() => useOverdueDigestProcessor({ onDigestSent }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onDigestSent).not.toHaveBeenCalled();
  });

  it('handles errors silently — hook remains mounted without throwing', async () => {
    mockApiGet.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useOverdueDigestProcessor());
    expect((result as { current: void; error?: unknown }).error).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect((result as { current: void; error?: unknown }).error).toBeUndefined();
  });
});
