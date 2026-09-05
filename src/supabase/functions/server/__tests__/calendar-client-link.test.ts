/**
 * calendar-client-link — regression guard for the client foreign-key fix
 * =====================================================================
 *
 * Creating a calendar event with a client attached failed in production with
 * `insert or update on table "events" violates foreign key constraint
 * "events_client_id_fkey"`: the key pointed at the empty `public.clients`
 * table while the UI sends Supabase Auth user ids. The service no longer
 * embeds `client:clients(*)`; it derives `client` from `attendees`, and turns a
 * foreign-key rejection into a 400 that names the problem.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/calendar-client-link.test.ts
 */
import { describe, it, expect } from 'vitest';

import {
  deriveLinkedClient,
  withLinkedClient,
  isClientLinkViolation,
  CLIENT_LINK_ERROR_MESSAGE,
} from '../calendar-client-link.ts';

describe('deriveLinkedClient', () => {
  it('reads the linked client from the attendees map keyed by client id', () => {
    const client = deriveLinkedClient({
      client_id: 'user-1',
      attendees: {
        'user-1': { name: 'Shawn Francisco', email: 'shawn@example.com', type: 'client' },
      },
    });
    expect(client).toEqual({
      id: 'user-1',
      full_name: 'Shawn Francisco',
      email: 'shawn@example.com',
    });
  });

  it('returns null when no client is attached', () => {
    expect(deriveLinkedClient({ client_id: null, attendees: {} })).toBeNull();
    expect(deriveLinkedClient({})).toBeNull();
  });

  it('falls back to a placeholder name when attendees lack the client', () => {
    expect(deriveLinkedClient({ client_id: 'user-9', attendees: {} })).toEqual({
      id: 'user-9',
      full_name: 'Client',
      email: '',
    });
    expect(deriveLinkedClient({ client_id: 'user-9', attendees: null })?.full_name).toBe('Client');
  });

  it('supports the array attendee shape by matching on id', () => {
    const client = deriveLinkedClient({
      client_id: 'user-2',
      attendees: [
        { id: 'user-1', name: 'Other', email: 'o@example.com' },
        { id: 'user-2', name: 'Jane Doe', email: 'jane@example.com' },
      ],
    });
    expect(client?.full_name).toBe('Jane Doe');
  });
});

describe('withLinkedClient', () => {
  it('attaches the derived client and keeps every other column', () => {
    const row = withLinkedClient({
      id: 'ev-1',
      title: 'Review',
      client_id: 'user-1',
      attendees: { 'user-1': { name: 'Jane', email: 'j@example.com' } },
    });
    expect(row.title).toBe('Review');
    expect(row.client?.full_name).toBe('Jane');
  });

  it('passes null through', () => {
    expect(withLinkedClient(null)).toBeNull();
  });
});

describe('isClientLinkViolation', () => {
  it('recognises the Postgres foreign-key error on client_id', () => {
    expect(
      isClientLinkViolation({
        code: '23503',
        message:
          'insert or update on table "events" violates foreign key constraint "events_client_id_fkey"',
        details: 'Key (client_id)=(abc) is not present in table "clients".',
      }),
    ).toBe(true);
  });

  it('ignores other foreign keys and other error codes', () => {
    expect(
      isClientLinkViolation({
        code: '23503',
        message: 'violates foreign key constraint "events_created_by_fkey"',
        details: 'Key (created_by)=(abc) is not present in table "users".',
      }),
    ).toBe(false);
    expect(isClientLinkViolation({ code: '22P02', message: 'client_id invalid' })).toBe(false);
    expect(isClientLinkViolation(null)).toBe(false);
    expect(isClientLinkViolation('client_id')).toBe(false);
  });

  it('exports a user-facing message that tells the adviser what to do', () => {
    expect(CLIENT_LINK_ERROR_MESSAGE).toMatch(/client/i);
  });
});
