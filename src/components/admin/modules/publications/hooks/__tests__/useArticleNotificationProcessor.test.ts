/**
 * Tests for useArticleNotificationProcessor hook.
 *
 * Strategy: use fake timers and mock the API client and supabase client.
 * Use renderHook because the hook uses useEffect with setInterval/setTimeout.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockProcessNotificationJobs = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      processNotificationJobs: (...args: unknown[]) => mockProcessNotificationJobs(...args),
    },
  },
}));

const mockGetSession = vi.fn();

vi.mock('../../../../../../utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: (...args: unknown[]) => mockGetSession(...args) },
  }),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useArticleNotificationProcessor } from '../useArticleNotificationProcessor';

// ── Constants mirrored from source ────────────────────────────────────────────

const INITIAL_DELAY_MS = 12_000;
const POLL_INTERVAL_MS = 15_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSession(token: string | null = 'test-token') {
  const session = token ? { access_token: token } : null;
  mockGetSession.mockResolvedValue({ data: { session } });
}

// ── Lifecycle tests ───────────────────────────────────────────────────────────

describe('useArticleNotificationProcessor — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire immediately on mount — waits for initial delay', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS - 1);
    });
    expect(mockProcessNotificationJobs).not.toHaveBeenCalled();
  });

  it('fires processJobs after the initial delay', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessNotificationJobs).toHaveBeenCalledOnce();
  });

  it('calls processNotificationJobs with correct parameters', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessNotificationJobs).toHaveBeenCalledWith({
      maxJobs: 5,
      maxBatchesPerJob: 4,
    });
  });

  it('fires again after the first poll interval', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    // initial timeout + one interval tick = 2
    expect(mockProcessNotificationJobs).toHaveBeenCalledTimes(2);
  });

  it('clears timers on unmount so no further calls occur', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    const { unmount } = renderHook(() => useArticleNotificationProcessor());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS * 2 + 100);
    });
    expect(mockProcessNotificationJobs).not.toHaveBeenCalled();
  });

  it('does not start timers when enabled is false', async () => {
    setupSession();
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockProcessNotificationJobs).not.toHaveBeenCalled();
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('useArticleNotificationProcessor — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the API call when there is no active session', async () => {
    setupSession(null);

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessNotificationJobs).not.toHaveBeenCalled();
  });

  it('skips when access_token is empty', async () => {
    setupSession('');

    renderHook(() => useArticleNotificationProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessNotificationJobs).not.toHaveBeenCalled();
  });
});

// ── Processing logic ──────────────────────────────────────────────────────────

describe('useArticleNotificationProcessor — processing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onProcessed when advancedJobs is 0', async () => {
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });
    const onProcessed = vi.fn();

    renderHook(() => useArticleNotificationProcessor({ onProcessed }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onProcessed).not.toHaveBeenCalled();
  });

  it('calls onProcessed with advancedJobs count when jobs are processed', async () => {
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 3 });
    const onProcessed = vi.fn();

    renderHook(() => useArticleNotificationProcessor({ onProcessed }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onProcessed).toHaveBeenCalledWith(3);
  });

  it('handles errors silently — hook remains mounted without throwing', async () => {
    mockProcessNotificationJobs.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useArticleNotificationProcessor());
    expect(result.error).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(result.error).toBeUndefined();
  });

  it('does not start a concurrent run when already processing', async () => {
    let resolveFirst!: () => void;
    const firstCall = new Promise<{ advancedJobs: number }>((res) => {
      resolveFirst = () => res({ advancedJobs: 0 });
    });
    mockProcessNotificationJobs.mockReturnValueOnce(firstCall);
    mockProcessNotificationJobs.mockResolvedValue({ advancedJobs: 0 });

    renderHook(() => useArticleNotificationProcessor());

    // Advance past initial delay — first run starts (pending)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });

    // Advance one full interval — interval tick fires while first is still pending
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Only one call made so far (second was skipped due to isRunning guard)
    expect(mockProcessNotificationJobs).toHaveBeenCalledTimes(1);

    // Resolve first call, then advance again for next interval
    await act(async () => {
      resolveFirst();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Now a second call can proceed
    expect(mockProcessNotificationJobs).toHaveBeenCalledTimes(2);
  });
});
