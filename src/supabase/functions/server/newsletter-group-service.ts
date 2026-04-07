/**
 * Newsletter Group Service
 *
 * Manages the "Newsletter Contacts" communication group — a hybrid group
 * that contains both existing clients (by clientId) and external
 * contacts (by email).  This bridges the gap between the client-only
 * communication groups and the public newsletter subscription flow.
 *
 * KV key: communication:groups:{NEWSLETTER_GROUP_ID}
 *
 * The group is lazily created on first confirmed subscriber.
 */

import * as kv from './kv_store.tsx';
import * as repo from './communication-repo.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { ExternalContact } from './communication-types.ts';
import type { Group } from './communication-types.ts';

const log = createModuleLogger('newsletter-group');

/** Well-known ID for the Newsletter Contacts group */
const NEWSLETTER_GROUP_ID = 'sys_newsletter_contacts';
const NEWSLETTER_GROUP_NAME = 'Newsletter Contacts';
const LEGACY_BACKFILL_STATE_KEY = 'newsletter:group_backfill:legacy_subscribers';
const NEWSLETTER_PREFIX = 'newsletter:';
const NEWSLETTER_BACKFILL_BATCH_SIZE = 200;

interface NewsletterSubscriptionRecord {
  email: string;
  name?: string;
  confirmed?: boolean;
  active?: boolean;
}

interface NewsletterGroupBackfillState {
  completedAt: string;
  subscriberCount: number;
  batchCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensure the "Newsletter Contacts" system group exists.
 * Creates it idempotently if missing.
 */
async function ensureNewsletterGroup(): Promise<Group> {
  let group = await repo.getGroupById(NEWSLETTER_GROUP_ID);

  if (!group) {
    log.info('Creating Newsletter Contacts system group');

    const now = new Date().toISOString();
    group = {
      id: NEWSLETTER_GROUP_ID,
      name: NEWSLETTER_GROUP_NAME,
      description:
        'Auto-managed group of confirmed newsletter subscribers. Includes both existing clients and external website visitors.',
      color: '#6d28d9',
      type: 'system' as const,
      clientIds: [],
      externalContacts: [],
      filterConfig: {},
      clientCount: 0,
      createdBy: 'system',
      createdAt: now,
      updatedAt: now,
    };

    await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, group);
    log.info('Newsletter Contacts group created', { id: NEWSLETTER_GROUP_ID });
  }

  return group;
}

export async function getNewsletterGroupBackfillState(): Promise<NewsletterGroupBackfillState | null> {
  return await kv.get(LEGACY_BACKFILL_STATE_KEY) as NewsletterGroupBackfillState | null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a confirmed newsletter subscriber to the Newsletter Contacts group.
 *
 * - If the subscriber email matches an existing client, they are added
 *   to `clientIds` (looked up by scanning `user_profile:*:personal_info`).
 * - Otherwise they are added as an `externalContact`.
 * - Duplicate emails are silently ignored.
 */
export async function addNewsletterSubscriber(
  email: string,
  name?: string,
): Promise<void> {
  try {
    const group = await ensureNewsletterGroup();

    const externalContacts: ExternalContact[] = group.externalContacts || [];
    const clientIds: string[] = group.clientIds || [];

    // Check for duplicate
    const alreadyExternal = externalContacts.some(
      (c: ExternalContact) => c.email.toLowerCase() === email.toLowerCase(),
    );

    // Try to find an existing client with this email
    let matchedClientId: string | null = null;
    try {
      const profiles = await kv.getByPrefix('user_profile:');
      for (const profile of profiles) {
        const profileEmail =
          profile?.email ||
          profile?.personalInformation?.email ||
          profile?.contactDetails?.email;
        if (profileEmail && profileEmail.toLowerCase() === email.toLowerCase()) {
          // Extract userId from key pattern  user_profile:{userId}:personal_info
          // The profile itself should have an id or userId field
          matchedClientId = profile.userId || profile.id || null;
          break;
        }
      }
    } catch (lookupErr) {
      log.error('Client lookup for newsletter subscriber failed (non-blocking)', lookupErr);
    }

    if (matchedClientId) {
      // Existing client — add to clientIds if not already present
      if (!clientIds.includes(matchedClientId)) {
        clientIds.push(matchedClientId);
        log.info('Added existing client to Newsletter Contacts group', {
          clientId: matchedClientId,
          email,
        });
      } else {
        log.info('Client already in Newsletter Contacts group', {
          clientId: matchedClientId,
        });
      }
    } else if (!alreadyExternal) {
      // External subscriber — add to externalContacts
      externalContacts.push({
        email,
        name: name || undefined,
        source: 'newsletter',
        subscribedAt: new Date().toISOString(),
      });
      log.info('Added external subscriber to Newsletter Contacts group', { email });
    } else {
      log.info('Subscriber already in Newsletter Contacts group', { email });
      return; // No change needed
    }

    // Persist — update both arrays and recalculate count
    const updatedGroup = {
      ...group,
      clientIds,
      externalContacts,
      clientCount: clientIds.length + externalContacts.length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, updatedGroup);
    log.info('Newsletter Contacts group updated', {
      clientCount: updatedGroup.clientCount,
    });
  } catch (error) {
    log.error('Failed to add subscriber to Newsletter Contacts group', error);
    // Non-blocking — the subscription itself should still succeed
  }
}

/**
 * Bulk-add confirmed newsletter subscribers to the Newsletter Contacts group.
 *
 * Performs the expensive `user_profile:` prefix scan ONCE and then resolves
 * all subscribers against the cached result in-memory.  This replaces
 * calling `addNewsletterSubscriber` inside a loop, which would scan
 * profiles N times and cause request timeouts on bulk imports.
 */
export async function addNewsletterSubscribersBulk(
  entries: { email: string; name?: string }[],
): Promise<void> {
  if (entries.length === 0) return;

  try {
    const group = await ensureNewsletterGroup();

    const externalContacts: ExternalContact[] = [...(group.externalContacts || [])];
    const clientIds: string[] = [...(group.clientIds || [])];

    // One-time profile scan — build email→clientId map
    const emailToClientId = new Map<string, string>();
    try {
      const profiles = await kv.getByPrefix('user_profile:');
      for (const profile of profiles) {
        const profileEmail = (
          profile?.email ||
          profile?.personalInformation?.email ||
          profile?.contactDetails?.email
        )?.toLowerCase();
        const cid = profile?.userId || profile?.id;
        if (profileEmail && cid) {
          emailToClientId.set(profileEmail, cid);
        }
      }
    } catch (lookupErr) {
      log.error('Client lookup for bulk subscriber import failed (non-blocking)', lookupErr);
    }

    let changed = false;
    const now = new Date().toISOString();

    for (const { email, name } of entries) {
      const normEmail = email.toLowerCase();
      const matchedClientId = emailToClientId.get(normEmail) || null;

      if (matchedClientId) {
        if (!clientIds.includes(matchedClientId)) {
          clientIds.push(matchedClientId);
          changed = true;
        }
      } else {
        const alreadyExternal = externalContacts.some(
          (c: ExternalContact) => c.email.toLowerCase() === normEmail,
        );
        if (!alreadyExternal) {
          externalContacts.push({
            email: normEmail,
            name: name || undefined,
            source: 'newsletter',
            subscribedAt: now,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      const updatedGroup = {
        ...group,
        clientIds,
        externalContacts,
        clientCount: clientIds.length + externalContacts.length,
        updatedAt: now,
      };

      await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, updatedGroup);
      log.info('Newsletter Contacts group bulk-updated', {
        clientCount: updatedGroup.clientCount,
        newEntries: entries.length,
      });
    }
  } catch (error) {
    log.error('Failed to bulk-add subscribers to Newsletter Contacts group', error);
    // Non-blocking — the subscriptions themselves should still succeed
  }
}

/**
 * Remove a subscriber from the Newsletter Contacts group (unsubscribe).
 */
export async function removeNewsletterSubscriber(email: string): Promise<void> {
  try {
    const group = await repo.getGroupById(NEWSLETTER_GROUP_ID);
    if (!group) return;

    const externalContacts: ExternalContact[] = (group.externalContacts || []).filter(
      (c: ExternalContact) => c.email.toLowerCase() !== email.toLowerCase(),
    );

    // Also check client match
    let clientIds: string[] = group.clientIds || [];
    try {
      const profiles = await kv.getByPrefix('user_profile:');
      for (const profile of profiles) {
        const profileEmail =
          profile?.email ||
          profile?.personalInformation?.email ||
          profile?.contactDetails?.email;
        if (profileEmail && profileEmail.toLowerCase() === email.toLowerCase()) {
          const cid = profile.userId || profile.id;
          if (cid) {
            clientIds = clientIds.filter((id: string) => id !== cid);
          }
          break;
        }
      }
    } catch {
      // best-effort
    }

    const updatedGroup = {
      ...group,
      clientIds,
      externalContacts,
      clientCount: clientIds.length + externalContacts.length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, updatedGroup);
    log.info('Subscriber removed from Newsletter Contacts group', { email });
  } catch (error) {
    log.error('Failed to remove subscriber from Newsletter Contacts group', error);
  }
}

/**
 * Update a newsletter subscriber contact inside the Newsletter Contacts group.
 *
 * - If the email changed, removes the previous email and adds the new one.
 * - If only the name changed and the subscriber is an external contact,
 *   updates it in-place.
 * - If no matching external contact exists, falls back to add flow.
 */
export async function updateNewsletterSubscriberContact(
  previousEmail: string,
  nextEmail: string,
  name?: string,
): Promise<void> {
  const normPrevious = previousEmail.trim().toLowerCase();
  const normNext = nextEmail.trim().toLowerCase();
  const nextName = name?.trim() || undefined;

  if (!normPrevious || !normNext) return;

  if (normPrevious !== normNext) {
    await removeNewsletterSubscriber(normPrevious);
    await addNewsletterSubscriber(normNext, nextName);
    return;
  }

  try {
    const group = await repo.getGroupById(NEWSLETTER_GROUP_ID);
    if (!group) {
      await addNewsletterSubscriber(normNext, nextName);
      return;
    }

    const externalContacts: ExternalContact[] = [...(group.externalContacts || [])];
    const existingIndex = externalContacts.findIndex(
      (c: ExternalContact) => c.email.toLowerCase() === normNext,
    );

    if (existingIndex === -1) {
      await addNewsletterSubscriber(normNext, nextName);
      return;
    }

    externalContacts[existingIndex] = {
      ...externalContacts[existingIndex],
      name: nextName,
    };

    const updatedGroup = {
      ...group,
      externalContacts,
      clientCount: (group.clientIds || []).length + externalContacts.length,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, updatedGroup);
    log.info('Updated Newsletter Contacts external subscriber details', { email: normNext });
  } catch (error) {
    log.error('Failed to update subscriber in Newsletter Contacts group', error);
  }
}

/**
 * Backfill older confirmed active newsletter KV records into the Newsletter
 * Contacts group as external contacts.
 *
 * This intentionally avoids profile/client matching so the repair stays fast
 * and bounded even when the KV table is large. Recipient de-duplication is
 * still handled by email when campaigns are queued.
 */
export async function backfillLegacyNewsletterSubscribersToGroup(): Promise<NewsletterGroupBackfillState> {
  const existingState = await getNewsletterGroupBackfillState();
  if (existingState) {
    return existingState;
  }

  const group = await ensureNewsletterGroup();
  const externalContacts: ExternalContact[] = [...(group.externalContacts || [])];
  const existingEmails = new Set(externalContacts.map((contact) => contact.email.toLowerCase()));

  let lastKey: string | undefined;
  let batchCount = 0;
  let subscriberCount = 0;

  while (true) {
    const rows = await kv.listByPrefix(NEWSLETTER_PREFIX, {
      limit: NEWSLETTER_BACKFILL_BATCH_SIZE,
      startAfter: lastKey,
    });

    if (rows.length === 0) {
      break;
    }

    batchCount++;

    for (const row of rows) {
      const subscription = row.value as NewsletterSubscriptionRecord | null;
      const email = subscription?.email?.trim().toLowerCase();
      if (!email || !subscription?.confirmed || subscription.active === false) continue;
      if (existingEmails.has(email)) continue;

      existingEmails.add(email);
      subscriberCount++;
      externalContacts.push({
        email,
        name: subscription.name?.trim() || undefined,
        source: 'newsletter-legacy-backfill',
        subscribedAt: new Date().toISOString(),
      });
    }

    if (rows.length < NEWSLETTER_BACKFILL_BATCH_SIZE) {
      break;
    }

    lastKey = rows[rows.length - 1]?.key;
  }

  const now = new Date().toISOString();
  if (subscriberCount > 0) {
    await kv.set(`communication:groups:${NEWSLETTER_GROUP_ID}`, {
      ...group,
      externalContacts,
      clientCount: (group.clientIds || []).length + externalContacts.length,
      updatedAt: now,
    });
  }

  const state: NewsletterGroupBackfillState = {
    completedAt: now,
    subscriberCount,
    batchCount,
  };

  await kv.set(LEGACY_BACKFILL_STATE_KEY, state);
  log.info('Legacy newsletter subscriber backfill completed', state);
  return state;
}
