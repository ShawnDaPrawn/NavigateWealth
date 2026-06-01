import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '../useAutoSave';
import type { EsignField } from '../../types';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'sonner';

const f = (id: string): EsignField => ({ id }) as unknown as EsignField;

type Props = Parameters<typeof useAutoSave>[0];

function makeProps(over: Partial<Props> = {}): Props {
  return {
    fields: [f('a')],
    initialFields: [f('a')],
    onSaveFields: vi.fn().mockResolvedValue(undefined),
    hasUnsavedChanges: false,
    setHasUnsavedChanges: vi.fn(),
    saving: false,
    sending: false,
    ...over,
  };
}

describe('useAutoSave', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists the current snapshot, stamps lastSavedAt and clears unsaved', async () => {
    const onSaveFields = vi.fn().mockResolvedValue(undefined);
    const setHasUnsavedChanges = vi.fn();
    const props = makeProps({ onSaveFields, setHasUnsavedChanges });
    const { result, rerender } = renderHook((p: Props) => useAutoSave(p), { initialProps: props });

    // an edit lands — fieldsRef tracks the freshest fields each render
    rerender(makeProps({ onSaveFields, setHasUnsavedChanges, fields: [f('a'), f('b')] }));

    let ret: boolean | undefined;
    await act(async () => {
      ret = await result.current.persistFields();
    });

    expect(ret).toBe(true);
    expect(onSaveFields).toHaveBeenCalledWith([f('a'), f('b')]);
    expect(setHasUnsavedChanges).toHaveBeenLastCalledWith(false);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('is a no-op when nothing changed since the last save (drift short-circuit)', async () => {
    const onSaveFields = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook((p: Props) => useAutoSave(p), {
      initialProps: makeProps({ onSaveFields }),
    });

    let ret: boolean | undefined;
    await act(async () => {
      ret = await result.current.persistFields();
    });

    expect(ret).toBe(false);
    expect(onSaveFields).not.toHaveBeenCalled();
  });

  it('returns false with no handler wired', async () => {
    const { result } = renderHook((p: Props) => useAutoSave(p), {
      initialProps: makeProps({ onSaveFields: undefined, fields: [f('a'), f('b')] }),
    });
    let ret: boolean | undefined;
    await act(async () => {
      ret = await result.current.persistFields();
    });
    expect(ret).toBe(false);
  });

  it('auto-saves 1.5s after an unsaved change', async () => {
    vi.useFakeTimers();
    try {
      const onSaveFields = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook((p: Props) => useAutoSave(p), {
        initialProps: makeProps({ onSaveFields }),
      });

      rerender(makeProps({ onSaveFields, fields: [f('a'), f('b')], hasUnsavedChanges: true }));

      // nothing fires before the debounce window elapses
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1400);
      });
      expect(onSaveFields).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(onSaveFields).toHaveBeenCalledWith([f('a'), f('b')]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not auto-save while a manual save/send is already in flight', async () => {
    vi.useFakeTimers();
    try {
      const onSaveFields = vi.fn().mockResolvedValue(undefined);
      const { rerender } = renderHook((p: Props) => useAutoSave(p), {
        initialProps: makeProps({ onSaveFields }),
      });

      rerender(
        makeProps({
          onSaveFields,
          fields: [f('a'), f('b')],
          hasUnsavedChanges: true,
          saving: true,
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(onSaveFields).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('toasts on a loud failure but stays silent for background saves', async () => {
    const onSaveFields = vi.fn().mockRejectedValue(new Error('network'));
    const { result, rerender } = renderHook((p: Props) => useAutoSave(p), {
      initialProps: makeProps({ onSaveFields }),
    });
    rerender(makeProps({ onSaveFields, fields: [f('a'), f('b')] }));

    let loud: boolean | undefined;
    await act(async () => {
      loud = await result.current.persistFields();
    });
    expect(loud).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);

    // a silent save of the same (still-unpersisted) change must not toast again
    await act(async () => {
      await result.current.persistFields({ silent: true });
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
