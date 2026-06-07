import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import {
  isIssueManagerTask,
  getTaskDescriptionPreview,
  isTaskOverdue,
  getOverdueDays,
  isDueToday,
  isDueThisWeek,
  filterBySearch,
  filterByStatus,
  filterByPriority,
  filterByAssignee,
  filterByCategory,
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
} from '../utils';

const today = () => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().split('T')[0];
};
const pastDate = (days = 3) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
};
const futureDate = (days = 3) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 't1',
  title: 'Test Task',
  description: null,
  status: 'new',
  priority: 'medium',
  reminder_frequency: null,
  last_reminder_sent: null,
  is_template: false,
  due_date: null,
  assignee_initials: null,
  assignee_id: null,
  tags: [],
  category: null,
  created_by: 'user1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  client_id: null,
  ...overrides,
});

// ── isIssueManagerTask ────────────────────────────────────────────────────────

describe('isIssueManagerTask', () => {
  it('returns true for tasks with [Issue Manager] prefix', () => {
    expect(isIssueManagerTask({ title: '[Issue Manager] CVE-2025-001', tags: [] })).toBe(true);
  });

  it('returns true for tasks tagged issue-manager', () => {
    expect(isIssueManagerTask({ title: 'Regular Task', tags: ['issue-manager'] })).toBe(true);
  });

  it('returns false for regular tasks', () => {
    expect(isIssueManagerTask({ title: 'Regular Task', tags: ['compliance'] })).toBe(false);
  });
});

// ── getTaskDescriptionPreview ─────────────────────────────────────────────────

describe('getTaskDescriptionPreview', () => {
  it('returns null for empty description', () => {
    expect(getTaskDescriptionPreview(makeTask({ description: null }))).toBeNull();
    expect(getTaskDescriptionPreview(makeTask({ description: '' }))).toBeNull();
  });

  it('returns first line for regular tasks', () => {
    const task = makeTask({ description: 'First line\nSecond line' });
    expect(getTaskDescriptionPreview(task)).toBe('First line');
  });

  it('strips leading dash from preview', () => {
    const task = makeTask({ description: '- Action item here' });
    expect(getTaskDescriptionPreview(task)).toBe('Action item here');
  });
});

// ── isTaskOverdue ─────────────────────────────────────────────────────────────

describe('isTaskOverdue', () => {
  it('returns false when no due_date', () => {
    expect(isTaskOverdue(makeTask())).toBe(false);
  });

  it('returns false for completed tasks', () => {
    expect(isTaskOverdue(makeTask({ status: 'completed', due_date: pastDate() }))).toBe(false);
  });

  it('returns false for archived tasks', () => {
    expect(isTaskOverdue(makeTask({ status: 'archived', due_date: pastDate() }))).toBe(false);
  });

  it('returns true for overdue task', () => {
    expect(isTaskOverdue(makeTask({ due_date: pastDate(5) }))).toBe(true);
  });

  it('returns false for future due date', () => {
    expect(isTaskOverdue(makeTask({ due_date: futureDate(5) }))).toBe(false);
  });
});

// ── getOverdueDays ────────────────────────────────────────────────────────────

describe('getOverdueDays', () => {
  it('returns 0 when not overdue', () => {
    expect(getOverdueDays(makeTask({ due_date: futureDate() }))).toBe(0);
  });

  it('returns 0 for completed tasks', () => {
    expect(getOverdueDays(makeTask({ status: 'completed', due_date: pastDate(5) }))).toBe(0);
  });

  it('returns days overdue', () => {
    expect(getOverdueDays(makeTask({ due_date: pastDate(3) }))).toBeGreaterThanOrEqual(3);
  });
});

// ── isDueToday ────────────────────────────────────────────────────────────────

describe('isDueToday', () => {
  it('returns false when no due date', () => {
    expect(isDueToday(makeTask())).toBe(false);
  });

  it('returns true when due today', () => {
    expect(isDueToday(makeTask({ due_date: today() }))).toBe(true);
  });

  it('returns false for past/future dates', () => {
    expect(isDueToday(makeTask({ due_date: pastDate() }))).toBe(false);
    expect(isDueToday(makeTask({ due_date: futureDate(5) }))).toBe(false);
  });
});

// ── isDueThisWeek ─────────────────────────────────────────────────────────────

describe('isDueThisWeek', () => {
  it('returns false when no due date', () => {
    expect(isDueThisWeek(makeTask())).toBe(false);
  });

  it('returns true when due within 7 days', () => {
    expect(isDueThisWeek(makeTask({ due_date: futureDate(3) }))).toBe(true);
    expect(isDueThisWeek(makeTask({ due_date: today() }))).toBe(true);
  });

  it('returns false for overdue or far-future tasks', () => {
    expect(isDueThisWeek(makeTask({ due_date: pastDate(1) }))).toBe(false);
    expect(isDueThisWeek(makeTask({ due_date: futureDate(10) }))).toBe(false);
  });
});

// ── filterBySearch ────────────────────────────────────────────────────────────

describe('filterBySearch', () => {
  const tasks = [
    makeTask({ title: 'Review compliance report' }),
    makeTask({ title: 'Client meeting', description: 'Compliance check' }),
    makeTask({ title: 'Send invoice', tags: ['billing'] }),
  ];

  it('returns all tasks for empty query', () => {
    expect(filterBySearch(tasks, '')).toHaveLength(3);
  });

  it('filters by title', () => {
    expect(filterBySearch(tasks, 'invoice')).toHaveLength(1);
  });

  it('filters by description', () => {
    expect(filterBySearch(tasks, 'compliance')).toHaveLength(2);
  });

  it('filters by tag', () => {
    expect(filterBySearch(tasks, 'billing')).toHaveLength(1);
  });
});

// ── filterByStatus ────────────────────────────────────────────────────────────

describe('filterByStatus', () => {
  const tasks = [
    makeTask({ status: 'new' }),
    makeTask({ status: 'in_progress' }),
    makeTask({ status: 'completed' }),
  ];

  it('returns all when status is all', () => {
    expect(filterByStatus(tasks, 'all')).toHaveLength(3);
  });

  it('filters by specific status', () => {
    expect(filterByStatus(tasks, 'new')).toHaveLength(1);
    expect(filterByStatus(tasks, 'completed')).toHaveLength(1);
  });
});

// ── filterByPriority ──────────────────────────────────────────────────────────

describe('filterByPriority', () => {
  const tasks = [
    makeTask({ priority: 'low' }),
    makeTask({ priority: 'high' }),
    makeTask({ priority: 'critical' }),
  ];

  it('returns all when priority is all', () => {
    expect(filterByPriority(tasks, 'all')).toHaveLength(3);
  });

  it('filters by priority', () => {
    expect(filterByPriority(tasks, 'critical')).toHaveLength(1);
  });
});

// ── filterByAssignee ──────────────────────────────────────────────────────────

describe('filterByAssignee', () => {
  const tasks = [
    makeTask({ assignee_id: 'user1' }),
    makeTask({ assignee_id: 'user2' }),
    makeTask({ assignee_id: null }),
  ];

  it('returns all when assigneeId is all', () => {
    expect(filterByAssignee(tasks, 'all')).toHaveLength(3);
  });

  it('filters by assignee', () => {
    expect(filterByAssignee(tasks, 'user1')).toHaveLength(1);
  });
});

// ── filterByCategory ──────────────────────────────────────────────────────────

describe('filterByCategory', () => {
  const tasks = [
    makeTask({ category: 'client' }),
    makeTask({ category: 'compliance' }),
    makeTask({ category: null }),
  ];

  it('returns all when category is all', () => {
    expect(filterByCategory(tasks, 'all')).toHaveLength(3);
  });

  it('filters by category', () => {
    expect(filterByCategory(tasks, 'compliance')).toHaveLength(1);
  });
});

// ── sortByDueDate ─────────────────────────────────────────────────────────────

describe('sortByDueDate', () => {
  const tasks = [
    makeTask({ id: 't1', due_date: '2026-03-01' }),
    makeTask({ id: 't2', due_date: null }),
    makeTask({ id: 't3', due_date: '2026-01-01' }),
  ];

  it('sorts tasks with null due dates last', () => {
    const sorted = sortByDueDate(tasks);
    expect(sorted[sorted.length - 1].id).toBe('t2');
  });

  it('sorts earlier dates first', () => {
    const sorted = sortByDueDate(tasks.filter((t) => t.due_date));
    expect(sorted[0].id).toBe('t3');
  });
});

// ── sortByPriority ────────────────────────────────────────────────────────────

describe('sortByPriority', () => {
  const tasks = [
    makeTask({ id: 'low', priority: 'low' }),
    makeTask({ id: 'critical', priority: 'critical' }),
    makeTask({ id: 'medium', priority: 'medium' }),
  ];

  it('sorts critical first', () => {
    const sorted = sortByPriority(tasks);
    expect(sorted[0].id).toBe('critical');
  });
});

// ── sortByCreatedDate ─────────────────────────────────────────────────────────

describe('sortByCreatedDate', () => {
  const tasks = [
    makeTask({ id: 't1', created_at: '2026-01-01' }),
    makeTask({ id: 't2', created_at: '2026-03-01' }),
  ];

  it('sorts newest first', () => {
    const sorted = sortByCreatedDate(tasks);
    expect(sorted[0].id).toBe('t2');
  });
});

// ── sortByTitle ───────────────────────────────────────────────────────────────

describe('sortByTitle', () => {
  const tasks = [makeTask({ id: 'z', title: 'Zebra' }), makeTask({ id: 'a', title: 'Apple' })];

  it('sorts alphabetically', () => {
    const sorted = sortByTitle(tasks);
    expect(sorted[0].id).toBe('a');
  });
});

// ── groupByStatus ─────────────────────────────────────────────────────────────

describe('groupByStatus', () => {
  const tasks = [
    makeTask({ status: 'new' }),
    makeTask({ status: 'new' }),
    makeTask({ status: 'completed' }),
  ];

  it('groups by status', () => {
    const result = groupByStatus(tasks);
    expect(result.new).toHaveLength(2);
    expect(result.completed).toHaveLength(1);
    expect(result.in_progress).toHaveLength(0);
  });
});

// ── groupByPriority ───────────────────────────────────────────────────────────

describe('groupByPriority', () => {
  const tasks = [
    makeTask({ priority: 'high' }),
    makeTask({ priority: 'high' }),
    makeTask({ priority: 'low' }),
  ];

  it('groups by priority', () => {
    const result = groupByPriority(tasks);
    expect(result.high).toHaveLength(2);
    expect(result.low).toHaveLength(1);
    expect(result.critical).toHaveLength(0);
  });
});

// ── groupByCategory ───────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  const tasks = [
    makeTask({ category: 'client' }),
    makeTask({ category: null }),
    makeTask({ category: 'compliance' }),
  ];

  it('groups by category, with null in "none"', () => {
    const result = groupByCategory(tasks);
    expect(result.client).toHaveLength(1);
    expect(result.none).toHaveLength(1);
  });
});

// ── validateTitle ─────────────────────────────────────────────────────────────

describe('validateTitle', () => {
  it('returns error for empty title', () => {
    expect(validateTitle('')).toContain('required');
    expect(validateTitle('   ')).toContain('required');
  });

  it('returns error for title over 200 chars', () => {
    expect(validateTitle('a'.repeat(201))).toContain('200');
  });

  it('returns null for valid title', () => {
    expect(validateTitle('Valid Task Title')).toBeNull();
  });
});

// ── validateDescription ───────────────────────────────────────────────────────

describe('validateDescription', () => {
  it('returns null for null description', () => {
    expect(validateDescription(null)).toBeNull();
  });

  it('returns error for description over 2000 chars', () => {
    expect(validateDescription('a'.repeat(2001))).toContain('2000');
  });

  it('returns null for valid description', () => {
    expect(validateDescription('Normal description')).toBeNull();
  });
});

// ── validateDueDate ───────────────────────────────────────────────────────────

describe('validateDueDate', () => {
  it('returns null for null due date', () => {
    expect(validateDueDate(null)).toBeNull();
  });

  it('returns error for invalid date', () => {
    expect(validateDueDate('not-a-date')).toContain('Invalid');
  });

  it('returns null for valid date', () => {
    expect(validateDueDate('2026-12-31')).toBeNull();
  });
});

// ── validateAssigneeInitials ──────────────────────────────────────────────────

describe('validateAssigneeInitials', () => {
  it('returns null for null initials', () => {
    expect(validateAssigneeInitials(null)).toBeNull();
  });

  it('returns error for initials over 3 chars', () => {
    expect(validateAssigneeInitials('ABCD')).toContain('1-3');
  });

  it('returns error for non-letter initials', () => {
    expect(validateAssigneeInitials('A1')).toContain('letters');
  });

  it('returns null for valid initials', () => {
    expect(validateAssigneeInitials('AB')).toBeNull();
    expect(validateAssigneeInitials('JDS')).toBeNull();
  });
});
