/**
 * Newsletter Service — Business Logic Layer
 *
 * §4.2 — Services own business logic, KV access patterns, and cross-entity consistency.
 * §5.4 — KV key: newsletter:{email}
 *
 * Admin-facing operations extracted from newsletter.tsx.
 * Public-facing flows (subscribe/confirm/unsubscribe) remain in the route file
 * due to tight coupling with email template logic — extraction deferred to a
 * follow-up change.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  addNewsletterSubscriber,
  addNewsletterSubscribersBulk,
  removeNewsletterSubscriber,
} from './newsletter-group-service.ts';

const log = createModuleLogger('newsletter-service');

// ── Types (server-side, §4.2) ──────────────────────────────────────────

interface SubscriberEntry {
  email: string;
  firstName?: string;
  surname?: string;
  name?: string;
  source?: string;
  confirmed?: boolean;
  active?: boolean;
  subscribedAt?: string;
  confirmedAt?: string;
  unsubscribedAt?: string | null;
  removedBy?: string | null;
  adminAdded?: boolean;
  adminAddedAt?: string;
  resubscribedAt?: string | null;
  resubscribedBy?: string | null;
  [key: string]: unknown;
}

export interface SubscriberView {
  email: string;
  firstName: string;
  surname: string;
  name: string;
  source: string;
  confirmed: boolean;
  active: boolean;
  subscribedAt: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  removedBy: string | null;
}

export interface BulkAddResult {
  added: number;
  skipped: number;
  errors: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function composeName(firstName?: string, surname?: string, legacyName?: string): string {
  if (firstName || surname) {
    return `${firstName || ''} ${surname || ''}`.trim();
  }
  return legacyName?.trim() || '';
}

function toSubscriberView(entry: SubscriberEntry): SubscriberView {
  return {
    email: entry.email,
    firstName: entry.firstName || '',
    surname: entry.surname || '',
    name: entry.firstName && entry.surname
      ? `${entry.firstName} ${entry.surname}`.trim()
      : entry.name || '',
    source: entry.source || 'unknown',
    confirmed: !!entry.confirmed,
    active: !!entry.active,
    subscribedAt: entry.subscribedAt || null,
    confirmedAt: entry.confirmedAt || null,
    unsubscribedAt: entry.unsubscribedAt || null,
    removedBy: entry.removedBy || null,
  };
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * List all subscribers, sorted by subscribedAt descending.
 */
export async function listSubscribers(): Promise<SubscriberView[]> {
  const entries: SubscriberEntry[] = await kv.getByPrefix('newsletter:');
  return entries
    .filter((e) => e && e.email)
    .map(toSubscriberView)
    .sort((a, b) => {
      const dateA = a.subscribedAt ? new Date(a.subscribedAt).getTime() : 0;
      const dateB = b.subscribedAt ? new Date(b.subscribedAt).getTime() : 0;
      return dateB - dateA;
    });
}

/**
 * Add a single subscriber (admin manual upload — bypasses double opt-in).
 * Returns { alreadySubscribed, message, subscriber }.
 */
export async function addSubscriber(input: {
  email: string;
  firstName?: string;
  surname?: string;
  name?: string;
}): Promise<{ alreadySubscribed: boolean; message: string; subscriber?: SubscriberView }> {
  const normEmail = input.email.trim().toLowerCase();
  const normFirstName = input.firstName?.trim() || '';
  const normSurname = input.surname?.trim() || '';
  const composedName = composeName(normFirstName, normSurname, input.name);

  const subscriptionKey = `newsletter:${normEmail}`;
  const timestamp = new Date().toISOString();

  const existing: SubscriberEntry | null = await kv.get(subscriptionKey);

  if (existing && existing.confirmed && existing.active) {
    return {
      alreadySubscribed: true,
      message: `${normEmail} is already an active subscriber`,
    };
  }

  const updated: SubscriberEntry = {
    ...(existing || {}),
    email: normEmail,
    firstName: normFirstName || existing?.firstName || '',
    surname: normSurname || existing?.surname || '',
    name: composedName || existing?.name || '',
    subscribedAt: existing?.subscribedAt || timestamp,
    confirmedAt: timestamp,
    source: 'Admin Manual Upload',
    confirmed: true,
    active: true,
    adminAdded: true,
    adminAddedAt: timestamp,
  };

  await kv.set(subscriptionKey, updated);
  await addNewsletterSubscriber(normEmail, composedName);

  log.info('Admin manually added newsletter subscriber', { email: normEmail });

  return {
    alreadySubscribed: false,
    message: `${normEmail} added to newsletter`,
    subscriber: toSubscriberView(updated),
  };
}

/**
 * Bulk-add subscribers from parsed spreadsheet data.
 */
export async function bulkAddSubscribers(
  subscribers: { email?: string; firstName?: string; surname?: string; name?: string }[],
): Promise<BulkAddResult> {
  const timestamp = new Date().toISOString();
  const results: BulkAddResult = { added: 0, skipped: 0, errors: [] };
  const groupEntries: { email: string; name?: string }[] = [];

  for (const sub of subscribers) {
    try {
      const email = sub.email?.trim()?.toLowerCase();
      if (!email || !email.includes('@')) {
        results.errors.push(`Invalid email: ${sub.email || '(empty)'}`);
        continue;
      }

      const subscriptionKey = `newsletter:${email}`;
      const existing: SubscriberEntry | null = await kv.get(subscriptionKey);

      if (existing && existing.confirmed && existing.active) {
        results.skipped++;
        continue;
      }

      const normFirstName = sub.firstName?.trim() || '';
      const normSurname = sub.surname?.trim() || '';
      const composedName = composeName(normFirstName, normSurname, sub.name);

      await kv.set(subscriptionKey, {
        ...(existing || {}),
        email,
        firstName: normFirstName || existing?.firstName || '',
        surname: normSurname || existing?.surname || '',
        name: composedName || existing?.name || '',
        subscribedAt: existing?.subscribedAt || timestamp,
        confirmedAt: timestamp,
        source: 'Admin Bulk Upload',
        confirmed: true,
        active: true,
        adminAdded: true,
        adminAddedAt: timestamp,
      });

      groupEntries.push({ email, name: composedName || undefined });
      results.added++;
    } catch (err) {
      results.errors.push(
        `Failed for ${sub.email}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // Batch-update newsletter group ONCE
  if (groupEntries.length > 0) {
    await addNewsletterSubscribersBulk(groupEntries);
  }

  log.info('Admin bulk upload complete', {
    added: results.added,
    skipped: results.skipped,
    errors: results.errors.length,
  });

  return results;
}

/**
 * Remove (deactivate) a subscriber by email.
 */
export async function removeSubscriberByEmail(email: string): Promise<void> {
  const normEmail = email.trim().toLowerCase();
  const subscriptionKey = `newsletter:${normEmail}`;
  const existing: SubscriberEntry | null = await kv.get(subscriptionKey);

  if (!existing) {
    throw new Error('Subscriber not found');
  }

  await kv.set(subscriptionKey, {
    ...existing,
    active: false,
    unsubscribedAt: new Date().toISOString(),
    removedBy: 'admin',
  });

  await removeNewsletterSubscriber(normEmail);
  log.info('Admin removed newsletter subscriber', { email: normEmail });
}

/**
 * Re-subscribe a previously unsubscribed subscriber.
 */
export async function resubscribeByEmail(
  email: string,
): Promise<{ alreadyActive: boolean; message: string }> {
  const normEmail = email.trim().toLowerCase();
  const subscriptionKey = `newsletter:${normEmail}`;
  const existing: SubscriberEntry | null = await kv.get(subscriptionKey);

  if (!existing) {
    throw new Error('Subscriber not found');
  }

  if (existing.active && existing.confirmed) {
    return {
      alreadyActive: true,
      message: `${normEmail} is already an active subscriber`,
    };
  }

  const timestamp = new Date().toISOString();

  await kv.set(subscriptionKey, {
    ...existing,
    active: true,
    confirmed: true,
    confirmedAt: existing.confirmedAt || timestamp,
    unsubscribedAt: null,
    removedBy: null,
    resubscribedAt: timestamp,
    resubscribedBy: 'admin',
  });

  const composedName = composeName(existing.firstName, existing.surname, existing.name);
  await addNewsletterSubscriber(normEmail, composedName);
  log.info('Admin re-subscribed newsletter subscriber', { email: normEmail });

  return {
    alreadyActive: false,
    message: `${normEmail} re-subscribed to newsletter`,
  };
}

/**
 * Newsletter KPI summary for admin dashboard.
 */
export async function getStats(): Promise<{
  totalSubscribers: number;
  confirmedSubscribers: number;
  activeSubscribers: number;
  totalBroadcasts: number;
  broadcastsThisMonth: number;
  lastBroadcastAt: string | null;
  lastBroadcastSubject: string | null;
}> {
  const [subscribers, broadcasts] = await Promise.all([
    kv.getByPrefix('newsletter:'),
    kv.getByPrefix('broadcast:'),
  ]);

  const allSubs = (subscribers as SubscriberEntry[]).filter((e) => e && e.email);
  const confirmed = allSubs.filter((e) => e.confirmed);
  const active = confirmed.filter((e) => e.active);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const broadcastsThisMonth = (broadcasts as any[]).filter(
    (b) => b && b.sentAt && new Date(b.sentAt) >= monthStart,
  );

  const sorted = (broadcasts as any[])
    .filter((b) => b && b.sentAt)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  const lastBroadcast = sorted[0] || null;

  return {
    totalSubscribers: allSubs.length,
    confirmedSubscribers: confirmed.length,
    activeSubscribers: active.length,
    totalBroadcasts: (broadcasts as any[]).filter((b) => b && b.id).length,
    broadcastsThisMonth: broadcastsThisMonth.length,
    lastBroadcastAt: lastBroadcast?.sentAt || null,
    lastBroadcastSubject: lastBroadcast?.subject || null,
  };
}
