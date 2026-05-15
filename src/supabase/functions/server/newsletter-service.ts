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
  updateNewsletterSubscriberContact,
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

export interface UpdateSubscriberInput {
  currentEmail: string;
  email: string;
  firstName?: string;
  surname?: string;
  name?: string;
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
 * Update subscriber details (email and/or name fields).
 */
export async function updateSubscriberDetails(
  input: UpdateSubscriberInput,
): Promise<{ message: string; subscriber: SubscriberView }> {
  const normCurrentEmail = input.currentEmail.trim().toLowerCase();
  const normEmail = input.email.trim().toLowerCase();
  const normFirstName = input.firstName?.trim() || '';
  const normSurname = input.surname?.trim() || '';
  const composedName = composeName(normFirstName, normSurname, input.name);

  const currentKey = `newsletter:${normCurrentEmail}`;
  const existing: SubscriberEntry | null = await kv.get(currentKey);

  if (!existing) {
    throw new Error('Subscriber not found');
  }

  if (normCurrentEmail !== normEmail) {
    const targetExisting: SubscriberEntry | null = await kv.get(`newsletter:${normEmail}`);
    if (targetExisting && targetExisting.email && targetExisting.email !== normCurrentEmail) {
      throw new Error('A subscriber with this email already exists');
    }
  }

  const updated: SubscriberEntry = {
    ...existing,
    email: normEmail,
    firstName: normFirstName,
    surname: normSurname,
    name: composedName,
    updatedAt: new Date().toISOString(),
  };

  const targetKey = `newsletter:${normEmail}`;
  await kv.set(targetKey, updated);

  if (normCurrentEmail !== normEmail) {
    await kv.del(currentKey);
  }

  if (existing.active && existing.confirmed) {
    await updateNewsletterSubscriberContact(normCurrentEmail, normEmail, composedName);
  }

  log.info('Admin updated newsletter subscriber details', {
    previousEmail: normCurrentEmail,
    nextEmail: normEmail,
  });

  return {
    message: `${normCurrentEmail} updated`,
    subscriber: toSubscriberView(updated),
  };
}

/**
 * Auto-subscribe a client by email.  Fire-and-forget, non-blocking.
 * Used by auth-signup.ts and admin-client-onboarding-service.ts.
 *
 * Bypasses double opt-in (the user already opted into the platform).
 * If a newsletter entry already exists (confirmed + active), skips.
 * If a newsletter entry exists but is inactive (unsubscribed), respects
 * the unsubscribe and does NOT re-subscribe.
 */
export async function autoSubscribeClient(
  email: string,
  firstName?: string,
  surname?: string,
): Promise<void> {
  try {
    const normEmail = email.trim().toLowerCase();
    const subscriptionKey = `newsletter:${normEmail}`;

    const existing: SubscriberEntry | null = await kv.get(subscriptionKey);

    // Respect explicit unsubscribes — never auto-re-subscribe
    if (existing && existing.active === false) {
      return;
    }

    // Already active and confirmed
    if (existing && existing.confirmed && existing.active) {
      return;
    }

    const timestamp = new Date().toISOString();
    const normFirstName = firstName?.trim() || existing?.firstName || '';
    const normSurname = surname?.trim() || existing?.surname || '';
    const composedName = composeName(normFirstName, normSurname, existing?.name);

    const entry: SubscriberEntry = {
      ...(existing || {}),
      email: normEmail,
      firstName: normFirstName,
      surname: normSurname,
      name: composedName || existing?.name || '',
      subscribedAt: existing?.subscribedAt || timestamp,
      confirmedAt: timestamp,
      source: 'Client Signup Auto-Subscribe',
      confirmed: true,
      active: true,
    };

    await kv.set(subscriptionKey, entry);
    await addNewsletterSubscriber(normEmail, composedName);

    log.info('Auto-subscribed client to newsletter', { email: normEmail });
  } catch (error) {
    log.error('Auto-subscribe client failed (non-blocking)', error as Error);
    // Non-blocking — signup/onboarding must not fail on newsletter error
  }
}

/**
 * Reconcile all platform clients into the newsletter subscriber list.
 *
 * Fetches every client profile and every existing newsletter entry,
 * then creates newsletter entries for clients that aren't already
 * subscribed.  Explicitly unsubscribed clients (active: false) are
 * skipped to honour their opt-out.
 *
 * Returns { added, skipped, alreadySubscribed, errors } for audit.
 */
export async function reconcileClientsToSubscribers(): Promise<{
  added: number;
  skippedUnsubscribed: number;
  alreadySubscribed: number;
  errors: string[];
  totalClients: number;
  totalSubscribersBefore: number;
  totalSubscribersAfter: number;
}> {
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  // 1. Fetch all existing newsletter entries
  const newsletterEntries: SubscriberEntry[] = await kv.getByPrefix('newsletter:');
  const subscriptionMap = new Map<string, SubscriberEntry>();
  for (const entry of newsletterEntries) {
    if (entry && entry.email) {
      subscriptionMap.set(entry.email.toLowerCase(), entry);
    }
  }
  const totalSubscribersBefore = subscriptionMap.size;

  // 2. Fetch all client profiles
  const profiles = await kv.getByPrefix('user_profile:');
  const clientEmails = new Map<string, { email: string; firstName: string; surname: string }>();

  for (const profile of profiles) {
    if (!profile) continue;
    const profileEmail = (
      profile.email ||
      profile.personalInformation?.email ||
      profile.contactDetails?.email
    )?.trim().toLowerCase();

    if (!profileEmail) continue;

    const firstName = (
      profile.personalInformation?.firstName ||
      profile.firstName ||
      ''
    ).trim();

    const surname = (
      profile.personalInformation?.lastName ||
      profile.lastName ||
      profile.surname ||
      ''
    ).trim();

    // De-duplicate by email
    if (!clientEmails.has(profileEmail)) {
      clientEmails.set(profileEmail, { email: profileEmail, firstName, surname });
    }
  }

  const totalClients = clientEmails.size;
  let added = 0;
  let skippedUnsubscribed = 0;
  let alreadySubscribed = 0;

  // 3. Create missing newsletter entries
  for (const [, client] of clientEmails) {
    try {
      const existing = subscriptionMap.get(client.email);

      // Explicitly unsubscribed — skip
      if (existing && existing.active === false) {
        skippedUnsubscribed++;
        continue;
      }

      // Already active and confirmed
      if (existing && existing.confirmed && existing.active) {
        alreadySubscribed++;
        continue;
      }

      // Create or re-activate
      const subscriptionKey = `newsletter:${client.email}`;
      const composedName = composeName(client.firstName, client.surname, existing?.name);

      await kv.set(subscriptionKey, {
        ...(existing || {}),
        email: client.email,
        firstName: client.firstName || existing?.firstName || '',
        surname: client.surname || existing?.surname || '',
        name: composedName || existing?.name || '',
        subscribedAt: existing?.subscribedAt || timestamp,
        confirmedAt: timestamp,
        source: 'Client Reconciliation',
        confirmed: true,
        active: true,
      });

      await addNewsletterSubscriber(client.email, composedName);
      added++;
    } catch (err) {
      errors.push(`${client.email}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  const totalSubscribersAfter = subscriptionMap.size - skippedUnsubscribed + added;

  log.info('Client-to-subscriber reconciliation complete', {
    totalClients,
    totalSubscribersBefore,
    added,
    skippedUnsubscribed,
    alreadySubscribed,
    errors: errors.length,
  });

  return {
    added,
    skippedUnsubscribed,
    alreadySubscribed,
    errors,
    totalClients,
    totalSubscribersBefore,
    totalSubscribersAfter,
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
