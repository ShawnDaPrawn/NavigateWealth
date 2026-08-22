/**
 * Form prefill follows the shared client-access policy (S16).
 * ===========================================================
 *
 * Prefill used to allow any adviser to prefill any client, documented as a
 * deliberate looseness. That was coherent while nothing else enforced
 * assignment. P1.4 changed the facts: the FNA family now requires one, and
 * prefill reads `user_profile:{clientId}:personal_info`, `client_keys` and
 * `policies:{clientId}` — the same PII — returning it as proposed field values.
 *
 * So an adviser refused client B's FNA could call `POST /form-prefill/resolve`
 * with B's id and read B's personal information, ID number and policies out of
 * the response. The two policies disagreeing was a bypass of whichever was
 * stricter, not a style difference.
 *
 * THE CONSTRAINT THIS FILE EXISTS TO PIN
 * --------------------------------------
 * Tightening adviser access must not touch platform administrators. Super
 * admins reach every client through `isPlatformAdminRole`, which is checked
 * BEFORE any adviser resolution runs — and a super-admin identity resolves via
 * `resolveTrustedRole`'s email allowlist to `super_admin`. Both spellings of
 * the role and the allowlist path are asserted below, so "did not break super
 * admin" is a test result rather than a claim.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const resolveAdviser = vi.hoisted(() => vi.fn());
vi.mock('../fna-intake-adviser-resolver.ts', () => ({
  resolveClientAdviserUserId: (...a: unknown[]) => resolveAdviser(...a),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({ createClient: vi.fn() }));

import { assertPrefillClientAccess, requirePrefillUser } from '../form-prefill-auth.ts';
import { FnaIntakeError } from '../fna-intake-errors.ts';
import type { FNAAuthUser } from '../fna-auth.ts';

const CLIENT = 'client-1';

function user(id: string, role: string): FNAAuthUser {
  return { id, email: `${id}@example.com`, role };
}

beforeEach(() => {
  resolveAdviser.mockReset();
  resolveAdviser.mockResolvedValue(null);
});

describe('platform administrators are untouched', () => {
  it.each(['super_admin', 'super-admin', 'admin'])(
    'allows %s across every client, with no assignment on record',
    async (role) => {
      await expect(assertPrefillClientAccess(user('boss', role), CLIENT)).resolves.toBeUndefined();
      // The decisive part: it never even asks who the adviser is.
      expect(resolveAdviser).not.toHaveBeenCalled();
    },
  );

  it('allows a super admin even when the resolver would name someone else', async () => {
    resolveAdviser.mockResolvedValue('adviser-9');

    await expect(
      assertPrefillClientAccess(user('boss', 'super_admin'), CLIENT),
    ).resolves.toBeUndefined();
  });

  it('keeps the allowlist path working', async () => {
    // `resolveTrustedRole` maps an allowlisted email to exactly 'super_admin',
    // which is the string asserted above. If that mapping ever changes, this
    // pairing is where it should be noticed.
    const { resolveTrustedRole } = await import('../constants.ts');
    const resolved = resolveTrustedRole({
      email: 'nobody@example.com',
      app_metadata: { role: 'super_admin' },
      user_metadata: {},
    } as never);

    expect(resolved).toBe('super_admin');
    await expect(
      assertPrefillClientAccess(user('boss', resolved), CLIENT),
    ).resolves.toBeUndefined();
  });
});

describe('advisers are now scoped to their own book', () => {
  it('allows the assigned adviser', async () => {
    resolveAdviser.mockResolvedValue('adviser-1');

    await expect(
      assertPrefillClientAccess(user('adviser-1', 'adviser'), CLIENT),
    ).resolves.toBeUndefined();
  });

  it('refuses an adviser who is not the one assigned', async () => {
    // The bypass this closes.
    resolveAdviser.mockResolvedValue('adviser-1');

    await expect(
      assertPrefillClientAccess(user('adviser-2', 'adviser'), CLIENT),
    ).rejects.toBeInstanceOf(FnaIntakeError);
  });

  it('refuses an adviser when the client has no assignment on record', async () => {
    resolveAdviser.mockResolvedValue(null);

    await expect(
      assertPrefillClientAccess(user('adviser-1', 'adviser'), CLIENT),
    ).rejects.toBeInstanceOf(FnaIntakeError);
  });

  it('allows a client to prefill their own record', async () => {
    await expect(
      assertPrefillClientAccess(user(CLIENT, 'client'), CLIENT),
    ).resolves.toBeUndefined();
  });
});

describe('the denial keeps its old shape', () => {
  it('throws a 403 FnaIntakeError, not the shared ClientAccessError', async () => {
    // Both prefill route files map FnaIntakeError to its own status and
    // everything else to a 500. Letting ClientAccessError escape would turn a
    // deliberate 403 into an opaque server fault.
    const error = await assertPrefillClientAccess(user('adviser-2', 'adviser'), CLIENT).catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(FnaIntakeError);
    expect((error as FnaIntakeError & { status: number }).status).toBe(403);
    expect(error.constructor.name).not.toBe('ClientAccessError');
  });

  it('denies a missing client id rather than resolving it to nothing', async () => {
    await expect(assertPrefillClientAccess(user('boss', 'admin'), '')).rejects.toBeInstanceOf(
      FnaIntakeError,
    );
  });
});

describe('requirePrefillUser still gates the workflow itself', () => {
  it('admits the roles isFnaAdminRole admits', () => {
    for (const role of ['admin', 'super_admin', 'super-admin', 'adviser']) {
      expect(() => requirePrefillUser(user('someone', role))).not.toThrow();
    }
  });

  it('keeps refusing the other personnel roles', () => {
    // Unchanged by this work — paraplanner/compliance/viewer never had prefill.
    for (const role of ['paraplanner', 'compliance', 'viewer', 'client']) {
      expect(() => requirePrefillUser(user('someone', role))).toThrow();
    }
  });
});
