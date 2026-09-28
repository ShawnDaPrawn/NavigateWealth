/**
 * ai-intelligence.tsx — who may use the AI Intelligence agent.
 * ============================================================
 *
 * The router authenticates the token itself, then used to decide access from
 * the caller's KV PROFILE role and admit `admin`, `super_admin` and `adviser`.
 * Two problems: the profile is a second copy of the role that can drift from
 * the trusted resolver every auth-mw guard uses, and an adviser was let in
 * with no check that the client was theirs — `/chat` loads the full context of
 * any `clientId` it is given and `/search-clients` searches every profile.
 *
 * The gate now asks `resolveTrustedRole` and admits platform admins only; every
 * caller is in the admin panel. These tests drive the real router with the
 * token → user lookup stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

type StubUser = {
  id: string;
  email: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};
const users = vi.hoisted(() => new Map<string, StubUser>());
// When set, the stubbed AI limiter refuses every request it guards.
const limiter = vi.hoisted(() => ({ exhausted: false }));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = users.get(token);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: {} };
      },
    },
    from: () => ({ select: () => ({ like: async () => ({ data: [], error: null }) }) }),
  }),
}));
vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../auth-mw.ts', () => ({
  AuthError: class extends Error {},
  enforceAccountSecurity: vi.fn(async () => undefined),
}));
vi.mock('../ai-usage-limit.ts', () => ({
  aiUsageLimit:
    () => async (c: { json: (b: unknown, s: number) => Response }, next: () => Promise<void>) =>
      limiter.exhausted ? c.json({ error: 'rate limited' }, 429) : next(),
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const app = (await import('../ai-intelligence.tsx')).default;

const status = (token: string) =>
  app.request('/status', { headers: { Authorization: `Bearer ${token}` } });

beforeEach(() => {
  kvStore.clear();
  users.clear();
  limiter.exhausted = false;
});

describe('AI Intelligence gate', () => {
  it('admits an admin whose role comes from app_metadata', async () => {
    users.set('t-admin', { id: 'a1', email: 'a1@x.co', app_metadata: { role: 'admin' } });
    expect((await status('t-admin')).status).toBe(200);
  });

  it('refuses a client whose KV profile claims admin', async () => {
    // The profile is not the source of truth for a role; the trusted resolver is.
    users.set('t-c', { id: 'c1', email: 'c1@x.co' });
    kvStore.set('user_profile:c1:personal_info', { role: 'admin' });
    expect((await status('t-c')).status).toBe(403);
  });

  it('refuses an adviser — the agent reaches every client, not just theirs', async () => {
    users.set('t-adv', { id: 'adv1', email: 'adv1@x.co', app_metadata: { role: 'adviser' } });
    kvStore.set('user_profile:adv1:personal_info', { role: 'adviser' });
    expect((await status('t-adv')).status).toBe(403);
  });

  it('refuses a role written into user_metadata', async () => {
    users.set('t-meta', { id: 'm1', email: 'm1@x.co', user_metadata: { role: 'admin' } });
    expect((await status('t-meta')).status).toBe(403);
  });

  it('refuses a missing or invalid token', async () => {
    expect((await app.request('/status')).status).toBe(401);
    expect((await status('not-a-session')).status).toBe(401);
  });
});

describe('client search is not an AI call', () => {
  const search = (token: string) =>
    app.request('/search-clients', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm: 'smith' }),
    });

  it('admits the super admin by the owner email alone', async () => {
    users.set('t-owner', { id: 'o1', email: 'shawn@navigatewealth.co' });
    expect((await status('t-owner')).status).toBe(200);
  });

  // Search shared /chat's per-user burst cap, and the RoA client picker spends
  // one per debounced keystroke, so a few lookups locked the super admin out.
  it('still answers when the AI allowance is spent', async () => {
    users.set('t-owner', { id: 'o1', email: 'shawn@navigatewealth.co' });
    limiter.exhausted = true;
    expect((await search('t-owner')).status).toBe(200);
  });
});
