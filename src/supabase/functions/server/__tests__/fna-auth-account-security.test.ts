/**
 * Account-security enforcement on the FNA gateway (P1.5)
 * ======================================================
 *
 * Suspending an account does NOT invalidate a JWT that has already been issued.
 * So "suspended" is only real if it is checked on the request path — and
 * `fna-auth.authenticateUser` never checked it. It validated the token,
 * resolved the role, and returned. Every route behind it — 14 modules covering
 * FNA, tax, estate planning, wills and form-prefill, i.e. client financial and
 * medical data — stayed fully open to a suspended or deleted user for as long
 * as their existing token remained valid.
 *
 * `auth-mw`'s routes have enforced this the whole time. This pins that the FNA
 * gateway now applies the SAME policy rather than a second, weaker copy.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/fna-auth-account-security.test.ts
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

const securityRecords = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => securityRecords.get(key) ?? null),
  set: vi.fn(async () => {}),
  del: vi.fn(async () => {}),
  mget: vi.fn(async () => []),
  getByPrefix: vi.fn(async () => []),
  listByPrefix: vi.fn(async () => []),
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

const getUser = vi.fn();
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }),
}));

const { authenticateUser, fnaErrorResponse } = await import('../fna-auth.ts');
const { AuthError } = await import('../auth-mw.ts');

const ACTIVE_USER = {
  id: 'user-1',
  email: 'client@example.com',
  app_metadata: {},
  user_metadata: {},
};

beforeEach(() => {
  securityRecords.clear();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: ACTIVE_USER }, error: null });
});

describe('fna-auth applies the shared account-security policy', () => {
  it('authenticates a user with no security record', async () => {
    const user = await authenticateUser('Bearer valid-token', 'fna');
    expect(user.id).toBe('user-1');
  });

  it('authenticates a user whose record is present but clean', async () => {
    securityRecords.set('security:user-1', { suspended: false, deleted: false });
    await expect(authenticateUser('Bearer valid-token', 'fna')).resolves.toMatchObject({
      id: 'user-1',
    });
  });

  it('REJECTS a suspended user holding a still-valid token', async () => {
    securityRecords.set('security:user-1', { suspended: true });
    await expect(authenticateUser('Bearer valid-token', 'fna')).rejects.toThrow(
      'Account is suspended',
    );
  });

  it('REJECTS a deleted user holding a still-valid token', async () => {
    securityRecords.set('security:user-1', { deleted: true });
    await expect(authenticateUser('Bearer valid-token', 'fna')).rejects.toThrow(
      'Account is closed',
    );
  });

  it('rejects a 2FA user whose verification has gone stale', async () => {
    securityRecords.set('security:user-1', {
      twoFactorEnabled: true,
      last2faVerifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    await expect(authenticateUser('Bearer valid-token', 'fna')).rejects.toThrow(
      'Two-factor verification required',
    );
  });

  it('admits a 2FA user verified within the grace window', async () => {
    securityRecords.set('security:user-1', {
      twoFactorEnabled: true,
      last2faVerifiedAt: new Date().toISOString(),
    });
    await expect(authenticateUser('Bearer valid-token', 'fna')).resolves.toMatchObject({
      id: 'user-1',
    });
  });
});

describe('the rejection reaches the client with its reason intact', () => {
  const context = () =>
    ({
      json: (body: unknown, status?: number) => ({ body, status: status ?? 200 }),
    }) as never;

  it('maps a suspension to 403 with its code, not a generic 401', async () => {
    // Flattening this to 401 would tell a suspended user to log in again, which
    // sends them round a loop that cannot succeed.
    const res = fnaErrorResponse(
      context(),
      new AuthError('Account is suspended', 403, 'ACCOUNT_SUSPENDED'),
    ) as unknown as { body: { error: string; code: string }; status: number };

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('preserves TWO_FACTOR_REQUIRED, which AuthContext keys off', async () => {
    const res = fnaErrorResponse(
      context(),
      new AuthError('Two-factor verification required', 403, 'TWO_FACTOR_REQUIRED'),
    ) as unknown as { body: { code: string }; status: number };

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('still maps a plain auth failure to 401', async () => {
    const res = fnaErrorResponse(context(), new Error('Unauthorized')) as unknown as {
      status: number;
    };
    expect(res.status).toBe(401);
  });
});
