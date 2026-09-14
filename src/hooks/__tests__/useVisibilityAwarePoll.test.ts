/**
 * Tests for useVisibilityAwarePoll.
 *
 * The point of this hook is what it does NOT do: a hidden tab must issue no
 * requests. Two admin accelerators poll every 15 seconds, so a backgrounded
 * tab that kept ticking cost hundreds of Edge Function invocations an hour
 * (docs/INCIDENTS.md, 2026-09-13). These tests pin that, and pin that becoming
 * visible again resumes promptly rather than after a full interval.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useVisibilityAwarePoll } from '../useVisibilityAwarePoll';

/** Drive document.visibilityState, which is read-only in jsdom. */
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useVisibilityAwarePoll', () => {
  it('waits out the initial delay, then ticks on the interval', () => {
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePoll(tick, { intervalMs: 1_000, initialDelayMs: 5_000 }));

    vi.advanceTimersByTime(4_999);
    expect(tick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(3_000);
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it('issues nothing at all while the tab is hidden', () => {
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePoll(tick, { intervalMs: 1_000 }));

    vi.advanceTimersByTime(2_000);
    const before = tick.mock.calls.length;
    expect(before).toBeGreaterThan(0);

    setHidden(true);
    vi.advanceTimersByTime(60_000);

    expect(tick).toHaveBeenCalledTimes(before);
  });

  it('ticks immediately on becoming visible rather than waiting an interval', () => {
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePoll(tick, { intervalMs: 10_000, initialDelayMs: 0 }));
    vi.advanceTimersByTime(0);
    tick.mockClear();

    setHidden(true);
    vi.advanceTimersByTime(30_000);
    expect(tick).not.toHaveBeenCalled();

    setHidden(false);
    vi.advanceTimersByTime(0);
    expect(tick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('still owes its settle delay to a tab that was opened in the background', () => {
    setHidden(true);
    const tick = vi.fn();
    renderHook(() => useVisibilityAwarePoll(tick, { intervalMs: 1_000, initialDelayMs: 5_000 }));

    vi.advanceTimersByTime(10_000);
    expect(tick).not.toHaveBeenCalled();

    setHidden(false);
    vi.advanceTimersByTime(4_999);
    expect(tick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled, and stops on unmount', () => {
    const tick = vi.fn();
    const disabled = renderHook(() =>
      useVisibilityAwarePoll(tick, { intervalMs: 1_000, enabled: false }),
    );
    vi.advanceTimersByTime(10_000);
    expect(tick).not.toHaveBeenCalled();
    disabled.unmount();

    const live = renderHook(() => useVisibilityAwarePoll(tick, { intervalMs: 1_000 }));
    vi.advanceTimersByTime(2_000);
    const before = tick.mock.calls.length;
    live.unmount();
    vi.advanceTimersByTime(10_000);
    expect(tick).toHaveBeenCalledTimes(before);
  });

  it('uses the latest callback without restarting the interval', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ fn }: { fn: () => void }) => useVisibilityAwarePoll(fn, { intervalMs: 1_000 }),
      { initialProps: { fn: first } },
    );

    // A zero initial delay ticks straight away, then every interval after.
    vi.advanceTimersByTime(1_000);
    expect(first).toHaveBeenCalledTimes(2);

    rerender({ fn: second });
    vi.advanceTimersByTime(1_000);

    // The interval kept running and picked up the new callback in place.
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
