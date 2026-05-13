import { describe, expect, it } from 'vitest';
import { getTaskDescriptionPreview, isIssueManagerTask } from '../utils';
import type { Task } from '../types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Follow up with client',
    description: 'Call the client and confirm the next review date.',
    status: 'new',
    priority: 'medium',
    reminder_frequency: null,
    last_reminder_sent: null,
    is_template: false,
    due_date: null,
    assignee_initials: null,
    assignee_id: null,
    tags: [],
    category: 'internal',
    created_by: 'user-1',
    created_at: '2026-05-13T08:00:00.000Z',
    updated_at: '2026-05-13T08:00:00.000Z',
    completed_at: null,
    sort_order: 1,
    ...overrides,
  };
}

describe('task presentation helpers', () => {
  it('detects issue manager tasks from tags or title', () => {
    expect(isIssueManagerTask(buildTask({ tags: ['issue-manager'] }))).toBe(true);
    expect(isIssueManagerTask(buildTask({ title: '[Issue Manager] Fix dependency' }))).toBe(true);
    expect(isIssueManagerTask(buildTask())).toBe(false);
  });

  it('builds a compact preview for issue manager tasks', () => {
    const preview = getTaskDescriptionPreview(buildTask({
      title: '[Issue Manager] Patch dependency',
      tags: ['issue-manager', 'security'],
      description: [
        'Security Issue',
        '',
        'Finding: Hono missing validation on cookie writes',
        'Impact: Cookie names can bypass validation in the affected code path.',
        '',
        'Affected Dependency',
        '- Package: hono@4.12.11',
        '- Priority: medium',
      ].join('\n'),
    }));

    expect(preview).toBe('Impact: Cookie names can bypass validation in the affected code path. | Package: hono@4.12.11 | Priority: medium');
  });

  it('returns the first line for native tasks', () => {
    const preview = getTaskDescriptionPreview(buildTask({
      description: 'Prepare the retirement review pack.\nInclude the supporting statements.',
    }));

    expect(preview).toBe('Prepare the retirement review pack.');
  });
});
