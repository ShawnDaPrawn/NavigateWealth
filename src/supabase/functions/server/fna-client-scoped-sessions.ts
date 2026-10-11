/**
 * FNAs stored under their client: `<prefix>:client:<clientId>:<id>`.
 *
 * That is every Investment INA, Estate Planning and Tax Planning session, and
 * the drafts a client intake makes for them. Their routes read, publish,
 * unpublish and delete one session through these helpers, so the key is built
 * in one place.
 *
 * Wizard sessions have ids `<clientId>-v<N>-<suffix>`, so the client is read
 * from the id. A draft made from a client intake has a plain UUID id that does
 * not name its client, so the caller passes it (`?clientId=`). Either way the
 * key is built from the client the route authorizes, so authorizing that
 * client authorizes exactly the record that is touched.
 */

import * as kv from './kv_store.tsx';

export type ClientScopedPrefix = 'investment-ina' | 'estate-planning-fna' | 'tax-planning-fna';

export type ClientScopedSession = Record<string, unknown> & { id?: string; status?: string };

/** The client a session belongs to: the caller's `clientId`, else the one in the id. */
export function sessionOwner(sessionId: string, clientHint?: string | null): string {
  return clientHint || sessionId.split('-v')[0];
}

function sessionKey(prefix: ClientScopedPrefix, clientId: string, sessionId: string): string {
  return `${prefix}:client:${clientId}:${sessionId}`;
}

export async function readSession(
  prefix: ClientScopedPrefix,
  clientId: string,
  sessionId: string,
): Promise<ClientScopedSession | null> {
  return ((await kv.get(sessionKey(prefix, clientId, sessionId))) as ClientScopedSession) ?? null;
}

export async function writeSession(
  prefix: ClientScopedPrefix,
  clientId: string,
  sessionId: string,
  session: ClientScopedSession,
): Promise<void> {
  await kv.set(sessionKey(prefix, clientId, sessionId), session);
}

/** Deletes the session. False when there was none, so the route can answer 404. */
export async function removeSession(
  prefix: ClientScopedPrefix,
  clientId: string,
  sessionId: string,
): Promise<boolean> {
  if (!(await readSession(prefix, clientId, sessionId))) return false;
  await kv.del(sessionKey(prefix, clientId, sessionId));
  return true;
}

/** The session published (stamped with who and when) or back to a draft. */
export function withPublished(
  session: ClientScopedSession,
  published: boolean,
  userId: string,
): ClientScopedSession {
  const now = new Date().toISOString();
  return published
    ? { ...session, status: 'published', publishedAt: now, publishedBy: userId, updatedAt: now }
    : {
        ...session,
        status: 'draft',
        publishedAt: undefined,
        publishedBy: undefined,
        updatedAt: now,
      };
}
