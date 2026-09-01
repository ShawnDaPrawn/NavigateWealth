/**
 * newsletter.tsx — the three public consent routes
 * ================================================
 *
 * `/subscribe`, `/confirm` and `/unsubscribe` are the only newsletter paths a
 * member of the public can reach, and they were the only three that did NOT
 * normalise the address before building the KV key. Every admin and service
 * path — removeSubscriberByEmail, resubscribeByEmail, the Newsletter Contacts
 * group sync, RFC 8058 one-click unsubscribe — keys off
 * `email.trim().toLowerCase()`. That split the consent store in two the moment
 * anyone typed a capital letter:
 *
 *   - a record filed as `newsletter:John.Smith@x.com` is invisible to the admin
 *     UI, which cannot unsubscribe or re-subscribe it, and
 *   - that person's own unsubscribe link — built from the lowercased address —
 *     missed, so the route answered 200 and wrote NOTHING.
 *
 * The second half of that is the worse one and has its own tests below: an
 * opt-out that records nothing means the person sees a success page, keeps
 * receiving mail, and leaves no trace anyone can audit. Under POPIA an opt-out
 * has to stick whether or not a subscription row happened to exist.
 *
 * Real: the in-memory KV and the real route wiring. Stubbed: the email
 * transport and the group writer, both process boundaries — the group writer is
 * asserted against so the group and the consent record cannot drift apart.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const group = vi.hoisted(() => ({
  addNewsletterSubscriber: vi.fn(async () => undefined),
  removeNewsletterSubscriber: vi.fn(async () => undefined),
  backfillLegacyNewsletterSubscribersToGroup: vi.fn(async () => undefined),
}));

const email = vi.hoisted(() => ({
  sendEmail: vi.fn(async () => true),
  createEmailTemplate: vi.fn((c: string) => `<html>${c}`),
  createPlainTextEmail: vi.fn((c: string) => c),
  getFooterSettings: vi.fn(async () => ({})),
}));

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('../newsletter-group-service.ts', () => group);
vi.mock('../email-service.ts', () => email);
vi.mock('../admin-audit-service.ts', () => ({
  AdminAuditService: { record: vi.fn(async () => undefined) },
}));
vi.mock('../auth-mw.ts', () => ({
  requireAuth: async (_c: unknown, next: () => Promise<void>) => next(),
  requireAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const app = (await import('../newsletter.tsx')).default;

type Entry = Record<string, unknown>;

const stored = (addr: string) => kvStore.get(`newsletter:${addr}`) as Entry | undefined;

const seed = (addr: string, overrides: Entry = {}) =>
  kvStore.set(`newsletter:${addr}`, {
    email: addr,
    source: 'Website',
    confirmed: true,
    active: true,
    subscribedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  email.sendEmail.mockResolvedValue(true);
});

describe('GET /unsubscribe — an opt-out is never a no-op', () => {
  it('deactivates the subscriber and dates the opt-out', async () => {
    seed('thandi@example.com');

    const res = await app.request('/unsubscribe?email=thandi@example.com');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    const entry = stored('thandi@example.com')!;
    expect(entry.active).toBe(false);
    expect(entry.unsubscribedAt).toEqual(expect.any(String));
    expect(group.removeNewsletterSubscriber).toHaveBeenCalledWith('thandi@example.com');
  });

  it('honours a mixed-case address against the lowercase record', async () => {
    // The exact shape of the lost unsubscribe: the person clicks the link in
    // their client, which carries the address as they typed it.
    seed('thandi@example.com');

    const res = await app.request('/unsubscribe?email=Thandi%40Example.com');

    expect(res.status).toBe(200);
    expect(stored('thandi@example.com')!.active).toBe(false);
    // …and no second, orphaned record under the mixed-case key.
    expect(stored('Thandi@Example.com')).toBeUndefined();
    expect(kvStore.size).toBe(1);
  });

  it('records the opt-out even when no subscription record exists', async () => {
    // Previously answered 200 `notFound` and wrote nothing: the person saw a
    // success page, kept getting mail, and no trace of the request survived.
    const res = await app.request('/unsubscribe?email=ghost@example.com');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    const entry = stored('ghost@example.com')!;
    expect(entry).toBeDefined();
    expect(entry.active).toBe(false);
    expect(entry.email).toBe('ghost@example.com');
    expect(entry.unsubscribedAt).toEqual(expect.any(String));
    // Still evicted from the audience, which is the part that stops the mail.
    expect(group.removeNewsletterSubscriber).toHaveBeenCalledWith('ghost@example.com');
  });

  it('preserves the existing record rather than overwriting it', async () => {
    seed('thandi@example.com', {
      firstName: 'Thandi',
      surname: 'Nkosi',
      source: 'Admin Bulk Upload',
      subscribedAt: '2026-02-26T20:23:37.806Z',
    });

    await app.request('/unsubscribe?email=thandi@example.com');

    const entry = stored('thandi@example.com')!;
    expect(entry.firstName).toBe('Thandi');
    expect(entry.source).toBe('Admin Bulk Upload');
    expect(entry.subscribedAt).toBe('2026-02-26T20:23:37.806Z');
  });

  it('trims a padded address', async () => {
    seed('thandi@example.com');
    await app.request(`/unsubscribe?email=${encodeURIComponent('  thandi@example.com  ')}`);
    expect(stored('thandi@example.com')!.active).toBe(false);
  });

  it('still refuses a request with no address', async () => {
    const res = await app.request('/unsubscribe');
    expect(res.status).toBe(400);
    expect(kvStore.size).toBe(0);
  });
});

describe('POST /subscribe — one canonical key', () => {
  const subscribe = (addr: string) =>
    app.request('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addr }),
    });

  it('files a mixed-case signup under the lowercase key', async () => {
    const res = await subscribe('John.Smith@Example.com');

    expect(res.status).toBe(200);
    expect(stored('john.smith@example.com')).toBeDefined();
    expect(stored('John.Smith@Example.com')).toBeUndefined();
    expect(stored('john.smith@example.com')!.email).toBe('john.smith@example.com');
  });

  it('recognises an existing subscriber typed in a different case', async () => {
    // Without normalisation this wrote a second pending record over the top of
    // a confirmed subscriber's identity.
    seed('john.smith@example.com', { confirmed: true });

    const res = await subscribe('JOHN.SMITH@EXAMPLE.COM');

    expect(await res.json()).toMatchObject({ alreadySubscribed: true });
    expect(kvStore.size).toBe(1);
    expect(stored('john.smith@example.com')!.confirmed).toBe(true);
  });
});

describe('GET /confirm — one canonical key', () => {
  it('confirms a mixed-case link against the lowercase record', async () => {
    seed('john.smith@example.com', {
      confirmed: false,
      active: false,
      confirmToken: 'tok-1',
      // Inside the route's 48-hour confirmation window.
      subscribedAt: new Date().toISOString(),
    });

    const res = await app.request('/confirm?token=tok-1&email=John.Smith%40Example.com');

    expect(res.status).toBe(200);
    const entry = stored('john.smith@example.com')!;
    expect(entry.confirmed).toBe(true);
    expect(entry.active).toBe(true);
    expect(group.addNewsletterSubscriber).toHaveBeenCalledWith('john.smith@example.com');
  });
});
