/**
 * communication-unsubscribes — admin suppression list
 * ===================================================
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/communication-unsubscribes.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('Deno', { env: { get: () => 'test' } });

const kvStore = new Map<string, unknown>();
const clone = <T>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn(async (key: string) => clone(kvStore.get(key) ?? null)),
  set: vi.fn(async (key: string, value: unknown) => {
    kvStore.set(key, clone(value));
  }),
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

vi.mock('../error.middleware.ts', () => {
  class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
  return { ValidationError, NotFoundError };
});

const removeSubscriberByEmail = vi.fn(async () => {});
const resubscribeByEmail = vi.fn(async () => ({ alreadyActive: false, message: 'ok' }));
vi.mock('../newsletter-service.ts', () => ({
  removeSubscriberByEmail: (...args: unknown[]) => removeSubscriberByEmail(...args),
  resubscribeByEmail: (...args: unknown[]) => resubscribeByEmail(...args),
}));

const removeNewsletterSubscriber = vi.fn(async () => {});
vi.mock('../newsletter-group-service.ts', () => ({
  removeNewsletterSubscriber: (...args: unknown[]) => removeNewsletterSubscriber(...args),
}));

import {
  getUnsubscribeIndex,
  isUnsubscribed,
  listUnsubscribed,
  unsubscribeContact,
  resubscribeContact,
} from '../communication-unsubscribes.ts';

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('unsubscribeContact', () => {
  it('stores a suppression record keyed by normalised email', async () => {
    const result = await unsubscribeContact({
      email: '  Alex@Example.com ',
      clientId: 'client-1',
      name: 'Alex Example',
      adminUserId: 'admin-1',
    });

    expect(result.alreadyUnsubscribed).toBe(false);
    expect(result.contact.email).toBe('alex@example.com');
    expect(result.contact.clientId).toBe('client-1');
    expect(kvStore.get('communication:unsubscribed:alex@example.com')).toMatchObject({
      email: 'alex@example.com',
      unsubscribedBy: 'admin',
    });
    expect(removeSubscriberByEmail).toHaveBeenCalledWith('alex@example.com');
    expect(kvStore.get('comm_prefs:client-1')).toMatchObject({
      marketing: { email: false, sms: false },
    });
  });

  it('is idempotent when the contact is already unsubscribed', async () => {
    await unsubscribeContact({
      email: 'alex@example.com',
      adminUserId: 'admin-1',
    });
    removeSubscriberByEmail.mockClear();

    const result = await unsubscribeContact({
      email: 'alex@example.com',
      adminUserId: 'admin-1',
    });

    expect(result.alreadyUnsubscribed).toBe(true);
    expect(removeSubscriberByEmail).not.toHaveBeenCalled();
  });

  it('still unsubscribes when the email is not a newsletter subscriber', async () => {
    removeSubscriberByEmail.mockRejectedValueOnce(new Error('Subscriber not found'));

    const result = await unsubscribeContact({
      email: 'visitor@example.com',
      adminUserId: 'admin-1',
    });

    expect(result.alreadyUnsubscribed).toBe(false);
    expect(removeNewsletterSubscriber).toHaveBeenCalledWith('visitor@example.com');
  });
});

describe('resubscribeContact', () => {
  it('removes the suppression record and restores marketing email', async () => {
    await unsubscribeContact({
      email: 'alex@example.com',
      clientId: 'client-1',
      adminUserId: 'admin-1',
    });

    const result = await resubscribeContact({
      email: 'alex@example.com',
      clientId: 'client-1',
      adminUserId: 'admin-1',
    });

    expect(result.alreadySubscribed).toBe(false);
    expect(kvStore.get('communication:unsubscribed:alex@example.com')).toBeUndefined();
    expect(kvStore.get('comm_prefs:client-1')).toMatchObject({
      marketing: { email: true, sms: false },
    });
    expect(resubscribeByEmail).toHaveBeenCalledWith('alex@example.com');
  });
});

describe('unsubscribe index', () => {
  it('matches by email or client id', async () => {
    await unsubscribeContact({
      email: 'alex@example.com',
      clientId: 'client-1',
      adminUserId: 'admin-1',
    });

    const index = await getUnsubscribeIndex();
    expect(isUnsubscribed(index, { email: 'ALEX@example.com' })).toBe(true);
    expect(isUnsubscribed(index, { clientId: 'client-1' })).toBe(true);
    expect(isUnsubscribed(index, { email: 'other@example.com', clientId: 'client-2' })).toBe(false);

    const listed = await listUnsubscribed();
    expect(listed).toHaveLength(1);
    expect(listed[0].email).toBe('alex@example.com');
  });
});
