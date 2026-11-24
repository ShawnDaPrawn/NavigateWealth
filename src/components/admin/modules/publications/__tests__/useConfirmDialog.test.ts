import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmDialog } from '../components/ConfirmDialog';

const cfg = (title: string) => ({ title, description: 'd', onConfirm: vi.fn() });

describe('useConfirmDialog', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('clears the config 200ms after close, once the animation has run', () => {
    const { result } = renderHook(() => useConfirmDialog());
    act(() => result.current.open(cfg('Delete')));
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
    expect(result.current.config?.title).toBe('Delete');

    act(() => vi.advanceTimersByTime(200));
    expect(result.current.config).toBeNull();
  });

  it('keeps a dialog opened within 200ms of the previous close', () => {
    const { result } = renderHook(() => useConfirmDialog());
    act(() => result.current.open(cfg('First')));
    act(() => result.current.close());
    act(() => result.current.open(cfg('Second')));

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isOpen).toBe(true);
    expect(result.current.config?.title).toBe('Second');
  });

  it('cancels the pending clear on unmount', () => {
    // A leaked timer here fired after the test DOM was torn down and failed
    // the whole CI run with "ReferenceError: window is not defined".
    const { result, unmount } = renderHook(() => useConfirmDialog());
    act(() => result.current.open(cfg('Delete')));
    act(() => result.current.close());

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
