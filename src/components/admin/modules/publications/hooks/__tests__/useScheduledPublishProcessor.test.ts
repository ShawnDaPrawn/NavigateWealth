/**
 * Tests for useScheduledPublishProcessor hook.
 *
 * Strategy: use fake timers and mock the API client, supabase client, and
 * logger. Use renderHook because the hook uses useEffect with setInterval/setTimeout.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockProcessScheduled = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      processScheduled: (...args: unknown[]) => mockProcessScheduled(...args),
    },
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

import { useScheduledPublishProcessor } from '../useScheduledPublishProcessor';

// ── Constants mirrored from source ────────────────────────────────────────────

const INITIAL_DELAY_MS = 20_000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSession(token: string | null = 'test-token') {
  const session = token ? { access_token: token } : null;
  mockGetSession.mockResolvedValue({ data: { session } });
}

// ── Lifecycle tests ───────────────────────────────────────────────────────────

describe('useScheduledPublishProcessor — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire immediately on mount — waits for initial delay', async () => {
    setupSession();
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    renderHook(() => useScheduledPublishProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS - 1);
    });
    expect(mockProcessScheduled).not.toHaveBeenCalled();
  });

  it('fires processScheduled after the initial delay', async () => {
    setupSession();
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    renderHook(() => useScheduledPublishProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessScheduled).toHaveBeenCalledOnce();
  });

  it('fires again after the first poll interval', async () => {
    setupSession();
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    renderHook(() => useScheduledPublishProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    // initial timeout + one interval tick = 2
    expect(mockProcessScheduled).toHaveBeenCalledTimes(2);
  });

  it('clears timers on unmount so no further calls occur', async () => {
    setupSession();
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    const { unmount } = renderHook(() => useScheduledPublishProcessor());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS * 2 + 100);
    });
    expect(mockProcessScheduled).not.toHaveBeenCalled();
  });

  it('does not start timers when enabled is false', async () => {
    setupSession();
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    renderHook(() => useScheduledPublishProcessor({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockProcessScheduled).not.toHaveBeenCalled();
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('useScheduledPublishProcessor — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the API call when there is no active session', async () => {
    setupSession(null);

    renderHook(() => useScheduledPublishProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessScheduled).not.toHaveBeenCalled();
  });

  it('skips when access_token is empty', async () => {
    setupSession('');

    renderHook(() => useScheduledPublishProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessScheduled).not.toHaveBeenCalled();
  });
});

// ── Processing logic ──────────────────────────────────────────────────────────

describe('useScheduledPublishProcessor — processing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onProcessed when processed count is 0', async () => {
    mockProcessScheduled.mockResolvedValue({ processed: 0 });
    const onProcessed = vi.fn();

    renderHook(() => useScheduledPublishProcessor({ onProcessed }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onProcessed).not.toHaveBeenCalled();
  });

  it('calls onProcessed with count when articles are processed', async () => {
    mockProcessScheduled.mockResolvedValue({ processed: 4 });
    const onProcessed = vi.fn();

    renderHook(() => useScheduledPublishProcessor({ onProcessed }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onProcessed).toHaveBeenCalledWith(4);
  });

  it('handles errors silently — hook remains mounted without throwing', async () => {
    mockProcessScheduled.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useScheduledPublishProcessor());
    expect(result.error).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(result.error).toBeUndefined();
  });

  it('does not start a concurrent run when already processing', async () => {
    let resolveFirst!: () => void;
    const firstCall = new Promise<{ processed: number }>((res) => {
      resolveFirst = () => res({ processed: 0 });
    });
    mockProcessScheduled.mockReturnValueOnce(firstCall);
    mockProcessScheduled.mockResolvedValue({ processed: 0 });

    renderHook(() => useScheduledPublishProcessor());

    // Advance past initial delay — first run starts (pending)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });

    // Advance one full interval — interval tick fires while first is still pending
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Only one call made so far (second was skipped due to isRunning guard)
    expect(mockProcessScheduled).toHaveBeenCalledTimes(1);

    // Resolve first call, then advance again for next interval
    await act(async () => {
      resolveFirst();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Now a second call can proceed
    expect(mockProcessScheduled).toHaveBeenCalledTimes(2);
  });
});
