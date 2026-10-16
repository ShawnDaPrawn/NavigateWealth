/**
 * Manual communication unsubscribes (admin suppression list).
 *
 * KV key: `communication:unsubscribed:{email}`
 *
 * Campaign sends skip anyone on this list. Direct 1:1 adviser messages
 * (client-management Communication tab) are unchanged — those are
 * transactional, not marketing.
 */
import { ValidationError, NotFoundError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { removeSubscriberByEmail, resubscribeByEmail } from './newsletter-service.ts';
import { removeNewsletterSubscriber } from './newsletter-group-service.ts';
import { createKvRepository } from './repositories/kv-repository.ts';
import {
  communicationUnsubscribes,
  type UnsubscribedContact,
} from './repositories/communication-unsubscribes-repository.ts';

const log = createModuleLogger('communication-unsubscribes');

export type { UnsubscribedContact };

const commPrefs = createKvRepository<Record<string, unknown>>('comm_prefs:');

export interface UnsubscribeIndex {
  emails: Set<string>;
  clientIds: Set<string>;
}

export interface UnsubscribeInput {
  email: string;
  clientId?: string;
  name?: string;
  adminUserId: string;
}

export function normalizeUnsubscribeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUnsubscribeIndex(): Promise<UnsubscribeIndex> {
  const rows = await communicationUnsubscribes.listAll('load communication unsubscribe index');
  const emails = new Set<string>();
  const clientIds = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const email = normalizeUnsubscribeEmail(row.email || '');
    if (email) emails.add(email);
    const clientId = typeof row.clientId === 'string' ? row.clientId.trim() : '';
    if (clientId) clientIds.add(clientId);
  }

  return { emails, clientIds };
}

export function isUnsubscribed(
  index: UnsubscribeIndex,
  opts: { clientId?: string | null; email?: string | null },
): boolean {
  const email = opts.email ? normalizeUnsubscribeEmail(opts.email) : '';
  if (email && index.emails.has(email)) return true;
  const clientId = opts.clientId?.trim();
  if (clientId && index.clientIds.has(clientId)) return true;
  return false;
}

export async function listUnsubscribed(): Promise<UnsubscribedContact[]> {
  const rows = await communicationUnsubscribes.listAll('list communication unsubscribes');
  return rows
    .filter((row): row is UnsubscribedContact =>
      Boolean(row && typeof row === 'object' && row.email),
    )
    .map((row) => ({
      email: normalizeUnsubscribeEmail(row.email),
      clientId: row.clientId || null,
      name: row.name || undefined,
      unsubscribedAt: row.unsubscribedAt,
      unsubscribedBy: 'admin' as const,
    }))
    .sort((a, b) => (b.unsubscribedAt || '').localeCompare(a.unsubscribedAt || ''));
}

async function syncNewsletterUnsubscribe(email: string): Promise<void> {
  try {
    await removeSubscriberByEmail(email);
  } catch {
    await removeNewsletterSubscriber(email);
  }
}

async function updateMarketingPrefs(
  clientId: string,
  marketingEmail: boolean,
  marketingSms: boolean,
): Promise<void> {
  const existing = await commPrefs.get(clientId);
  const transactional =
    existing && typeof existing.transactional === 'object' && existing.transactional
      ? (existing.transactional as { email?: boolean; sms?: boolean })
      : { email: true, sms: true };
  const frequency = typeof existing?.frequency === 'string' ? existing.frequency : 'realtime';

  await commPrefs.put(clientId, {
    ...(existing || {}),
    userId: clientId,
    transactional: {
      email: transactional.email !== false,
      sms: transactional.sms !== false,
    },
    marketing: { email: marketingEmail, sms: marketingSms },
    frequency,
    updatedAt: new Date().toISOString(),
  });
}

export async function unsubscribeContact(
  input: UnsubscribeInput,
): Promise<{ alreadyUnsubscribed: boolean; contact: UnsubscribedContact }> {
  const email = normalizeUnsubscribeEmail(input.email);
  if (!email || !email.includes('@')) {
    throw new ValidationError('A valid email is required to unsubscribe');
  }

  const existing = await communicationUnsubscribes.get(email);
  if (existing?.email) {
    log.info('Contact already unsubscribed from communication', {
      clientId: existing.clientId || undefined,
    });
    return { alreadyUnsubscribed: true, contact: existing };
  }

  const now = new Date().toISOString();
  const contact: UnsubscribedContact = {
    email,
    clientId: input.clientId?.trim() || null,
    name: input.name?.trim() || undefined,
    unsubscribedAt: now,
    unsubscribedBy: 'admin',
  };

  await communicationUnsubscribes.put(email, contact);

  if (contact.clientId) {
    try {
      await updateMarketingPrefs(contact.clientId, false, false);
    } catch (err) {
      log.warn('Failed to update communication preferences on unsubscribe', {
        error: String(err),
      });
    }
  }

  try {
    await syncNewsletterUnsubscribe(email);
  } catch (err) {
    log.warn('Newsletter unsubscribe sync failed (non-blocking)', { error: String(err) });
  }

  log.info('Contact unsubscribed from communication', {
    clientId: contact.clientId || undefined,
    adminUserId: input.adminUserId,
  });

  return { alreadyUnsubscribed: false, contact };
}

export async function resubscribeContact(
  input: Omit<UnsubscribeInput, 'name'>,
): Promise<{ alreadySubscribed: boolean }> {
  const email = normalizeUnsubscribeEmail(input.email);
  if (!email || !email.includes('@')) {
    throw new ValidationError('A valid email is required to re-subscribe');
  }

  const existing = await communicationUnsubscribes.get(email);
  if (!existing) {
    throw new NotFoundError('This contact is not on the communication unsubscribe list');
  }

  await communicationUnsubscribes.remove(email);

  const clientId = input.clientId?.trim() || existing.clientId || '';
  if (clientId) {
    try {
      await updateMarketingPrefs(clientId, true, false);
    } catch (err) {
      log.warn('Failed to update communication preferences on re-subscribe', {
        error: String(err),
      });
    }
  }

  try {
    await resubscribeByEmail(email);
  } catch {
    // Not a newsletter subscriber — communication re-subscribe still stands.
  }

  log.info('Contact re-subscribed to communication', {
    clientId: clientId || undefined,
    adminUserId: input.adminUserId,
  });

  return { alreadySubscribed: false };
}
