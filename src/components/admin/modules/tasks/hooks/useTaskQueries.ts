/**
 * Task Management Module - Query Hooks
 * Navigate Wealth Admin Dashboard
 * 
 * React Query hooks for data fetching operations:
 * - Task list queries
 * - Task statistics
 * - Filtered queries
 * 
 * @module tasks/hooks/useTaskQueries
 */

import { useQuery } from '@tanstack/react-query';
import { TasksAPI, TaskStatsAPI } from '../api';
import type { Task, TaskStats } from '../types';

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * Query key factory for tasks
 * Provides centralized, type-safe query keys
 */
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: string) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  stats: () => [...taskKeys.all, 'stats'] as const,
};

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Fetch all tasks
 * 
 * @returns React Query result with tasks array
 * 
 * @example
 * ```tsx
 * function TaskList() {
 *   const { data: tasks, isLoading, error } = useTasks();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error loading tasks</div>;
 *   
 *   return (
 *     <div>
 *       {tasks?.map(task => (
 *         <div key={task.id}>{task.title}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTasks() {
  return useQuery({
    queryKey: taskKeys.lists(),
    queryFn: TasksAPI.getTasks,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

/**
 * Fetch a single task by ID
 * 
 * @param id - Task ID
 * @param enabled - Whether to run the query (default: true)
 * @returns React Query result with task
 * 
 * @example
 * ```tsx
 * function TaskDetail({ taskId }: { taskId: string }) {
 *   const { data: task, isLoading } = useTask(taskId);
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!task) return <div>Task not found</div>;
 *   
 *   return <div>{task.title}</div>;
 * }
 * ```
 */
export function useTask(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => TasksAPI.getTask(id),
    staleTime: 30000,
    retry: false,
    enabled: enabled && !!id,
  });
}

/**
 * Fetch task statistics
 * 
 * @returns React Query result with task stats
 * 
 * @example
 * ```tsx
 * function TaskStats() {
 *   const { data: stats } = useTaskStats();
 *   
 *   return (
 *     <div>
 *       <div>Total: {stats?.total}</div>
 *       <div>New: {stats?.new}</div>
 *       <div>In Progress: {stats?.in_progress}</div>
 *       <div>Completed: {stats?.completed}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTaskStats() {
  return useQuery({
    queryKey: taskKeys.stats(),
    queryFn: TaskStatsAPI.getStats,
    staleTime: 30000,
    retry: false,
  });
}
