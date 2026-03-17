/**
 * Task Management Module - Utility Functions
 * Navigate Wealth Admin Dashboard
 * 
 * Reusable utility functions for:
 * - Date/time calculations and formatting
 * - Task filtering and sorting
 * - Priority and status helpers
 * - Validation
 * 
 * @module tasks/utils
 */

import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskFilters,
} from './types';

// ============================================================================
// DATE & TIME UTILITIES
// ============================================================================

/**
 * Check if a task is overdue
 * 
 * @param task - Task to check
 * @returns True if task is overdue
 * 
 * @example
 * isTaskOverdue(task); // true
 */
export function isTaskOverdue(task: Task): boolean {
  if (!task.due_date || task.status === 'completed' || task.status === 'archived') {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate < today;
}

/**
 * Calculate number of days a task is overdue
 * 
 * @param task - Task to check
 * @returns Number of days overdue (0 if not overdue)
 * 
 * @example
 * getOverdueDays(task); // 3
 */
export function getOverdueDays(task: Task): number {
  if (!task.due_date || task.status === 'completed' || task.status === 'archived') {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Check if task is due today
 * 
 * @param task - Task to check
 * @returns True if due today
 * 
 * @example
 * isDueToday(task); // true
 */
export function isDueToday(task: Task): boolean {
  if (!task.due_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() === today.getTime();
}

/**
 * Check if task is due this week
 * 
 * @param task - Task to check
 * @returns True if due this week
 * 
 * @example
 * isDueThisWeek(task); // true
 */
export function isDueThisWeek(task: Task): boolean {
  if (!task.due_date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  return dueDate >= today && dueDate <= weekFromNow;
}

// ============================================================================
// FILTERING UTILITIES
// ============================================================================

/**
 * Filter tasks by search query
 * Searches title, description, tags, and category
 * 
 * @param tasks - Tasks to filter
 * @param query - Search query
 * @returns Filtered tasks
 * 
 * @example
 * filterBySearch(tasks, 'urgent'); // [...matching tasks]
 */
export function filterBySearch(tasks: Task[], query: string): Task[] {
  if (!query) return tasks;

  const queryLower = query.toLowerCase();

  return tasks.filter(
    (task) =>
      task.title.toLowerCase().includes(queryLower) ||
      task.description?.toLowerCase().includes(queryLower) ||
      task.tags?.some((tag) => tag.toLowerCase().includes(queryLower)) ||
      task.category?.toLowerCase().includes(queryLower)
  );
}

/**
 * Filter tasks by status
 * 
 * @param tasks - Tasks to filter
 * @param status - Status to filter by ('all' or specific status)
 * @returns Filtered tasks
 * 
 * @example
 * filterByStatus(tasks, 'in_progress'); // [...in progress tasks]
 */
export function filterByStatus(tasks: Task[], status: 'all' | TaskStatus): Task[] {
  if (status === 'all') return tasks;
  return tasks.filter((task) => task.status === status);
}

/**
 * Filter tasks by priority
 * 
 * @param tasks - Tasks to filter
 * @param priority - Priority to filter by ('all' or specific priority)
 * @returns Filtered tasks
 * 
 * @example
 * filterByPriority(tasks, 'high'); // [...high priority tasks]
 */
export function filterByPriority(tasks: Task[], priority: 'all' | TaskPriority): Task[] {
  if (priority === 'all') return tasks;
  return tasks.filter((task) => task.priority === priority);
}

/**
 * Filter tasks by assignee
 * 
 * @param tasks - Tasks to filter
 * @param assigneeId - Assignee ID ('all' or specific user ID)
 * @returns Filtered tasks
 * 
 * @example
 * filterByAssignee(tasks, 'user-123'); // [...assigned tasks]
 */
export function filterByAssignee(tasks: Task[], assigneeId: 'all' | string): Task[] {
  if (assigneeId === 'all') return tasks;
  return tasks.filter((task) => task.assignee_id === assigneeId);
}

/**
 * Filter tasks by category
 * 
 * @param tasks - Tasks to filter
 * @param category - Category ('all' or specific category)
 * @returns Filtered tasks
 * 
 * @example
 * filterByCategory(tasks, 'client'); // [...client tasks]
 */
export function filterByCategory(tasks: Task[], category: 'all' | TaskCategory): Task[] {
  if (category === 'all') return tasks;
  return tasks.filter((task) => task.category === category);
}

/**
 * Filter tasks by due date
 * 
 * @param tasks - Tasks to filter
 * @param filter - Due date filter
 * @returns Filtered tasks
 * 
 * @example
 * filterByDueDate(tasks, 'overdue'); // [...overdue tasks]
 */
export function filterByDueDate(tasks: Task[], filter: string): Task[] {
  switch (filter) {
    case 'overdue':
      return tasks.filter(isTaskOverdue);
    case 'today':
      return tasks.filter(isDueToday);
    case 'week':
      return tasks.filter(isDueThisWeek);
    case 'all':
    default:
      return tasks;
  }
}

/**
 * Apply multiple filters to tasks
 * 
 * @param tasks - Tasks to filter
 * @param filters - Filter object
 * @returns Filtered tasks
 * 
 * @example
 * const filtered = applyFilters(tasks, {
 *   search: 'urgent',
 *   status: 'in_progress',
 *   priority: 'high'
 * });
 */
export function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  let filtered = tasks;

  // Filter out archived tasks unless explicitly shown
  if (!filters.showArchived) {
    filtered = filtered.filter((task) => task.status !== 'archived');
  }

  // Apply search
  if (filters.search) {
    filtered = filterBySearch(filtered, filters.search);
  }

  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filterByStatus(filtered, filters.status);
  }

  // Apply priority filter
  if (filters.priority && filters.priority !== 'all') {
    filtered = filterByPriority(filtered, filters.priority);
  }

  // Apply assignee filter
  if (filters.assigneeId && filters.assigneeId !== 'all') {
    filtered = filterByAssignee(filtered, filters.assigneeId);
  }

  // Apply category filter
  if (filters.category && filters.category !== 'all') {
    filtered = filterByCategory(filtered, filters.category);
  }

  // Apply due date filter
  if (filters.dueDate && filters.dueDate !== 'all') {
    filtered = filterByDueDate(filtered, filters.dueDate);
  }

  return filtered;
}

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort tasks by due date (earliest first)
 * Tasks without due dates are sorted last
 * 
 * @param tasks - Tasks to sort
 * @returns Sorted tasks
 * 
 * @example
 * sortByDueDate(tasks); // [...sorted by due date]
 */
export function sortByDueDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Tasks without due dates go last
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;

    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });
}

/**
 * Sort tasks by priority (highest first)
 * 
 * @param tasks - Tasks to sort
 * @returns Sorted tasks
 * 
 * @example
 * sortByPriority(tasks); // [...critical, high, medium, low]
 */
export function sortByPriority(tasks: Task[]): Task[] {
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...tasks].sort((a, b) => {
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

/**
 * Sort tasks by created date (newest first)
 * 
 * @param tasks - Tasks to sort
 * @returns Sorted tasks
 * 
 * @example
 * sortByCreatedDate(tasks); // [...newest to oldest]
 */
export function sortByCreatedDate(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Sort tasks by title (alphabetical)
 * 
 * @param tasks - Tasks to sort
 * @returns Sorted tasks
 * 
 * @example
 * sortByTitle(tasks); // [...A to Z]
 */
export function sortByTitle(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    return a.title.localeCompare(b.title);
  });
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Group tasks by status
 * 
 * @param tasks - Tasks to group
 * @returns Tasks grouped by status
 * 
 * @example
 * const grouped = groupByStatus(tasks);
 * // { new: [...], in_progress: [...], completed: [...], archived: [...] }
 */
export function groupByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = {
    new: [],
    in_progress: [],
    completed: [],
    archived: [],
  };

  tasks.forEach((task) => {
    if (grouped[task.status]) {
      grouped[task.status].push(task);
    }
  });

  // Sort each group by sort_order
  Object.keys(grouped).forEach((status) => {
    grouped[status as TaskStatus].sort((a, b) => a.sort_order - b.sort_order);
  });

  return grouped;
}

/**
 * Group tasks by priority
 * 
 * @param tasks - Tasks to group
 * @returns Tasks grouped by priority
 * 
 * @example
 * const grouped = groupByPriority(tasks);
 * // { critical: [...], high: [...], medium: [...], low: [...] }
 */
export function groupByPriority(tasks: Task[]): Record<TaskPriority, Task[]> {
  const grouped: Record<TaskPriority, Task[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };

  tasks.forEach((task) => {
    if (grouped[task.priority]) {
      grouped[task.priority].push(task);
    }
  });

  return grouped;
}

/**
 * Group tasks by category
 * 
 * @param tasks - Tasks to group
 * @returns Tasks grouped by category
 * 
 * @example
 * const grouped = groupByCategory(tasks);
 * // { client: [...], compliance: [...], application: [...], internal: [...] }
 */
export function groupByCategory(tasks: Task[]): Record<TaskCategory | 'none', Task[]> {
  const grouped: Record<TaskCategory | 'none', Task[]> = {
    client: [],
    compliance: [],
    application: [],
    internal: [],
    none: [],
  };

  tasks.forEach((task) => {
    if (task.category && grouped[task.category]) {
      grouped[task.category].push(task);
    } else {
      grouped.none.push(task);
    }
  });

  return grouped;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate task title
 * 
 * @param title - Title to validate
 * @returns Error message or null if valid
 * 
 * @example
 * validateTitle(''); // 'Title is required'
 * validateTitle('Valid title'); // null
 */
export function validateTitle(title: string): string | null {
  if (!title || title.trim().length === 0) {
    return 'Title is required';
  }
  if (title.length > 200) {
    return 'Title must be less than 200 characters';
  }
  return null;
}

/**
 * Validate task description
 * 
 * @param description - Description to validate
 * @returns Error message or null if valid
 * 
 * @example
 * validateDescription('Very long...'); // 'Description must be less than 2000 characters'
 * validateDescription('Valid'); // null
 */
export function validateDescription(description: string | null): string | null {
  if (!description) return null;
  if (description.length > 2000) {
    return 'Description must be less than 2000 characters';
  }
  return null;
}

/**
 * Validate due date
 * 
 * @param dueDate - Due date to validate
 * @returns Error message or null if valid
 * 
 * @example
 * validateDueDate('invalid'); // 'Invalid date format'
 * validateDueDate('2026-01-10'); // null
 */
export function validateDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  if (isNaN(date.getTime())) {
    return 'Invalid date format';
  }

  return null;
}

/**
 * Validate assignee initials
 * 
 * @param initials - Initials to validate
 * @returns Error message or null if valid
 * 
 * @example
 * validateAssigneeInitials('ABCD'); // 'Initials must be 1-3 characters'
 * validateAssigneeInitials('AB'); // null
 */
export function validateAssigneeInitials(initials: string | null): string | null {
  if (!initials) return null;
  
  if (initials.length > 3) {
    return 'Initials must be 1-3 characters';
  }
  
  if (!/^[A-Za-z]+$/.test(initials)) {
    return 'Initials must contain only letters';
  }

  return null;
}

// ============================================================================
// EXPORT UTILITY OBJECT (Optional convenience)
// ============================================================================

/**
 * Utility object with all task utilities
 * Use individual exports for better tree-shaking
 */
export const taskUtils = {
  // Date/Time
  isTaskOverdue,
  getOverdueDays,
  isDueToday,
  isDueThisWeek,
  
  // Filtering
  filterBySearch,
  filterByStatus,
  filterByPriority,
  filterByAssignee,
  filterByCategory,
  filterByDueDate,
  applyFilters,
  
  // Sorting
  sortByDueDate,
  sortByPriority,
  sortByCreatedDate,
  sortByTitle,
  
  // Grouping
  groupByStatus,
  groupByPriority,
  groupByCategory,
  
  // Validation
  validateTitle,
  validateDescription,
  validateDueDate,
  validateAssigneeInitials,
};

export default taskUtils;