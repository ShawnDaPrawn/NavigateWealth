/**
 * `getStats` — the payload behind `/admin/stats`.
 *
 * This is the route the admin dashboard blocks its first paint on, and it
 * reads five unrelated namespaces. Those reads used to be awaited one after
 * another, so the route cost the sum of five round trips; they are now issued
 * together and reconciled with `allSettled`.
 *
 * Two things are worth pinning. The reads must actually overlap — a future
 * edit that puts an `await` back between them would keep every count correct
 * and quietly restore the latency. And the endpoint must still answer when one
 * namespace fails: the sequential version wrapped each read in its own
 * try/catch precisely so a single bad namespace degraded its own counts rather
 * than taking the response down, and `allSettled` has to preserve that.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/applications-service-stats.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

/** Prefix → rows, plus the ability to make one prefix fail. */
const namespaces = new Map<string, unknown[]>();
const failingPrefixes = new Set<string>();
/** Resolved in call order, so a sequential implementation is visible. */
let prefixCallOrder: string[] = [];
/** Held-open reads, so a test can prove the next read started before this one finished. */
const gates = new Map<string, () => void>();

const getByPrefix = vi.fn(async (prefix: string) => {
  prefixCallOrder.push(prefix);
  const gate = gates.get(prefix);
  if (gate) {
    await new Promise<void>((resolve) => {
      gates.set(prefix, resolve);
      gate();
    });
  }
  if (failingPrefixes.has(prefix)) throw new Error(`${prefix} unavailable`);
  return namespaces.get(prefix) ?? [];
});

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async () => null),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  mget: vi.fn(async (keys: string[]) => keys.map(() => undefined)),
  getByPrefix: (prefix: string) => getByPrefix(prefix),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  }),
}));

let eligibleClients: unknown[] = [];
let clientsServiceFails = false;
vi.mock('../client-management-service.ts', () => ({
  ClientsService: class {
    getAllClients() {
      if (clientsServiceFails) return Promise.reject(new Error('auth listing down'));
      return Promise.resolve(eligibleClients);
    }
  },
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({}),
}));

const { getStats } = await import('../applications-service-queries.ts');

const APPLICATION_PREFIX = 'application:';
const TASK_PREFIX = 'task:';
const REQUEST_PREFIX = 'requests:request:';
const ESIGN_PREFIX = 'esign:envelope:';

/** A root application document, which is what the stats filters keep. */
function application(id: string, status: string, createdAt = new Date().toISOString()) {
  return {
    id,
    user_id: `00000000-0000-4000-8000-${id.padStart(12, '0')}`,
    application_data: {},
    status,
    created_at: createdAt,
  };
}

beforeEach(() => {
  namespaces.clear();
  failingPrefixes.clear();
  gates.clear();
  prefixCallOrder = [];
  eligibleClients = [];
  clientsServiceFails = false;
  vi.clearAllMocks();
});

describe('getStats — counts', () => {
  it('counts applications by status', async () => {
    namespaces.set(APPLICATION_PREFIX, [
      application('1', 'draft'),
      application('2', 'in_progress'),
      application('3', 'approved'),
      application('4', 'declined'),
      application('5', 'submitted'),
    ]);

    const stats = await getStats();

    expect(stats.total).toBe(5);
    expect(stats.draft).toBe(1);
    expect(stats.application_in_progress).toBe(1);
    expect(stats.incomplete).toBe(2);
    expect(stats.approved).toBe(1);
    expect(stats.declined).toBe(1);
    expect(stats.submitted_for_review).toBe(1);
  });

  it('counts pending and new tasks', async () => {
    namespaces.set(TASK_PREFIX, [
      { status: 'new' },
      { status: 'in_progress' },
      { status: 'completed' },
    ]);

    const stats = await getStats();

    expect(stats.new_tasks).toBe(1);
    expect(stats.pending_tasks).toBe(2);
  });

  it('counts open requests and pending signatures', async () => {
    namespaces.set(REQUEST_PREFIX, [
      { status: 'New' },
      { status: 'In Sign-Off' },
      { status: 'Completed' },
    ]);
    namespaces.set(ESIGN_PREFIX, [
      { status: 'sent' },
      { status: 'in_progress' },
      { status: 'completed' },
    ]);

    const stats = await getStats();

    expect(stats.total_requests).toBe(3);
    expect(stats.pending_requests).toBe(2);
    expect(stats.pending_esignatures).toBe(2);
  });

  it('takes the client count from Client Management, so the two cannot disagree', async () => {
    eligibleClients = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    namespaces.set(APPLICATION_PREFIX, [application('1', 'approved')]);

    const stats = await getStats();

    expect(stats.total_clients).toBe(3);
    expect(stats.active_users).toBe(3);
  });
});

describe('getStats — the reads run together', () => {
  it('starts every namespace read before the first one has resolved', async () => {
    // Hold the applications read open; if the others were awaiting it, they
    // would not have been issued by the time we look.
    const applicationsStarted = new Promise<void>((resolve) => {
      gates.set(APPLICATION_PREFIX, resolve);
    });
    const pending = getStats();
    await applicationsStarted;

    expect(prefixCallOrder).toContain(TASK_PREFIX);
    expect(prefixCallOrder).toContain(REQUEST_PREFIX);
    expect(prefixCallOrder).toContain(ESIGN_PREFIX);

    gates.get(APPLICATION_PREFIX)?.();
    await pending;
  });
});

describe('getStats — one bad namespace does not take the response down', () => {
  it('still answers when the applications read fails', async () => {
    failingPrefixes.add(APPLICATION_PREFIX);
    namespaces.set(TASK_PREFIX, [{ status: 'new' }]);
    eligibleClients = [{ id: 'a' }];

    const stats = await getStats();

    expect(stats.total).toBe(0);
    expect(stats.new_this_month).toBe(0);
    // The namespaces that did answer are still counted.
    expect(stats.new_tasks).toBe(1);
    expect(stats.total_clients).toBe(1);
  });

  it('still answers when the task read fails', async () => {
    failingPrefixes.add(TASK_PREFIX);
    namespaces.set(APPLICATION_PREFIX, [application('1', 'approved')]);

    const stats = await getStats();

    expect(stats.pending_tasks).toBe(0);
    expect(stats.total).toBe(1);
  });

  it('still answers when the request and e-signature reads fail', async () => {
    failingPrefixes.add(REQUEST_PREFIX);
    failingPrefixes.add(ESIGN_PREFIX);
    namespaces.set(APPLICATION_PREFIX, [application('1', 'approved')]);

    const stats = await getStats();

    expect(stats.total_requests).toBe(0);
    expect(stats.pending_requests).toBe(0);
    expect(stats.pending_esignatures).toBe(0);
    expect(stats.total).toBe(1);
  });

  it('falls back to distinct application owners when the client count fails', async () => {
    clientsServiceFails = true;
    namespaces.set(APPLICATION_PREFIX, [
      application('1', 'approved'),
      application('2', 'draft'),
      // A third application owned by the same user as the first.
      { ...application('3', 'draft'), user_id: application('1', 'approved').user_id },
    ]);

    const stats = await getStats();

    expect(stats.total_clients).toBe(2);
  });

  it('answers with zeroes rather than throwing when every read fails', async () => {
    failingPrefixes.add(APPLICATION_PREFIX);
    failingPrefixes.add(TASK_PREFIX);
    failingPrefixes.add(REQUEST_PREFIX);
    failingPrefixes.add(ESIGN_PREFIX);
    clientsServiceFails = true;

    const stats = await getStats();

    expect(stats.total).toBe(0);
    expect(stats.pending_tasks).toBe(0);
    expect(stats.total_clients).toBe(0);
    expect(stats.pending_esignatures).toBe(0);
  });
});
