/**
 * Cron authentication — the guard that replaced four drifting copies.
 * ==================================================================
 *
 * On 2026-08-25 every scheduled endpoint whose only auth was
 * `token === SUPABASE_SERVICE_ROLE_KEY` was answering 401 to its own cron job,
 * and had been for as long as the logs retain. The comparison was correct; the
 * two sides simply held different strings. Nothing reported it, because pg_cron
 * marks `net.http_post` succeeded as soon as the request is enqueued.
 *
 * These tests pin the properties that make the replacement safe to rely on:
 * the Vault branch is tried first, an infrastructure failure in that branch
 * does NOT take every job down, and — the one that matters most — an absent
 * env secret can never be matched by an absent credential.
 */
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());

beforeAll(() => {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) =>
        ({
          SUPABASE_URL: 'https://test',
          SUPABASE_SERVICE_ROLE_KEY: 'env-service-role-key',
          SUPER_ADMIN_PASSWORD: 'env-super-admin-password',
        })[name] ?? '',
    },
  });
});

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }),
}));

const { isAuthorizedCronRequest, requireCronAuth, CRON_AUTH_HEADER } =
  await import('../cron-auth.ts');

/** Minimal stand-in for the slice of Hono's Context the guard reads. */
function ctx(headers: Record<string, string>) {
  return {
    req: {
      header: (name: string) => headers[name.toLowerCase()],
    },
  };
}

beforeEach(() => {
  rpc.mockReset();
});

describe('isAuthorizedCronRequest — Vault branch', () => {
  it('authorizes when the oracle confirms the shared token', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await expect(isAuthorizedCronRequest(ctx({ [CRON_AUTH_HEADER]: 'the-token' }))).resolves.toBe(
      true,
    );
    expect(rpc).toHaveBeenCalledWith('verify_cron_auth_token', { candidate: 'the-token' });
  });

  it('is checked before the env branch, so a stale env key cannot block a valid job', async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    // No Authorization header at all — the Vault token alone must suffice.
    await expect(isAuthorizedCronRequest(ctx({ [CRON_AUTH_HEADER]: 'the-token' }))).resolves.toBe(
      true,
    );
  });

  it('rejects a shared token the oracle does not recognise', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(isAuthorizedCronRequest(ctx({ [CRON_AUTH_HEADER]: 'guessed' }))).resolves.toBe(
      false,
    );
  });

  it('does not call the oracle when no shared token is present', async () => {
    await expect(isAuthorizedCronRequest(ctx({}))).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('isAuthorizedCronRequest — the Vault branch fails open to the env branch', () => {
  // Deliberate: a PostgREST blip must not 401 every scheduled job at once.
  // The request still has to carry a valid service-role bearer to get through.
  it('falls through to the env branch when the oracle errors', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'PostgREST unavailable' } });

    await expect(
      isAuthorizedCronRequest(
        ctx({ [CRON_AUTH_HEADER]: 'the-token', authorization: 'Bearer env-service-role-key' }),
      ),
    ).resolves.toBe(true);
  });

  it('falls through to the env branch when the oracle throws', async () => {
    rpc.mockRejectedValue(new Error('socket hang up'));

    await expect(
      isAuthorizedCronRequest(
        ctx({ [CRON_AUTH_HEADER]: 'the-token', authorization: 'Bearer env-service-role-key' }),
      ),
    ).resolves.toBe(true);
  });

  it('still rejects when the oracle errors and no valid bearer is supplied', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'PostgREST unavailable' } });

    await expect(isAuthorizedCronRequest(ctx({ [CRON_AUTH_HEADER]: 'the-token' }))).resolves.toBe(
      false,
    );
  });
});

describe('isAuthorizedCronRequest — env fallback', () => {
  it('accepts the service-role key as a bearer', async () => {
    await expect(
      isAuthorizedCronRequest(ctx({ authorization: 'Bearer env-service-role-key' })),
    ).resolves.toBe(true);
  });

  it('accepts the super-admin password as a bearer', async () => {
    await expect(
      isAuthorizedCronRequest(ctx({ authorization: 'Bearer env-super-admin-password' })),
    ).resolves.toBe(true);
  });

  it('is case-insensitive about the Bearer prefix', async () => {
    await expect(
      isAuthorizedCronRequest(ctx({ authorization: 'bearer env-service-role-key' })),
    ).resolves.toBe(true);
  });

  it('rejects a wrong bearer', async () => {
    await expect(isAuthorizedCronRequest(ctx({ authorization: 'Bearer nope' }))).resolves.toBe(
      false,
    );
  });

  it('rejects a bare Authorization header with no token', async () => {
    await expect(isAuthorizedCronRequest(ctx({ authorization: 'Bearer ' }))).resolves.toBe(false);
  });
});

describe('isAuthorizedCronRequest — unset secrets must not become a wildcard', () => {
  it('rejects an empty credential when the env secrets are unset', async () => {
    // Three independent things enforce this, which is why mutating any single
    // one of them still passes: the `if (!bearer) return false` early exit, the
    // `!== ''` guards, and `constantTimeEqual`'s length check. Verified by
    // mutation on 2026-08-25 — removing the early exit alone survives, removing
    // the guards alone survives, and replacing `constantTimeEqual` with `===`
    // (which drops the length check too) fails this test and one other.
    //
    // So this test pins the PROPERTY, not one guard. That is the useful thing
    // to assert: with the env unset, a caller who supplies nothing must not be
    // authorized, however that ends up being enforced.
    vi.stubGlobal('Deno', { env: { get: () => '' } });
    vi.resetModules();
    const fresh = await import('../cron-auth.ts');

    await expect(fresh.isAuthorizedCronRequest(ctx({ authorization: 'Bearer ' }))).resolves.toBe(
      false,
    );
    await expect(fresh.isAuthorizedCronRequest(ctx({}))).resolves.toBe(false);
  });
});

describe('requireCronAuth middleware', () => {
  it('calls next() when authorized', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const next = vi.fn();

    await requireCronAuth(
      // deno-lint-ignore no-explicit-any
      ctx({ [CRON_AUTH_HEADER]: 'the-token' }) as any,
      next as never,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 without calling next() when unauthorized', async () => {
    const next = vi.fn();
    const json = vi.fn((body: unknown, status: number) => ({ body, status }));

    const result = await requireCronAuth(
      // deno-lint-ignore no-explicit-any
      { ...ctx({}), json } as any,
      next as never,
    );

    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      { error: expect.stringContaining('cron auth required'), code: 'CRON_AUTH_REQUIRED' },
      401,
    );
    expect(result).toEqual({ body: expect.anything(), status: 401 });
  });
});
