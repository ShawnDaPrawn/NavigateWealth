/**
 * Tests for useMaintenanceCronProcessor hook.
 * Strategy: fake timers + mocked api/supabase/logger, renderHook.
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

import { useMaintenanceCronProcessor } from '../useMaintenanceCronProcessor';

// ── Constants mirrored from source ────────────────────────────────────────────

const INITIAL_DELAY_MS = 35_000;
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupSession(token: string | null = 'test-token') {
  const session = token ? { access_token: token } : null;
  mockGetSession.mockResolvedValue({ data: { session } });
}

// ── Lifecycle tests ───────────────────────────────────────────────────────────

describe('useMaintenanceCronProcessor — lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not fire before the initial delay', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS - 1);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('fires after the initial delay', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).toHaveBeenCalled();
  });

  it('fires again after each poll interval', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    // first run + one interval = multiple calls (2 status checks × 2 runs)
    expect(mockApiGet.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('clears timers on unmount', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    const { unmount } = renderHook(() => useMaintenanceCronProcessor());
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('does not start when enabled is false', async () => {
    setupSession();
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    renderHook(() => useMaintenanceCronProcessor({ enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + POLL_INTERVAL_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe('useMaintenanceCronProcessor — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips API calls when session is null', async () => {
    setupSession(null);

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('skips API calls when access_token is empty', async () => {
    setupSession('');

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

// ── Maintenance logic ─────────────────────────────────────────────────────────

describe('useMaintenanceCronProcessor — maintenance logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupSession();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not POST client cleanup when already ran today', async () => {
    mockApiGet.mockResolvedValue({ alreadyRanToday: true });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('POSTs /clients/maintenance/cleanup when not ran today', async () => {
    mockApiGet
      .mockResolvedValueOnce({ alreadyRanToday: false }) // client status
      .mockResolvedValueOnce({ alreadyRanToday: true }); // kv status
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: false,
      totalProfilesScanned: 10,
    });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiPost).toHaveBeenCalledWith('/clients/maintenance/cleanup', { dryRun: false });
  });

  it('calls onClientCleanupRan when client cleanup succeeds', async () => {
    mockApiGet
      .mockResolvedValueOnce({ alreadyRanToday: false })
      .mockResolvedValueOnce({ alreadyRanToday: true });
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: false,
      totalProfilesScanned: 5,
    });
    const onClientCleanupRan = vi.fn();

    renderHook(() => useMaintenanceCronProcessor({ onClientCleanupRan }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onClientCleanupRan).toHaveBeenCalledOnce();
  });

  it('POSTs /kv-cleanup/run when KV not ran today', async () => {
    mockApiGet
      .mockResolvedValueOnce({ alreadyRanToday: true }) // client status
      .mockResolvedValueOnce({ alreadyRanToday: false }); // kv status
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: false,
      totalKeysDeleted: 3,
    });

    renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(mockApiPost).toHaveBeenCalledWith('/kv-cleanup/run', { dryRun: false });
  });

  it('calls onKvCleanupRan when KV cleanup succeeds', async () => {
    mockApiGet
      .mockResolvedValueOnce({ alreadyRanToday: true })
      .mockResolvedValueOnce({ alreadyRanToday: false });
    mockApiPost.mockResolvedValue({
      success: true,
      dryRun: false,
      totalKeysDeleted: 7,
    });
    const onKvCleanupRan = vi.fn();

    renderHook(() => useMaintenanceCronProcessor({ onKvCleanupRan }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onKvCleanupRan).toHaveBeenCalledOnce();
  });

  it('handles API errors silently — hook stays mounted', async () => {
    mockApiGet.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useMaintenanceCronProcessor());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(result.error).toBeUndefined();
  });

  it('does not call onClientCleanupRan when cleanup result.success is false', async () => {
    mockApiGet
      .mockResolvedValueOnce({ alreadyRanToday: false })
      .mockResolvedValueOnce({ alreadyRanToday: true });
    mockApiPost.mockResolvedValue({ success: false, dryRun: false, totalProfilesScanned: 0 });
    const onClientCleanupRan = vi.fn();

    renderHook(() => useMaintenanceCronProcessor({ onClientCleanupRan }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INITIAL_DELAY_MS + 100);
    });
    expect(onClientCleanupRan).not.toHaveBeenCalled();
  });
});
