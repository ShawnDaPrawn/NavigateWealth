/**
 * getAllClients — the name every outbound email is addressed to
 * =============================================================
 *
 * `getAllClients` is the loader behind the birthday digest, the birthday
 * greeting, campaigns and group membership, so whatever it decides a client is
 * called is what lands in their inbox.
 *
 * It used to read `profile.personalInformation.firstName` and, failing that,
 * auth `user_metadata`. Both halves of that were wrong for the same client:
 * profiles built from an application are FLAT (no `personalInformation` at all,
 * the same shape that already forced `resolveDateOfBirth` to exist), and
 * `user_metadata` is a snapshot written at signup that nothing corrects. A
 * client renamed on his profile months earlier was therefore still greeted —
 * and reported to his advisor — by the name he was enrolled under.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/communication-client-names.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test' } });

const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const PROFILES: Record<string, unknown> = {};

vi.mock('../kv_store.tsx', () => ({
  mget: vi.fn(async (keys: string[]) =>
    keys.map((k) => (k.startsWith('user_profile:') ? clone(PROFILES[k] ?? null) : null)),
  ),
  get: vi.fn(async () => null),
  set: vi.fn(async () => {}),
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

vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(),
  createEmailTemplate: vi.fn((html: string) => html),
}));

vi.mock('../communication-repo.ts', () => ({
  getGroup: vi.fn(),
  getGroupMembersCache: vi.fn(),
  setGroupMembersCache: vi.fn(),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: vi.fn() }));

const AUTH_USERS: Array<Record<string, unknown>> = [];
vi.mock('../auth-admin-list-users.ts', () => ({
  listAllAuthUsers: vi.fn(async () => AUTH_USERS),
}));

import { getAllClients } from '../communication-business-logic.ts';
import type { SupabaseAdminClient } from '../communication-types.ts';

const supabase = {} as unknown as SupabaseAdminClient;

/** Seed one client: an auth row, and the KV profile keyed to it. */
function seed(id: string, metadata: Record<string, unknown>, profile: Record<string, unknown>) {
  AUTH_USERS.push({ id, email: `${id}@example.com`, user_metadata: metadata });
  PROFILES[`user_profile:${id}:personal_info`] = { userId: id, ...profile };
}

beforeEach(() => {
  vi.clearAllMocks();
  AUTH_USERS.length = 0;
  for (const key of Object.keys(PROFILES)) delete PROFILES[key];
});

describe('the corrected name wins over the signup snapshot', () => {
  it('reads a FLAT profile, the shape every self-service client has', async () => {
    // Exactly the production row: renamed on the profile, never in auth.
    seed(
      'kirtan',
      { firstName: 'Liezl', surname: 'Daya' },
      { firstName: 'Kirtan', lastName: 'Daya', dateOfBirth: '1977-09-07' },
    );

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Kirtan');
    expect(client.lastName).toBe('Daya');
  });

  it('still reads the legacy nested shape', async () => {
    seed(
      'ann',
      { firstName: 'Stale', surname: 'Stale' },
      { personalInformation: { firstName: 'Ann', lastName: 'Smith' } },
    );

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Ann');
    expect(client.lastName).toBe('Smith');
  });

  it('prefers the root when a row carries both — the root was written later', async () => {
    seed(
      'aaron',
      {},
      { firstName: 'Aaron', personalInformation: { firstName: 'Individual', lastName: 'Legacy' } },
    );

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Aaron');
  });
});

describe('the fallbacks that were already there', () => {
  it('uses auth metadata when the profile holds no name', async () => {
    seed('ben', { firstName: 'Ben', surname: 'Jones' }, { dateOfBirth: '1980-01-01' });

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Ben');
    expect(client.lastName).toBe('Jones');
  });

  it('splits a single metadata display name', async () => {
    seed('cara', { name: 'Cara van Wyk' }, {});

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Cara');
    expect(client.lastName).toBe('van Wyk');
  });

  it("renders 'Client' rather than a blank when nothing is known", async () => {
    seed('dee', {}, {});

    const [client] = await getAllClients(supabase);

    expect(client.firstName).toBe('Client');
    expect(client.lastName).toBe('');
  });
});
