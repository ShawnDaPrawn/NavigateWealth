/**
 * Tests for useTypeActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypeActions } from '../useTypeActions';
import type { ContentType } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
const mockCreateType = vi.fn();
const mockUpdateType = vi.fn();
const mockDeleteType = vi.fn();
const mockReorderTypes = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Types: {
      createType: (...args: unknown[]) => mockCreateType(...args),
      updateType: (...args: unknown[]) => mockUpdateType(...args),
      deleteType: (...args: unknown[]) => mockDeleteType(...args),
      reorderTypes: (...args: unknown[]) => mockReorderTypes(...args),
    },
  },
}));

vi.mock('../../constants', () => ({
  SUCCESS_MESSAGES: {
    typeCreated: 'Type created successfully',
    typeUpdated: 'Type updated successfully',
    typeDeleted: 'Type deleted successfully',
  },
  ERROR_MESSAGES: {
    typeCreateFailed: 'Failed to create type',
    typeUpdateFailed: 'Failed to update type',
    typeDeleteFailed: 'Failed to delete type',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeType(overrides: Partial<ContentType> = {}): ContentType {
  return {
    id: 'type-1',
    name: 'Test Type',
    slug: 'test-type',
    description: 'A test type',
    icon: null,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useTypeActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('initial isProcessing is false', () => {
    const { result } = renderHook(() => useTypeActions());
    expect(result.current.isProcessing).toBe(false);
  });

  // ── handleCreate ──────────────────────────────────────────────────────────

  it('handleCreate returns type and calls onSuccess on success', async () => {
    const type = makeType();
    mockCreateType.mockResolvedValueOnce(type);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: ContentType | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({
        name: 'Test Type',
        description: 'desc',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(returned).toEqual(type);
    expect(onSuccess).toHaveBeenCalledWith('Type created successfully', type);
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleCreate returns null and calls onError on failure', async () => {
    mockCreateType.mockRejectedValueOnce(new Error('Create failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));

    let returned: ContentType | null | undefined;
    await act(async () => {
      returned = await result.current.handleCreate({ name: 'Test' });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Create failed');
  });

  it('handleCreate uses fallback error message when error is not an Error instance', async () => {
    mockCreateType.mockRejectedValueOnce('string error');
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));
    await act(async () => {
      await result.current.handleCreate({ name: 'Test' });
    });

    expect(onError).toHaveBeenCalledWith('Failed to create type');
  });

  it('handleCreate resets isProcessing to false after success', async () => {
    const type = makeType();
    mockCreateType.mockResolvedValueOnce(type);

    const { result } = renderHook(() => useTypeActions());
    await act(async () => {
      await result.current.handleCreate({ name: 'Test' });
    });

    expect(result.current.isProcessing).toBe(false);
  });

  it('handleCreate resets isProcessing to false after failure', async () => {
    mockCreateType.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useTypeActions());
    await act(async () => {
      await result.current.handleCreate({ name: 'Test' });
    });

    expect(result.current.isProcessing).toBe(false);
  });

  // ── handleUpdate ──────────────────────────────────────────────────────────

  it('handleUpdate returns type and calls onSuccess on success', async () => {
    const type = makeType({ name: 'Updated Type' });
    mockUpdateType.mockResolvedValueOnce(type);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: ContentType | null = null;
    await act(async () => {
      returned = await result.current.handleUpdate('type-1', { name: 'Updated Type' });
    });

    expect(returned).toEqual(type);
    expect(onSuccess).toHaveBeenCalledWith('Type updated successfully', type);
    expect(mockUpdateType).toHaveBeenCalledWith({ id: 'type-1', name: 'Updated Type' });
  });

  it('handleUpdate returns null and calls onError on failure', async () => {
    mockUpdateType.mockRejectedValueOnce(new Error('Update failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));

    let returned: ContentType | null | undefined;
    await act(async () => {
      returned = await result.current.handleUpdate('type-1', { name: 'Updated' });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Update failed');
  });

  it('handleUpdate uses fallback error message when error is not an Error instance', async () => {
    mockUpdateType.mockRejectedValueOnce('plain error');
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));
    await act(async () => {
      await result.current.handleUpdate('type-1', { name: 'X' });
    });

    expect(onError).toHaveBeenCalledWith('Failed to update type');
  });

  // ── handleDelete ──────────────────────────────────────────────────────────

  it('handleDelete returns true and calls onSuccess and onDelete on success', async () => {
    mockDeleteType.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    const onDelete = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess, onDelete }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('type-1');
    });

    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('Type deleted successfully');
    expect(onDelete).toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleDelete returns false and calls onError on failure', async () => {
    mockDeleteType.mockRejectedValueOnce(new Error('Delete failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('type-1');
    });

    expect(returned).toBe(false);
    expect(onError).toHaveBeenCalledWith('Delete failed');
  });

  it('handleDelete does not require onDelete to be provided', async () => {
    mockDeleteType.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('type-1');
    });

    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  // ── handleToggleActive ────────────────────────────────────────────────────

  it('handleToggleActive activates an inactive type and calls onSuccess', async () => {
    const inactive = makeType({ is_active: false });
    const activated = makeType({ is_active: true });
    mockUpdateType.mockResolvedValueOnce(activated);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: ContentType | null = null;
    await act(async () => {
      returned = await result.current.handleToggleActive(inactive);
    });

    expect(returned).toEqual(activated);
    expect(mockUpdateType).toHaveBeenCalledWith({ id: 'type-1', is_active: true });
    expect(onSuccess).toHaveBeenCalledWith('Type activated', activated);
  });

  it('handleToggleActive deactivates an active type and calls onSuccess', async () => {
    const active = makeType({ is_active: true });
    const deactivated = makeType({ is_active: false });
    mockUpdateType.mockResolvedValueOnce(deactivated);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: ContentType | null = null;
    await act(async () => {
      returned = await result.current.handleToggleActive(active);
    });

    expect(returned).toEqual(deactivated);
    expect(mockUpdateType).toHaveBeenCalledWith({ id: 'type-1', is_active: false });
    expect(onSuccess).toHaveBeenCalledWith('Type deactivated', deactivated);
  });

  it('handleToggleActive returns null and calls onError on failure', async () => {
    const active = makeType({ is_active: true });
    mockUpdateType.mockRejectedValueOnce(new Error('Toggle failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));

    let returned: ContentType | null | undefined;
    await act(async () => {
      returned = await result.current.handleToggleActive(active);
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Toggle failed');
  });

  // ── handleReorder ─────────────────────────────────────────────────────────

  it('handleReorder returns true, calls API with correct sort_order values, and calls onSuccess', async () => {
    mockReorderTypes.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const types = [
      makeType({ id: 'type-1', sort_order: 5 }),
      makeType({ id: 'type-2', sort_order: 10 }),
      makeType({ id: 'type-3', sort_order: 0 }),
    ];

    const { result } = renderHook(() => useTypeActions({ onSuccess }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleReorder(types);
    });

    expect(returned).toBe(true);
    expect(mockReorderTypes).toHaveBeenCalledWith([
      { id: 'type-1', sort_order: 0 },
      { id: 'type-2', sort_order: 1 },
      { id: 'type-3', sort_order: 2 },
    ]);
    expect(onSuccess).toHaveBeenCalledWith('Types reordered successfully');
  });

  it('handleReorder returns false and calls onError on failure', async () => {
    mockReorderTypes.mockRejectedValueOnce(new Error('Reorder failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useTypeActions({ onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleReorder([makeType()]);
    });

    expect(returned).toBe(false);
    expect(onError).toHaveBeenCalledWith('Reorder failed');
  });

  // ── isProcessing during async operations ─────────────────────────────────

  it('isProcessing is true while an async operation is in flight', async () => {
    let resolveCreate!: (value: ContentType) => void;
    const pendingPromise = new Promise<ContentType>((res) => {
      resolveCreate = res;
    });
    mockCreateType.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useTypeActions());

    let actionPromise: Promise<ContentType | null>;
    act(() => {
      actionPromise = result.current.handleCreate({ name: 'Test' });
    });

    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      resolveCreate(makeType());
      await actionPromise!;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  // ── Callbacks not required ────────────────────────────────────────────────

  it('works without any callback options provided', async () => {
    const type = makeType();
    mockCreateType.mockResolvedValueOnce(type);

    const { result } = renderHook(() => useTypeActions());

    let returned: ContentType | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({ name: 'Test' });
    });

    expect(returned).toEqual(type);
  });
});
