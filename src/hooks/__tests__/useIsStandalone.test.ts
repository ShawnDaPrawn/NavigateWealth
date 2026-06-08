/**
 * Tests for useIsStandalone hook.
 * Mocks window.matchMedia to control display-mode standalone detection.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsStandalone } from '../useIsStandalone';

function makeMql(matches: boolean) {
  const listeners: (() => void)[] = [];
  return {
    matches,
    addEventListener: vi.fn((_type: string, cb: () => void) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    _fire: () => listeners.forEach((cb) => cb()),
  };
}

describe('useIsStandalone', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when matchMedia is not available', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);
  });

  it('returns false when display-mode is not standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMql(false)));
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);
  });

  it('returns true when display-mode is standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMql(true)));
    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(true);
  });

  it('updates when display-mode changes', async () => {
    const mql = makeMql(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));

    const { result } = renderHook(() => useIsStandalone());
    expect(result.current).toBe(false);

    // Simulate display-mode change to standalone
    Object.defineProperty(mql, 'matches', { get: () => true, configurable: true });
    await act(async () => {
      mql._fire();
    });

    expect(result.current).toBe(true);
  });

  it('removes the event listener on unmount', () => {
    const mql = makeMql(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));

    const { unmount } = renderHook(() => useIsStandalone());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledOnce();
  });
});
