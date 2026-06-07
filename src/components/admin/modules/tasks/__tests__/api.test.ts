import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TasksAPI, TaskStatsAPI, TaskFilterAPI, TaskApiError } from '../api';

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const MOCK_TASK = {
  id: 'task-001',
  title: 'Write proposal',
  status: 'new' as const,
  priority: 'high' as const,
  category: 'admin',
  due_date: new Date(Date.now() + 86400000).toISOString(), // tomorrow
  sort_order: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskApiError', () => {
  it('is an Error with name TaskApiError', () => {
    const err = new TaskApiError('Something failed', 'NOT_FOUND');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('TaskApiError');
    expect(err.message).toBe('Something failed');
    expect(err.code).toBe('NOT_FOUND');
  });

  it('creates error with details', () => {
    const details = { extra: 'info' };
    const err = new TaskApiError('Oops', 'ERR', details);
    expect(err.details).toEqual(details);
  });
});

describe('TasksAPI.getTasks', () => {
  it('returns tasks from api', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK]);
    const tasks = await TasksAPI.getTasks();
    expect(tasks).toEqual([MOCK_TASK]);
    expect(mockApiGet).toHaveBeenCalledWith('/tasks/all');
  });

  it('returns empty array when api returns null', async () => {
    mockApiGet.mockResolvedValue(null);
    const tasks = await TasksAPI.getTasks();
    expect(tasks).toEqual([]);
  });

  it('throws TaskApiError on failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    await expect(TasksAPI.getTasks()).rejects.toBeInstanceOf(TaskApiError);
  });
});

describe('TasksAPI.getTask', () => {
  it('returns task by id', async () => {
    mockApiGet.mockResolvedValue(MOCK_TASK);
    const task = await TasksAPI.getTask('task-001');
    expect(task).toEqual(MOCK_TASK);
    expect(mockApiGet).toHaveBeenCalledWith('/tasks/task-001');
  });

  it('throws when api returns null', async () => {
    mockApiGet.mockResolvedValue(null);
    await expect(TasksAPI.getTask('missing')).rejects.toBeInstanceOf(TaskApiError);
  });
});

describe('TasksAPI.createTask', () => {
  it('posts to TASKS endpoint and returns created task', async () => {
    mockApiPost.mockResolvedValue(MOCK_TASK);
    const input = { title: 'Write proposal', status: 'new' as const, priority: 'high' as const };
    const result = await TasksAPI.createTask(input);
    expect(result).toEqual(MOCK_TASK);
    expect(mockApiPost).toHaveBeenCalledWith('/tasks', input);
  });
});

describe('TasksAPI.saveChecklist', () => {
  it('saves checklist and returns items', async () => {
    const items = [{ id: 'c1', text: 'Step 1', completed: false }];
    mockApiPost.mockResolvedValue({ success: true, checklist: items });
    const result = await TasksAPI.saveChecklist('task-001', items);
    expect(result).toEqual(items);
  });

  it('returns empty array when checklist is absent in response', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const result = await TasksAPI.saveChecklist('task-001', []);
    expect(result).toEqual([]);
  });
});

describe('TasksAPI.updateTask', () => {
  it('patches task and returns updated task', async () => {
    const updated = { ...MOCK_TASK, title: 'Updated title' };
    mockApiPatch.mockResolvedValue(updated);
    const result = await TasksAPI.updateTask({ id: 'task-001', title: 'Updated title' });
    expect(result).toEqual(updated);
    expect(mockApiPatch).toHaveBeenCalledWith('/tasks/task-001', { title: 'Updated title' });
  });
});

describe('TasksAPI.deleteTask', () => {
  it('calls delete endpoint', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await TasksAPI.deleteTask('task-001');
    expect(mockApiDelete).toHaveBeenCalledWith('/tasks/task-001');
  });
});

describe('TasksAPI.moveTask', () => {
  it('posts to move endpoint with status and sort_order', async () => {
    mockApiPost.mockResolvedValue(MOCK_TASK);
    await TasksAPI.moveTask('task-001', 'in_progress', 5);
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/task-001/move', {
      status: 'in_progress',
      sort_order: 5,
    });
  });
});

describe('TasksAPI.reorderTasks', () => {
  it('posts reorder updates', async () => {
    mockApiPost.mockResolvedValue({ success: true });
    const updates = [{ id: 'task-001', sortOrder: 0, status: 'new' as const }];
    await TasksAPI.reorderTasks(updates);
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/reorder', { updates });
  });
});

describe('TasksAPI.duplicateTask', () => {
  it('posts to duplicate endpoint with no body', async () => {
    const duplicated = { ...MOCK_TASK, id: 'task-002' };
    mockApiPost.mockResolvedValue(duplicated);
    const result = await TasksAPI.duplicateTask('task-001');
    expect(result.id).toBe('task-002');
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/task-001/duplicate');
  });
});

describe('TasksAPI.archiveTask', () => {
  it('posts to archive endpoint with no body', async () => {
    mockApiPost.mockResolvedValue(MOCK_TASK);
    const result = await TasksAPI.archiveTask('task-001');
    expect(result).toEqual(MOCK_TASK);
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/task-001/archive');
  });
});

describe('TasksAPI.unarchiveTask', () => {
  it('posts to unarchive with default status new', async () => {
    mockApiPost.mockResolvedValue(MOCK_TASK);
    await TasksAPI.unarchiveTask('task-001');
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/task-001/unarchive', { status: 'new' });
  });

  it('posts with custom newStatus', async () => {
    mockApiPost.mockResolvedValue(MOCK_TASK);
    await TasksAPI.unarchiveTask('task-001', 'in_progress');
    expect(mockApiPost).toHaveBeenCalledWith('/tasks/task-001/unarchive', {
      status: 'in_progress',
    });
  });
});

describe('TaskStatsAPI.getStats', () => {
  it('returns stats from api', async () => {
    const stats = { total: 5, new: 2, in_progress: 1, completed: 1, archived: 1 };
    mockApiGet.mockResolvedValue(stats);
    const result = await TaskStatsAPI.getStats();
    expect(result).toEqual(stats);
  });

  it('returns empty stats on api failure', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error'));
    const result = await TaskStatsAPI.getStats();
    expect(result.total).toBe(0);
    expect(result.new).toBe(0);
  });
});

describe('TaskStatsAPI.getStatsByStatus', () => {
  it('returns status counts derived from all tasks', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK, { ...MOCK_TASK, id: 't2', status: 'in_progress' }]);
    const result = await TaskStatsAPI.getStatsByStatus();
    expect(result.new).toBe(1);
    expect(result.in_progress).toBe(1);
  });
});

describe('TaskStatsAPI.getStatsByPriority', () => {
  it('returns priority counts derived from all tasks', async () => {
    mockApiGet.mockResolvedValue([
      MOCK_TASK,
      { ...MOCK_TASK, id: 't2', priority: 'medium', status: 'new' },
    ]);
    const result = await TaskStatsAPI.getStatsByPriority();
    expect(result.high).toBe(1);
    expect(result.medium).toBe(1);
  });
});

describe('TaskStatsAPI.getStatsByCategory', () => {
  it('returns category counts derived from all tasks', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK, { ...MOCK_TASK, id: 't2', category: 'compliance' }]);
    const result = await TaskStatsAPI.getStatsByCategory();
    expect(result.admin).toBe(1);
    expect(result.compliance).toBe(1);
  });
});

describe('TaskFilterAPI.getTasksByStatus', () => {
  it('returns tasks filtered by status', async () => {
    mockApiGet.mockResolvedValue([
      MOCK_TASK,
      { ...MOCK_TASK, id: 't2', status: 'completed', sort_order: 1 },
    ]);
    const tasks = await TaskFilterAPI.getTasksByStatus('new');
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('task-001');
  });
});

describe('TaskFilterAPI.getTasksByAssignee', () => {
  it('returns tasks filtered by assignee', async () => {
    const taskWithAssignee = { ...MOCK_TASK, assignee_id: 'user-1' };
    mockApiGet.mockResolvedValue([taskWithAssignee, MOCK_TASK]);
    const tasks = await TaskFilterAPI.getTasksByAssignee('user-1');
    expect(tasks.length).toBe(1);
    expect(tasks[0].assignee_id).toBe('user-1');
  });
});

describe('TaskFilterAPI.getTasksByPriority', () => {
  it('returns tasks filtered by priority', async () => {
    mockApiGet.mockResolvedValue([
      MOCK_TASK,
      { ...MOCK_TASK, id: 't2', priority: 'medium', status: 'new' },
    ]);
    const tasks = await TaskFilterAPI.getTasksByPriority('high');
    expect(tasks.length).toBe(1);
    expect(tasks[0].priority).toBe('high');
  });
});

describe('TaskFilterAPI.getTasksByCategory', () => {
  it('returns tasks filtered by category', async () => {
    mockApiGet.mockResolvedValue([
      MOCK_TASK,
      { ...MOCK_TASK, id: 't2', category: 'compliance', status: 'new' },
    ]);
    const tasks = await TaskFilterAPI.getTasksByCategory('admin');
    expect(tasks.length).toBe(1);
    expect(tasks[0].category).toBe('admin');
  });
});

describe('TaskFilterAPI.getOverdueTasks', () => {
  it('returns overdue tasks', async () => {
    const overdueTask = {
      ...MOCK_TASK,
      due_date: new Date(Date.now() - 2 * 86400000).toISOString(), // yesterday
      status: 'new' as const,
    };
    mockApiGet.mockResolvedValue([overdueTask, MOCK_TASK]);
    const tasks = await TaskFilterAPI.getOverdueTasks();
    expect(tasks.length).toBe(1);
  });

  it('excludes completed tasks', async () => {
    const overdueCompleted = {
      ...MOCK_TASK,
      due_date: new Date(Date.now() - 86400000).toISOString(),
      status: 'completed' as const,
    };
    mockApiGet.mockResolvedValue([overdueCompleted]);
    const tasks = await TaskFilterAPI.getOverdueTasks();
    expect(tasks.length).toBe(0);
  });
});

describe('TaskFilterAPI.getTasksDueToday', () => {
  it('returns tasks due today', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayTask = { ...MOCK_TASK, due_date: today.toISOString() };
    mockApiGet.mockResolvedValue([todayTask]);
    const tasks = await TaskFilterAPI.getTasksDueToday();
    expect(tasks.length).toBe(1);
  });
});

describe('TaskFilterAPI.getTasksDueThisWeek', () => {
  it('returns tasks due this week', async () => {
    // MOCK_TASK has due_date = tomorrow, which is within this week
    mockApiGet.mockResolvedValue([MOCK_TASK]);
    const tasks = await TaskFilterAPI.getTasksDueThisWeek();
    expect(tasks.length).toBe(1);
  });
});

describe('TaskFilterAPI.searchTasks', () => {
  it('returns tasks whose title matches query', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK, { ...MOCK_TASK, id: 't2', title: 'Plan meeting' }]);
    const tasks = await TaskFilterAPI.searchTasks('proposal');
    expect(tasks.length).toBe(1);
    expect(tasks[0].title).toBe('Write proposal');
  });

  it('returns empty array when nothing matches', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK]);
    const tasks = await TaskFilterAPI.searchTasks('zzz_no_match_xyz');
    expect(tasks.length).toBe(0);
  });
});

describe('TaskFilterAPI.getFilteredTasks', () => {
  it('returns tasks matching filter status', async () => {
    mockApiGet.mockResolvedValue([MOCK_TASK, { ...MOCK_TASK, id: 't2', status: 'completed' }]);
    const tasks = await TaskFilterAPI.getFilteredTasks({ status: 'new' });
    expect(tasks.every((t) => t.status === 'new')).toBe(true);
  });
});
