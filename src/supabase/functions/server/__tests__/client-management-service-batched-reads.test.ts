/**
 * `ClientsService.getAllClients` — batched KV reads.
 *
 * This method is what `/admin/stats` calls just to count clients, and the admin
 * dashboard blocks its first paint on `/admin/stats`. It used to issue three
 * awaited `kv.get`s per client — profile, the application that profile names,
 * and security — so the cost of loading the dashboard grew with 3× the client
 * count, one Postgres connection at a time.
 *
 * These tests pin the read SHAPE, because that is the whole point of the
 * change and the part that silently regresses: a future edit that reintroduces
 * a per-client `kv.get` inside the map would still return the right clients and
 * pass every other test in the suite.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-management-service-batched-reads.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const kvGet = vi.fn(async (key: string) => clone(kvStore.get(key) ?? null));
const kvMget = vi.fn(async (keys: string[]) =>
  keys.map((key) => clone(kvStore.get(key) ?? undefined)),
);

vi.mock('../kv_store.tsx', () => ({
  get: (key: string) => kvGet(key),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, clone(value));
  }),
  del: vi.fn(async () => {}),
  mget: (keys: string[]) => kvMget(keys),
  getByPrefix: vi.fn(async (prefix: string) => {
    const out: unknown[] = [];
    kvStore.forEach((v, k) => {
      if (k.startsWith(prefix)) out.push(clone(v));
    });
    return out;
  }),
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

vi.mock('../newsletter-service.ts', () => ({
  autoSubscribeClient: vi.fn(async () => {}),
  removeSubscriberByEmail: vi.fn(async () => {}),
}));

let authUsers: Array<Record<string, unknown>> = [];
vi.mock('../auth-admin-list-users.ts', () => ({
  listAllAuthUsers: vi.fn(async () => authUsers),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: { getUserById: vi.fn(), updateUserById: vi.fn() } } }),
}));

const { ClientsService } = await import('../client-management-service.ts');

beforeEach(() => {
  kvStore.clear();
  authUsers = [];
  vi.clearAllMocks();
});

/** Seed `count` clients, each with a profile, an application and a security row. */
function seedClients(count: number) {
  for (let i = 0; i < count; i++) {
    const id = `client-${i}`;
    authUsers.push({
      id,
      email: `client${i}@example.com`,
      created_at: '2026-01-01T00:00:00.000Z',
      user_metadata: { role: 'client', firstName: `First${i}`, surname: `Last${i}` },
    });
    kvStore.set(`user_profile:${id}:personal_info`, {
      personalInformation: { firstName: `First${i}`, lastName: `Last${i}` },
      accountStatus: 'approved',
      applicationId: `app-${i}`,
    });
    kvStore.set(`application:app-${i}`, { id: `app-${i}`, status: 'approved' });
    kvStore.set(`security:${id}`, { suspended: false, deleted: false });
  }
}

/** Keys read through `kv.mget`, flattened across batches. */
function batchedKeys(): string[] {
  return kvMget.mock.calls.flatMap(([keys]) => keys as string[]);
}

describe('getAllClients — read shape', () => {
  it('reads nothing per client: the profile/application/security rows are batched', async () => {
    seedClients(25);

    await new ClientsService().getAllClients();

    expect(kvGet).not.toHaveBeenCalled();
  });

  it('issues a constant number of batches regardless of how many clients there are', async () => {
    seedClients(5);
    await new ClientsService().getAllClients();
    const batchesForFive = kvMget.mock.calls.length;

    vi.clearAllMocks();
    kvStore.clear();
    authUsers = [];

    seedClients(50);
    await new ClientsService().getAllClients();

    expect(kvMget.mock.calls.length).toBe(batchesForFive);
  });

  it('splits a large read into bounded batches rather than one unbounded key list', async () => {
    // `kv.mget` filters with PostgREST's `in.(...)`, which travels in the URL,
    // so an unbounded key list is a request that eventually fails outright.
    seedClients(450);

    await new ClientsService().getAllClients();

    expect(kvMget.mock.calls.length).toBeGreaterThan(3);
    for (const [keys] of kvMget.mock.calls) {
      expect((keys as string[]).length).toBeLessThanOrEqual(200);
    }
  });

  it('reads each client its own profile, application and security row', async () => {
    seedClients(3);

    await new ClientsService().getAllClients();

    const keys = batchedKeys();
    for (let i = 0; i < 3; i++) {
      expect(keys).toContain(`user_profile:client-${i}:personal_info`);
      expect(keys).toContain(`application:app-${i}`);
      expect(keys).toContain(`security:client-${i}`);
    }
  });
});

describe('getAllClients — results are unchanged by the batching', () => {
  it('still returns every client, in auth-listing order, with its own rows attached', async () => {
    seedClients(3);

    const clients = await new ClientsService().getAllClients();

    expect(clients.map((c) => c.id)).toEqual(['client-0', 'client-1', 'client-2']);
    expect(clients.map((c) => c.firstName)).toEqual(['First0', 'First1', 'First2']);
    expect(clients.map((c) => c.applicationStatus)).toEqual(['approved', 'approved', 'approved']);
  });

  it('does not mis-align rows when a client has no profile of their own', async () => {
    seedClients(3);
    kvStore.delete('user_profile:client-1:personal_info');

    const clients = await new ClientsService().getAllClients();

    // client-1 falls back to auth metadata; the others keep their own profiles.
    expect(clients.map((c) => c.firstName)).toEqual(['First0', 'First1', 'First2']);
    expect(clients.map((c) => c.accountStatus)).toEqual(['approved', undefined, 'approved']);
    expect(clients.map((c) => c.applicationStatus)).toEqual(['approved', 'none', 'approved']);
  });

  it('resolves the application by id, not by position, when clients share one', async () => {
    seedClients(2);
    // Both profiles now point at the same application row.
    kvStore.set('user_profile:client-1:personal_info', {
      personalInformation: { firstName: 'First1', lastName: 'Last1' },
      accountStatus: 'approved',
      applicationId: 'app-0',
    });

    const clients = await new ClientsService().getAllClients();

    expect(clients.map((c) => c.applicationStatus)).toEqual(['approved', 'approved']);
  });

  it('carries the security flags through to the right client', async () => {
    seedClients(3);
    kvStore.set('security:client-2', { suspended: true, deleted: false });

    const clients = await new ClientsService().getAllClients();

    expect(clients.map((c) => c.suspended)).toEqual([false, false, true]);
  });

  it('reads nothing at all when there are no clients to read for', async () => {
    await new ClientsService().getAllClients();

    expect(kvMget).not.toHaveBeenCalled();
    expect(kvGet).not.toHaveBeenCalled();
  });
});
