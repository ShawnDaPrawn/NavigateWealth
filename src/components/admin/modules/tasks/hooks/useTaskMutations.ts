/**
 * Task Management Module - Mutation Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for data modification operations:
 * - Create, update, delete tasks
 * - Move and reorder tasks
 * - Duplicate and archive tasks
 * - Optimistic updates for better UX
 * 
 * @module tasks/hooks/useTaskMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner@2.0.3';
import { pendingCountsKeys, tasksKeys } from '../../../../../utils/queryKeys';
import { TasksAPI } from '../api';
import { taskKeys } from './useTaskQueries';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskStatus } from '../types';

export function mergeTaskReorderIntoList(previousTasks: Task[] | undefined, reorderedTasks: Task[]): Task[] {
  if (!previousTasks) return reorderedTasks;

  const reorderedById = new Map(reorderedTasks.map((task) => [task.id, task]));
  return previousTasks.map((task) => reorderedById.get(task.id) ?? task);
}

// ============================================================================
// CREATE MUTATION
// ============================================================================

/**
 * Create a new task
 * 
 * @returns React Query mutation for creating tasks
 * 
 * @example
 * ```tsx
 * function CreateTaskButton() {
 *   const createTask = useCreateTask();
 *   
 *   const handleCreate = async () => {
 *     await createTask.mutateAsync({
 *       title: 'New Task',
 *       description: 'Task description',
 *       priority: 'high',
 *     });
 *   };
 *   
 *   return (
 *     <button onClick={handleCreate} disabled={createTask.isPending}>
 *       {createTask.isPending ? 'Creating...' : 'Create Task'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TasksAPI.createTask,
    onSuccess: () => {
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      
      // Invalidate dashboard queries (if they exist)
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task created successfully');
    },
    onError: (error) => {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    },
  });
}

// ============================================================================
// UPDATE MUTATION
// ============================================================================

/**
 * Update an existing task
 * 
 * @returns React Query mutation for updating tasks
 * 
 * @example
 * ```tsx
 * function UpdateTaskButton({ task }: { task: Task }) {
 *   const updateTask = useUpdateTask();
 *   
 *   const handleUpdate = async () => {
 *     await updateTask.mutateAsync({
 *       id: task.id,
 *       status: 'completed',
 *       completed_at: new Date().toISOString(),
 *     });
 *   };
 *   
 *   return (
 *     <button onClick={handleUpdate}>
 *       Mark Complete
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TasksAPI.updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update task:', error);
      toast.error('Failed to update task');
    },
  });
}

// ============================================================================
// DELETE MUTATION
// ============================================================================

/**
 * Delete a task
 * 
 * @returns React Query mutation for deleting tasks
 * 
 * @example
 * ```tsx
 * function DeleteTaskButton({ taskId }: { taskId: string }) {
 *   const deleteTask = useDeleteTask();
 *   
 *   const handleDelete = async () => {
 *     if (confirm('Are you sure?')) {
 *       await deleteTask.mutateAsync(taskId);
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handleDelete}>
 *       Delete
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TasksAPI.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    },
  });
}

// ============================================================================
// MOVE MUTATION (with Optimistic Updates)
// ============================================================================

/**
 * Move task to different status with optimistic updates
 * 
 * @returns React Query mutation for moving tasks
 * 
 * @example
 * ```tsx
 * function MoveTaskButton({ task }: { task: Task }) {
 *   const moveTask = useMoveTask();
 *   
 *   const handleMove = async () => {
 *     await moveTask.mutateAsync({
 *       taskId: task.id,
 *       newStatus: 'completed',
 *       newSortOrder: 0,
 *     });
 *   };
 *   
 *   return <button onClick={handleMove}>Move</button>;
 * }
 * ```
 */
export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newStatus, newSortOrder }: { 
      taskId: string; 
      newStatus: TaskStatus; 
      newSortOrder: number 
    }) => TasksAPI.moveTask(taskId, newStatus, newSortOrder),
    
    // Optimistic update
    onMutate: async ({ taskId, newStatus, newSortOrder }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      
      // Snapshot previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());

      // Optimistically update the cache
      if (previousTasks) {
        const updatedTasks = previousTasks.map((task) =>
          task.id === taskId
            ? { ...task, status: newStatus, sort_order: newSortOrder }
            : task
        );
        queryClient.setQueryData(taskKeys.lists(), updatedTasks);
      }

      // Return context for rollback
      return { previousTasks };
    },
    
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error('Failed to move task');
    },
    
    // Refetch on settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    },
  });
}

// ============================================================================
// REORDER MUTATION (with Optimistic Updates)
// ============================================================================

/**
 * Reorder tasks within a column with optimistic updates
 * 
 * @returns React Query mutation for reordering tasks
 * 
 * @example
 * ```tsx
 * function TaskColumn({ tasks }: { tasks: Task[] }) {
 *   const reorderTasks = useReorderTasks();
 *   
 *   const handleReorder = async (reorderedTasks: Task[]) => {
 *     await reorderTasks.mutateAsync(reorderedTasks);
 *   };
 *   
 *   return <div>...</div>;
 * }
 * ```
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      const updates = tasks.map((task, index) => ({
        id: task.id,
        sort_order: index,
      }));
      return TasksAPI.reorderTasks(updates);
    },
    
    // Optimistic update
    onMutate: async (tasks) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.lists() });
      const previousTasks = queryClient.getQueryData<Task[]>(taskKeys.lists());
      
      queryClient.setQueryData(taskKeys.lists(), mergeTaskReorderIntoList(previousTasks, tasks));

      return { previousTasks };
    },
    
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      toast.error('Failed to reorder tasks');
    },
    
    // Refetch on settle
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
    },
  });
}

// ============================================================================
// DUPLICATE MUTATION
// ============================================================================

/**
 * Duplicate a task
 * 
 * @returns React Query mutation for duplicating tasks
 * 
 * @example
 * ```tsx
 * function DuplicateButton({ taskId }: { taskId: string }) {
 *   const duplicateTask = useDuplicateTask();
 *   
 *   const handleDuplicate = async () => {
 *     await duplicateTask.mutateAsync(taskId);
 *   };
 *   
 *   return <button onClick={handleDuplicate}>Duplicate</button>;
 * }
 * ```
 */
export function useDuplicateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TasksAPI.duplicateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task duplicated successfully');
    },
    onError: (error) => {
      console.error('Failed to duplicate task:', error);
      toast.error('Failed to duplicate task');
    },
  });
}

// ============================================================================
// ARCHIVE MUTATION
// ============================================================================

/**
 * Archive a task
 * 
 * @returns React Query mutation for archiving tasks
 * 
 * @example
 * ```tsx
 * function ArchiveButton({ taskId }: { taskId: string }) {
 *   const archiveTask = useArchiveTask();
 *   
 *   const handleArchive = async () => {
 *     await archiveTask.mutateAsync(taskId);
 *   };
 *   
 *   return <button onClick={handleArchive}>Archive</button>;
 * }
 * ```
 */
export function useArchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: TasksAPI.archiveTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task archived successfully');
    },
    onError: (error) => {
      console.error('Failed to archive task:', error);
      toast.error('Failed to archive task');
    },
  });
}

/**
 * Unarchive a task
 * 
 * @returns React Query mutation for unarchiving tasks
 * 
 * @example
 * ```tsx
 * function UnarchiveButton({ taskId }: { taskId: string }) {
 *   const unarchiveTask = useUnarchiveTask();
 *   
 *   const handleUnarchive = async () => {
 *     await unarchiveTask.mutateAsync({ taskId, newStatus: 'new' });
 *   };
 *   
 *   return <button onClick={handleUnarchive}>Unarchive</button>;
 * }
 * ```
 */
export function useUnarchiveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus?: TaskStatus }) => 
      TasksAPI.unarchiveTask(taskId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.stats() });
      queryClient.invalidateQueries({ queryKey: pendingCountsKeys.all });
      queryClient.invalidateQueries({ queryKey: tasksKeys.dueToday() });
      
      toast.success('Task unarchived successfully');
    },
    onError: (error) => {
      console.error('Failed to unarchive task:', error);
      toast.error('Failed to unarchive task');
    },
  });
}
