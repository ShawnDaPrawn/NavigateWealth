/**
 * ****************************************************************************
 * TASKS ROUTES
 * ****************************************************************************
 * 
 * VERSION: 2.0.0
 * 
 * Full CRUD + query endpoints for task management.
 * Uses KV Store for persistence (no Postgres table required).
 * 
 * KV key pattern: task:{uuid}
 * 
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import { requireAdmin } from "./auth-mw.ts";
import * as kv from './kv_store.tsx';
import type { KvTask, RawKvTask } from './tasks-types.ts';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  ReorderTasksSchema,
  UnarchiveTaskSchema,
  DateRangeQuerySchema,
} from './tasks-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';

const app = new Hono();
const log = createModuleLogger('tasks');

// All task routes require admin authentication (§12.2)
app.use('*', requireAdmin);

// ============================================================================
// HELPERS
// ============================================================================

function taskKey(id: string): string {
  return `task:${id}`;
}

/** Normalise a task coming out of KV so field names match the frontend contract (snake_case). */
function normaliseTask(raw: RawKvTask): KvTask {
  if (!raw || typeof raw !== 'object') return raw as unknown as KvTask;
  return {
    ...raw,
    // Ensure snake_case fields exist (handle legacy camelCase data)
    due_date: raw.due_date ?? raw.dueDate ?? null,
    is_template: raw.is_template ?? raw.isTemplate ?? false,
    assignee_initials: raw.assignee_initials ?? raw.assigneeInitials ?? null,
    assignee_id: raw.assignee_id ?? raw.assigneeId ?? null,
    created_by: raw.created_by ?? raw.createdBy ?? '',
    created_at: raw.created_at ?? raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    completed_at: raw.completed_at ?? raw.completedAt ?? null,
    sort_order: raw.sort_order ?? raw.sortOrder ?? 0,
    reminder_frequency: raw.reminder_frequency ?? raw.reminderFrequency ?? null,
    last_reminder_sent: raw.last_reminder_sent ?? raw.lastReminderSent ?? null,
    tags: raw.tags ?? [],
    category: raw.category ?? null,
    priority: raw.priority ?? 'medium',
    status: raw.status ?? 'new',
    description: raw.description ?? null,
  };
}

// ============================================================================
// HEALTH / ROOT
// ============================================================================

app.get('/', (c) => c.json({ service: 'tasks', status: 'active', version: '2.0.0' }));

// ============================================================================
// GET /tasks/all — Fetch all tasks
// ============================================================================

app.get('/all', asyncHandler(async (c) => {
  log.info('Fetching all tasks from KV store');

  try {
    const allRaw = await kv.getByPrefix('task:');

    if (!Array.isArray(allRaw)) {
      return c.json([]);
    }

    const tasks = allRaw
      .filter((t: RawKvTask) => t && typeof t === 'object' && t.id && t.title)
      .map(normaliseTask)
      .sort((a: KvTask, b: KvTask) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    log.info(`Returning ${tasks.length} tasks`);
    return c.json(tasks);
  } catch (error) {
    log.error('Failed to fetch all tasks', error);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
}));

// ============================================================================
// GET /tasks/stats — Task statistics
// ============================================================================

app.get('/stats', asyncHandler(async (c) => {
  try {
    const allRaw = await kv.getByPrefix('task:');
    const tasks = Array.isArray(allRaw)
      ? allRaw.filter((t: RawKvTask) => t && typeof t === 'object' && t.id)
      : [];

    const stats = {
      total: 0,
      new: 0,
      in_progress: 0,
      completed: 0,
      archived: 0,
    };

    for (const task of tasks) {
      if (task.status !== 'archived') stats.total++;
      if (task.status === 'new') stats.new++;
      if (task.status === 'in_progress') stats.in_progress++;
      if (task.status === 'completed') stats.completed++;
      if (task.status === 'archived') stats.archived++;
    }

    return c.json(stats);
  } catch (error) {
    log.error('Failed to compute task stats', error);
    return c.json({ total: 0, new: 0, in_progress: 0, completed: 0, archived: 0 });
  }
}));

// ============================================================================
// GET /tasks/due-today — Dashboard widget
// ============================================================================

app.get('/due-today', asyncHandler(async (c) => {
  log.info('Fetching pending tasks from KV store');

  try {
    const allTasksRaw = await kv.getByPrefix('task:');

    if (!Array.isArray(allTasksRaw)) {
      return c.json({ success: true, data: [], count: 0 });
    }

    const tasksDueToday = allTasksRaw
      .filter((task: RawKvTask) => {
        if (!task || typeof task !== 'object') return false;
        if (task.status === 'completed' || task.status === 'archived') return false;
        return true;
      })
      .map(normaliseTask)
      .sort((a: KvTask, b: KvTask) => {
        const dA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        const dB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
        if (dA !== dB) return dA - dB;
        const po: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (po[b.priority] || 0) - (po[a.priority] || 0);
      })
      .slice(0, 10);

    return c.json({ success: true, data: tasksDueToday, count: tasksDueToday.length });
  } catch (error) {
    log.error('Failed to fetch tasks due today', error);
    return c.json({ success: false, error: 'Failed to fetch tasks', data: [], count: 0 }, 200);
  }
}));

// ============================================================================
// GET /tasks/by-date — Tasks in date range
// ============================================================================

app.get('/by-date', asyncHandler(async (c) => {
  const startStr = c.req.query('start');
  const endStr = c.req.query('end');

  if (!startStr || !endStr) {
    return c.json({ success: false, error: 'start and end query parameters are required', data: [] }, 400);
  }

  try {
    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return c.json({ success: false, error: 'Invalid date parameters', data: [] }, 400);
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const allRaw = await kv.getByPrefix('task:');
    if (!Array.isArray(allRaw)) {
      return c.json({ success: true, data: [], count: 0 });
    }

    const tasksInRange = allRaw
      .filter((t: RawKvTask) => {
        if (!t || typeof t !== 'object' || t.status === 'archived') return false;
        const dd = t.due_date || t.dueDate;
        if (!dd) return false;
        const d = new Date(dd);
        return !isNaN(d.getTime()) && d >= startDate && d <= endDate;
      })
      .map(normaliseTask)
      .sort((a: KvTask, b: KvTask) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

    return c.json({ success: true, data: tasksInRange, count: tasksInRange.length });
  } catch (error) {
    log.error('Failed to fetch tasks by date', error);
    return c.json({ success: false, error: 'Failed to fetch tasks by date', data: [], count: 0 }, 200);
  }
}));

// ============================================================================
// GET /tasks/:id — Get single task
// ============================================================================

app.get('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const task = await kv.get(taskKey(id));
    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }
    return c.json(normaliseTask(task as RawKvTask));
  } catch (error) {
    log.error(`Failed to fetch task ${id}`, error);
    return c.json({ error: 'Failed to fetch task' }, 500);
  }
}));

// ============================================================================
// POST /tasks — Create task
// ============================================================================

app.post('/', asyncHandler(async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const input = parsed.data;
    const now = new Date().toISOString();
    const id = input.id || crypto.randomUUID();
    const status = input.status;

    // Compute next sort_order for the target status column
    let nextSort = 0;
    try {
      const allRaw = await kv.getByPrefix('task:');
      if (Array.isArray(allRaw)) {
        const maxSort = allRaw
          .filter((t: RawKvTask) => t && t.status === status)
          .reduce((max: number, t: RawKvTask) => Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number), -1);
        nextSort = maxSort + 1;
      }
    } catch (_) { /* ignore */ }

    const task = {
      id,
      title: input.title.trim(),
      description: input.description ?? null,
      status,
      priority: input.priority,
      reminder_frequency: input.reminder_frequency ?? null,
      last_reminder_sent: null,
      is_template: input.is_template,
      due_date: input.due_date ?? null,
      assignee_initials: input.assignee_initials ?? null,
      assignee_id: input.assignee_id ?? null,
      tags: input.tags,
      category: input.category ?? null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
      completed_at: null,
      sort_order: nextSort,
    };

    await kv.set(taskKey(id), task);
    log.info(`Created task ${id}`);
    return c.json(task, 201);
  } catch (error) {
    log.error('Failed to create task', error);
    return c.json({ error: 'Failed to create task' }, 500);
  }
}));

// ============================================================================
// PATCH /tasks/:id — Update task
// ============================================================================

app.patch('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await kv.get(taskKey(id));
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const body = await c.req.json();
    const parsed = UpdateTaskSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const now = new Date().toISOString();

    const updated = {
      ...normaliseTask(existing as RawKvTask),
      ...parsed.data,
      id, // prevent ID override
      updated_at: now,
    };

    await kv.set(taskKey(id), updated);
    log.info(`Updated task ${id}`);
    return c.json(normaliseTask(updated));
  } catch (error) {
    log.error(`Failed to update task ${id}`, error);
    return c.json({ error: 'Failed to update task' }, 500);
  }
}));

// ============================================================================
// DELETE /tasks/:id — Delete task
// ============================================================================

app.delete('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    await kv.del(taskKey(id));
    // Also clean up related data
    try { await kv.del(`task_checklist:${id}`); } catch (_) { /* ignore */ }
    try { await kv.del(`task_comments:${id}`); } catch (_) { /* ignore */ }

    log.info(`Deleted task ${id}`);
    return c.json({ success: true });
  } catch (error) {
    log.error(`Failed to delete task ${id}`, error);
    return c.json({ error: 'Failed to delete task' }, 500);
  }
}));

// ============================================================================
// POST /tasks/:id/move — Move task to new status
// ============================================================================

app.post('/:id/move', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await kv.get(taskKey(id));
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const body = await c.req.json();
    const parsed = MoveTaskSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const { status, sort_order } = parsed.data;
    const now = new Date().toISOString();

    const updates: KvTask = {
      ...normaliseTask(existing as RawKvTask),
      status,
      sort_order,
      updated_at: now,
    };

    if (status === 'completed') {
      updates.completed_at = now;
    } else {
      updates.completed_at = null;
    }

    await kv.set(taskKey(id), updates);
    log.info(`Moved task ${id} to ${status}`);
    return c.json(normaliseTask(updates));
  } catch (error) {
    log.error(`Failed to move task ${id}`, error);
    return c.json({ error: 'Failed to move task' }, 500);
  }
}));

// ============================================================================
// POST /tasks/reorder — Batch reorder tasks
// ============================================================================

app.post('/reorder', asyncHandler(async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ReorderTasksSchema.safeParse(body.updates ?? body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }

    const updates = parsed.data;

    for (const u of updates) {
      const existing = await kv.get(taskKey(u.id));
      if (existing) {
        await kv.set(taskKey(u.id), {
          ...normaliseTask(existing as RawKvTask),
          sort_order: u.sort_order,
          updated_at: new Date().toISOString(),
        });
      }
    }

    log.info(`Reordered ${updates.length} tasks`);
    return c.json({ success: true });
  } catch (error) {
    log.error('Failed to reorder tasks', error);
    return c.json({ error: 'Failed to reorder tasks' }, 500);
  }
}));

// ============================================================================
// POST /tasks/:id/duplicate — Duplicate a task
// ============================================================================

app.post('/:id/duplicate', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const original = await kv.get(taskKey(id));
    if (!original) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const norm = normaliseTask(original as RawKvTask);
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();

    // Get next sort_order
    let nextSort = 0;
    try {
      const allRaw = await kv.getByPrefix('task:');
      if (Array.isArray(allRaw)) {
        const maxSort = allRaw
          .filter((t: RawKvTask) => t && t.status === norm.status)
          .reduce((max: number, t: RawKvTask) => Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number), -1);
        nextSort = maxSort + 1;
      }
    } catch (_) { /* ignore */ }

    const duplicate = {
      ...norm,
      id: newId,
      title: `${norm.title} (Copy)`,
      created_at: now,
      updated_at: now,
      completed_at: null,
      sort_order: nextSort,
    };

    await kv.set(taskKey(newId), duplicate);
    log.info(`Duplicated task ${id} → ${newId}`);
    return c.json(normaliseTask(duplicate), 201);
  } catch (error) {
    log.error(`Failed to duplicate task ${id}`, error);
    return c.json({ error: 'Failed to duplicate task' }, 500);
  }
}));

// ============================================================================
// POST /tasks/:id/archive — Archive a task
// ============================================================================

app.post('/:id/archive', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await kv.get(taskKey(id));
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const updated = {
      ...normaliseTask(existing as RawKvTask),
      status: 'archived',
      updated_at: new Date().toISOString(),
    };

    await kv.set(taskKey(id), updated);
    log.info(`Archived task ${id}`);
    return c.json(normaliseTask(updated));
  } catch (error) {
    log.error(`Failed to archive task ${id}`, error);
    return c.json({ error: 'Failed to archive task' }, 500);
  }
}));

// ============================================================================
// POST /tasks/:id/unarchive — Unarchive a task
// ============================================================================

app.post('/:id/unarchive', asyncHandler(async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await kv.get(taskKey(id));
    if (!existing) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = UnarchiveTaskSchema.safeParse(body);
    const newStatus = parsed.success ? parsed.data.status : 'new';

    // Get next sort_order
    let nextSort = 0;
    try {
      const allRaw = await kv.getByPrefix('task:');
      if (Array.isArray(allRaw)) {
        const maxSort = allRaw
          .filter((t: RawKvTask) => t && t.status === newStatus)
          .reduce((max: number, t: RawKvTask) => Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number), -1);
        nextSort = maxSort + 1;
      }
    } catch (_) { /* ignore */ }

    const updated = {
      ...normaliseTask(existing as RawKvTask),
      status: newStatus,
      sort_order: nextSort,
      updated_at: new Date().toISOString(),
    };

    await kv.set(taskKey(id), updated);
    log.info(`Unarchived task ${id} to ${newStatus}`);
    return c.json(normaliseTask(updated));
  } catch (error) {
    log.error(`Failed to unarchive task ${id}`, error);
    return c.json({ error: 'Failed to unarchive task' }, 500);
  }
}));

export default app;