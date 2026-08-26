/**
 * Tasks repository
 * ================
 *
 * Added because the dashboard needed to read tasks and the direct-access
 * ratchet was right to object. `task:` was already reached for directly from
 * two modules — `tasks-routes.ts` and `tasks-digest-routes.ts` — and the cost
 * of that sprawl is visible in the tree: BOTH of them carry their own copy of
 * `normaliseTask`, and each has its own idea of which stored rows count as a
 * task. A third hand-rolled reader in the reporting service would have made
 * the dashboard's numbers a fourth opinion.
 *
 * So this file owns three things and nothing else:
 *
 *   - the `task:` namespace string
 *   - which stored rows count as tasks
 *   - the legacy camelCase fallback for `due_date`
 *
 * SCOPE, STATED PLAINLY: `tasks-routes.ts` and `tasks-digest-routes.ts` still
 * read `task:` directly and still hold their own `normaliseTask`. Moving them
 * is a real refactor of two large, thinly-covered modules and does not belong
 * in the change that introduced this file. The duplication is not fixed here —
 * it is now merely documented and given somewhere to converge on.
 */

import { createKvRepository } from './kv-repository.ts';

/** Namespace for every stored task. Note the trailing separator. */
export const TASK_NAMESPACE = 'task:';

/**
 * The subset of a task this layer promises. Deliberately narrow: callers that
 * need the full record read it through `tasks` below and keep their own type.
 */
export interface StoredTask {
  id?: string;
  status?: string;
  due_date?: string | null;
  [key: string]: unknown;
}

export const tasks = createKvRepository<StoredTask>(TASK_NAMESPACE);

/**
 * True when a stored row is a task rather than debris.
 *
 * Matches `GET /tasks/stats` exactly — `t && typeof t === 'object' && t.id` —
 * so a count taken here and a count taken there can never disagree about the
 * denominator. `/tasks/all` additionally requires a `title`; that is a display
 * concern, and counting a titleless task as absent would understate the total.
 */
export function isTask(row: unknown): row is StoredTask {
  return !!row && typeof row === 'object' && !!(row as StoredTask).id;
}

/**
 * Normalise the one field that has two spellings in stored data.
 *
 * Both copies of `normaliseTask` fall back `due_date ?? dueDate`, because rows
 * written before the snake_case convention are still in the store. A reader
 * that skips this does not see fewer fields — it sees fewer *due dates*, which
 * silently drops those tasks out of every date-based metric.
 */
export function withNormalisedDueDate(row: StoredTask): StoredTask {
  return {
    ...row,
    due_date: (row.due_date ?? (row as Record<string, unknown>).dueDate ?? null) as string | null,
  };
}

/**
 * Every task in the store, filtered and normalised.
 *
 * `listAll` rather than `list` on purpose, and the reason is passed through to
 * the repository's log line: dashboard metrics are counts over the whole set,
 * so a page of 100 would not answer the question. There are 33 rows today.
 * When that stops being true, the fix is an aggregate, not a bigger page.
 */
export async function listAllTasks(reason: string): Promise<StoredTask[]> {
  const rows = await tasks.listAll(reason);
  return rows.filter(isTask).map(withNormalisedDueDate);
}
