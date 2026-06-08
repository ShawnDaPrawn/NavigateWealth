/**
 * Tests for useCategoryActions hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCategoryActions } from '../useCategoryActions';
import type { Category } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
const mockCreateCategory = vi.fn();
const mockUpdateCategory = vi.fn();
const mockDeleteCategory = vi.fn();
const mockReorderCategories = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Categories: {
      createCategory: (...args: unknown[]) => mockCreateCategory(...args),
      updateCategory: (...args: unknown[]) => mockUpdateCategory(...args),
      deleteCategory: (...args: unknown[]) => mockDeleteCategory(...args),
      reorderCategories: (...args: unknown[]) => mockReorderCategories(...args),
    },
  },
}));

vi.mock('../../constants', () => ({
  SUCCESS_MESSAGES: {
    categoryCreated: 'Category created successfully',
    categoryUpdated: 'Category updated successfully',
    categoryDeleted: 'Category deleted successfully',
  },
  ERROR_MESSAGES: {
    categoryCreateFailed: 'Failed to create category',
    categoryUpdateFailed: 'Failed to update category',
    categoryDeleteFailed: 'Failed to delete category',
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-1',
    name: 'Test Category',
    description: 'A test category',
    icon: 'test-icon',
    slug: 'test-category',
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

describe('useCategoryActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('initial isProcessing is false', () => {
    const { result } = renderHook(() => useCategoryActions());
    expect(result.current.isProcessing).toBe(false);
  });

  // ── handleCreate ──────────────────────────────────────────────────────────

  it('handleCreate returns category and calls onSuccess on success', async () => {
    const category = makeCategory();
    mockCreateCategory.mockResolvedValueOnce(category);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: Category | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({
        name: 'Test Category',
        description: 'desc',
        icon: '',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(returned).toEqual(category);
    expect(onSuccess).toHaveBeenCalledWith('Category created successfully', category);
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleCreate returns null and calls onError on failure', async () => {
    mockCreateCategory.mockRejectedValueOnce(new Error('Create failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));

    let returned: Category | null | undefined;
    await act(async () => {
      returned = await result.current.handleCreate({
        name: 'Test',
        description: '',
        icon: '',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Create failed');
  });

  it('handleCreate uses fallback error message when error is not an Error instance', async () => {
    mockCreateCategory.mockRejectedValueOnce('string error');
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));
    await act(async () => {
      await result.current.handleCreate({
        name: 'Test',
        description: '',
        icon: '',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(onError).toHaveBeenCalledWith('Failed to create category');
  });

  // ── handleUpdate ──────────────────────────────────────────────────────────

  it('handleUpdate returns category and calls onSuccess on success', async () => {
    const category = makeCategory({ name: 'Updated Category' });
    mockUpdateCategory.mockResolvedValueOnce(category);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: Category | null = null;
    await act(async () => {
      returned = await result.current.handleUpdate('cat-1', { name: 'Updated Category' });
    });

    expect(returned).toEqual(category);
    expect(onSuccess).toHaveBeenCalledWith('Category updated successfully', category);
    expect(mockUpdateCategory).toHaveBeenCalledWith({ id: 'cat-1', name: 'Updated Category' });
  });

  it('handleUpdate returns null and calls onError on failure', async () => {
    mockUpdateCategory.mockRejectedValueOnce(new Error('Update failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));

    let returned: Category | null | undefined;
    await act(async () => {
      returned = await result.current.handleUpdate('cat-1', { name: 'Updated' });
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Update failed');
  });

  // ── handleDelete ──────────────────────────────────────────────────────────

  it('handleDelete returns true and calls onSuccess and onDelete on success', async () => {
    mockDeleteCategory.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();
    const onDelete = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess, onDelete }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('cat-1');
    });

    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith('Category deleted successfully');
    expect(onDelete).toHaveBeenCalled();
    expect(result.current.isProcessing).toBe(false);
  });

  it('handleDelete returns false and calls onError on failure', async () => {
    mockDeleteCategory.mockRejectedValueOnce(new Error('Delete failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('cat-1');
    });

    expect(returned).toBe(false);
    expect(onError).toHaveBeenCalledWith('Delete failed');
  });

  it('handleDelete does not require onDelete to be provided', async () => {
    mockDeleteCategory.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleDelete('cat-1');
    });

    expect(returned).toBe(true);
    expect(onSuccess).toHaveBeenCalled();
  });

  // ── handleToggleActive ────────────────────────────────────────────────────

  it('handleToggleActive activates an inactive category and calls onSuccess', async () => {
    const inactive = makeCategory({ is_active: false });
    const activated = makeCategory({ is_active: true });
    mockUpdateCategory.mockResolvedValueOnce(activated);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: Category | null = null;
    await act(async () => {
      returned = await result.current.handleToggleActive(inactive);
    });

    expect(returned).toEqual(activated);
    expect(mockUpdateCategory).toHaveBeenCalledWith({ id: 'cat-1', is_active: true });
    expect(onSuccess).toHaveBeenCalledWith('Category activated', activated);
  });

  it('handleToggleActive deactivates an active category and calls onSuccess', async () => {
    const active = makeCategory({ is_active: true });
    const deactivated = makeCategory({ is_active: false });
    mockUpdateCategory.mockResolvedValueOnce(deactivated);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: Category | null = null;
    await act(async () => {
      returned = await result.current.handleToggleActive(active);
    });

    expect(returned).toEqual(deactivated);
    expect(mockUpdateCategory).toHaveBeenCalledWith({ id: 'cat-1', is_active: false });
    expect(onSuccess).toHaveBeenCalledWith('Category deactivated', deactivated);
  });

  it('handleToggleActive returns null and calls onError on failure', async () => {
    const active = makeCategory({ is_active: true });
    mockUpdateCategory.mockRejectedValueOnce(new Error('Toggle failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));

    let returned: Category | null | undefined;
    await act(async () => {
      returned = await result.current.handleToggleActive(active);
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Toggle failed');
  });

  // ── handleReorder ─────────────────────────────────────────────────────────

  it('handleReorder returns true, calls API with correct sort_order values, and calls onSuccess', async () => {
    mockReorderCategories.mockResolvedValueOnce(undefined);
    const onSuccess = vi.fn();

    const categories = [
      makeCategory({ id: 'cat-1', sort_order: 5 }),
      makeCategory({ id: 'cat-2', sort_order: 10 }),
      makeCategory({ id: 'cat-3', sort_order: 0 }),
    ];

    const { result } = renderHook(() => useCategoryActions({ onSuccess }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleReorder(categories);
    });

    expect(returned).toBe(true);
    expect(mockReorderCategories).toHaveBeenCalledWith([
      { id: 'cat-1', sort_order: 0 },
      { id: 'cat-2', sort_order: 1 },
      { id: 'cat-3', sort_order: 2 },
    ]);
    expect(onSuccess).toHaveBeenCalledWith('Categories reordered successfully');
  });

  it('handleReorder returns false and calls onError on failure', async () => {
    mockReorderCategories.mockRejectedValueOnce(new Error('Reorder failed'));
    const onError = vi.fn();

    const { result } = renderHook(() => useCategoryActions({ onError }));

    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleReorder([makeCategory()]);
    });

    expect(returned).toBe(false);
    expect(onError).toHaveBeenCalledWith('Reorder failed');
  });

  // ── isProcessing during async operations ─────────────────────────────────

  it('isProcessing is true while an async operation is in flight', async () => {
    let resolveCreate!: (value: Category) => void;
    const pendingPromise = new Promise<Category>((res) => {
      resolveCreate = res;
    });
    mockCreateCategory.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useCategoryActions());

    let actionPromise: Promise<Category | null>;
    act(() => {
      actionPromise = result.current.handleCreate({
        name: 'Test',
        description: '',
        icon: '',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(result.current.isProcessing).toBe(true);

    await act(async () => {
      resolveCreate(makeCategory());
      await actionPromise!;
    });

    expect(result.current.isProcessing).toBe(false);
  });

  // ── Callbacks not required ────────────────────────────────────────────────

  it('works without any callback options provided', async () => {
    const category = makeCategory();
    mockCreateCategory.mockResolvedValueOnce(category);

    const { result } = renderHook(() => useCategoryActions());

    let returned: Category | null = null;
    await act(async () => {
      returned = await result.current.handleCreate({
        name: 'Test',
        description: '',
        icon: '',
        sort_order: 0,
        is_active: true,
      });
    });

    expect(returned).toEqual(category);
  });
});
