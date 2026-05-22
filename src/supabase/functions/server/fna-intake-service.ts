/**
 * FNA Intake Service — client-led financial discovery sessions
 */

import { createModuleLogger } from './stderr-logger.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import {
  notifyIntakeAccepted,
  notifyIntakeRequestInfo,
  notifyIntakeSubmitted,
} from './fna-intake-notifications.ts';
import { intakeConflict, intakeNotFound, intakeUnprocessable } from './fna-intake-errors.ts';
import { createFnaDraftFromIntake } from './fna-intake-draft-factory.ts';
import { fnaIntakePgRepo } from './fna-intake-postgres-repo.ts';
import {
  storageGetSession,
  storageGetActiveSession,
  storageSaveSession,
  storageMarkSubmitted,
  storageUnmarkSubmitted,
  storageListSubmittedSessions,
  fnaIntakePostgresOnly,
  fnaIntakeReadSource,
} from './fna-intake-storage.ts';
import {
  FNA_INTAKE_DOMAINS,
  FNA_INTAKE_CONSENT_VERSION,
  FNA_INTAKE_CONSENT_TEXT,
  isFnaIntakeDomain,
  type FnaIntakeDomain,
  type FnaIntakeSession,
  type FnaIntakeSubmittedBy,
  type BatchIntakeOverlayStatus,
} from './fna-intake-types.ts';

export {
  FNA_INTAKE_DOMAINS,
  FNA_INTAKE_CONSENT_VERSION,
  FNA_INTAKE_CONSENT_TEXT,
  isFnaIntakeDomain,
  type FnaIntakeDomain,
  type FnaIntakeSession,
  type FnaIntakeSubmittedBy,
  type BatchIntakeOverlayStatus,
};

const log = createModuleLogger('fna-intake-service');

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

export async function getIntakeSession(sessionId: string): Promise<FnaIntakeSession | null> {
  return storageGetSession(sessionId);
}

export async function getActiveIntakeSession(
  clientId: string,
  domain: FnaIntakeDomain,
): Promise<FnaIntakeSession | null> {
  return storageGetActiveSession(clientId, domain);
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
    await storageSaveSession(updated, { activePointer: true });
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

  await storageSaveSession(session, { activePointer: true });
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

  await storageSaveSession(updated, { activePointer: true });
  await storageMarkSubmitted(session.id, now);

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
  const sessions = await storageListSubmittedSessions();
  return sessions.sort((a, b) => {
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

  await storageSaveSession(updated, { activePointer: true });
  await storageUnmarkSubmitted(sessionId);

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
  const usePgAccept = fnaIntakePostgresOnly || fnaIntakeReadSource === 'postgres';

  if (usePgAccept) {
    const placeholder = `pending:${crypto.randomUUID()}`;
    const claim = await fnaIntakePgRepo.claimSessionForAccept(sessionId, admin, placeholder);

    if (claim?.kind === 'already_accepted' && claim.session.linkedFnaId) {
      return { session: claim.session, linkedFnaId: claim.session.linkedFnaId };
    }

    if (claim?.kind === 'claimed') {
      const linkedFnaId = await createFnaDraftFromIntake(claim.session, admin);
      const finalized = await fnaIntakePgRepo.finalizeAccept(sessionId, linkedFnaId);
      const updated = finalized ?? { ...claim.session, linkedFnaId, status: 'accepted' as const };

      if (!fnaIntakePostgresOnly) {
        await storageSaveSession(updated, { clearActivePointer: true });
        await storageUnmarkSubmitted(sessionId);
      }

      await recordIntakeAudit(
        'fna_intake_accepted',
        `Intake accepted (${updated.domain})`,
        admin,
        updated,
      );
      void notifyIntakeAccepted(updated);
      log.info('Intake accepted (postgres)', { sessionId, linkedFnaId, domain: updated.domain });
      return { session: updated, linkedFnaId };
    }
  }

  const session = await getIntakeSession(sessionId);
  if (!session) throw intakeNotFound();

  if (session.status === 'accepted' && session.linkedFnaId && !session.linkedFnaId.startsWith('pending:')) {
    return { session, linkedFnaId: session.linkedFnaId };
  }

  if (session.status !== 'submitted') {
    throw intakeUnprocessable('Only submitted intakes can be accepted');
  }

  const linkedFnaId = await createFnaDraftFromIntake(session, admin);

  const now = new Date().toISOString();
  const updated: FnaIntakeSession = {
    ...session,
    status: 'accepted',
    updatedAt: now,
    acceptedAt: now,
    acceptedBy: admin,
    linkedFnaId,
  };

  await storageSaveSession(updated, { clearActivePointer: true });
  await storageUnmarkSubmitted(sessionId);

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

export function sanitizeIntakeForClient(session: FnaIntakeSession): FnaIntakeSession {
  const { acceptedBy, linkedFnaId, submittedBy, ...rest } = session;

  return {
    ...rest,
    acceptedBy: session.status === 'accepted' ? acceptedBy : undefined,
    linkedFnaId: session.status === 'accepted' ? linkedFnaId ?? null : null,
    submittedBy: submittedBy ? { id: submittedBy.id, email: '' } : null,
  };
}

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
