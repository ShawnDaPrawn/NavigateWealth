/**
 * Public form rate limiting — SECURITY-AUDIT S11 regression guard
 * ===============================================================
 *
 * The limit on the three public lead-gen forms keyed on the submitted email
 * address alone. That address is chosen by the same anonymous caller the limit
 * restrains, so incrementing one character produced a fresh bucket and the
 * limit bounded nothing. The load-bearing assertion in this file is
 * `rotating the email address no longer grants a fresh budget`.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/public-form-rate-limit.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** In-memory stand-in for the KV store, keyed exactly as the repository keys it. */
let store = new Map<string, unknown>();
let failStore = false;

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => {
    if (failStore) throw new Error('KV unavailable');
    return store.get(key) ?? null;
  }),
  set: vi.fn(async (key: string, value: unknown) => {
    if (failStore) throw new Error('KV unavailable');
    store.set(key, value);
  }),
  del: vi.fn(),
  getByPrefix: vi.fn(async () => []),
  listByPrefix: vi.fn(async () => ({ items: [], nextCursor: null })),
  mget: vi.fn(async () => []),
  mset: vi.fn(),
  mdel: vi.fn(),
}));

import {
  checkPublicFormRateLimit,
  EMAIL_LIMIT_PER_HOUR,
  IP_LIMIT_PER_HOUR,
} from '../public-form-rate-limit.ts';

/** Header accessor for a caller at a given IP; `null` mimics a stripped proxy header. */
const from = (ip: string | null) => (headerName: string) =>
  headerName.toLowerCase() === 'x-forwarded-for' ? ip : null;

beforeEach(() => {
  store = new Map();
  failStore = false;
});

describe('email dimension', () => {
  it('admits up to the budget, then rejects', async () => {
    for (let i = 0; i < EMAIL_LIMIT_PER_HOUR; i++) {
      const result = await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    expect(blocked).toEqual({ allowed: false, limitedBy: 'email' });
  });

  it('treats addresses case-insensitively, as the previous implementation did', async () => {
    for (let i = 0; i < EMAIL_LIMIT_PER_HOUR; i++) {
      await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    }

    const blocked = await checkPublicFormRateLimit('contact', 'A@Example.COM', from('1.1.1.1'));
    expect(blocked.allowed).toBe(false);
  });

  it('keeps scopes independent so one form cannot exhaust another', async () => {
    for (let i = 0; i < EMAIL_LIMIT_PER_HOUR; i++) {
      await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    }

    const other = await checkPublicFormRateLimit('quote', 'a@example.com', from('1.1.1.1'));
    expect(other.allowed).toBe(true);
  });

  it('writes buckets under the rate_limit: prefix the cleanup service sweeps', async () => {
    // kv-cleanup-service.ts expires these by prefix; a changed key shape would
    // orphan every bucket this module writes.
    await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    expect([...store.keys()]).toContain('rate_limit:contact:a@example.com');
  });
});

describe('IP dimension — the hole S11 identified', () => {
  it('rotating the email address no longer grants a fresh budget', async () => {
    // The exploit verbatim: a unique address per submission. Under the old
    // email-only limiter every one of these was allowed, without bound.
    let allowed = 0;
    for (let i = 0; i < IP_LIMIT_PER_HOUR + 5; i++) {
      const result = await checkPublicFormRateLimit(
        'contact',
        `victim+${i}@example.com`,
        from('9.9.9.9'),
      );
      if (result.allowed) allowed++;
    }

    expect(allowed).toBe(IP_LIMIT_PER_HOUR);

    const blocked = await checkPublicFormRateLimit('contact', 'fresh@example.com', from('9.9.9.9'));
    expect(blocked).toEqual({ allowed: false, limitedBy: 'ip' });
  });

  it('does not penalise a different IP for a saturated neighbour', async () => {
    for (let i = 0; i < IP_LIMIT_PER_HOUR; i++) {
      await checkPublicFormRateLimit('contact', `a+${i}@example.com`, from('9.9.9.9'));
    }

    const elsewhere = await checkPublicFormRateLimit('contact', 'b@example.com', from('8.8.8.8'));
    expect(elsewhere.allowed).toBe(true);
  });

  it('still applies the email limit when no IP can be resolved', async () => {
    // Local dev, or a proxy that strips the forwarding headers: the IP check is
    // skipped, but the submission must not become unlimited.
    for (let i = 0; i < EMAIL_LIMIT_PER_HOUR; i++) {
      await checkPublicFormRateLimit('contact', 'a@example.com', from(null));
    }

    const blocked = await checkPublicFormRateLimit('contact', 'a@example.com', from(null));
    expect(blocked).toEqual({ allowed: false, limitedBy: 'email' });
  });

  it('does not extend an over-limit caller’s window by re-recording attempts', async () => {
    for (let i = 0; i < EMAIL_LIMIT_PER_HOUR; i++) {
      await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    }
    const bucketAfterLimit = structuredClone(store.get('rate_limit:contact:a@example.com'));

    await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));

    expect(store.get('rate_limit:contact:a@example.com')).toEqual(bucketAfterLimit);
  });
});

describe('fail posture', () => {
  it('allows the submission when the store is unreachable, by design', async () => {
    // Documented in public-form-rate-limit.ts: on an unauthenticated marketing
    // form, a lost client enquiry costs more than an admin-deletable spam entry.
    // This test exists so that trade is a decision rather than an accident — if
    // it is ever reversed, this is the assertion that must change with it.
    failStore = true;

    const result = await checkPublicFormRateLimit('contact', 'a@example.com', from('1.1.1.1'));
    expect(result.allowed).toBe(true);
  });
});
