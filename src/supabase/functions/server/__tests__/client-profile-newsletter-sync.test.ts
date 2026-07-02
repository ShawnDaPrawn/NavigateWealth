/**
 * Tests that a client-manager profile rename propagates to the client's
 * newsletter subscriber record and the Newsletter Contacts group external
 * contact, without ever subscribing a non-subscriber.
 *
 * Run with: npx vitest run src/supabase/functions/server/__tests__/client-profile-newsletter-sync.test.ts
 *
 * @module server/__tests__/client-profile-newsletter-sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../kv_store.tsx', () => ({
  get: vi.fn((key: string) => {
    const val = kvStore.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : null;
  }),
  set: vi.fn((key: string, value: unknown) => {
    kvStore.set(key, JSON.parse(JSON.stringify(value)));
  }),
}));

vi.mock('../stderr-logger.ts', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// The Newsletter Contacts group is read through the communication repo; mock it
// so the real newsletter-group-service logic (in-place-only contact update) runs.
const getGroupById = vi.fn();
vi.mock('../communication-repo.ts', () => ({
  getGroupById: (id: string) => getGroupById(id),
}));

import * as kv from '../kv_store.tsx';
import { syncClientProfileNamesToNewsletter } from '../newsletter-service.ts';

const GROUP_KEY = 'communication:groups:sys_newsletter_contacts';
const EMAIL = 'client@example.com';

beforeEach(() => {
  kvStore.clear();
  getGroupById.mockReset();
  vi.clearAllMocks();
});

describe('syncClientProfileNamesToNewsletter', () => {
  it('propagates a rename to the subscriber record and the group contact', async () => {
    kvStore.set(`newsletter:${EMAIL}`, {
      email: EMAIL,
      firstName: 'Old',
      surname: 'Name',
      name: 'Old Name',
      active: true,
      confirmed: true,
    });
    getGroupById.mockResolvedValue({
      id: 'sys_newsletter_contacts',
      clientIds: [],
      externalContacts: [{ email: EMAIL, name: 'Old Name' }],
    });

    await syncClientProfileNamesToNewsletter({
      email: EMAIL,
      firstName: 'New',
      lastName: 'Name',
    });

    const subscriber = kvStore.get(`newsletter:${EMAIL}`) as Record<string, unknown>;
    expect(subscriber.firstName).toBe('New');
    expect(subscriber.surname).toBe('Name');
    expect(subscriber.name).toBe('New Name');

    const group = kvStore.get(GROUP_KEY) as { externalContacts: Array<{ name: string }> };
    expect(group.externalContacts[0].name).toBe('New Name');
  });

  it('never creates a subscriber record for a non-subscriber', async () => {
    getGroupById.mockResolvedValue({
      id: 'sys_newsletter_contacts',
      clientIds: [],
      externalContacts: [], // email is not a contact
    });

    await syncClientProfileNamesToNewsletter({
      email: EMAIL,
      firstName: 'New',
      lastName: 'Name',
    });

    // No newsletter subscriber record was created...
    expect(kvStore.has(`newsletter:${EMAIL}`)).toBe(false);
    // ...and no group write happened (in-place-only update found no contact).
    expect(kv.set).not.toHaveBeenCalled();
  });

  it('is a no-op when the profile has no email', async () => {
    await syncClientProfileNamesToNewsletter({ firstName: 'New', lastName: 'Name' });
    expect(kv.set).not.toHaveBeenCalled();
    expect(getGroupById).not.toHaveBeenCalled();
  });
});
