/**
 * Unified intake session storage — KV with optional Postgres dual-write / read cutover.
 */

import * as kv from './kv_store.tsx';
import {
  fnaIntakePgRepo,
  fnaIntakePostgresOnly,
  fnaIntakeReadSource,
  fnaIntakeDualWriteEnabled,
} from './fna-intake-postgres-repo.ts';
import type { FnaIntakeDomain, FnaIntakeSession } from './fna-intake-types.ts';

function sessionKey(sessionId: string) {
  return `fna-intake:session:${sessionId}`;
}

function activePointerKey(clientId: string, domain: FnaIntakeDomain) {
  return `fna-intake:client:${clientId}:${domain}:active`;
}

function submittedMarkerKey(sessionId: string) {
  return `fna-intake:submitted:${sessionId}`;
}

const LEGACY_SUBMITTED_INDEX_KEY = 'fna-intake:submitted';

export async function storageGetSession(sessionId: string): Promise<FnaIntakeSession | null> {
  if (fnaIntakeReadSource === 'postgres' || fnaIntakePostgresOnly) {
    const pg = await fnaIntakePgRepo.getSessionById(sessionId);
    if (pg) return pg;
    if (fnaIntakePostgresOnly) return null;
  }
  return (await kv.get(sessionKey(sessionId))) as FnaIntakeSession | null;
}

export async function storageGetActiveSession(
  clientId: string,
  domain: FnaIntakeDomain,
): Promise<FnaIntakeSession | null> {
  if (fnaIntakeReadSource === 'postgres' || fnaIntakePostgresOnly) {
    const pg = await fnaIntakePgRepo.getActiveSession(clientId, domain);
    if (pg && pg.status !== 'accepted') return pg;
    if (fnaIntakePostgresOnly) return null;
  }

  const sessionId = (await kv.get(activePointerKey(clientId, domain))) as string | null;
  if (!sessionId) return null;
  const session = await storageGetSession(sessionId);
  if (!session || session.status === 'accepted') return null;
  return session;
}

export async function storageSaveSession(
  session: FnaIntakeSession,
  options?: { activePointer?: boolean; clearActivePointer?: boolean },
): Promise<void> {
  if (!fnaIntakePostgresOnly) {
    await kv.set(sessionKey(session.id), session);
    if (options?.activePointer) {
      await kv.set(activePointerKey(session.clientId, session.domain), session.id);
    }
    if (options?.clearActivePointer) {
      await kv.del(activePointerKey(session.clientId, session.domain));
    }
  }
  await fnaIntakePgRepo.upsertSession(session);
}

export async function storageMarkSubmitted(sessionId: string, submittedAt: string): Promise<void> {
  if (!fnaIntakePostgresOnly) {
    await kv.set(submittedMarkerKey(sessionId), { sessionId, submittedAt });
    const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
    if (!legacyIndex.includes(sessionId)) {
      await kv.set(LEGACY_SUBMITTED_INDEX_KEY, [sessionId, ...legacyIndex].slice(0, 500));
    }
  }
}

export async function storageUnmarkSubmitted(sessionId: string): Promise<void> {
  if (!fnaIntakePostgresOnly) {
    await kv.del(submittedMarkerKey(sessionId));
    const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
    await kv.set(
      LEGACY_SUBMITTED_INDEX_KEY,
      legacyIndex.filter((id) => id !== sessionId),
    );
  }
}

export async function storageListSubmittedSessions(): Promise<FnaIntakeSession[]> {
  if (fnaIntakeReadSource === 'postgres' || fnaIntakePostgresOnly) {
    const pgSessions = await fnaIntakePgRepo.listSubmittedSessions();
    if (pgSessions.length > 0 || fnaIntakePostgresOnly) {
      return pgSessions;
    }
  }

  const markers = (await kv.getByPrefix('fna-intake:submitted:')) as Array<{ sessionId?: string }>;
  const sessionIds = markers
    .map((marker) => marker?.sessionId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
  const allIds = [...new Set([...sessionIds, ...legacyIndex])];

  const sessions = await Promise.all(allIds.map((id) => storageGetSession(id)));
  return sessions.filter((s): s is FnaIntakeSession => !!s && s.status === 'submitted');
}

export { fnaIntakeDualWriteEnabled, fnaIntakeReadSource, fnaIntakePostgresOnly };
