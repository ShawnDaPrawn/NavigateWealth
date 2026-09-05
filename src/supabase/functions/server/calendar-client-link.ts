/**
 * Calendar Module - Client link helpers
 *
 * Pure functions (no Deno, no Supabase client) so they can be unit-tested with
 * the SPA's vitest run.
 *
 * Background: `events.client_id` and `reminders.client_id` originally
 * referenced `public.clients`, a table nothing in the product writes to (it
 * holds 0 rows). The admin UI picks clients from `profile/all-users`, whose ids
 * are Supabase Auth user ids, so every create that attached a client failed
 * with a foreign-key violation and surfaced as "Failed to create event".
 *
 * The migration `20260905170000_calendar_client_fk_to_auth_users.sql` re-points
 * both foreign keys at `auth.users`. That also removes the PostgREST
 * relationship the old `client:clients(*)` embed depended on, so the `client`
 * relation the SPA renders is now derived from the `attendees` map instead —
 * which is where the UI already stores the linked client's name and email.
 *
 * EVENTS ONLY. `reminders` has no `attendees` column, so there is nothing to
 * derive from and nothing here is applied to it. Never fabricate a name for a
 * row whose real client metadata is not present: the embed used to yield
 * `null` for those (the `clients` table is empty), and a placeholder would be
 * a downgrade from an absent field to a wrong one.
 */

export interface LinkedClient {
  id: string;
  full_name: string;
  email: string;
}

interface AttendeeLike {
  name?: unknown;
  email?: unknown;
}

function asAttendee(value: unknown): AttendeeLike | null {
  return value && typeof value === 'object' ? (value as AttendeeLike) : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Derive the primary linked client for a row from its `client_id` and its
 * `attendees` JSONB map (`{ "<client-id>": { name, email, type } }`).
 *
 * Returns `null` when the row has no client, and also when `attendees` carries
 * no entry for it — an absent relation is honest, an invented name is not.
 * Either way the SPA's `event.client &&` guards keep working unchanged.
 */
export function deriveLinkedClient(row: {
  client_id?: string | null;
  attendees?: unknown;
}): LinkedClient | null {
  const clientId = row.client_id;
  if (!clientId) return null;

  const attendees = row.attendees;
  let match: AttendeeLike | null = null;

  if (Array.isArray(attendees)) {
    match =
      attendees.map(asAttendee).find((a) => a && (a as { id?: unknown }).id === clientId) ?? null;
  } else if (attendees && typeof attendees === 'object') {
    match = asAttendee((attendees as Record<string, unknown>)[clientId]);
  }

  const fullName = str(match?.name);
  if (!fullName) return null;

  return { id: clientId, full_name: fullName, email: str(match?.email) };
}

/**
 * Attach the derived `client` relation to a row (or to `null`, passed through).
 */
export function withLinkedClient<T extends { client_id?: string | null; attendees?: unknown }>(
  row: T,
): T & { client: LinkedClient | null };
export function withLinkedClient(row: null): null;
export function withLinkedClient<T extends { client_id?: string | null; attendees?: unknown }>(
  row: T | null,
): (T & { client: LinkedClient | null }) | null {
  if (!row) return null;
  return { ...row, client: deriveLinkedClient(row) };
}

/** Postgres SQLSTATE for a foreign-key violation. */
const FK_VIOLATION = '23503';

/**
 * True when a Supabase/PostgREST error is the `client_id` foreign key being
 * rejected. Used to turn an opaque 500 into a 400 that names the problem.
 */
export function isClientLinkViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: unknown; message?: unknown; details?: unknown };
  if (e.code !== FK_VIOLATION) return false;
  const text = `${str(e.message)} ${str(e.details)}`;
  return text.includes('client_id');
}

export const CLIENT_LINK_ERROR_MESSAGE =
  'The selected client could not be linked to this event. Refresh the client list and try again.';
