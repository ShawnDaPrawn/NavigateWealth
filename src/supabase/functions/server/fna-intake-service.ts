/**
 * FNA Intake Service — client-led financial discovery sessions
 *
 * KV layout:
 *   fna-intake:session:{sessionId}              — full session record
 *   fna-intake:client:{clientId}:{domain}:active — pointer to active intake session
 *   fna-intake:submitted:{sessionId}            — durable admin queue marker
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  notifyIntakeAccepted,
  notifyIntakeRequestInfo,
  notifyIntakeSubmitted,
} from './fna-intake-notifications.ts';
import { intakeConflict, intakeNotFound, intakeUnprocessable } from './fna-intake-errors.ts';
import { createFnaDraftFromIntake } from './fna-intake-draft-factory.ts';

const log = createModuleLogger('fna-intake-service');

export const FNA_INTAKE_DOMAINS = [
  'risk',
  'medical',
  'retirement',
  'investment',
  'tax',
  'estate',
] as const;

export type FnaIntakeDomain = (typeof FNA_INTAKE_DOMAINS)[number];

export type FnaIntakeSessionStatus = 'client_draft' | 'submitted' | 'accepted';

export interface FnaIntakeSubmittedBy {
  id: string;
  email: string;
}

export interface FnaIntakeSession {
  id: string;
  clientId: string;
  domain: FnaIntakeDomain;
  status: FnaIntakeSessionStatus;
  inputs: Record<string, unknown>;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  submittedBy?: FnaIntakeSubmittedBy | null;
  consentAcceptedAt?: string | null;
  consentTextVersion?: string;
  acceptedAt?: string | null;
  acceptedBy?: FnaIntakeSubmittedBy | null;
  linkedFnaId?: string | null;
  requestInfoAt?: string | null;
  intakeSource: 'client';
}

export const FNA_INTAKE_CONSENT_VERSION = '2026-05-v1';

export const FNA_INTAKE_CONSENT_TEXT =
  'I understand this is not financial advice. Navigate Wealth will review my information and may publish a formal Financial Needs Analysis after adviser review.';

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

function computeProgress(inputs: Record<string, unknown>): number {
  const values = Object.values(inputs);
  if (values.length === 0) return 0;
  const filled = values.filter((v) => {
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'number' && Number.isNaN(v)) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;
  return Math.min(100, Math.round((filled / Math.max(values.length, 1)) * 100));
}

export function isFnaIntakeDomain(value: string): value is FnaIntakeDomain {
  return (FNA_INTAKE_DOMAINS as readonly string[]).includes(value);
}

export async function getIntakeSession(sessionId: string): Promise<FnaIntakeSession | null> {
  return (await kv.get(sessionKey(sessionId))) as FnaIntakeSession | null;
}

export async function getActiveIntakeSession(
  clientId: string,
  domain: FnaIntakeDomain,
): Promise<FnaIntakeSession | null> {
  const sessionId = (await kv.get(activePointerKey(clientId, domain))) as string | null;
  if (!sessionId) return null;
  const session = await getIntakeSession(sessionId);
  if (!session || session.status === 'accepted') return null;
  return session;
}

async function markSubmitted(sessionId: string, submittedAt: string): Promise<void> {
  await kv.set(submittedMarkerKey(sessionId), { sessionId, submittedAt });
}

async function unmarkSubmitted(sessionId: string): Promise<void> {
  await kv.del(submittedMarkerKey(sessionId));
}

async function recordIntakeAudit(
  action: string,
  summary: string,
  actor: FnaIntakeSubmittedBy,
  session: FnaIntakeSession,
  actorRole = 'adviser',
): Promise<void> {
  await AdminAuditService.record({
    actorId: actor.id,
    actorRole,
    category: 'communication',
    action,
    summary,
    severity: 'info',
    entityType: 'fna_intake',
    entityId: session.id,
    metadata: {
      clientId: session.clientId,
      domain: session.domain,
      status: session.status,
    },
  });
}

export async function createOrUpdateIntakeDraft(
  clientId: string,
  domain: FnaIntakeDomain,
  inputs: Record<string, unknown>,
  user: FnaIntakeSubmittedBy,
): Promise<FnaIntakeSession> {
  const existing = await getActiveIntakeSession(clientId, domain);
  const now = new Date().toISOString();
  const progressPercent = computeProgress(inputs);

  if (existing && existing.status === 'client_draft') {
    const updated: FnaIntakeSession = {
      ...existing,
      inputs,
      progressPercent,
      updatedAt: now,
    };
    await kv.set(sessionKey(existing.id), updated);
    return updated;
  }

  if (existing && existing.status === 'submitted') {
    throw intakeConflict('Intake already submitted and awaiting adviser review');
  }

  const session: FnaIntakeSession = {
    id: crypto.randomUUID(),
    clientId,
    domain,
    status: 'client_draft',
    inputs,
    progressPercent,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    submittedBy: null,
    consentAcceptedAt: null,
    requestInfoAt: null,
    intakeSource: 'client',
  };

  await kv.set(sessionKey(session.id), session);
  await kv.set(activePointerKey(clientId, domain), session.id);
  log.info('Created client intake draft', { sessionId: session.id, clientId, domain, userId: user.id });
  return session;
}

export async function submitIntakeSession(
  sessionId: string,
  user: FnaIntakeSubmittedBy,
  consentAccepted: boolean,
): Promise<FnaIntakeSession> {
  if (!consentAccepted) {
    throw intakeUnprocessable('Consent must be accepted before submitting intake');
  }

  const session = await getIntakeSession(sessionId);
  if (!session) throw intakeNotFound();
  if (session.status === 'submitted') return sanitizeIntakeForClient(session);
  if (session.status === 'accepted') throw intakeConflict('Intake already accepted by adviser');

  const now = new Date().toISOString();
  const updated: FnaIntakeSession = {
    ...session,
    status: 'submitted',
    progressPercent: Math.max(session.progressPercent, 80),
    updatedAt: now,
    submittedAt: now,
    submittedBy: { id: user.id, email: user.email },
    consentAcceptedAt: now,
    consentTextVersion: FNA_INTAKE_CONSENT_VERSION,
    requestInfoAt: null,
  };

  await kv.set(sessionKey(session.id), updated);
  await markSubmitted(session.id, now);

  const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
  if (!legacyIndex.includes(session.id)) {
    await kv.set(LEGACY_SUBMITTED_INDEX_KEY, [session.id, ...legacyIndex].slice(0, 500));
  }

  log.info('Client intake submitted', { sessionId, clientId: session.clientId, domain: session.domain });
  await recordIntakeAudit(
    'fna_intake_submitted',
    `Client intake submitted (${session.domain})`,
    user,
    updated,
    'client',
  );
  void notifyIntakeSubmitted(updated);
  return sanitizeIntakeForClient(updated);
}

export async function listSubmittedIntakeSessions(): Promise<FnaIntakeSession[]> {
  const markers = (await kv.getByPrefix('fna-intake:submitted:')) as Array<{ sessionId?: string }>;
  const sessionIds = markers
    .map((marker) => marker?.sessionId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
  const allIds = [...new Set([...sessionIds, ...legacyIndex])];

  const sessions = await Promise.all(allIds.map((id) => getIntakeSession(id)));
  return sessions
    .filter((s): s is FnaIntakeSession => !!s && s.status === 'submitted')
    .sort((a, b) => {
      const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return dateB - dateA;
    });
}

export async function requestMoreInfo(
  sessionId: string,
  admin: FnaIntakeSubmittedBy,
): Promise<FnaIntakeSession> {
  const session = await getIntakeSession(sessionId);
  if (!session) throw intakeNotFound();
  if (session.status !== 'submitted') {
    throw intakeUnprocessable('Only submitted intakes can be returned for more info');
  }

  const now = new Date().toISOString();
  const updated: FnaIntakeSession = {
    ...session,
    status: 'client_draft',
    updatedAt: now,
    submittedAt: null,
    submittedBy: null,
    consentAcceptedAt: null,
    requestInfoAt: now,
  };

  await kv.set(sessionKey(session.id), updated);
  await unmarkSubmitted(sessionId);

  const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
  await kv.set(
    LEGACY_SUBMITTED_INDEX_KEY,
    legacyIndex.filter((id) => id !== sessionId),
  );

  await recordIntakeAudit(
    'fna_intake_request_info',
    `Intake returned for more info (${session.domain})`,
    admin,
    updated,
  );
  void notifyIntakeRequestInfo(updated);
  return updated;
}

export async function acceptIntakeSession(
  sessionId: string,
  admin: FnaIntakeSubmittedBy,
): Promise<{ session: FnaIntakeSession; linkedFnaId: string }> {
  const session = await getIntakeSession(sessionId);
  if (!session) throw intakeNotFound();

  if (session.status === 'accepted' && session.linkedFnaId) {
    return { session, linkedFnaId: session.linkedFnaId };
  }

  if (session.status !== 'submitted') {
    throw intakeUnprocessable('Only submitted intakes can be accepted');
  }

  let linkedFnaId: string;
  linkedFnaId = await createFnaDraftFromIntake(session, admin);

  const now = new Date().toISOString();
  const updated: FnaIntakeSession = {
    ...session,
    status: 'accepted',
    updatedAt: now,
    acceptedAt: now,
    acceptedBy: admin,
    linkedFnaId,
  };

  await kv.set(sessionKey(session.id), updated);
  await kv.del(activePointerKey(session.clientId, session.domain));
  await unmarkSubmitted(sessionId);

  const legacyIndex = ((await kv.get(LEGACY_SUBMITTED_INDEX_KEY)) as string[] | null) ?? [];
  await kv.set(
    LEGACY_SUBMITTED_INDEX_KEY,
    legacyIndex.filter((id) => id !== sessionId),
  );

  await recordIntakeAudit(
    'fna_intake_accepted',
    `Intake accepted (${session.domain})`,
    admin,
    updated,
  );
  void notifyIntakeAccepted(updated);

  log.info('Intake accepted', { sessionId, linkedFnaId, domain: session.domain });
  return { session: updated, linkedFnaId };
}

/** Strip admin-only fields before returning intake to clients */
export function sanitizeIntakeForClient(session: FnaIntakeSession): FnaIntakeSession {
  const {
    acceptedBy,
    linkedFnaId,
    submittedBy,
    ...rest
  } = session;

  return {
    ...rest,
    acceptedBy: session.status === 'accepted' ? acceptedBy : undefined,
    linkedFnaId: session.status === 'accepted' ? linkedFnaId ?? null : null,
    submittedBy: submittedBy
      ? { id: submittedBy.id, email: '' }
      : null,
  };
}

export type BatchIntakeOverlayStatus = 'client_draft' | 'submitted' | null;

export async function getIntakeOverlayForDomain(
  clientId: string,
  domain: FnaIntakeDomain,
): Promise<{ status: BatchIntakeOverlayStatus; session: FnaIntakeSession | null }> {
  const session = await getActiveIntakeSession(clientId, domain);
  if (!session) return { status: null, session: null };
  if (session.status === 'client_draft') return { status: 'client_draft', session };
  if (session.status === 'submitted') return { status: 'submitted', session };
  return { status: null, session: null };
}
