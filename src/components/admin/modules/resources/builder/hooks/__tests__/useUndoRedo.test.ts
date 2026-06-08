/**
 * Tests for useUndoRedo
 *
 * Pure React hook with no external dependencies. Uses renderHook + act.
 * Fake timers are used to control the setWithMerge merge window.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../useUndoRedo';

// ============================================================================
// TYPES / HELPERS
// ============================================================================

type State = { count: number };

const initial: State = { count: 0 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================================
// 1. Initial state
// ============================================================================

describe('useUndoRedo – initial state', () => {
  it('state matches the provided initial value', () => {
    const { result } = renderHook(() => useUndoRedo(initial));
    expect(result.current.state).toEqual({ count: 0 });
  });

  it('canUndo is false initially', () => {
    const { result } = renderHook(() => useUndoRedo(initial));
    expect(result.current.canUndo).toBe(false);
  });

  it('canRedo is false initially', () => {
    const { result } = renderHook(() => useUndoRedo(initial));
    expect(result.current.canRedo).toBe(false);
  });

  it('historySize and futureSize are 0 initially', () => {
    const { result } = renderHook(() => useUndoRedo(initial));
    expect(result.current.historySize).toBe(0);
    expect(result.current.futureSize).toBe(0);
  });
});

// ============================================================================
// 2. set() — creates a new history entry
// ============================================================================

describe('useUndoRedo – set()', () => {
  it('updates state and makes canUndo true', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.set({ count: 1 });
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.historySize).toBe(1);
  });

  it('each set() call increments historySize', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 1 }));
    act(() => result.current.set({ count: 2 }));
    act(() => result.current.set({ count: 3 }));

    expect(result.current.historySize).toBe(3);
    expect(result.current.state).toEqual({ count: 3 });
  });
});

// ============================================================================
// 3. undo()
// ============================================================================

describe('useUndoRedo – undo()', () => {
  it('reverts state to the previous value', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 5 }));
    act(() => result.current.undo());

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
  });

  it('makes canRedo true after undo', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 5 }));
    act(() => result.current.undo());

    expect(result.current.canRedo).toBe(true);
    expect(result.current.futureSize).toBe(1);
  });

  it('is a no-op when there is nothing to undo', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.undo());

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
  });
});

// ============================================================================
// 4. redo()
// ============================================================================

describe('useUndoRedo – redo()', () => {
  it('re-applies the undone state', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 7 }));
    act(() => result.current.undo());
    act(() => result.current.redo());

    expect(result.current.state).toEqual({ count: 7 });
    expect(result.current.canRedo).toBe(false);
  });

  it('is a no-op when there is nothing to redo', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.redo());

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canRedo).toBe(false);
  });
});

// ============================================================================
// 5. Multiple undo / redo steps
// ============================================================================

describe('useUndoRedo – multiple steps', () => {
  it('can undo and redo across multiple history entries', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 1 }));
    act(() => result.current.set({ count: 2 }));
    act(() => result.current.set({ count: 3 }));

    act(() => result.current.undo());
    expect(result.current.state).toEqual({ count: 2 });

    act(() => result.current.undo());
    expect(result.current.state).toEqual({ count: 1 });

    act(() => result.current.redo());
    expect(result.current.state).toEqual({ count: 2 });

    act(() => result.current.redo());
    expect(result.current.state).toEqual({ count: 3 });
  });
});

// ============================================================================
// 6. set() after undo clears redo stack
// ============================================================================

describe('useUndoRedo – set() after undo', () => {
  it('discards the redo stack when a new set() is called after an undo', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 1 }));
    act(() => result.current.set({ count: 2 }));
    act(() => result.current.undo()); // back to 1, canRedo=true

    expect(result.current.canRedo).toBe(true);

    act(() => result.current.set({ count: 99 })); // new branch

    expect(result.current.canRedo).toBe(false);
    expect(result.current.futureSize).toBe(0);
    expect(result.current.state).toEqual({ count: 99 });
  });
});

// ============================================================================
// 7. reset()
// ============================================================================

describe('useUndoRedo – reset()', () => {
  it('clears history and sets a new present state', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 10 }));
    act(() => result.current.set({ count: 20 }));
    act(() => result.current.reset({ count: 0 }));

    expect(result.current.state).toEqual({ count: 0 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.historySize).toBe(0);
    expect(result.current.futureSize).toBe(0);
  });
});

// ============================================================================
// 8. historySize and futureSize tracking
// ============================================================================

describe('useUndoRedo – historySize / futureSize', () => {
  it('tracks historySize and futureSize correctly across a full undo/redo cycle', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => result.current.set({ count: 1 }));
    act(() => result.current.set({ count: 2 }));
    expect(result.current.historySize).toBe(2);
    expect(result.current.futureSize).toBe(0);

    act(() => result.current.undo());
    expect(result.current.historySize).toBe(1);
    expect(result.current.futureSize).toBe(1);

    act(() => result.current.undo());
    expect(result.current.historySize).toBe(0);
    expect(result.current.futureSize).toBe(2);

    act(() => result.current.redo());
    expect(result.current.historySize).toBe(1);
    expect(result.current.futureSize).toBe(1);
  });
});

// ============================================================================
// 9. setWithMerge() — merges rapid calls into one history entry
// ============================================================================

describe('useUndoRedo – setWithMerge()', () => {
  it('first call creates a history entry', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setWithMerge({ count: 1 }, 500);
    });

    expect(result.current.state).toEqual({ count: 1 });
    expect(result.current.historySize).toBe(1);
  });

  it('rapid subsequent calls within the merge window do NOT add new history entries', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setWithMerge({ count: 1 }, 500);
    });
    act(() => {
      result.current.setWithMerge({ count: 2 }, 500);
    });
    act(() => {
      result.current.setWithMerge({ count: 3 }, 500);
    });

    // Still only one history entry (the first setWithMerge)
    expect(result.current.historySize).toBe(1);
    expect(result.current.state).toEqual({ count: 3 });
  });

  it('after the merge window expires, a new call creates a fresh history entry', async () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setWithMerge({ count: 1 }, 500);
    });

    // Expire the merge window
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    act(() => {
      result.current.setWithMerge({ count: 2 }, 500);
    });

    expect(result.current.historySize).toBe(2);
    expect(result.current.state).toEqual({ count: 2 });
  });

  it('undo after merged calls goes back to state before first setWithMerge', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setWithMerge({ count: 10 }, 500);
    });
    act(() => {
      result.current.setWithMerge({ count: 20 }, 500);
    });

    act(() => result.current.undo());

    // Should be back at the state BEFORE the merged group — i.e. initial
    expect(result.current.state).toEqual({ count: 0 });
  });
});

// ============================================================================
// 10. Updater function syntax
// ============================================================================

describe('useUndoRedo – updater function', () => {
  it('accepts an updater function for set()', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.set((prev) => ({ count: prev.count + 1 }));
    });
    act(() => {
      result.current.set((prev) => ({ count: prev.count + 1 }));
    });

    expect(result.current.state).toEqual({ count: 2 });
    expect(result.current.historySize).toBe(2);
  });

  it('accepts an updater function for setWithMerge()', () => {
    const { result } = renderHook(() => useUndoRedo(initial));

    act(() => {
      result.current.setWithMerge((prev) => ({ count: prev.count + 5 }), 500);
    });

    expect(result.current.state).toEqual({ count: 5 });
  });
});
