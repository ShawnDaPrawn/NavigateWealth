/**
 * Household mailboxes in admin client onboarding.
 *
 * The scenario these lock down is the one that broke in production: Charlotte,
 * a minor, was enrolled on her father Michael's email. Supabase Auth allows one
 * account per address, so Charlotte's record consumed the address and Michael —
 * the actual mailbox owner and the fee-paying client — could not be onboarded
 * at all. The advisory relationship is with two people; the constraint is on
 * mailboxes, not on people.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/admin-client-onboarding-shared-mailbox.contract.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

// ── In-memory KV ─────────────────────────────────────────────────────────────
const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

const defaultKvSet = async (key: string, value: unknown) => {
  kvStore.set(key, clone(value));
};
const kvSet = vi.fn(defaultKvSet);

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
  set: kvSet,
  del: vi.fn(async (key: string) => {
    kvStore.delete(key);
  }),
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

vi.mock('../application-number-utils.ts', () => ({
  generateApplicationNumber: vi.fn(async () => 'NW-TEST-0001'),
}));

// ── Supabase Auth double ─────────────────────────────────────────────────────
// Models the one behaviour that matters here: a UNIQUE index on email.
interface FakeUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
}

const authUsers = new Map<string, FakeUser>();
let nextUserId = 1;

const duplicateEmailError = () =>
  Object.assign(new Error('A user with this email address has already been registered'), {
    status: 422,
    code: 'email_exists',
  });

const findByEmail = (email: string) =>
  [...authUsers.values()].find((u) => u.email === email.trim().toLowerCase());

const admin = {
  createUser: vi.fn(async (opts: { email: string; user_metadata?: Record<string, unknown> }) => {
    const email = opts.email.trim().toLowerCase();
    if (findByEmail(email)) return { data: null, error: duplicateEmailError() };

    const user: FakeUser = {
      id: `user-${nextUserId++}`,
      email,
      user_metadata: opts.user_metadata ?? {},
    };
    authUsers.set(user.id, user);
    return { data: { user }, error: null };
  }),

  getUserById: vi.fn(async (id: string) => {
    const user = authUsers.get(id);
    return user ? { data: { user }, error: null } : { data: null, error: new Error('not found') };
  }),

  updateUserById: vi.fn(
    async (id: string, updates: { email?: string; user_metadata?: Record<string, unknown> }) => {
      const user = authUsers.get(id);
      if (!user) return { data: null, error: new Error('not found') };

      if (updates.email) {
        const email = updates.email.trim().toLowerCase();
        const holder = findByEmail(email);
        if (holder && holder.id !== id) return { data: null, error: duplicateEmailError() };
        user.email = email;
      }
      if (updates.user_metadata) user.user_metadata = updates.user_metadata;
      return { data: { user }, error: null };
    },
  ),

  listUsers: vi.fn(async () => ({ data: { users: [...authUsers.values()] }, error: null })),
};

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin } }),
}));

const { AdminClientOnboardingService } = await import('../admin-client-onboarding-service.ts');

const ADMIN_ID = 'admin-1';
const MICHAEL_EMAIL = 'michael.wood@gmail.com';

const michael = {
  firstName: 'Michael',
  lastName: 'Wood',
  emailAddress: MICHAEL_EMAIL,
  cellphoneNumber: '+27 82 123 4567',
};

const charlotte = {
  firstName: 'Charlotte',
  lastName: 'Page Wood',
  emailAddress: MICHAEL_EMAIL,
  cellphoneNumber: '+27 82 123 4567',
};

const profileOf = (userId: string) =>
  kvStore.get(`user_profile:${userId}:personal_info`) as Record<string, any> | undefined;

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
  nextUserId = 1;
  vi.clearAllMocks();
  // clearAllMocks resets call history, not implementations — a test that swaps
  // one in would otherwise leak it into every test that follows.
  kvSet.mockImplementation(defaultKvSet);
});

describe('addClient — a client that owns its mailbox', () => {
  it('signs in with the address the admin typed', async () => {
    const result = await AdminClientOnboardingService.addClient(michael, ADMIN_ID);

    expect(result.success).toBe(true);
    expect(result.signInEmail).toBe(MICHAEL_EMAIL);
    expect(result.contactEmail).toBe(MICHAEL_EMAIL);
    // No link is written, so nothing downstream has to reason about one.
    expect(profileOf(result.userId!)?.sharedEmail).toBeUndefined();
  });
});

describe('addClient — a duplicate the admin has not explained', () => {
  it('still refuses, and names who holds the address', async () => {
    await AdminClientOnboardingService.addClient(michael, ADMIN_ID);

    const result = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('EMAIL_EXISTS');
    // "Already exists" alone cannot distinguish a re-entered client from a
    // household sharing an inbox. Naming the holder is what lets the admin
    // decide, so it is part of the contract, not a nicety.
    expect(result.conflictingClient).toMatchObject({
      name: 'Michael Wood',
      email: MICHAEL_EMAIL,
    });
  });
});

describe('addClient — a confirmed household mailbox', () => {
  it('creates the second client against a derived alias', async () => {
    await AdminClientOnboardingService.addClient(michael, ADMIN_ID);

    const result = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true, relationshipToEmailOwner: 'Daughter (minor)' },
      ADMIN_ID,
    );

    expect(result.success).toBe(true);
    expect(result.signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');
    // The contact address is unchanged — mail still reaches the father.
    expect(result.contactEmail).toBe(MICHAEL_EMAIL);
  });

  it('leaves the mailbox owner untouched', async () => {
    const owner = await AdminClientOnboardingService.addClient(michael, ADMIN_ID);
    await AdminClientOnboardingService.addClient({ ...charlotte, emailIsShared: true }, ADMIN_ID);

    expect(authUsers.get(owner.userId!)?.email).toBe(MICHAEL_EMAIL);
  });

  it('records the link on the profile so mail resolves to the real inbox', async () => {
    const result = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true, relationshipToEmailOwner: 'Daughter (minor)' },
      ADMIN_ID,
    );

    const profile = profileOf(result.userId!);
    expect(profile?.sharedEmail).toMatchObject({
      contactEmail: MICHAEL_EMAIL,
      signInEmail: 'michael.wood+charlotte-page-wood@gmail.com',
      relationship: 'Daughter (minor)',
      linkedBy: ADMIN_ID,
    });
    // The profile's own contact field stays the real address too, so anything
    // reading the profile directly agrees with `resolveContactEmail`.
    expect(profile?.personalInformation?.email).toBe(MICHAEL_EMAIL);
  });

  it('works when the address is free — the flag describes the household, not the conflict', async () => {
    const result = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true },
      ADMIN_ID,
    );

    expect(result.success).toBe(true);
    expect(result.signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');
  });

  it('numbers the alias when two household members slugify identically', async () => {
    const first = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true },
      ADMIN_ID,
    );
    const second = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true },
      ADMIN_ID,
    );

    expect(first.signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');
    expect(second.signInEmail).toBe('michael.wood+charlotte-page-wood-2@gmail.com');
  });

  it('does not nest tags when linking a sibling off an already-linked address', async () => {
    const sibling = await AdminClientOnboardingService.addClient(
      {
        firstName: 'Thomas',
        lastName: 'Wood',
        emailAddress: 'michael.wood+charlotte-page-wood@gmail.com',
        cellphoneNumber: '+27 82 123 4567',
        emailIsShared: true,
      },
      ADMIN_ID,
    );

    expect(sibling.signInEmail).toBe('michael.wood+thomas-wood@gmail.com');
  });

  it('gives up after a bounded number of attempts rather than looping', async () => {
    for (let i = 0; i < 5; i++) {
      await AdminClientOnboardingService.addClient({ ...charlotte, emailIsShared: true }, ADMIN_ID);
    }

    const result = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true },
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('EMAIL_EXISTS');
  });

  it('does not retry a failure that is not a duplicate', async () => {
    admin.createUser.mockImplementationOnce(async () => ({
      data: null,
      error: Object.assign(new Error('Auth service unavailable'), { status: 503 }),
    }));

    const result = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailIsShared: true },
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_ERROR');
    expect(admin.createUser).toHaveBeenCalledTimes(1);
  });
});

describe('linkExistingClientToSharedMailbox — the repair for existing records', () => {
  it('frees the address held by a dependant so its owner can be onboarded', async () => {
    // Charlotte was captured first, on her father's address.
    const charlotteResult = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    expect(charlotteResult.success).toBe(true);

    // Which is exactly why Michael cannot be added.
    const blocked = await AdminClientOnboardingService.addClient(michael, ADMIN_ID);
    expect(blocked.errorCode).toBe('EMAIL_EXISTS');

    const link = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      charlotteResult.userId!,
      ADMIN_ID,
      { relationship: 'Daughter (minor)' },
    );

    expect(link.success).toBe(true);
    expect(link.freedEmail).toBe(MICHAEL_EMAIL);
    expect(link.signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');

    // The whole point: Michael now onboards on his own address.
    const michaelResult = await AdminClientOnboardingService.addClient(michael, ADMIN_ID);
    expect(michaelResult.success).toBe(true);
    expect(michaelResult.signInEmail).toBe(MICHAEL_EMAIL);
  });

  it('keeps the dependant reachable at the same inbox', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    await AdminClientOnboardingService.linkExistingClientToSharedMailbox(created.userId!, ADMIN_ID);

    const profile = profileOf(created.userId!);
    expect(profile?.sharedEmail?.contactEmail).toBe(MICHAEL_EMAIL);
    expect(profile?.personalInformation?.email).toBe(MICHAEL_EMAIL);
  });

  it('is idempotent — re-running does not push the client onto a second alias', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    const first = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );
    const second = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );

    expect(second.alreadyLinked).toBe(true);
    expect(second.signInEmail).toBe(first.signInEmail);
    expect(authUsers.get(created.userId!)?.email).toBe(first.signInEmail);
  });

  it('reports a missing client rather than throwing', async () => {
    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      'no-such-user',
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NOT_FOUND');
  });
});

describe('bulkAddClients — a household book', () => {
  it('skips duplicate rows by default, so a twice-listed client is not cloned', async () => {
    const result = await AdminClientOnboardingService.bulkAddClients(
      [michael, charlotte],
      ADMIN_ID,
    );

    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[1].status).toBe('skipped');
  });

  it('links duplicate rows when the admin opts in', async () => {
    const result = await AdminClientOnboardingService.bulkAddClients(
      [michael, charlotte],
      ADMIN_ID,
      { linkDuplicateEmails: true },
    );

    expect(result.succeeded).toBe(2);
    expect(result.results[1].status).toBe('success');
    expect(result.results[1].signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');
  });

  it('attributes the link to the client that already held the address', async () => {
    const result = await AdminClientOnboardingService.bulkAddClients(
      [michael, charlotte],
      ADMIN_ID,
      { linkDuplicateEmails: true },
    );

    const linked = profileOf(result.results[1].userId!);
    expect(linked?.sharedEmail?.ownerUserId).toBe(result.results[0].userId);
  });
});

describe('linkExistingClientToSharedMailbox — who may be re-keyed', () => {
  it('refuses a personnel account, whose login is not ours to change', async () => {
    const adviser = await AdminClientOnboardingService.addClient(
      { ...michael, emailAddress: 'adviser@navigatewealth.co' },
      ADMIN_ID,
    );
    kvStore.set(`personnel:profile:${adviser.userId}`, { id: adviser.userId, role: 'adviser' });

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      adviser.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NOT_A_CLIENT');
    expect(authUsers.get(adviser.userId!)?.email).toBe('adviser@navigatewealth.co');
  });

  it('refuses the super admin, whose address is the authorization allowlist', async () => {
    const superAdmin = await AdminClientOnboardingService.addClient(
      { ...michael, emailAddress: 'shawn@navigatewealth.co' },
      ADMIN_ID,
    );

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      superAdmin.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('NOT_A_CLIENT');
    // Re-keying this address would have revoked their own access.
    expect(authUsers.get(superAdmin.userId!)?.email).toBe('shawn@navigatewealth.co');
  });

  it('tells the caller when a duplicate is held by staff, so no re-key is offered', async () => {
    const adviser = await AdminClientOnboardingService.addClient(
      { ...michael, emailAddress: 'adviser@navigatewealth.co' },
      ADMIN_ID,
    );
    kvStore.set(`personnel:profile:${adviser.userId}`, { id: adviser.userId, role: 'adviser' });

    const blocked = await AdminClientOnboardingService.addClient(
      { ...charlotte, emailAddress: 'adviser@navigatewealth.co' },
      ADMIN_ID,
    );

    expect(blocked.conflictingClient?.isClient).toBe(false);
  });

  it('marks an ordinary client holder as re-keyable', async () => {
    await AdminClientOnboardingService.addClient(michael, ADMIN_ID);
    const blocked = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);

    expect(blocked.conflictingClient?.isClient).toBe(true);
  });
});

describe('linkExistingClientToSharedMailbox — a failure between the two writes', () => {
  it('leaves the sign-in email alone when the link cannot be recorded', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    kvSet.mockRejectedValueOnce(new Error('kv unavailable'));

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PROFILE_WRITE_FAILED');
    // Nothing was half-done: the client still signs in with the address they had.
    expect(authUsers.get(created.userId!)?.email).toBe(MICHAEL_EMAIL);
  });

  it('recovers the real mailbox on retry when Auth changed but the link never finalised', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);

    // The window the write order leaves open: the marker is down, Auth is
    // re-keyed, and the finalising write never landed.
    authUsers.get(created.userId!)!.email = 'michael.wood+charlotte-page-wood@gmail.com';
    kvStore.set(`user_profile:${created.userId}:personal_info`, {
      personalInformation: { firstName: 'Charlotte', lastName: 'Page Wood' },
      sharedEmail: {
        contactEmail: MICHAEL_EMAIL,
        signInEmail: '',
        linkedAt: '2026-09-03T00:00:00.000Z',
        linkedBy: ADMIN_ID,
      },
    });

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(true);
    // Reading the mailbox back off the marker is the whole point: deriving it
    // from the CURRENT address would record the alias as the contact address
    // and lose the father's inbox for good.
    expect(result.contactEmail).toBe(MICHAEL_EMAIL);
    expect(result.signInEmail).toBe('michael.wood+charlotte-page-wood@gmail.com');
    expect(profileOf(created.userId!)?.sharedEmail).toMatchObject({
      contactEmail: MICHAEL_EMAIL,
      signInEmail: 'michael.wood+charlotte-page-wood@gmail.com',
    });
  });

  it('writes the mailbox marker before touching Auth, never after', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);

    const order: string[] = [];
    kvSet.mockImplementation(async (key: string, value: unknown) => {
      if (key.endsWith(':personal_info')) order.push('profile');
      kvStore.set(key, clone(value));
    });
    admin.updateUserById.mockImplementationOnce(async (id: string, updates: { email?: string }) => {
      order.push('auth');
      const u = authUsers.get(id)!;
      if (updates.email) u.email = updates.email;
      return { data: { user: u }, error: null };
    });

    await AdminClientOnboardingService.linkExistingClientToSharedMailbox(created.userId!, ADMIN_ID);

    // An Auth email changed but never recorded loses the only copy of the real
    // inbox; a marker written but never used resolves to the same address it
    // already had. The order is chosen for which failure is survivable.
    expect(order).toEqual(['profile', 'auth', 'profile']);
  });

  it('rolls the marker back when the Auth update fails outright', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    admin.updateUserById.mockImplementationOnce(async () => ({
      data: null,
      error: Object.assign(new Error('Auth service unavailable'), { status: 503 }),
    }));

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTH_ERROR');
    // No link describing a re-key that never happened.
    expect(profileOf(created.userId!)?.sharedEmail).toBeUndefined();
    expect(authUsers.get(created.userId!)?.email).toBe(MICHAEL_EMAIL);
  });

  it('records the link even when the client had no profile row at all', async () => {
    const created = await AdminClientOnboardingService.addClient(charlotte, ADMIN_ID);
    kvStore.delete(`user_profile:${created.userId}:personal_info`);

    const result = await AdminClientOnboardingService.linkExistingClientToSharedMailbox(
      created.userId!,
      ADMIN_ID,
    );

    expect(result.success).toBe(true);
    // Without somewhere to record it, contact resolution would fall back to the
    // alias forever — so a minimal profile is created to hold the mapping.
    expect(profileOf(created.userId!)?.sharedEmail?.contactEmail).toBe(MICHAEL_EMAIL);
  });
});
