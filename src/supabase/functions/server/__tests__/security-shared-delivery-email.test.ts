/**
 * `resolveDeliveryEmail` — where security mail actually goes.
 *
 * 2FA codes and admin-reset credentials used to be addressed to the Supabase
 * Auth email. For a client enrolled on a household mailbox that address is a
 * derived alias, and sub-addressing is widely but not universally honoured — so
 * a login code could silently fail to arrive, which is a lockout rather than an
 * inconvenience. These flows resolve the contact inbox instead.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/security-shared-delivery-email.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  vi.stubGlobal('Deno', { env: { get: () => 'test-value' } });
});

const kvStore = new Map<string, unknown>();
const kvGet = vi.fn(async (key: string) => {
  const v = kvStore.get(key);
  return v == null ? null : JSON.parse(JSON.stringify(v));
});

vi.mock('../kv_store.tsx', () => ({
  get: kvGet,
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, value);
  }),
  del: vi.fn(async () => {}),
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

vi.mock('../email-service.ts', () => ({
  sendEmail: vi.fn(async () => ({ success: true })),
  createEmailTemplate: vi.fn(() => '<html></html>'),
  getFooterSettings: vi.fn(async () => ({})),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ auth: { admin: {} } }),
}));

const { resolveDeliveryEmail, updateStoredPrimaryEmail } = await import('../security-shared.ts');

const MICHAEL_EMAIL = 'michael.wood@gmail.com';
const CHARLOTTE_ALIAS = 'michael.wood+charlotte-page-wood@gmail.com';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('resolveDeliveryEmail', () => {
  it('returns the auth email for a client that owns its mailbox', async () => {
    kvStore.set('user_profile:michael:personal_info', { personalInformation: {} });

    expect(await resolveDeliveryEmail('michael', MICHAEL_EMAIL)).toBe(MICHAEL_EMAIL);
  });

  it('returns the guardian inbox for a linked client, not the alias', async () => {
    kvStore.set('user_profile:charlotte:personal_info', {
      sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
    });

    expect(await resolveDeliveryEmail('charlotte', CHARLOTTE_ALIAS)).toBe(MICHAEL_EMAIL);
  });

  it('falls back to the auth email when there is no profile', async () => {
    expect(await resolveDeliveryEmail('nobody', MICHAEL_EMAIL)).toBe(MICHAEL_EMAIL);
  });

  it('still returns an address when the profile read throws', async () => {
    kvGet.mockRejectedValueOnce(new Error('kv unavailable'));

    // A 2FA code with no recipient is a lockout, so a KV outage must degrade to
    // the auth email rather than to nothing.
    expect(await resolveDeliveryEmail('charlotte', CHARLOTTE_ALIAS)).toBe(CHARLOTTE_ALIAS);
  });
});

describe('updateStoredPrimaryEmail', () => {
  it('drops a shared-mailbox link when the client moves to their own address', async () => {
    kvStore.set('user_profile:charlotte:personal_info', {
      personalInformation: { firstName: 'Charlotte' },
      sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
    });

    await updateStoredPrimaryEmail('charlotte', 'charlotte@her-own-domain.co.za');

    // Keeping the link would carry on routing her mail to the guardian she has
    // just moved off.
    const profile = kvStore.get('user_profile:charlotte:personal_info') as Record<string, unknown>;
    expect(profile.sharedEmail).toBeUndefined();
    expect(profile.email).toBe('charlotte@her-own-domain.co.za');
  });

  it('keeps the link when the address is the shared mailbox itself', async () => {
    kvStore.set('user_profile:charlotte:personal_info', {
      sharedEmail: { contactEmail: MICHAEL_EMAIL, signInEmail: CHARLOTTE_ALIAS, linkedAt: 'x' },
    });

    await updateStoredPrimaryEmail('charlotte', 'Michael.Wood@Gmail.com');

    const profile = kvStore.get('user_profile:charlotte:personal_info') as Record<string, unknown>;
    expect(profile.sharedEmail).toBeDefined();
  });
});
