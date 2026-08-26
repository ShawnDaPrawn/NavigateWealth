/**
 * reporting-service-dashboard.ts — task metrics
 * ============================================
 *
 * `getDashboardReport()` read tasks from `supabase.from('tasks_91ed8379')`.
 * No such table exists — the only tasks table in the project is `tasks`, and
 * tasks are not in a table at all, they are in the KV store under `task:`.
 *
 * The destructure was `const { data: tasksData } = await ...`, which discards
 * the error. So the query failed, `tasksData` came back null, `tasks` became
 * `[]`, and every task figure on the admin dashboard — due today, due last
 * month, total, completed, and the growth percentage derived from them —
 * rendered a confident zero. Nothing threw and nothing logged.
 *
 * That is the shape of failure this file exists to prevent: not a crash, a
 * plausible wrong number. So the assertions are on VALUES, with a fixture
 * built so that every metric has a distinct non-zero answer. A test that only
 * checked "responds without throwing" would have passed against the bug.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const store = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (k: string) => store.get(k) ?? null),
  set: vi.fn(async (k: string, v: unknown) => {
    store.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    store.delete(k);
  }),
  getByPrefix: vi.fn(async (p: string) =>
    [...store.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v),
  ),
  listByPrefix: vi.fn(async (p: string, o?: { limit?: number; startAfter?: string }) => {
    let rows = [...store.entries()]
      .filter(([k]) => k.startsWith(p))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => ({ key, value }));
    if (o?.startAfter) rows = rows.filter((r) => r.key > o.startAfter!);
    return rows.slice(0, o?.limit ?? 100);
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn(), debug: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { getDashboardReport } = await import('../reporting-service-dashboard.ts');

const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const today = iso(new Date());
const thirtyDaysAgo = iso(daysAgo(30));

function putTask(id: string, task: Record<string, unknown>) {
  store.set(`task:${id}`, { id, ...task });
}

beforeEach(() => {
  store.clear();
});

describe('dashboard task metrics come from the KV store', () => {
  beforeEach(() => {
    // Counts chosen so no two metrics share a value — a wrong wiring that
    // happened to return the right shape would still land on a wrong number.
    putTask('t1', { status: 'new', due_date: today });
    putTask('t2', { status: 'in_progress', due_date: today });
    putTask('t3', { status: 'new', due_date: today });
    putTask('t4', { status: 'completed', due_date: today }); // completed: not due
    putTask('t5', { status: 'archived', due_date: today }); // archived: not due, not total
    putTask('t6', { status: 'new', due_date: thirtyDaysAgo });
    putTask('t7', { status: 'completed', due_date: thirtyDaysAgo });
    putTask('t8', { status: 'new' }); // no due date
  });

  it('counts tasks due today, excluding completed and archived', async () => {
    const report = await getDashboardReport();
    expect(report.tasks.dueToday).toBe(3);
  });

  it('counts total tasks, excluding archived', async () => {
    const report = await getDashboardReport();
    expect(report.tasks.total).toBe(7);
  });

  it('counts completed tasks', async () => {
    const report = await getDashboardReport();
    expect(report.tasks.completed).toBe(2);
  });

  it('reports a non-zero figure at all — the exact bug that shipped', async () => {
    // The regression this file was written for. Every one of these was 0.
    const report = await getDashboardReport();
    expect(report.tasks.total).toBeGreaterThan(0);
    expect(report.tasks.dueToday).toBeGreaterThan(0);
    expect(report.tasks.completed).toBeGreaterThan(0);
  });

  it('does not count task_checklist rows as tasks', async () => {
    // `task_checklist:` does not fall inside the `task:` prefix range — '_' is
    // 0x5F and ':' is 0x3A, so the scan's upper bound stops short of it. Pinned
    // because the two namespaces are one character apart.
    store.set('task_checklist:c1', { id: 'c1', status: 'new', due_date: today });
    const report = await getDashboardReport();
    expect(report.tasks.total).toBe(7);
  });

  it('ignores stored debris that carries no id', async () => {
    // Same filter as GET /tasks/stats. A null or id-less row is not a task.
    store.set('task:junk', null);
    store.set('task:partial', { status: 'new', due_date: today });
    const report = await getDashboardReport();
    expect(report.tasks.total).toBe(7);
    expect(report.tasks.dueToday).toBe(3);
  });

  it('honours a legacy camelCase dueDate', async () => {
    // Both copies of `normaliseTask` fall back due_date ?? dueDate, because
    // rows written before the convention are still in the store. A reader that
    // skips the fallback does not see fewer fields, it silently drops those
    // tasks out of every date-based metric.
    store.clear();
    putTask('legacy', { status: 'new', dueDate: today });
    const report = await getDashboardReport();
    expect(report.tasks.dueToday).toBe(1);
  });

  it('reports zeros when there genuinely are no tasks', async () => {
    store.clear();
    const report = await getDashboardReport();
    expect(report.tasks.total).toBe(0);
    expect(report.tasks.dueToday).toBe(0);
    expect(report.tasks.completed).toBe(0);
  });
});

describe('dashboard reads every source it reports on', () => {
  it('counts clients, applications, FNAs and communications from their own namespaces', async () => {
    store.set('user_profile:u1', { id: 'u1', createdAt: today });
    store.set('user_profile:u2', { id: 'u2', createdAt: today });
    store.set('application:a1', { id: 'a1', created_at: today });
    store.set('fna:f1', { id: 'f1' });
    store.set('fna:f2', { id: 'f2' });
    store.set('fna:f3', { id: 'f3' });
    store.set('communication_history:c1', { id: 'c1' });

    const report = await getDashboardReport();
    expect(report.clients.total).toBe(2);
    expect(report.applications.total).toBe(1);
    expect(report.fnas.total).toBe(3);
    expect(report.activity.communications).toBe(1);
  });

  it('issues its reads concurrently rather than one after another', async () => {
    // The five sources are independent, and the function runs in whichever
    // region is nearest the caller while Postgres sits in one region — so
    // serial awaits cost four extra round trips. Asserted by overlap: if the
    // reads were sequential, the maximum concurrent depth would be 1.
    const kv = await import('../kv_store.tsx');
    let inFlight = 0;
    let peak = 0;
    const original = kv.getByPrefix as unknown as (p: string) => Promise<unknown[]>;
    vi.mocked(kv.getByPrefix).mockImplementation(async (p: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      const out = [...store.entries()].filter(([k]) => k.startsWith(p)).map(([, v]) => v);
      inFlight -= 1;
      return out;
    });

    await getDashboardReport();
    expect(peak).toBeGreaterThan(1);

    vi.mocked(kv.getByPrefix).mockImplementation(original);
  });
});
