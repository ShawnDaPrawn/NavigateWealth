import { describe, expect, it } from 'vitest';
import { mergeTaskReorderIntoList } from '../useTaskMutations';
import type { Task, TaskStatus } from '../../types';

function task(id: string, status: TaskStatus, sort_order: number): Task {
  return {
    id,
    title: id,
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
    created_by: 'test',
    created_at: '2026-05-06T00:00:00.000Z',
    updated_at: '2026-05-06T00:00:00.000Z',
    completed_at: null,
    sort_order,
  };
}

describe('mergeTaskReorderIntoList', () => {
  it('keeps tasks from other columns when applying a reordered column update', () => {
    const previousTasks = [
      task('new-1', 'new', 0),
      task('new-2', 'new', 1),
      task('progress-1', 'in_progress', 0),
    ];

    const reorderedTasks = [
      task('progress-1', 'in_progress', 0),
      task('new-1', 'in_progress', 1),
    ];

    const merged = mergeTaskReorderIntoList(previousTasks, reorderedTasks);

    expect(merged).toHaveLength(3);
    expect(merged.find((item) => item.id === 'new-2')?.status).toBe('new');
    expect(merged.find((item) => item.id === 'new-1')?.status).toBe('in_progress');
    expect(merged.find((item) => item.id === 'new-1')?.sort_order).toBe(1);
  });
});
