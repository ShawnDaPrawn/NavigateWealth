/**
 * Task Management Module - Hooks Index
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized exports for all task-related hooks
 * 
 * @module tasks/hooks
 */

// Query hooks
export {
  useTasks,
  useTask,
  useTaskStats,
  taskKeys,
} from './useTaskQueries';

// Mutation hooks
export {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useReorderTasks,
  useDuplicateTask,
  useArchiveTask,
  useUnarchiveTask,
} from './useTaskMutations';

// Board hook
export { useTaskBoard } from './useTaskBoard';

// Background processors
export { useOverdueDigestProcessor } from './useOverdueDigestProcessor';