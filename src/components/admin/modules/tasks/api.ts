/**
 * Task Management Module - API Layer
 * Navigate Wealth Admin Dashboard
 * 
 * Centralized API abstraction for all task-related operations.
 * Uses KV-backed server routes for persistence (no direct Supabase table access).
 * 
 * @module tasks/api
 */

import { api } from '../../../../utils/api/client';
import { logger } from '../../../../utils/logger';
import type {
  Task,
  TaskChecklistItem,
  CreateTaskInput,
  UpdateTaskInput,
  TaskStats,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  TaskFilters,
  TaskReorderUpdate,
} from './types';
import { ENDPOINTS } from './constants';

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for task API errors
 */
export class TaskApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'TaskApiError';
  }
}

/**
 * Wrap API errors into TaskApiError
 */
function handleError(error: unknown, context: string): never {
  logger.error(`Error in ${context}`, error);

  if (error instanceof TaskApiError) throw error;

  const message = error instanceof Error ? error.message : 'An unknown error occurred';
  throw new TaskApiError(message, undefined, error);
}

// ============================================================================
// TASKS API - CORE CRUD OPERATIONS
// ============================================================================

export const TasksAPI = {
  /**
   * Fetch all tasks
   */
  async getTasks(): Promise<Task[]> {
    logger.debug('[TasksAPI] Fetching all tasks...');

    try {
      const data = await api.get<Task[]>(ENDPOINTS.ALL);
      logger.debug(`[TasksAPI] Found ${data?.length || 0} tasks`);
      return data || [];
    } catch (error) {
      handleError(error, 'getTasks');
    }
  },

  /**
   * Fetch a single task by ID
   */
  async getTask(id: string): Promise<Task> {
    logger.debug(`[TasksAPI] Fetching task ${id}...`);

    try {
      const data = await api.get<Task>(ENDPOINTS.TASK(id));
      if (!data) {
        throw new TaskApiError(`Task with ID ${id} not found`, 'NOT_FOUND');
      }
      return data;
    } catch (error) {
      handleError(error, `getTask(${id})`);
    }
  },

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    logger.debug('[TasksAPI] Creating task:', { title: input.title });

    try {
      const data = await api.post<Task>(ENDPOINTS.TASKS, input);
      logger.debug(`[TasksAPI] Created task ${data.id}`);
      return data;
    } catch (error) {
      handleError(error, 'createTask');
    }
  },

  /**
   * Replace the checklist for a task.
   */
  async saveChecklist(taskId: string, checklist: TaskChecklistItem[]): Promise<TaskChecklistItem[]> {
    logger.debug(`[TasksAPI] Saving checklist for task ${taskId}...`);

    try {
      const data = await api.post<{ success: boolean; checklist: TaskChecklistItem[] }>(
        ENDPOINTS.CHECKLIST(taskId),
        { checklist },
      );
      return data.checklist || [];
    } catch (error) {
      handleError(error, `saveChecklist(${taskId})`);
    }
  },

  /**
   * Update an existing task
   */
  async updateTask(input: UpdateTaskInput): Promise<Task> {
    logger.debug(`[TasksAPI] Updating task ${input.id}...`);

    try {
      const { id, ...updates } = input;
      const data = await api.patch<Task>(ENDPOINTS.TASK(id), updates);
      logger.debug(`[TasksAPI] Updated task ${id}`);
      return data;
    } catch (error) {
      handleError(error, `updateTask(${input.id})`);
    }
  },

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    logger.debug(`[TasksAPI] Deleting task ${id}...`);

    try {
      await api.delete(ENDPOINTS.TASK(id));
      logger.debug(`[TasksAPI] Deleted task ${id}`);
    } catch (error) {
      handleError(error, `deleteTask(${id})`);
    }
  },

  /**
   * Move task to different status and update sort order
   */
  async moveTask(
    id: string,
    newStatus: TaskStatus,
    newSortOrder: number
  ): Promise<Task> {
    logger.debug(`[TasksAPI] Moving task ${id} to ${newStatus} at position ${newSortOrder}...`);

    try {
      const data = await api.post<Task>(ENDPOINTS.MOVE(id), {
        status: newStatus,
        sort_order: newSortOrder,
      });
      logger.debug(`[TasksAPI] Moved task ${id} to ${newStatus}`);
      return data;
    } catch (error) {
      handleError(error, `moveTask(${id})`);
    }
  },

  /**
   * Reorder multiple tasks (batch update)
   */
  async reorderTasks(updates: TaskReorderUpdate[]): Promise<void> {
    logger.debug(`[TasksAPI] Reordering ${updates.length} tasks...`);

    try {
      await api.post(ENDPOINTS.REORDER, { updates });
      logger.debug(`[TasksAPI] Reordered ${updates.length} tasks`);
    } catch (error) {
      handleError(error, 'reorderTasks');
    }
  },

  /**
   * Duplicate a task
   */
  async duplicateTask(id: string): Promise<Task> {
    logger.debug(`[TasksAPI] Duplicating task ${id}...`);

    try {
      const data = await api.post<Task>(ENDPOINTS.DUPLICATE(id));
      logger.debug(`[TasksAPI] Duplicated task ${id} → ${data.id}`);
      return data;
    } catch (error) {
      handleError(error, `duplicateTask(${id})`);
    }
  },

  /**
   * Archive a task
   */
  async archiveTask(id: string): Promise<Task> {
    logger.debug(`[TasksAPI] Archiving task ${id}...`);

    try {
      const data = await api.post<Task>(ENDPOINTS.ARCHIVE(id));
      logger.debug(`[TasksAPI] Archived task ${id}`);
      return data;
    } catch (error) {
      handleError(error, `archiveTask(${id})`);
    }
  },

  /**
   * Unarchive a task (restore from archived)
   */
  async unarchiveTask(id: string, newStatus: TaskStatus = 'new'): Promise<Task> {
    logger.debug(`[TasksAPI] Unarchiving task ${id} to ${newStatus}...`);

    try {
      const data = await api.post<Task>(ENDPOINTS.UNARCHIVE(id), { status: newStatus });
      logger.debug(`[TasksAPI] Unarchived task ${id}`);
      return data;
    } catch (error) {
      handleError(error, `unarchiveTask(${id})`);
    }
  },
};

// ============================================================================
// TASK STATS API - STATISTICS & ANALYTICS
// ============================================================================

export const TaskStatsAPI = {
  /**
   * Get basic task statistics
   */
  async getStats(): Promise<TaskStats> {
    logger.debug('[TaskStatsAPI] Fetching task statistics...');

    try {
      const stats = await api.get<TaskStats>(ENDPOINTS.STATS);
      logger.debug('[TaskStatsAPI] Stats:', { stats });
      return stats;
    } catch (error) {
      logger.warn('[TaskStatsAPI] Failed to fetch stats, returning empty');
      return { total: 0, new: 0, in_progress: 0, completed: 0, archived: 0 };
    }
  },

  /**
   * Get task count by status (derived from all tasks)
   */
  async getStatsByStatus(): Promise<Record<TaskStatus, number>> {
    logger.debug('[TaskStatsAPI] Fetching stats by status...');

    try {
      const tasks = await TasksAPI.getTasks();
      const stats: Record<TaskStatus, number> = {
        new: 0, in_progress: 0, completed: 0, archived: 0,
      };
      tasks.forEach((task) => {
        if (stats[task.status] !== undefined) stats[task.status]++;
      });
      return stats;
    } catch (error) {
      handleError(error, 'getStatsByStatus');
    }
  },

  /**
   * Get task count by priority (derived from all tasks)
   */
  async getStatsByPriority(): Promise<Record<TaskPriority, number>> {
    logger.debug('[TaskStatsAPI] Fetching stats by priority...');

    try {
      const tasks = await TasksAPI.getTasks();
      const stats: Record<TaskPriority, number> = {
        low: 0, medium: 0, high: 0, critical: 0,
      };
      tasks
        .filter((t) => t.status !== 'archived')
        .forEach((t) => {
          if (stats[t.priority] !== undefined) stats[t.priority]++;
        });
      return stats;
    } catch (error) {
      handleError(error, 'getStatsByPriority');
    }
  },

  /**
   * Get task count by category (derived from all tasks)
   */
  async getStatsByCategory(): Promise<Record<string, number>> {
    logger.debug('[TaskStatsAPI] Fetching stats by category...');

    try {
      const tasks = await TasksAPI.getTasks();
      const stats: Record<string, number> = {};
      tasks
        .filter((t) => t.status !== 'archived' && t.category)
        .forEach((t) => {
          const cat = t.category as string;
          stats[cat] = (stats[cat] || 0) + 1;
        });
      return stats;
    } catch (error) {
      handleError(error, 'getStatsByCategory');
    }
  },
};

// ============================================================================
// TASK FILTER API - CLIENT-SIDE FILTERING
// ============================================================================

export const TaskFilterAPI = {
  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    logger.debug(`[TaskFilterAPI] Fetching tasks with status: ${status}...`);
    const tasks = await TasksAPI.getTasks();
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Get tasks by assignee
   */
  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    logger.debug(`[TaskFilterAPI] Fetching tasks for assignee: ${assigneeId}...`);
    const tasks = await TasksAPI.getTasks();
    return tasks
      .filter((t) => t.assignee_id === assigneeId && t.status !== 'archived')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Get tasks by priority
   */
  async getTasksByPriority(priority: TaskPriority): Promise<Task[]> {
    logger.debug(`[TaskFilterAPI] Fetching tasks with priority: ${priority}...`);
    const tasks = await TasksAPI.getTasks();
    return tasks
      .filter((t) => t.priority === priority && t.status !== 'archived')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Get tasks by category
   */
  async getTasksByCategory(category: TaskCategory): Promise<Task[]> {
    logger.debug(`[TaskFilterAPI] Fetching tasks with category: ${category}...`);
    const tasks = await TasksAPI.getTasks();
    return tasks
      .filter((t) => t.category === category && t.status !== 'archived')
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },

  /**
   * Get overdue tasks
   */
  async getOverdueTasks(): Promise<Task[]> {
    logger.debug('[TaskFilterAPI] Fetching overdue tasks...');
    const tasks = await TasksAPI.getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter((t) => {
        if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
        return new Date(t.due_date) < today;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  },

  /**
   * Get tasks due today
   */
  async getTasksDueToday(): Promise<Task[]> {
    logger.debug('[TaskFilterAPI] Fetching tasks due today...');
    const tasks = await TasksAPI.getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return tasks
      .filter((t) => {
        if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
        const d = new Date(t.due_date);
        return d >= today && d < tomorrow;
      });
  },

  /**
   * Get tasks due this week
   */
  async getTasksDueThisWeek(): Promise<Task[]> {
    logger.debug('[TaskFilterAPI] Fetching tasks due this week...');
    const tasks = await TasksAPI.getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return tasks
      .filter((t) => {
        if (!t.due_date || t.status === 'completed' || t.status === 'archived') return false;
        const d = new Date(t.due_date);
        return d >= today && d < nextWeek;
      })
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  },

  /**
   * Search tasks by query string
   */
  async searchTasks(query: string): Promise<Task[]> {
    logger.debug(`[TaskFilterAPI] Searching tasks for: "${query}"...`);
    const tasks = await TasksAPI.getTasks();
    const q = query.toLowerCase();

    return tasks
      .filter((t) => t.status !== 'archived')
      .filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        t.category?.toLowerCase().includes(q)
      );
  },

  /**
   * Get filtered tasks (client-side filtering)
   */
  async getFilteredTasks(filters: TaskFilters): Promise<Task[]> {
    logger.debug('[TaskFilterAPI] Getting filtered tasks...', { filters });
    let tasks = await TasksAPI.getTasks();

    // Status filter
    if (filters.status && filters.status !== 'all') {
      tasks = tasks.filter((t) => t.status === filters.status);
    } else if (!filters.showArchived) {
      tasks = tasks.filter((t) => t.status !== 'archived');
    }

    // Priority filter
    if (filters.priority && filters.priority !== 'all') {
      tasks = tasks.filter((t) => t.priority === filters.priority);
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      tasks = tasks.filter((t) => t.category === filters.category);
    }

    // Assignee filter
    if (filters.assigneeId && filters.assigneeId !== 'all') {
      tasks = tasks.filter((t) => t.assignee_id === filters.assigneeId);
    }

    // Template filter
    if (filters.templatesOnly) {
      tasks = tasks.filter((t) => t.is_template);
    }

    // Search filter
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      tasks = tasks.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Due date filter
    if (filters.dueDate && filters.dueDate !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      tasks = tasks.filter((t) => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);

        switch (filters.dueDate) {
          case 'overdue':
            return d < now;
          case 'today': {
            const tom = new Date(now);
            tom.setDate(tom.getDate() + 1);
            return d >= now && d < tom;
          }
          case 'week': {
            const nw = new Date(now);
            nw.setDate(nw.getDate() + 7);
            return d >= now && d < nw;
          }
          case 'month': {
            const nm = new Date(now);
            nm.setMonth(nm.getMonth() + 1);
            return d >= now && d < nm;
          }
          default:
            return true;
        }
      });
    }

    return tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  },
};
