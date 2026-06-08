/**
 * Tests for useIsMobile hook.
 * Mocks window.matchMedia and window.innerWidth.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

function makeMql(matches: boolean) {
  const listeners: (() => void)[] = [];
  return {
    matches,
    addEventListener: vi.fn((_type: string, cb: () => void) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    _fire: () => listeners.forEach((cb) => cb()),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

import { useIsMobile } from '../use-mobile';

describe('useIsMobile', () => {
  it('returns false when window.innerWidth >= 768', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMql(false)));
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when window.innerWidth < 768', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(makeMql(true)));
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true, writable: true });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when the media query fires a change', async () => {
    const mql = makeMql(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true, writable: true });
    await act(async () => {
      mql._fire();
    });

    expect(result.current).toBe(true);
  });

  it('removes the event listener on unmount', () => {
    const mql = makeMql(false);
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
      writable: true,
    });

    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledOnce();
  });
});
