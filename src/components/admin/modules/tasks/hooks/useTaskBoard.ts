/**
 * Task Management Module - Board Hook
 * Navigate Wealth Admin Dashboard
 * 
 * Main state management hook for the Kanban task board:
 * - Filter state management
 * - Modal state management
 * - Drag-and-drop handling
 * - Task grouping and organization
 * 
 * @module tasks/hooks/useTaskBoard
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { DropResult } from '@hello-pangea/dnd';
import type { Task, TaskFilters, TaskStatus, TaskModalMode } from '../types';
import { useMoveTask, useReorderTasks } from './useTaskMutations';
import { applyFilters, groupByStatus } from '../utils';

// ============================================================================
// HOOK
// ============================================================================

/**
 * Task board state management hook
 * 
 * Manages all state and logic for the Kanban task board including:
 * - Filtering tasks
 * - Modal state (create/edit/view)
 * - Drag-and-drop operations
 * - Task grouping by status
 * - Visible columns
 * 
 * @param tasks - Array of all tasks
 * @returns Board state and handlers
 * 
 * @example
 * ```tsx
 * function TaskBoard() {
 *   const { data: tasks = [] } = useTasks();
 *   const {
 *     tasksByStatus,
 *     visibleColumns,
 *     filters,
 *     setFilters,
 *     isModalOpen,
 *     selectedTask,
 *     modalMode,
 *     handleDragEnd,
 *     handleCreateTask,
 *     handleEditTask,
 *     handleViewTask,
 *     handleCloseModal,
 *   } = useTaskBoard(tasks);
 *   
 *   return (
 *     <div>
 *       {visibleColumns.map(status => (
 *         <TaskColumn
 *           key={status}
 *           status={status}
 *           tasks={tasksByStatus[status]}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTaskBoard(tasks: Task[] = []) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: 'all',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalMode, setModalMode] = useState<TaskModalMode>('create');
  const [showArchived, setShowArchived] = useState(false);

  const moveTask = useMoveTask();
  const reorderTasks = useReorderTasks();

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Update selected task when tasks change
   * Keeps modal in sync with latest task data
   * Uses ID-based comparison to prevent unnecessary re-renders
   */
  useEffect(() => {
    if (!selectedTask || !isModalOpen) return;

    const updatedTask = tasks.find(task => task.id === selectedTask.id);
    if (updatedTask) {
      // Only update if the task data actually changed (compare updated_at)
      if (updatedTask.updated_at !== selectedTask.updated_at) {
        setSelectedTask(updatedTask);
      }
    } else {
      // Task was deleted - close modal
      setIsModalOpen(false);
      setSelectedTask(null);
    }
  }, [tasks]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  /**
   * Apply all active filters to tasks
   * Uses centralized filter utility
   */
  const filteredTasks = useMemo(() => {
    return applyFilters(tasks, {
      ...filters,
      showArchived,
    });
  }, [tasks, filters, showArchived]);

  /**
   * Group filtered tasks by status
   * Sorted by sort_order within each group
   */
  const tasksByStatus = useMemo(() => {
    return groupByStatus(filteredTasks);
  }, [filteredTasks]);

  /**
   * Determine which columns to show based on filters
   */
  const visibleColumns: TaskStatus[] = useMemo(() => {
    if (filters.status === 'all') {
      return ['new', 'in_progress', 'completed'];
    }
    return [filters.status as TaskStatus];
  }, [filters.status]);

  // ============================================================================
  // DRAG & DROP HANDLERS
  // ============================================================================

  /**
   * Handle drag end event
   * Supports both moving between columns and reordering within columns
   */
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    // Same position - no change
    if (sourceStatus === destStatus && source.index === destination.index) {
      return;
    }

    const sourceTasks = [...tasksByStatus[sourceStatus]];
    const destTasks = sourceStatus === destStatus ? sourceTasks : [...tasksByStatus[destStatus]];

    // Remove from source
    const [movedTask] = sourceTasks.splice(source.index, 1);

    // Add to destination
    if (sourceStatus === destStatus) {
      sourceTasks.splice(destination.index, 0, movedTask);
    } else {
      destTasks.splice(destination.index, 0, movedTask);
    }

    // Update task status and sort order
    if (sourceStatus !== destStatus) {
      // Moving between columns
      await moveTask.mutateAsync({
        taskId: draggableId,
        newStatus: destStatus,
        newSortOrder: destination.index,
      });

      // Update sort orders for destination column
      const updatedDestTasks = destTasks.map((task, index) => ({
        ...task,
        status: destStatus,
        sort_order: index,
      }));
      await reorderTasks.mutateAsync(updatedDestTasks);
    } else {
      // Reordering within same column
      const updatedTasks = sourceTasks.map((task, index) => ({
        ...task,
        sort_order: index,
      }));
      await reorderTasks.mutateAsync(updatedTasks);
    }
  };

  // ============================================================================
  // MODAL HANDLERS
  // ============================================================================

  /**
   * Open modal in create mode
   */
  const handleCreateTask = () => {
    setSelectedTask(null);
    setModalMode('create');
    setIsModalOpen(true);
  };

  /**
   * Open modal in edit mode with task
   */
  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  /**
   * Open modal in view mode with task
   */
  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setModalMode('view');
    setIsModalOpen(true);
  };

  /**
   * Close modal and reset state
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  /**
   * Change modal mode (e.g., view → edit)
   */
  const handleModeChange = (newMode: TaskModalMode) => {
    setModalMode(newMode);
  };

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Filter state
    filters,
    setFilters,
    
    // Modal state
    isModalOpen,
    setIsModalOpen,
    selectedTask,
    modalMode,
    
    // View state
    showArchived,
    setShowArchived,
    
    // Computed data
    tasksByStatus,
    visibleColumns,
    
    // Event handlers
    handleDragEnd,
    handleCreateTask,
    handleEditTask,
    handleViewTask,
    handleCloseModal,
    handleModeChange,
  };
}