import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldHistory } from '../useFieldHistory';
import type { EsignField } from '../../types';

const f = (id: string): EsignField => ({ id }) as unknown as EsignField;

describe('useFieldHistory', () => {
  it('pushes, undoes and redoes — applying setFields and marking unsaved', () => {
    const setFields = vi.fn();
    const setUnsaved = vi.fn();
    const { result } = renderHook(() => useFieldHistory([f('a')], setFields, setUnsaved));

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.pushToHistory([f('a'), f('b')]));
    expect(setFields).toHaveBeenLastCalledWith([f('a'), f('b')]);
    expect(setUnsaved).toHaveBeenLastCalledWith(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(setFields).toHaveBeenLastCalledWith([f('a')]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(setFields).toHaveBeenLastCalledWith([f('a'), f('b')]);
    expect(result.current.canRedo).toBe(false);
  });

  it('truncates the redo branch when a new push follows an undo', () => {
    const { result } = renderHook(() => useFieldHistory([f('a')], vi.fn(), vi.fn()));

    act(() => result.current.pushToHistory([f('b')]));
    act(() => result.current.pushToHistory([f('c')]));
    act(() => result.current.undo()); // cursor back on [b], [c] is now a redo step
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.pushToHistory([f('d')])); // discards the [c] redo branch
    expect(result.current.canRedo).toBe(false);
  });

  it('is a no-op to undo at the start or redo at the end', () => {
    const setFields = vi.fn();
    const { result } = renderHook(() => useFieldHistory([f('a')], setFields, vi.fn()));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(setFields).not.toHaveBeenCalled();
  });
});
