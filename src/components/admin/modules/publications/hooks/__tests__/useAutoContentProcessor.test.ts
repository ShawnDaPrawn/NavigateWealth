/**
 * Tests for useAutoContentProcessor hook.
 *
 * Strategy: use fake timers and mock the API client and supabase client.
 * Use renderHook because the hook uses useEffect with setInterval/setTimeout.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockProcessDue = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    AutoContent: {
      processDue: (...args: unknown[]) => mockProcessDue(...args),
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

import { useAutoContentProcessor } from '../useAutoContentProcessor';

// ── Constants mirrored from source ────────────────────────────────────────────

const INITIAL_DELAY_MS = 25_000;
const POLL_INTERVAL_MS = 15 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSession(token: string | null = 'test-token') {
  const session = token ? { access_token: token } : null;
  mockGetSession.mockResolvedValue({ data: { session } });
}

// ── Lifecycle tests ───────────────────────────────────────────────────────────

describe('useAutoContentProcessor — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire immediately on mount — waits for initial delay', async () => {
    setupSession();
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    renderHook(() => useAutoContentProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS - 1);
    });
    expect(mockProcessDue).not.toHaveBeenCalled();
  });

  it('fires processDue after the initial delay', async () => {
    setupSession();
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    renderHook(() => useAutoContentProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessDue).toHaveBeenCalledOnce();
  });

  it('fires again after the first poll interval', async () => {
    setupSession();
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    renderHook(() => useAutoContentProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    // initial timeout + one interval tick = 2
    expect(mockProcessDue).toHaveBeenCalledTimes(2);
  });

  it('clears timers on unmount so no further calls occur', async () => {
    setupSession();
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    const { unmount } = renderHook(() => useAutoContentProcessor());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS * 2 + 100);
    });
    expect(mockProcessDue).not.toHaveBeenCalled();
  });

  it('does not start timers when enabled is false', async () => {
    setupSession();
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    renderHook(() => useAutoContentProcessor({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockProcessDue).not.toHaveBeenCalled();
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('useAutoContentProcessor — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips the API call when there is no active session', async () => {
    setupSession(null);

    renderHook(() => useAutoContentProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessDue).not.toHaveBeenCalled();
  });

  it('skips when access_token is empty', async () => {
    setupSession('');

    renderHook(() => useAutoContentProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockProcessDue).not.toHaveBeenCalled();
  });
});

// ── Processing logic ──────────────────────────────────────────────────────────

describe('useAutoContentProcessor — processing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onArticlesGenerated when totalArticlesGenerated is 0', async () => {
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });
    const onArticlesGenerated = vi.fn();

    renderHook(() => useAutoContentProcessor({ onArticlesGenerated }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onArticlesGenerated).not.toHaveBeenCalled();
  });

  it('calls onArticlesGenerated with count and pipeline names when articles are generated', async () => {
    mockProcessDue.mockResolvedValue({
      totalArticlesGenerated: 3,
      processed: [
        { pipelineId: 'pipeline-a', articlesGenerated: 2 },
        { pipelineId: 'pipeline-b', articlesGenerated: 0 },
        { pipelineId: 'pipeline-c', articlesGenerated: 1 },
      ],
    });
    const onArticlesGenerated = vi.fn();

    renderHook(() => useAutoContentProcessor({ onArticlesGenerated }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onArticlesGenerated).toHaveBeenCalledWith(3, ['pipeline-a', 'pipeline-c']);
  });

  it('handles errors silently — hook remains mounted without throwing', async () => {
    mockProcessDue.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useAutoContentProcessor());
    expect(result.error).toBeUndefined();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(result.error).toBeUndefined();
  });

  it('does not start a concurrent run when already processing', async () => {
    // Simulate a slow processDue so second interval tick occurs while first is running
    let resolveFirst!: () => void;
    const firstCall = new Promise<{ totalArticlesGenerated: number; processed: unknown[] }>(
      (res) => {
        resolveFirst = () => res({ totalArticlesGenerated: 0, processed: [] });
      },
    );
    mockProcessDue.mockReturnValueOnce(firstCall);
    mockProcessDue.mockResolvedValue({ totalArticlesGenerated: 0, processed: [] });

    renderHook(() => useAutoContentProcessor());

    // Advance past initial delay — first run starts (pending)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });

    // Advance one full interval — interval tick fires while first is still pending
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Only one call made so far (second was skipped)
    expect(mockProcessDue).toHaveBeenCalledTimes(1);

    // Resolve first call, then advance again for next interval
    await act(async () => {
      resolveFirst();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    });

    // Now a second call can proceed
    expect(mockProcessDue).toHaveBeenCalledTimes(2);
  });
});
