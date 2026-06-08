/**
 * Tests for useAutosave
 *
 * Pure React hook with no external dependencies beyond React itself.
 * Uses vi.useFakeTimers() to control the debounce timer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================================
// HELPERS
// ============================================================================

type State = { value: string };

function makeOnSave(impl?: (data: State) => Promise<void>) {
  return vi.fn().mockImplementation(impl ?? (() => Promise.resolve()));
}

// ============================================================================
// 1. Initial state
// ============================================================================

describe('useAutosave – initial state', () => {
  it('status is "saved", isDirty is false, lastSavedAt is null', () => {
    const { result } = renderHook(() =>
      useAutosave({ data: { value: 'hello' }, onSave: makeOnSave() }),
    );

    expect(result.current.status).toBe('saved');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSavedAt).toBeNull();
  });
});

// ============================================================================
// 2. Dirty detection
// ============================================================================

describe('useAutosave – dirty state', () => {
  it('isDirty becomes true and status becomes "unsaved" when data changes', () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(({ data }) => useAutosave({ data, onSave }), {
      initialProps: { data: { value: 'a' } },
    });

    expect(result.current.isDirty).toBe(false);

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    expect(result.current.isDirty).toBe(true);
    expect(result.current.status).toBe('unsaved');
  });
});

// ============================================================================
// 3. Debounced autosave
// ============================================================================

describe('useAutosave – debounced autosave', () => {
  it('calls onSave after debounce elapses', async () => {
    const onSave = makeOnSave();
    const { rerender } = renderHook(({ data }) => useAutosave({ data, onSave, debounceMs: 1000 }), {
      initialProps: { data: { value: 'a' } },
    });

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'b' });
  });

  it('does NOT call onSave before debounce elapses', async () => {
    const onSave = makeOnSave();
    const { rerender } = renderHook(({ data }) => useAutosave({ data, onSave, debounceMs: 2000 }), {
      initialProps: { data: { value: 'a' } },
    });

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 4. Successful save — status and timestamps
// ============================================================================

describe('useAutosave – after successful save', () => {
  it('sets status="saved", isDirty=false, and lastSavedAt after debounce save', async () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, onSave, debounceMs: 500 }),
      { initialProps: { data: { value: 'a' } } },
    );

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// 5. Save failure
// ============================================================================

describe('useAutosave – save failure', () => {
  it('sets status="error" when onSave throws', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, onSave, debounceMs: 100 }),
      { initialProps: { data: { value: 'a' } } },
    );

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.status).toBe('error');
  });
});

// ============================================================================
// 6. saveNow — immediate save
// ============================================================================

describe('useAutosave – saveNow', () => {
  it('triggers immediate save without waiting for debounce', async () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ data, onSave, debounceMs: 5000 }),
      { initialProps: { data: { value: 'a' } } },
    );

    act(() => {
      rerender({ data: { value: 'changed' } });
    });

    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveNow();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ value: 'changed' });
  });

  it('sets status="saved" and lastSavedAt after saveNow', async () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(({ data }) => useAutosave({ data, onSave }), {
      initialProps: { data: { value: 'a' } },
    });

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.status).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// 7. markSaved — reset baseline
// ============================================================================

describe('useAutosave – markSaved', () => {
  it('resets isDirty to false and sets lastSavedAt', () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(({ data }) => useAutosave({ data, onSave }), {
      initialProps: { data: { value: 'a' } },
    });

    act(() => {
      rerender({ data: { value: 'dirty' } });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.markSaved();
    });

    expect(result.current.isDirty).toBe(false);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    expect(result.current.status).toBe('saved');
  });
});

// ============================================================================
// 8. enabled=false — no auto-save
// ============================================================================

describe('useAutosave – enabled=false', () => {
  it('does not call onSave when enabled=false, even after debounce elapses', async () => {
    const onSave = makeOnSave();
    const { rerender } = renderHook(
      ({ data, enabled }) => useAutosave({ data, onSave, debounceMs: 100, enabled }),
      { initialProps: { data: { value: 'a' }, enabled: false } },
    );

    act(() => {
      rerender({ data: { value: 'b' }, enabled: false });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});

// ============================================================================
// 9. isNew=true — no auto-save until markSaved called
// ============================================================================

describe('useAutosave – isNew=true', () => {
  it('does not auto-save when isNew=true', async () => {
    const onSave = makeOnSave();
    const { rerender } = renderHook(
      ({ data }) => useAutosave({ data, onSave, debounceMs: 100, isNew: true }),
      { initialProps: { data: { value: 'a' } } },
    );

    act(() => {
      rerender({ data: { value: 'b' } });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('auto-saves after markSaved is called (isNew baseline update), then data changes', async () => {
    const onSave = makeOnSave();
    const { result, rerender } = renderHook(
      ({ data, isNew }) => useAutosave({ data, onSave, debounceMs: 100, isNew }),
      { initialProps: { data: { value: 'a' }, isNew: true } },
    );

    // Call markSaved to establish saved baseline and switch off isNew externally
    act(() => {
      result.current.markSaved();
    });

    // Now rerender with isNew=false (simulating parent setting isNew=false after first save)
    act(() => {
      rerender({ data: { value: 'changed-after-mark' }, isNew: false });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
