import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

const mockBlocker = {
  state: 'unblocked' as 'unblocked' | 'blocked' | 'proceeding',
  proceed: vi.fn(),
  reset: vi.fn(),
};

vi.mock('react-router', () => ({
  useBlocker: vi.fn(() => mockBlocker),
  useBeforeUnload: vi.fn(),
}));

describe('useUnsavedChangesGuard', () => {
  const onSave = vi.fn(async () => true);
  const onDiscard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockBlocker.state = 'unblocked';
  });

  it('runs tryAction immediately when not dirty', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: false,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('opens dialog instead of running tryAction when dirty', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: true,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(true);
  });

  it('discards and runs pending action from dialog', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: true,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    act(() => {
      result.current.dialogProps.onDiscard();
    });

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('stays on page without running pending action', () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: true,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    act(() => {
      result.current.dialogProps.onStay();
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('saves and runs pending action when save succeeds', async () => {
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: true,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    await act(async () => {
      await result.current.dialogProps.onSaveAndLeave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('does not run pending action when save fails', async () => {
    onSave.mockResolvedValueOnce(false);
    const action = vi.fn();
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({
        isDirty: true,
        onSave,
        onDiscard,
      }),
    );

    act(() => {
      result.current.tryAction(action);
    });

    await act(async () => {
      await result.current.dialogProps.onSaveAndLeave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
  });
});
