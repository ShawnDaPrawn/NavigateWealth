/**
 * The delayed value behind Global Search.
 *
 * The box shows each keystroke immediately; the search runs on the value
 * this hook returns. A timer that is not cancelled keeps an earlier query
 * and can overwrite the one the visitor just finished typing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('returns the current value immediately, before any delay', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDebouncedValue('policies', 250));
    expect(result.current).toBe('policies');
  });

  it('settles on the latest value only after the delay has been quiet', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    rerender({ value: 'a' });
    act(() => {
      vi.advanceTimersByTime(249);
    });
    rerender({ value: 'annuity' });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('annuity');
  });
});
