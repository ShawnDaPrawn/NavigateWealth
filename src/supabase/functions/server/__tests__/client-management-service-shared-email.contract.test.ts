/**
 * `ClientsService.getAllClients` — contact address vs sign-in identity.
 *
 * This method is the single seam every client-facing message flows through:
 * campaigns, the newsletter audience, birthday greetings and group matching all
 * read `client.email` from here. Resolving the shared-mailbox link at this one
 * point is what keeps a linked minor's mail going to her guardian's real inbox
 * without every downstream caller learning that aliases exist — so these tests
 * guard the seam, not the callers.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/client-management-service-shared-email.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, clone(value));
  }),
  del: vi.fn(async () => {}),
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

const getUserById = vi.fn();
const updateUserById = vi.fn(async () => ({ data: null, error: null }));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: { getUserById, updateUserById } } }),
}));

const { ClientsService } = await import('../client-management-service.ts');

const MICHAEL_EMAIL = 'michael.wood@gmail.com';
const CHARLOTTE_ALIAS = 'michael.wood+charlotte-page-wood@gmail.com';

beforeEach(() => {
  kvStore.clear();
  authUsers = [];
  vi.clearAllMocks();
});

/** Registers an auth user plus the profile KV row `getAllClients` reads. */
function seedClient(
  id: string,
  email: string,
  meta: Record<string, unknown>,
  profile?: Record<string, unknown>,
) {
  authUsers.push({
    id,
    email,
    created_at: '2026-01-01T00:00:00.000Z',
    user_metadata: { role: 'client', ...meta },
  });
  if (profile) kvStore.set(`user_profile:${id}:personal_info`, profile);
}

describe('getAllClients', () => {
  it('reports the sign-in address as the contact address when the client owns it', async () => {
    seedClient('michael', MICHAEL_EMAIL, { firstName: 'Michael', surname: 'Wood' });

    const [client] = await new ClientsService().getAllClients();

    expect(client.email).toBe(MICHAEL_EMAIL);
    expect(client.signInEmail).toBe(MICHAEL_EMAIL);
    expect(client.emailIsShared).toBe(false);
  });

  it('reports the guardian address for a linked client, and the alias separately', async () => {
    seedClient(
      'charlotte',
      CHARLOTTE_ALIAS,
      { firstName: 'Charlotte', surname: 'Page Wood' },
      {
        personalInformation: { firstName: 'Charlotte', lastName: 'Page Wood' },
        sharedEmail: {
          contactEmail: MICHAEL_EMAIL,
          signInEmail: CHARLOTTE_ALIAS,
          relationship: 'Daughter (minor)',
          linkedAt: '2026-09-03T00:00:00.000Z',
        },
      },
    );

    const [client] = await new ClientsService().getAllClients();

    // Everything that emails a client reads this field. Were it the alias, a
    // minor's mail would depend on the provider honouring sub-addressing.
    expect(client.email).toBe(MICHAEL_EMAIL);
    expect(client.signInEmail).toBe(CHARLOTTE_ALIAS);
    expect(client.emailIsShared).toBe(true);
  });

  it('keeps both household members in the list', async () => {
    seedClient('michael', MICHAEL_EMAIL, { firstName: 'Michael', surname: 'Wood' });
    seedClient(
      'charlotte',
      CHARLOTTE_ALIAS,
      { firstName: 'Charlotte', surname: 'Page Wood' },
      {
        sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
      },
    );

    const clients = await new ClientsService().getAllClients();

    expect(clients.map((c) => c.id).sort()).toEqual(['charlotte', 'michael']);
    // Two client records, one inbox — which is the whole shape of the problem.
    expect(clients.every((c) => c.email === MICHAEL_EMAIL)).toBe(true);
  });

  it('finds both household members when the admin searches the shared address', async () => {
    seedClient('michael', MICHAEL_EMAIL, { firstName: 'Michael', surname: 'Wood' });
    seedClient(
      'charlotte',
      CHARLOTTE_ALIAS,
      { firstName: 'Charlotte', surname: 'Page Wood' },
      {
        sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
      },
    );

    const clients = await new ClientsService().getAllClients({ search: 'michael.wood@gmail.com' });

    expect(clients).toHaveLength(2);
  });

  it('finds a linked client by the alias too', async () => {
    seedClient(
      'charlotte',
      CHARLOTTE_ALIAS,
      { firstName: 'Charlotte', surname: 'Page Wood' },
      {
        sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
      },
    );

    const clients = await new ClientsService().getAllClients({ search: 'charlotte-page-wood' });

    expect(clients.map((c) => c.id)).toEqual(['charlotte']);
  });

  it('agrees with getClientById, so the drawer and the list cannot disagree', async () => {
    const link = {
      contactEmail: MICHAEL_EMAIL,
      signInEmail: CHARLOTTE_ALIAS,
      linkedAt: 'x',
    };
    seedClient('charlotte', CHARLOTTE_ALIAS, { firstName: 'Charlotte' }, { sharedEmail: link });
    getUserById.mockResolvedValueOnce({
      data: {
        user: {
          id: 'charlotte',
          email: CHARLOTTE_ALIAS,
          created_at: '2026-01-01T00:00:00.000Z',
          user_metadata: { firstName: 'Charlotte', role: 'client' },
        },
      },
      error: null,
    });

    const one = await new ClientsService().getClientById('charlotte');
    const [fromList] = await new ClientsService().getAllClients();

    expect(one.email).toBe(fromList.email);
    expect(one.signInEmail).toBe(fromList.signInEmail);
    expect(one.emailIsShared).toBe(true);
  });

  it('ignores a malformed link rather than dropping the address', async () => {
    seedClient(
      'michael',
      MICHAEL_EMAIL,
      { firstName: 'Michael', surname: 'Wood' },
      {
        sharedEmail: { relationship: 'Daughter' },
      },
    );

    const [client] = await new ClientsService().getAllClients();

    expect(client.email).toBe(MICHAEL_EMAIL);
    expect(client.emailIsShared).toBe(false);
  });
});

describe('updateClient', () => {
  it('carries the shared-mailbox link across a wholesale profile replacement', async () => {
    const link = {
      contactEmail: MICHAEL_EMAIL,
      signInEmail: CHARLOTTE_ALIAS,
      relationship: 'Daughter (minor)',
      linkedAt: 'x',
    };
    kvStore.set('user_profile:charlotte:personal_info', {
      personalInformation: { firstName: 'Charlotte' },
      sharedEmail: link,
    });
    getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'charlotte',
          email: CHARLOTTE_ALIAS,
          created_at: '2026-01-01T00:00:00.000Z',
          user_metadata: { firstName: 'Charlotte', role: 'client' },
        },
      },
      error: null,
    });

    // An admin editing the profile sends the whole object back, and it will not
    // contain a field the editor never surfaced.
    const updated = await new ClientsService().updateClient('charlotte', {
      profile: { personalInformation: { firstName: 'Charlie' } },
    } as never);

    expect(
      (kvStore.get('user_profile:charlotte:personal_info') as Record<string, unknown>).sharedEmail,
    ).toMatchObject(link);
    // Which is what keeps her mail pointed at a real inbox after the edit.
    expect(updated.email).toBe(MICHAEL_EMAIL);
  });
});
