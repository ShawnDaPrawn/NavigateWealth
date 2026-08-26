/**
 * tasks-routes.ts — the rest of the family
 * ========================================
 *
 * `tasks-routes.contract.test.ts` pins the admin perimeter, the `/` vs `/all`
 * footgun, and POST validation. This covers everything after that: the query
 * endpoints, the single-task reads and writes, and the move/reorder/duplicate/
 * archive lifecycle.
 *
 * Two things here are behaviour worth knowing rather than behaviour worth
 * assuming, and both are pinned with the reasoning in the test body:
 *
 *   - `/due-today` does not filter by date at all.
 *   - `/by-date` snaps its range to whole days in the SERVER's local timezone.
 *
 * The same in-memory KV and role-aware admin gate as the sibling file, because a
 * header-only mock would pass whether the router carried `requireAdmin` or
 * merely `requireAuth`.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test' } });
});

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const ROLE_BY_TOKEN: Record<string, string> = {
  'admin-token': 'admin',
  'user-token': 'client',
};

vi.mock('../auth-mw.ts', () => ({
  requireAdmin: async (c: any, next: any) => {
    const header = c.req.header('Authorization');
    if (!header) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    const role = ROLE_BY_TOKEN[header.replace(/^Bearer\s+/, '')] ?? 'client';
    if (role !== 'admin' && role !== 'super_admin') {
      return c.json({ error: 'Forbidden: Admin access required', code: 'FORBIDDEN_ADMIN' }, 403);
    }
    c.set('userId', 'admin-user');
    c.set('userRole', role);
    await next();
  },
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import app from '../tasks-routes.ts';

const AUTH = { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' };

type Task = Record<string, unknown>;

const seedTask = (id: string, overrides: Task = {}): Task => {
  const task = {
    id,
    title: `Task ${id}`,
    description: null,
    status: 'new',
    priority: 'medium',
    is_template: false,
    due_date: null,
    assignee_initials: null,
    assignee_id: null,
    tags: [],
    category: null,
    created_by: 'admin-user',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    completed_at: null,
    sort_order: 0,
    reminder_frequency: null,
    last_reminder_sent: null,
    ...overrides,
  };
  kvStore.set(`task:${id}`, task);
  return task;
};

const stored = (id: string) => kvStore.get(`task:${id}`) as Task | undefined;

const call = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...AUTH, ...(init.headers ?? {}) } });

const json = async (res: Response) => (await res.json()) as any;

/** A date `days` from today, as the YYYY-MM-DD the SPA sends. */
const dayOffset = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => {
  kvStore.clear();
});

describe('GET /stats', () => {
  it('counts by status, and excludes archived from the total', async () => {
    // `total` deliberately means "live tasks", not "rows in the store" — an
    // archived task should not inflate the dashboard's workload figure.
    seedTask('a', { status: 'new' });
    seedTask('b', { status: 'in_progress' });
    seedTask('c', { status: 'completed' });
    seedTask('d', { status: 'archived' });
    seedTask('e', { status: 'archived' });

    expect(await json(await call('/stats'))).toEqual({
      total: 3,
      new: 1,
      in_progress: 1,
      completed: 1,
      archived: 2,
    });
  });

  it('returns zeroes on an empty store rather than erroring', async () => {
    expect(await json(await call('/stats'))).toEqual({
      total: 0,
      new: 0,
      in_progress: 0,
      completed: 0,
      archived: 0,
    });
  });

  it('ignores a row with no id', async () => {
    kvStore.set('task:junk', { status: 'new', title: 'no id' });
    seedTask('real');

    expect(await json(await call('/stats'))).toMatchObject({ total: 1 });
  });
});

describe('GET /due-today', () => {
  it('returns open tasks soonest-due first, NOT only those due today', async () => {
    // The route name promises a date filter and the implementation has none: it
    // returns every open task, sorted by due date, capped at ten. Pinned as what
    // it does — a caller that trusts the name will show a client tasks that are
    // not due today.
    seedTask('later', { due_date: dayOffset(30) });
    seedTask('undated');
    seedTask('sooner', { due_date: dayOffset(1) });
    seedTask('overdue', { due_date: dayOffset(-5) });

    const body = await json(await call('/due-today'));

    expect(body.success).toBe(true);
    expect(body.data.map((t: Task) => t.id)).toEqual(['overdue', 'sooner', 'later', 'undated']);
    expect(body.count).toBe(4);
  });

  it('puts an undated task last rather than first', async () => {
    // A null due date sorts as MAX_SAFE_INTEGER. Sorting it as 0 would push
    // every task with no deadline to the top of the adviser's list.
    seedTask('undated');
    seedTask('dated', { due_date: dayOffset(365) });

    const body = await json(await call('/due-today'));

    expect(body.data.map((t: Task) => t.id)).toEqual(['dated', 'undated']);
  });

  it('breaks a due-date tie by priority, highest first', async () => {
    const due = dayOffset(2);
    seedTask('low', { due_date: due, priority: 'low' });
    seedTask('critical', { due_date: due, priority: 'critical' });
    seedTask('medium', { due_date: due, priority: 'medium' });

    const body = await json(await call('/due-today'));

    expect(body.data.map((t: Task) => t.id)).toEqual(['critical', 'medium', 'low']);
  });

  it('excludes completed and archived tasks', async () => {
    seedTask('open');
    seedTask('done', { status: 'completed' });
    seedTask('filed', { status: 'archived' });

    const body = await json(await call('/due-today'));

    expect(body.data.map((t: Task) => t.id)).toEqual(['open']);
  });

  it('caps the list at ten', async () => {
    for (let index = 0; index < 15; index++) seedTask(`t${index}`);

    const body = await json(await call('/due-today'));

    expect(body.data).toHaveLength(10);
    expect(body.count).toBe(10);
  });
});

describe('GET /by-date', () => {
  it('requires both ends of the range', async () => {
    await expect(call('/by-date').then((r) => r.status)).resolves.toBe(400);
    await expect(call(`/by-date?start=${dayOffset(0)}`).then((r) => r.status)).resolves.toBe(400);
    await expect(call(`/by-date?end=${dayOffset(0)}`).then((r) => r.status)).resolves.toBe(400);
  });

  it('rejects an unparseable date', async () => {
    const res = await call('/by-date?start=not-a-date&end=also-not');

    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('Invalid date parameters');
  });

  it('includes a task due on the last day of the range', async () => {
    // The range is snapped to whole days — start 00:00:00 and end 23:59:59.999
    // in the SERVER's local timezone. Without that, a task due at 09:00 on the
    // end date would fall outside a range ending at midnight.
    const end = dayOffset(3);
    seedTask('on-end-day', { due_date: `${end}T09:00:00.000Z` });

    const body = await json(await call(`/by-date?start=${dayOffset(0)}&end=${end}`));

    expect(body.data.map((t: Task) => t.id)).toEqual(['on-end-day']);
  });

  it('excludes a task outside the range, and one with no due date', async () => {
    seedTask('inside', { due_date: `${dayOffset(1)}T12:00:00.000Z` });
    seedTask('after', { due_date: `${dayOffset(40)}T12:00:00.000Z` });
    seedTask('undated');

    const body = await json(await call(`/by-date?start=${dayOffset(0)}&end=${dayOffset(7)}`));

    expect(body.data.map((t: Task) => t.id)).toEqual(['inside']);
  });

  it('excludes archived tasks but keeps completed ones', async () => {
    // A completed task still belongs on a calendar view of the week; an
    // archived one does not.
    const due = `${dayOffset(1)}T12:00:00.000Z`;
    seedTask('done', { due_date: due, status: 'completed' });
    seedTask('filed', { due_date: due, status: 'archived' });

    const body = await json(await call(`/by-date?start=${dayOffset(0)}&end=${dayOffset(7)}`));

    expect(body.data.map((t: Task) => t.id)).toEqual(['done']);
  });

  it('reads a legacy camelCase dueDate as well as the snake_case field', async () => {
    kvStore.set('task:legacy', {
      id: 'legacy',
      title: 'Legacy row',
      status: 'new',
      dueDate: `${dayOffset(1)}T12:00:00.000Z`,
    });

    const body = await json(await call(`/by-date?start=${dayOffset(0)}&end=${dayOffset(7)}`));

    expect(body.data.map((t: Task) => t.id)).toEqual(['legacy']);
  });
});

describe('GET /:id', () => {
  it('returns the task, normalised', async () => {
    kvStore.set('task:legacy', {
      id: 'legacy',
      title: 'Legacy row',
      dueDate: '2026-05-05',
      assigneeInitials: 'TN',
      createdBy: 'someone',
      sortOrder: 7,
      isTemplate: true,
    });

    const body = await json(await call('/legacy'));

    // The frontend contract is snake_case; a legacy camelCase row has to arrive
    // in that shape rather than with both spellings or neither.
    expect(body).toMatchObject({
      due_date: '2026-05-05',
      assignee_initials: 'TN',
      created_by: 'someone',
      sort_order: 7,
      is_template: true,
      status: 'new',
      priority: 'medium',
      tags: [],
    });
  });

  it('404s a task that does not exist', async () => {
    const res = await call('/no-such-task');

    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Task not found');
  });

  it('does not shadow the literal query routes', async () => {
    // `/:id` is registered last on purpose. If it were registered first, every
    // one of /all, /stats, /due-today and /by-date would be read as a task id.
    seedTask('stats');
    seedTask('all');

    expect(await json(await call('/stats'))).toMatchObject({ total: 2 });
    expect(Array.isArray(await json(await call('/all')))).toBe(true);
  });
});

describe('PATCH /:id', () => {
  it('applies the update and moves updated_at', async () => {
    seedTask('t1', { title: 'Before' });

    const body = await json(
      await call('/t1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'After', priority: 'high' }),
      }),
    );

    expect(body).toMatchObject({ title: 'After', priority: 'high' });
    expect(body.updated_at).not.toBe('2026-01-01T00:00:00.000Z');
    expect(stored('t1')).toMatchObject({ title: 'After' });
  });

  it('refuses to move the id, even when the body names a different one', async () => {
    // Two layers stop it, and the order matters. `UpdateTaskSchema` has no
    // `id` field and zod strips unknown keys, so a body of ONLY `{ id }`
    // reduces to `{}` and is rejected by the schema's "at least one field"
    // refinement. With a real field alongside it, the id is silently dropped
    // and the handler's explicit `id` re-assignment is the belt to that braces.
    seedTask('t1');

    const idOnly = await call('/t1', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'hijacked' }),
    });
    expect(idOnly.status).toBe(400);

    const withRealField = await json(
      await call('/t1', {
        method: 'PATCH',
        body: JSON.stringify({ id: 'hijacked', title: 'Renamed' }),
      }),
    );
    expect(withRealField).toMatchObject({ id: 't1', title: 'Renamed' });
    expect(kvStore.has('task:hijacked')).toBe(false);
  });

  it('rejects an update with no recognised field to apply', async () => {
    // A PATCH that changes nothing is a client mistake worth surfacing rather
    // than a no-op write that bumps updated_at for no reason.
    seedTask('t1');

    const res = await call('/t1', {
      method: 'PATCH',
      body: JSON.stringify({ not_a_field: 'value' }),
    });

    expect(res.status).toBe(400);
    expect(stored('t1')).toMatchObject({ updated_at: '2026-01-01T00:00:00.000Z' });
  });

  it('404s before validating, so a bad body on a missing task is still a 404', async () => {
    const res = await call('/no-such-task', {
      method: 'PATCH',
      body: JSON.stringify({ priority: 'nonsense' }),
    });

    expect(res.status).toBe(404);
  });

  it('rejects a value outside the enum', async () => {
    seedTask('t1');

    const res = await call('/t1', {
      method: 'PATCH',
      body: JSON.stringify({ priority: 'urgent-ish' }),
    });

    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('Validation failed');
  });

  it('rejects a malformed JSON body with 400, not 500', async () => {
    // `c.req.json()` throws on a body that is not JSON, and the handler's outer
    // catch turned that into a 500 — a client error reported as a server fault,
    // inflating the backend error rate. POST / was fixed for this; PATCH, move
    // and reorder were not, until this change.
    seedTask('t1');

    const res = await call('/t1', { method: 'PATCH', body: 'not json at all' });

    expect(res.status).toBe(400);
    expect(await json(res)).toMatchObject({
      error: 'Validation failed',
      message: 'Request body must be JSON',
    });
  });
});

describe('DELETE /:id', () => {
  it('removes the task and its checklist and comments', async () => {
    seedTask('t1');
    kvStore.set('task_checklist:t1', [{ label: 'step one' }]);
    kvStore.set('task_comments:t1', [{ body: 'a note' }]);

    expect(await json(await call('/t1', { method: 'DELETE' }))).toEqual({ success: true });
    expect(kvStore.has('task:t1')).toBe(false);
    expect(kvStore.has('task_checklist:t1')).toBe(false);
    expect(kvStore.has('task_comments:t1')).toBe(false);
  });

  it('reports success for a task that was already gone', async () => {
    // Idempotent on purpose: a double-clicked delete must not surface an error.
    await expect(call('/gone', { method: 'DELETE' }).then((r) => r.status)).resolves.toBe(200);
  });
});

describe('POST /:id/move', () => {
  it('moves the task and stamps completed_at when it lands in completed', async () => {
    seedTask('t1');

    const body = await json(
      await call('/t1/move', {
        method: 'POST',
        body: JSON.stringify({ status: 'completed', sort_order: 3 }),
      }),
    );

    expect(body).toMatchObject({ status: 'completed', sort_order: 3 });
    expect(body.completed_at).toBeTruthy();
  });

  it('clears completed_at when the task moves back out of completed', async () => {
    // Reopening a task must not leave a completion timestamp behind, or every
    // report that counts completions counts it twice.
    seedTask('t1', { status: 'completed', completed_at: '2026-02-02T00:00:00.000Z' });

    const body = await json(
      await call('/t1/move', {
        method: 'POST',
        body: JSON.stringify({ status: 'in_progress', sort_order: 0 }),
      }),
    );

    expect(body).toMatchObject({ status: 'in_progress', completed_at: null });
  });

  it('defaults sort_order to 0 when the body omits it', async () => {
    seedTask('t1', { sort_order: 9 });

    const body = await json(
      await call('/t1/move', { method: 'POST', body: JSON.stringify({ status: 'new' }) }),
    );

    expect(body.sort_order).toBe(0);
  });

  it('rejects a status outside the enum, a 404 for a missing task, and a bad body', async () => {
    seedTask('t1');

    await expect(
      call('/t1/move', { method: 'POST', body: JSON.stringify({ status: 'nope' }) }).then(
        (r) => r.status,
      ),
    ).resolves.toBe(400);
    await expect(
      call('/gone/move', { method: 'POST', body: JSON.stringify({ status: 'new' }) }).then(
        (r) => r.status,
      ),
    ).resolves.toBe(404);
    await expect(
      call('/t1/move', { method: 'POST', body: 'not json' }).then((r) => r.status),
    ).resolves.toBe(400);
  });
});

describe('POST /reorder', () => {
  it('applies every sort_order in the batch', async () => {
    seedTask('a', { sort_order: 0 });
    seedTask('b', { sort_order: 1 });

    const res = await call('/reorder', {
      method: 'POST',
      body: JSON.stringify({
        updates: [
          { id: 'a', sort_order: 5 },
          { id: 'b', sort_order: 2 },
        ],
      }),
    });

    expect(await json(res)).toEqual({ success: true });
    expect(stored('a')).toMatchObject({ sort_order: 5 });
    expect(stored('b')).toMatchObject({ sort_order: 2 });
  });

  it('accepts a bare array as well as an { updates } wrapper', async () => {
    seedTask('a');

    await call('/reorder', {
      method: 'POST',
      body: JSON.stringify([{ id: 'a', sort_order: 4 }]),
    });

    expect(stored('a')).toMatchObject({ sort_order: 4 });
  });

  it('skips an id that does not exist instead of failing the whole batch', async () => {
    // A drag-and-drop reorder sends the whole column. One stale id in it must
    // not undo the reorder for every other card.
    seedTask('a');

    const res = await call('/reorder', {
      method: 'POST',
      body: JSON.stringify([
        { id: 'a', sort_order: 1 },
        { id: 'ghost', sort_order: 2 },
      ]),
    });

    expect(res.status).toBe(200);
    expect(stored('a')).toMatchObject({ sort_order: 1 });
    expect(kvStore.has('task:ghost')).toBe(false);
  });

  it('rejects an empty batch, a negative order, and a malformed body', async () => {
    await expect(
      call('/reorder', { method: 'POST', body: JSON.stringify([]) }).then((r) => r.status),
    ).resolves.toBe(400);
    await expect(
      call('/reorder', {
        method: 'POST',
        body: JSON.stringify([{ id: 'a', sort_order: -1 }]),
      }).then((r) => r.status),
    ).resolves.toBe(400);
    await expect(
      call('/reorder', { method: 'POST', body: 'not json' }).then((r) => r.status),
    ).resolves.toBe(400);
  });
});

describe('POST /:id/duplicate', () => {
  it('copies the task under a new id with "(Copy)" appended', async () => {
    seedTask('t1', { title: 'Quarterly review', status: 'in_progress' });

    const res = await call('/t1/duplicate', { method: 'POST' });
    const body = await json(res);

    expect(res.status).toBe(201);
    expect(body.id).not.toBe('t1');
    expect(body).toMatchObject({ title: 'Quarterly review (Copy)', status: 'in_progress' });
    expect(stored('t1')).toMatchObject({ title: 'Quarterly review' });
  });

  it('starts the copy uncompleted, whatever the original was', async () => {
    seedTask('t1', { status: 'completed', completed_at: '2026-02-02T00:00:00.000Z' });

    const body = await json(await call('/t1/duplicate', { method: 'POST' }));

    expect(body.completed_at).toBeNull();
  });

  it('places the copy at the end of its status column', async () => {
    seedTask('t1', { status: 'new', sort_order: 0 });
    seedTask('t2', { status: 'new', sort_order: 4 });

    const body = await json(await call('/t1/duplicate', { method: 'POST' }));

    expect(body.sort_order).toBe(5);
  });

  it('404s a task that does not exist', async () => {
    await expect(call('/gone/duplicate', { method: 'POST' }).then((r) => r.status)).resolves.toBe(
      404,
    );
  });
});

describe('POST /:id/archive and /:id/unarchive', () => {
  it('archives a task', async () => {
    seedTask('t1');

    const body = await json(await call('/t1/archive', { method: 'POST' }));

    expect(body.status).toBe('archived');
    expect(stored('t1')).toMatchObject({ status: 'archived' });
  });

  it('unarchives to "new" when the body says nothing', async () => {
    seedTask('t1', { status: 'archived' });

    const body = await json(await call('/t1/unarchive', { method: 'POST' }));

    expect(body.status).toBe('new');
  });

  it('unarchives to a requested status', async () => {
    seedTask('t1', { status: 'archived' });

    const body = await json(
      await call('/t1/unarchive', {
        method: 'POST',
        body: JSON.stringify({ status: 'in_progress' }),
      }),
    );

    expect(body.status).toBe('in_progress');
  });

  it('falls back to "new" rather than back to archived', async () => {
    // `archived` is excluded from the unarchive enum, so an invalid or excluded
    // status must not round-trip the task straight back into the archive.
    seedTask('t1', { status: 'archived' });

    const body = await json(
      await call('/t1/unarchive', { method: 'POST', body: JSON.stringify({ status: 'archived' }) }),
    );

    expect(body.status).toBe('new');
  });

  it('tolerates a malformed unarchive body', async () => {
    seedTask('t1', { status: 'archived' });

    const res = await call('/t1/unarchive', { method: 'POST', body: 'not json' });

    expect(res.status).toBe(200);
    expect((await json(res)).status).toBe('new');
  });

  it('places the unarchived task at the end of its new column', async () => {
    seedTask('t1', { status: 'archived' });
    seedTask('t2', { status: 'new', sort_order: 3 });

    const body = await json(await call('/t1/unarchive', { method: 'POST' }));

    expect(body.sort_order).toBe(4);
  });

  it('404s both routes for a task that does not exist', async () => {
    await expect(call('/gone/archive', { method: 'POST' }).then((r) => r.status)).resolves.toBe(
      404,
    );
    await expect(call('/gone/unarchive', { method: 'POST' }).then((r) => r.status)).resolves.toBe(
      404,
    );
  });
});
