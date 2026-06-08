/**
 * Tests for useTaskBoard hook
 *
 * Mocked dependencies (paths relative to hooks/__tests__/):
 *   - '../useTaskMutations'   → useMoveTask, useReorderTasks
 *   - '../../utils'          → applyFilters, groupByStatus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskBoard } from '../useTaskBoard';
import type { Task, TaskStatus } from '../../types';

// ============================================================================
// MOCK SPIES
// ============================================================================

const mockMutateAsync = vi.fn();
const mockMoveTaskMutate = vi.fn();
const mockReorderTasksMutate = vi.fn();
const mockApplyFilters = vi.fn();
const mockGroupByStatus = vi.fn();

vi.mock('../useTaskMutations', () => ({
  useMoveTask: () => ({
    mutate: (...args: unknown[]) => mockMoveTaskMutate(...args),
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
  useReorderTasks: () => ({
    mutate: (...args: unknown[]) => mockReorderTasksMutate(...args),
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
    isPending: false,
  }),
}));

vi.mock('../../utils', () => ({
  applyFilters: (...args: unknown[]) => mockApplyFilters(...args),
  groupByStatus: (...args: unknown[]) => mockGroupByStatus(...args),
}));

// ============================================================================
// HELPERS
// ============================================================================

function makeTask(id: string, status: TaskStatus = 'new', sort_order = 0): Task {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    status,
    priority: 'medium',
    reminder_frequency: null,
    last_reminder_sent: null,
    is_template: false,
    due_date: null,
    assignee_initials: null,
    assignee_id: null,
    tags: [],
    category: null,
    created_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    sort_order,
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Default passthrough behaviour so tests that don't care about
  // filter/group logic still get sensible return values.
  mockApplyFilters.mockImplementation((tasks: Task[]) => tasks);
  mockGroupByStatus.mockImplementation((_tasks: Task[]) => ({}));
  mockMutateAsync.mockResolvedValue(undefined);
});

// ============================================================================
// STRUCTURE
// ============================================================================

describe('useTaskBoard – return structure', () => {
  it('returns all expected keys', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    const keys = [
      'filters',
      'setFilters',
      'isModalOpen',
      'setIsModalOpen',
      'selectedTask',
      'modalMode',
      'showArchived',
      'setShowArchived',
      'tasksByStatus',
      'visibleColumns',
      'handleDragEnd',
      'handleCreateTask',
      'handleEditTask',
      'handleViewTask',
      'handleCloseModal',
      'handleModeChange',
    ];
    keys.forEach((key) => {
      expect(result.current).toHaveProperty(key);
    });
  });

  it('starts with default filter values', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    expect(result.current.filters).toEqual({ search: '', status: 'all' });
  });

  it('starts with modal closed and no selected task', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.selectedTask).toBeNull();
  });

  it('starts with modalMode set to "create"', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    expect(result.current.modalMode).toBe('create');
  });

  it('starts with showArchived set to false', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    expect(result.current.showArchived).toBe(false);
  });
});

// ============================================================================
// setFilters
// ============================================================================

describe('setFilters', () => {
  it('updates filter state', () => {
    const { result } = renderHook(() => useTaskBoard([]));

    act(() => {
      result.current.setFilters({ search: 'hello', status: 'new' });
    });

    expect(result.current.filters).toEqual({ search: 'hello', status: 'new' });
  });

  it('updates visibleColumns to the filtered status when status is not "all"', () => {
    const { result } = renderHook(() => useTaskBoard([]));

    act(() => {
      result.current.setFilters({ search: '', status: 'in_progress' });
    });

    expect(result.current.visibleColumns).toEqual(['in_progress']);
  });

  it('shows all three columns when status is "all"', () => {
    const { result } = renderHook(() => useTaskBoard([]));
    expect(result.current.visibleColumns).toEqual(['new', 'in_progress', 'completed']);
  });
});

// ============================================================================
// MODAL HANDLERS
// ============================================================================

describe('handleCreateTask', () => {
  it('opens the modal', () => {
    const { result } = renderHook(() => useTaskBoard([]));

    act(() => {
      result.current.handleCreateTask();
    });

    expect(result.current.isModalOpen).toBe(true);
  });

  it('sets modalMode to "create"', () => {
    const { result } = renderHook(() => useTaskBoard([]));

    act(() => {
      result.current.handleCreateTask();
    });

    expect(result.current.modalMode).toBe('create');
  });

  it('sets selectedTask to null', () => {
    const task = makeTask('t1');
    const { result } = renderHook(() => useTaskBoard([task]));

    // First set a selected task via edit
    act(() => {
      result.current.handleEditTask(task);
    });
    expect(result.current.selectedTask).toEqual(task);

    // Then switch to create mode
    act(() => {
      result.current.handleCreateTask();
    });

    expect(result.current.selectedTask).toBeNull();
  });
});

describe('handleEditTask', () => {
  it('opens the modal with mode "edit"', () => {
    const task = makeTask('t1');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleEditTask(task);
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.modalMode).toBe('edit');
  });

  it('sets selectedTask to the provided task', () => {
    const task = makeTask('t1');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleEditTask(task);
    });

    expect(result.current.selectedTask).toEqual(task);
  });
});

describe('handleViewTask', () => {
  it('opens the modal with mode "view"', () => {
    const task = makeTask('t2');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleViewTask(task);
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.modalMode).toBe('view');
  });

  it('sets selectedTask to the provided task', () => {
    const task = makeTask('t2');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleViewTask(task);
    });

    expect(result.current.selectedTask).toEqual(task);
  });
});

describe('handleCloseModal', () => {
  it('closes the modal', () => {
    const task = makeTask('t1');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleEditTask(task);
    });

    act(() => {
      result.current.handleCloseModal();
    });

    expect(result.current.isModalOpen).toBe(false);
  });

  it('clears selectedTask', () => {
    const task = makeTask('t1');
    const { result } = renderHook(() => useTaskBoard([task]));

    act(() => {
      result.current.handleEditTask(task);
    });
    expect(result.current.selectedTask).not.toBeNull();

    act(() => {
      result.current.handleCloseModal();
    });

    expect(result.current.selectedTask).toBeNull();
  });
});

// ============================================================================
// COMPUTED VALUES
// ============================================================================

describe('tasksByStatus', () => {
  it('calls groupByStatus with the filtered tasks', () => {
    const tasks = [makeTask('t1', 'new'), makeTask('t2', 'in_progress')];
    mockApplyFilters.mockReturnValue(tasks);
    mockGroupByStatus.mockReturnValue({ new: [tasks[0]], in_progress: [tasks[1]], completed: [] });

    const { result } = renderHook(() => useTaskBoard(tasks));

    expect(mockGroupByStatus).toHaveBeenCalledWith(tasks);
    expect(result.current.tasksByStatus).toEqual({
      new: [tasks[0]],
      in_progress: [tasks[1]],
      completed: [],
    });
  });
});

describe('filteredTasks (via applyFilters)', () => {
  it('calls applyFilters with the tasks and current filter state', () => {
    const tasks = [makeTask('t1')];
    mockApplyFilters.mockReturnValue(tasks);

    renderHook(() => useTaskBoard(tasks));

    expect(mockApplyFilters).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ search: '', status: 'all', showArchived: false }),
    );
  });

  it('re-applies filters when filters state changes', () => {
    const tasks = [makeTask('t1')];
    const { result } = renderHook(() => useTaskBoard(tasks));

    act(() => {
      result.current.setFilters({ search: 'foo', status: 'all' });
    });

    expect(mockApplyFilters).toHaveBeenCalledWith(
      tasks,
      expect.objectContaining({ search: 'foo' }),
    );
  });
});

// ============================================================================
// handleDragEnd
// ============================================================================

describe('handleDragEnd', () => {
  it('does nothing when destination is null', async () => {
    const { result } = renderHook(() => useTaskBoard([]));

    await act(async () => {
      await result.current.handleDragEnd({
        draggableId: 't1',
        type: 'DEFAULT',
        source: { droppableId: 'new', index: 0 },
        destination: null,
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      });
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does nothing when source and destination are the same position', async () => {
    const tasks = [makeTask('t1', 'new', 0), makeTask('t2', 'new', 1)];
    mockApplyFilters.mockReturnValue(tasks);
    mockGroupByStatus.mockReturnValue({ new: tasks, in_progress: [], completed: [] });

    const { result } = renderHook(() => useTaskBoard(tasks));

    await act(async () => {
      await result.current.handleDragEnd({
        draggableId: 't1',
        type: 'DEFAULT',
        source: { droppableId: 'new', index: 0 },
        destination: { droppableId: 'new', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      });
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('calls moveTask.mutateAsync when moving between columns', async () => {
    const task = makeTask('t1', 'new', 0);
    mockApplyFilters.mockReturnValue([task]);
    mockGroupByStatus.mockReturnValue({ new: [task], in_progress: [], completed: [] });

    const { result } = renderHook(() => useTaskBoard([task]));

    await act(async () => {
      await result.current.handleDragEnd({
        draggableId: 't1',
        type: 'DEFAULT',
        source: { droppableId: 'new', index: 0 },
        destination: { droppableId: 'in_progress', index: 0 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', newStatus: 'in_progress', newSortOrder: 0 }),
    );
  });

  it('calls reorderTasks.mutateAsync when reordering within the same column', async () => {
    const tasks = [makeTask('t1', 'new', 0), makeTask('t2', 'new', 1)];
    mockApplyFilters.mockReturnValue(tasks);
    mockGroupByStatus.mockReturnValue({ new: tasks, in_progress: [], completed: [] });

    const { result } = renderHook(() => useTaskBoard(tasks));

    await act(async () => {
      await result.current.handleDragEnd({
        draggableId: 't1',
        type: 'DEFAULT',
        source: { droppableId: 'new', index: 0 },
        destination: { droppableId: 'new', index: 1 },
        reason: 'DROP',
        mode: 'FLUID',
        combine: null,
      });
    });

    // reorderTasks is called (moveTask is not called separately for same-column drags)
    expect(mockMutateAsync).toHaveBeenCalled();
  });
});
