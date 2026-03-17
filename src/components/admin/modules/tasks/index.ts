/**
 * Task Management Module - Main Index
 * Navigate Wealth Admin Dashboard
 * 
 * Public API for the Task Management module
 * 
 * @module tasks
 */

// Main Component
export { TaskManagementModule } from './TaskManagementModule';

// Types
export type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskModalMode,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskStats,
  TaskReorderUpdate,
  MoveTaskInput,
  AdvancedTaskFilters,
  TaskSortOptions,
  ExtendedTaskStats,
  TaskMetrics,
  BoardViewState,
  TaskFormState,
  ApiResponse,
  PaginatedResponse,
  ValidationResult,
  PartialTask,
  TaskDisplay,
  TaskSummary,
  GroupedTasks,
} from './types';

// Type guards and constants
export {
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  CATEGORY_OPTIONS,
  BOARD_COLUMNS,
} from './constants';

export {
  isTaskStatus,
  isTaskPriority,
  isTaskCategory,
  isTask,
} from './types';

// API Layer
export { TasksAPI, TaskStatsAPI, TaskFilterAPI } from './api';

// Utilities
export {
  isTaskOverdue,
  getOverdueDays,
  isDueToday,
  isDueThisWeek,
  filterBySearch,
  filterByStatus,
  filterByPriority,
  filterByAssignee,
  filterByCategory,
  filterByDueDate,
  applyFilters,
  sortByDueDate,
  sortByPriority,
  sortByCreatedDate,
  sortByTitle,
  groupByStatus,
  groupByPriority,
  groupByCategory,
  validateTitle,
  validateDescription,
  validateDueDate,
  validateAssigneeInitials,
  taskUtils,
} from './utils';

// Hooks
export {
  useTasks,
  useTask,
  useTaskStats,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useReorderTasks,
  useDuplicateTask,
  useArchiveTask,
  useUnarchiveTask,
  useTaskBoard,
  useOverdueDigestProcessor,
  taskKeys,
} from './hooks';