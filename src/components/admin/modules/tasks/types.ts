/**
 * Task Management Module - Type Definitions
 * Navigate Wealth Admin Dashboard
 * 
 * Comprehensive type system for task management, including:
 * - Core task types and interfaces
 * - Input/output types for API operations
 * - Filter and query types
 * - Statistics and analytics types
 * - UI state types
 * - Constants and enums
 * 
 * @module tasks/types
 */

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Task status in the Kanban workflow
 * - new: Task created but not started
 * - in_progress: Task actively being worked on
 * - completed: Task finished
 * - archived: Task archived (not deleted)
 */
export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'archived';

/**
 * Reminder frequency options
 */
export type ReminderFrequency = 'daily' | 'every_2_days' | 'weekly' | 'none';

/**
 * Task priority level
 * Affects visual display and sort order
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * Task category for grouping and filtering
 * Links tasks to different areas of the business
 */
export type TaskCategory = 'client' | 'compliance' | 'application' | 'internal';

/**
 * Modal mode for task form
 */
export type TaskModalMode = 'create' | 'edit' | 'view';

/**
 * Due date filter options
 */
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'week' | 'month';

// ============================================================================
// MAIN INTERFACES
// ============================================================================

/**
 * Task checklist item
 */
export interface TaskChecklistItem {
  /** Unique ID */
  id: string;
  
  /** Task text */
  text: string;
  
  /** Completed status */
  completed: boolean;
}

/**
 * Task comment
 */
export interface TaskComment {
  /** Unique ID */
  id: string;
  
  /** Task ID */
  taskId: string;
  
  /** Comment text */
  text: string;
  
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  
  /** User ID (optional) */
  userId?: string;
  
  /** User Name (optional) */
  userName?: string;
  
  /** User Initials (optional) */
  userInitials?: string;
}

/**
 * Main Task interface
 * Represents a single task in the system
 */
export interface Task {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Task title (required) */
  title: string;
  
  /** Detailed description (optional) */
  description: string | null;
  
  /** Current status in workflow */
  status: TaskStatus;
  
  /** Priority level */
  priority: TaskPriority;

  /** Reminder frequency */
  reminder_frequency: ReminderFrequency | null;

  /** Last reminder sent timestamp */
  last_reminder_sent: string | null;
  
  /** Whether this is a reusable template */
  is_template: boolean;
  
  /** Due date (ISO 8601 string) */
  due_date: string | null;
  
  /** Assignee's initials for avatar display */
  assignee_initials: string | null;
  
  /** Assignee's user ID (foreign key to auth.users) */
  assignee_id: string | null;
  
  /** Array of tag strings for categorization */
  tags: string[];
  
  /** Business category */
  category: TaskCategory | null;
  
  /** User ID who created the task */
  created_by: string;
  
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
  
  /** Completion timestamp (ISO 8601, null if not completed) */
  completed_at: string | null;
  
  /** Sort order within status column (for drag-drop) */
  sort_order: number;
}

// ============================================================================
// INPUT TYPES (API)
// ============================================================================

/**
 * Input for creating a new task
 * All fields except title are optional (server provides defaults)
 */
export interface CreateTaskInput {
  /** Optional explicit ID (for pre-creation scenarios) */
  id?: string;
  
  /** Task title (required) */
  title: string;
  
  /** Task description */
  description?: string | null;
  
  /** Initial status (defaults to 'new') */
  status?: TaskStatus;
  
  /** Priority level (defaults to 'medium') */
  priority?: TaskPriority;

  /** Reminder frequency */
  reminder_frequency?: ReminderFrequency | null;
  
  /** Template flag (defaults to false) */
  is_template?: boolean;
  
  /** Due date */
  due_date?: string | null;
  
  /** Assignee initials */
  assignee_initials?: string | null;
  
  /** Assignee user ID */
  assignee_id?: string | null;
  
  /** Tags array */
  tags?: string[];
  
  /** Business category */
  category?: TaskCategory | null;
}

/**
 * Input for updating an existing task
 * All fields except id are optional (partial update)
 */
export interface UpdateTaskInput {
  /** Task ID (required) */
  id: string;
  
  /** New title */
  title?: string;
  
  /** New description */
  description?: string | null;
  
  /** New status */
  status?: TaskStatus;
  
  /** New priority */
  priority?: TaskPriority;

  /** New reminder frequency */
  reminder_frequency?: ReminderFrequency | null;

  /** New last reminder sent timestamp */
  last_reminder_sent?: string | null;
  
  /** New template flag */
  is_template?: boolean;
  
  /** New due date */
  due_date?: string | null;
  
  /** New assignee initials */
  assignee_initials?: string | null;
  
  /** New assignee ID */
  assignee_id?: string | null;
  
  /** New tags */
  tags?: string[];
  
  /** New category */
  category?: TaskCategory | null;
  
  /** Completion timestamp (set when marking complete) */
  completed_at?: string | null;
  
  /** New sort order */
  sort_order?: number;
}

/**
 * Input for reordering tasks
 * Used in batch reorder operations
 */
export interface TaskReorderUpdate {
  /** Task ID */
  id: string;
  
  /** New sort order */
  sort_order: number;
}

/**
 * Input for moving task to different status
 */
export interface MoveTaskInput {
  /** Task ID */
  taskId: string;
  
  /** New status */
  newStatus: TaskStatus;
  
  /** New sort order in destination column */
  newSortOrder: number;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

/**
 * Task filters for search and filtering
 */
export interface TaskFilters {
  /** Search query (searches title, description, tags, category) */
  search: string;
  
  /** Status filter ('all' or specific status) */
  status: 'all' | TaskStatus;
  
  /** Priority filter ('all' or specific priority) */
  priority?: 'all' | TaskPriority;
  
  /** Assignee filter ('all' or specific user ID) */
  assigneeId?: 'all' | string;
  
  /** Category filter ('all' or specific category) */
  category?: 'all' | TaskCategory;
  
  /** Due date filter */
  dueDate?: DueDateFilter;
  
  /** Show templates only */
  templatesOnly?: boolean;
  
  /** Show archived tasks */
  showArchived?: boolean;
}

/**
 * Advanced filter options
 */
export interface AdvancedTaskFilters extends TaskFilters {
  /** Filter by tags (any of these tags) */
  tags?: string[];
  
  /** Filter by created date range */
  createdDateRange?: {
    start: string;
    end: string;
  };
  
  /** Filter by due date range */
  dueDateRange?: {
    start: string;
    end: string;
  };
  
  /** Created by specific user */
  createdBy?: string;
}

/**
 * Sort options for task lists
 */
export interface TaskSortOptions {
  /** Field to sort by */
  field: 'title' | 'created_at' | 'due_date' | 'priority' | 'status' | 'sort_order';
  
  /** Sort direction */
  direction: 'asc' | 'desc';
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Task statistics for dashboard
 */
export interface TaskStats {
  /** Total active tasks (excludes archived) */
  total: number;
  
  /** Tasks in 'new' status */
  new: number;
  
  /** Tasks in 'in_progress' status */
  in_progress: number;
  
  /** Tasks in 'completed' status */
  completed: number;
  
  /** Tasks in 'archived' status */
  archived: number;
}

/**
 * Extended statistics with breakdowns
 */
export interface ExtendedTaskStats extends TaskStats {
  /** Stats by priority */
  byPriority: Record<TaskPriority, number>;
  
  /** Stats by category */
  byCategory: Record<TaskCategory, number>;
  
  /** Overdue tasks count */
  overdue: number;
  
  /** Due today count */
  dueToday: number;
  
  /** Due this week count */
  dueThisWeek: number;
  
  /** Completion rate (percentage) */
  completionRate: number;
}

/**
 * Task metrics for analytics
 */
export interface TaskMetrics {
  /** Average completion time (in days) */
  avgCompletionTime: number;
  
  /** Tasks created today */
  createdToday: number;
  
  /** Tasks completed today */
  completedToday: number;
  
  /** Tasks overdue */
  overdue: number;
  
  /** Tasks by assignee */
  byAssignee: Record<string, number>;
}

// ============================================================================
// UI STATE TYPES
// ============================================================================

/**
 * Board view state
 */
export interface BoardViewState {
  /** Current filter settings */
  filters: TaskFilters;
  
  /** Modal open/close state */
  isModalOpen: boolean;
  
  /** Currently selected task */
  selectedTask: Task | null;
  
  /** Modal mode */
  modalMode: TaskModalMode;
  
  /** Show archived view */
  showArchived: boolean;
  
  /** Visible columns (based on filters) */
  visibleColumns: TaskStatus[];
}

/**
 * Task form state
 */
export interface TaskFormState {
  /** Form values */
  values: CreateTaskInput | UpdateTaskInput;
  
  /** Form errors */
  errors: Record<string, string>;
  
  /** Form touched fields */
  touched: Record<string, boolean>;
  
  /** Form dirty state */
  isDirty: boolean;
  
  /** Form submitting state */
  isSubmitting: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T | null;
  
  /** Error message if failed */
  error: string | null;
  
  /** Success flag */
  success: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Array of items */
  data: T[];
  
  /** Total count */
  total: number;
  
  /** Current page */
  page: number;
  
  /** Page size */
  pageSize: number;
  
  /** Has more pages */
  hasMore: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;
  
  /** Error messages by field */
  errors: Record<string, string>;
}

/**
 * Field validation rule
 */
export interface ValidationRule {
  /** Rule type */
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  
  /** Rule value/pattern */
  value?: string | number | boolean;
  
  /** Error message */
  message: string;
  
  /** Custom validator function */
  validator?: (value: unknown) => boolean;
}

// Constants & mappings have been extracted to constants.ts (Guidelines §5.3)

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && ['new', 'in_progress', 'completed', 'archived'].includes(value);
}

/**
 * Type guard for TaskPriority
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && ['low', 'medium', 'high', 'critical'].includes(value);
}

/**
 * Type guard for TaskCategory
 */
export function isTaskCategory(value: unknown): value is TaskCategory {
  return typeof value === 'string' && ['client', 'compliance', 'application', 'internal'].includes(value);
}

/**
 * Type guard for Task object
 */
export function isTask(value: unknown): value is Task {
  if (!value || typeof value !== 'object') return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    isTaskStatus(task.status) &&
    isTaskPriority(task.priority)
  );
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Partial Task (for patches)
 */
export type PartialTask = Partial<Task> & Pick<Task, 'id'>;

/**
 * Task without metadata
 */
export type TaskWithoutMetadata = Omit<Task, 'created_at' | 'updated_at' | 'created_by'>;

/**
 * Task for display (with computed fields)
 */
export interface TaskDisplay extends Task {
  /** Is overdue */
  isOverdue: boolean;
  
  /** Overdue days count */
  overdueDays: number;
  
  /** Is due today */
  isDueToday: boolean;
  
  /** Is due this week */
  isDueThisWeek: boolean;
  
  /** Display priority label */
  priorityLabel: string;
  
  /** Display status label */
  statusLabel: string;
  
  /** Display category label */
  categoryLabel: string | null;
}

/**
 * Task summary (minimal data)
 */
export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
}

/**
 * Grouped tasks by status
 */
export type GroupedTasks = Record<TaskStatus, Task[]>;

/**
 * Grouped tasks by priority
 */
export type TasksByPriority = Record<TaskPriority, Task[]>;

/**
 * Grouped tasks by category
 */
export type TasksByCategory = Record<TaskCategory, Task[]>;

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Task event (for activity log)
 */
export interface TaskEvent {
  /** Event ID */
  id: string;
  
  /** Task ID */
  taskId: string;
  
  /** Event type */
  type: 'created' | 'updated' | 'deleted' | 'archived' | 'completed' | 'assigned';
  
  /** User who triggered event */
  userId: string;
  
  /** Event timestamp */
  timestamp: string;
  
  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Drag event result (from @hello-pangea/dnd)
 */
export interface DragEndResult {
  draggableId: string;
  type: string;
  source: {
    index: number;
    droppableId: string;
  };
  destination: {
    droppableId: string;
    index: number;
  } | null;
}

// ============================================================================
// EXPORT GROUPED TYPES
// ============================================================================

/**
 * All task-related types
 */
export type TaskTypes = {
  Task: Task;
  CreateTaskInput: CreateTaskInput;
  UpdateTaskInput: UpdateTaskInput;
  TaskFilters: TaskFilters;
  TaskStats: TaskStats;
  TaskStatus: TaskStatus;
  TaskPriority: TaskPriority;
  TaskCategory: TaskCategory;
};