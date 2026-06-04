/**
 * Client/adviser notifications for FNA intake lifecycle events.
 */

import { CommunicationService } from './communication-service.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { resolveClientAdviserUserId } from './fna-intake-adviser-resolver.ts';
import type { FnaIntakeDomain, FnaIntakeSession } from './fna-intake-service.ts';

const log = createModuleLogger('fna-intake-notifications');
const comms = new CommunicationService();

const DOMAIN_LABELS: Record<FnaIntakeDomain, string> = {
  risk: 'Risk Planning',
  medical: 'Medical Aid',
  retirement: 'Retirement',
  investment: 'Investment',
  tax: 'Tax Planning',
  estate: 'Estate Planning',
};

const SYSTEM_ACTOR = 'system';

function domainLabel(domain: FnaIntakeDomain): string {
  return DOMAIN_LABELS[domain] ?? domain;
}

async function notifyInbox(recipientId: string, subject: string, content: string): Promise<void> {
  try {
    await comms.sendMessage(SYSTEM_ACTOR, {
      subject,
      content,
      recipients: [recipientId],
      category: 'System',
      priority: 'normal',
    });
  } catch (error) {
    log.warn('Failed to send intake notification', { recipientId, subject, error });
  }
}

export async function notifyIntakeSubmitted(session: FnaIntakeSession): Promise<void> {
  const label = domainLabel(session.domain);

  await notifyInbox(
    session.clientId,
    `${label} discovery submitted`,
    `<p>Thank you — your ${label} financial discovery has been submitted to your adviser for review.</p>
<p>This is not financial advice until your adviser publishes your formal needs analysis.</p>`,
  );

  const adviserId = await resolveClientAdviserUserId(session.clientId);
  if (adviserId) {
    await notifyInbox(
      adviserId,
      `Client intake ready — ${label}`,
      `<p>A client has submitted their ${label} financial discovery for review.</p>
<p>Client ID: ${session.clientId}</p>
<p>Session: ${session.id}</p>
<p>Open the FNA Intake Queue in Client Management to accept and continue at Step 2.</p>`,
    );
  } else {
    log.info('No assigned adviser found for intake submit notification', {
      clientId: session.clientId,
      sessionId: session.id,
    });
  }
}

export async function notifyIntakeRequestInfo(session: FnaIntakeSession): Promise<void> {
  const label = domainLabel(session.domain);
  await notifyInbox(
    session.clientId,
    `More information needed — ${label}`,
    `<p>Your adviser needs more information to complete your ${label} financial discovery.</p>
<p>Please open your needs analysis and update your answers, then submit again when ready.</p>`,
  );
}

export async function notifyIntakeAccepted(session: FnaIntakeSession): Promise<void> {
  const label = domainLabel(session.domain);
  await notifyInbox(
    session.clientId,
    `${label} discovery under review`,
    `<p>Your adviser is reviewing your ${label} financial discovery and preparing your formal needs analysis.</p>`,
  );
}
