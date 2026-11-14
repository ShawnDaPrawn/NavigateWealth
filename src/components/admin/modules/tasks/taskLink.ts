import { moduleSearchParams } from '../../layout/moduleSearchParams';

/**
 * The address of a task's page in To-Do (?module=tasks&task=<id>). Used by
 * the Dashboard's "Due today", Notes ("Open task") and Calendar.
 */
export function taskAddress(taskId: string): URLSearchParams {
  const params = moduleSearchParams('tasks');
  params.set('task', taskId);
  return params;
}
