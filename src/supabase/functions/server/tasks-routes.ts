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

import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { asyncHandler } from './error.middleware.ts';
import { requireAdmin } from './auth-mw.ts';
import * as kv from './kv_store.tsx';
import type { KvTask, RawKvTask } from './tasks-types.ts';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  MoveTaskSchema,
  ReorderTasksSchema,
  UnarchiveTaskSchema,
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
  const r = raw as Record<string, unknown>;
  return {
    ...(raw as unknown as KvTask),
    // Ensure snake_case fields exist (handle legacy camelCase data)
    due_date: (r.due_date ?? r.dueDate ?? null) as string | null | undefined,
    is_template: (r.is_template ?? r.isTemplate ?? false) as boolean,
    assignee_initials: (r.assignee_initials ?? r.assigneeInitials ?? null) as
      | string
      | null
      | undefined,
    assignee_id: (r.assignee_id ?? r.assigneeId ?? null) as string | null | undefined,
    created_by: (r.created_by ?? r.createdBy ?? '') as string,
    created_at: (r.created_at ?? r.createdAt ?? new Date().toISOString()) as string,
    updated_at: (r.updated_at ?? r.updatedAt ?? new Date().toISOString()) as string,
    completed_at: (r.completed_at ?? r.completedAt ?? null) as string | null | undefined,
    sort_order: (r.sort_order ?? r.sortOrder ?? 0) as number,
    reminder_frequency: (r.reminder_frequency ?? r.reminderFrequency ?? null) as
      | string
      | null
      | undefined,
    last_reminder_sent: (r.last_reminder_sent ?? r.lastReminderSent ?? null) as
      | string
      | null
      | undefined,
    tags: (Array.isArray(r.tags) ? r.tags : []) as string[],
    category: (r.category ?? null) as string | null | undefined,
    priority: (r.priority ?? 'medium') as KvTask['priority'],
    status: (r.status ?? 'new') as KvTask['status'],
    description: (r.description ?? null) as string | null | undefined,
  };
}

// ============================================================================
// HEALTH / ROOT
// ============================================================================

app.get('/', (c) => c.json({ service: 'tasks', status: 'active', version: '2.0.0' }));

// ============================================================================
// GET /tasks/all — Fetch all tasks
// ============================================================================

app.get(
  '/all',
  asyncHandler(async (c) => {
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
  }),
);

// ============================================================================
// GET /tasks/stats — Task statistics
// ============================================================================

app.get(
  '/stats',
  asyncHandler(async (c) => {
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
  }),
);

// ============================================================================
// GET /tasks/due-today — Dashboard widget
// ============================================================================

app.get(
  '/due-today',
  asyncHandler(async (c) => {
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
  }),
);

// ============================================================================
// GET /tasks/by-date — Tasks in date range
// ============================================================================

app.get(
  '/by-date',
  asyncHandler(async (c) => {
    const startStr = c.req.query('start');
    const endStr = c.req.query('end');

    if (!startStr || !endStr) {
      return c.json(
        { success: false, error: 'start and end query parameters are required', data: [] },
        400,
      );
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
        .sort(
          (a: KvTask, b: KvTask) =>
            new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
        );

      return c.json({ success: true, data: tasksInRange, count: tasksInRange.length });
    } catch (error) {
      log.error('Failed to fetch tasks by date', error);
      return c.json(
        { success: false, error: 'Failed to fetch tasks by date', data: [], count: 0 },
        200,
      );
    }
  }),
);

// ============================================================================
// GET /tasks/:id — Get single task
// ============================================================================

app.get(
  '/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
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
  }),
);

// ============================================================================
// POST /tasks — Create task
// ============================================================================

app.post(
  '/',
  asyncHandler(async (c) => {
    try {
      // A body that is not JSON at all is a CLIENT error, not a server fault.
      // `c.req.json()` throws on malformed input, and the catch at the bottom of
      // this handler turned that into a 500 — so a truncated request or a bad
      // Content-Type was reported as "Failed to create task", recorded as an
      // unexpected 500 in the runtime-issue pipeline, and counted against the
      // backend error rate. Surfaced by tasks-routes.contract.test.ts.
      const body = await c.req.json().catch(() => null);
      if (body === null || typeof body !== 'object') {
        return c.json({ error: 'Validation failed', message: 'Request body must be JSON' }, 400);
      }

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
            .reduce(
              (max: number, t: RawKvTask) =>
                Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number),
              -1,
            );
          nextSort = maxSort + 1;
        }
      } catch (err) {
        // Best-effort fallback to default sort order — log the KV failure
        // instead of swallowing it silently.
        log.warn('Failed to compute next sort_order; using default', { error: String(err) });
      }

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
  }),
);

// ============================================================================
// PATCH /tasks/:id — Update task
// ============================================================================

app.patch(
  '/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
    try {
      const existing = await kv.get(taskKey(id));
      if (!existing) {
        return c.json({ error: 'Task not found' }, 404);
      }

      // Same reason as POST / above: `c.req.json()` throws on a malformed body
      // and the catch at the bottom turned that into a 500, so a truncated
      // request or a bad Content-Type was reported as a server fault and
      // counted against the backend error rate. A body that is not JSON is a
      // CLIENT error.
      const body = await c.req.json().catch(() => null);
      if (body === null || typeof body !== 'object') {
        return c.json({ error: 'Validation failed', message: 'Request body must be JSON' }, 400);
      }

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
      return c.json(normaliseTask(updated as unknown as RawKvTask));
    } catch (error) {
      log.error(`Failed to update task ${id}`, error);
      return c.json({ error: 'Failed to update task' }, 500);
    }
  }),
);

// ============================================================================
// DELETE /tasks/:id — Delete task
// ============================================================================

app.delete(
  '/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
    try {
      await kv.del(taskKey(id));
      // Also clean up related data
      try {
        await kv.del(`task_checklist:${id}`);
      } catch (err) {
        log.warn(`Best-effort cleanup of task_checklist:${id} failed`, { error: String(err) });
      }
      try {
        await kv.del(`task_comments:${id}`);
      } catch (err) {
        log.warn(`Best-effort cleanup of task_comments:${id} failed`, { error: String(err) });
      }

      log.info(`Deleted task ${id}`);
      return c.json({ success: true });
    } catch (error) {
      log.error(`Failed to delete task ${id}`, error);
      return c.json({ error: 'Failed to delete task' }, 500);
    }
  }),
);

// ============================================================================
// POST /tasks/:id/move — Move task to new status
// ============================================================================

app.post(
  '/:id/move',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
    try {
      const existing = await kv.get(taskKey(id));
      if (!existing) {
        return c.json({ error: 'Task not found' }, 404);
      }

      const body = await c.req.json().catch(() => null);
      if (body === null || typeof body !== 'object') {
        return c.json({ error: 'Validation failed', message: 'Request body must be JSON' }, 400);
      }

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
      return c.json(normaliseTask(updates as unknown as RawKvTask));
    } catch (error) {
      log.error(`Failed to move task ${id}`, error);
      return c.json({ error: 'Failed to move task' }, 500);
    }
  }),
);

// ============================================================================
// POST /tasks/reorder — Batch reorder tasks
// ============================================================================

app.post(
  '/reorder',
  asyncHandler(async (c) => {
    try {
      const body = await c.req.json().catch(() => null);
      if (body === null || typeof body !== 'object') {
        return c.json({ error: 'Validation failed', message: 'Request body must be JSON' }, 400);
      }

      const parsed = ReorderTasksSchema.safeParse((body as { updates?: unknown }).updates ?? body);
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
  }),
);

// ============================================================================
// POST /tasks/:id/duplicate — Duplicate a task
// ============================================================================

app.post(
  '/:id/duplicate',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
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
            .reduce(
              (max: number, t: RawKvTask) =>
                Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number),
              -1,
            );
          nextSort = maxSort + 1;
        }
      } catch (err) {
        // Best-effort fallback to default sort order — log the KV failure
        // instead of swallowing it silently.
        log.warn('Failed to compute next sort_order; using default', { error: String(err) });
      }

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
      return c.json(normaliseTask(duplicate as unknown as RawKvTask), 201);
    } catch (error) {
      log.error(`Failed to duplicate task ${id}`, error);
      return c.json({ error: 'Failed to duplicate task' }, 500);
    }
  }),
);

// ============================================================================
// POST /tasks/:id/archive — Archive a task
// ============================================================================

app.post(
  '/:id/archive',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
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
      return c.json(normaliseTask(updated as unknown as RawKvTask));
    } catch (error) {
      log.error(`Failed to archive task ${id}`, error);
      return c.json({ error: 'Failed to archive task' }, 500);
    }
  }),
);

// ============================================================================
// POST /tasks/:id/unarchive — Unarchive a task
// ============================================================================

app.post(
  '/:id/unarchive',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!id) return c.json({ error: 'Missing id' }, 400);
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
            .reduce(
              (max: number, t: RawKvTask) =>
                Math.max(max, (t.sort_order ?? t.sortOrder ?? 0) as number),
              -1,
            );
          nextSort = maxSort + 1;
        }
      } catch (err) {
        // Best-effort fallback to default sort order — log the KV failure
        // instead of swallowing it silently.
        log.warn('Failed to compute next sort_order; using default', { error: String(err) });
      }

      const updated = {
        ...normaliseTask(existing as RawKvTask),
        status: newStatus,
        sort_order: nextSort,
        updated_at: new Date().toISOString(),
      };

      await kv.set(taskKey(id), updated);
      log.info(`Unarchived task ${id} to ${newStatus}`);
      return c.json(normaliseTask(updated as unknown as RawKvTask));
    } catch (error) {
      log.error(`Failed to unarchive task ${id}`, error);
      return c.json({ error: 'Failed to unarchive task' }, 500);
    }
  }),
);

export default app;
