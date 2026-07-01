import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { backfillLegacyNewsletterSubscribersToGroup } from './newsletter-group-service.ts';
import {
  extractFirstName,
  getProfileEmail,
  getProfileFirstName,
  getProfileFullName,
} from './profile-name-resolver.ts';
import {
  chunkArray,
  LEGACY_SUBSCRIPTION_PAGE_SIZE,
  NEWSLETTER_GROUP_KEY,
  NEWSLETTER_PREFIX,
  normalizeSendError,
  PROFILE_LOOKUP_BATCH_SIZE,
} from './publications-notification-helpers.ts';
import { persistArticleEmailTrackingRecords } from './publications-email-engagement-service.ts';
import type {
  ArticleEmailTrackingRecord,
  ArticleNotificationRecipient,
  ExternalContact,
  LegacySubscriptionPageOptions,
  NewsletterGroup,
  NewsletterSubscription,
} from './publications-notification-types.ts';

const log = createModuleLogger('article-notifications');

export { extractFirstName };

async function collectRecipientsFromNewsletterGroup(
  recipientMap: Map<string, ArticleNotificationRecipient>,
  requestedEmails: Set<string> | null,
): Promise<number> {
  const group = (await kv.get(NEWSLETTER_GROUP_KEY)) as NewsletterGroup | null;

  if (!group) {
    log.warn('Newsletter Contacts group not found while resolving article notification recipients');
    return 0;
  }

  let addedCount = 0;

  // Resolve live client profiles FIRST so their current names win the first-wins
  // dedup below. A client's email may also appear as a legacy-backfilled external
  // contact carrying a stale name; processing profiles first ensures the
  // client-management name is used rather than the frozen contact name.
  const clientIds = Array.isArray(group.clientIds) ? group.clientIds.filter(Boolean) : [];
  if (clientIds.length > 0) {
    const profileKeys = clientIds.map((clientId) => `user_profile:${clientId}:personal_info`);
    for (const batch of chunkArray(profileKeys, PROFILE_LOOKUP_BATCH_SIZE)) {
      const profiles = (await kv.mget(batch)) as Array<Record<string, unknown> | null | undefined>;

      for (const profile of profiles) {
        const email = getProfileEmail(profile);
        if (!email) continue;
        if (requestedEmails && !requestedEmails.has(email)) continue;
        if (recipientMap.has(email)) continue;

        const firstName = getProfileFirstName(profile, email);
        recipientMap.set(email, {
          email,
          firstName,
          name: getProfileFullName(profile, firstName),
        });
        addedCount++;
      }
    }
  }

  if (group.externalContacts?.length) {
    for (const contact of group.externalContacts as ExternalContact[]) {
      const email = contact.email?.trim().toLowerCase();
      if (!email) continue;
      if (requestedEmails && !requestedEmails.has(email)) continue;
      if (recipientMap.has(email)) continue;

      const firstName = contact.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: contact.name || firstName,
      });
      addedCount++;
    }
  }

  return addedCount;
}

async function collectRecipientsFromRequestedLegacySubscriptions(
  recipientMap: Map<string, ArticleNotificationRecipient>,
  requestedEmails: Set<string>,
): Promise<number> {
  const unresolvedEmails = [...requestedEmails].filter((email) => !recipientMap.has(email));
  if (unresolvedEmails.length === 0) return 0;

  let addedCount = 0;

  for (const email of unresolvedEmails) {
    try {
      const subscription = (await kv.get(
        `${NEWSLETTER_PREFIX}${email}`,
      )) as NewsletterSubscription | null;
      if (!subscription || !subscription.confirmed || subscription.active === false) continue;

      const firstName = subscription.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: subscription.name || firstName,
      });
      addedCount++;
    } catch (error) {
      log.warn('Failed to resolve legacy newsletter subscription for requested recipient', {
        email,
        error: normalizeSendError(error),
      });
    }
  }

  return addedCount;
}

async function listLegacyNewsletterSubscriptionPage(
  options?: LegacySubscriptionPageOptions,
): Promise<Array<{ key: string; value: NewsletterSubscription | null }>> {
  return (await kv.listByPrefix(NEWSLETTER_PREFIX, {
    startAfter: options?.startAfter,
    limit: options?.limit ?? LEGACY_SUBSCRIPTION_PAGE_SIZE,
  })) as Array<{ key: string; value: NewsletterSubscription | null }>;
}

async function collectRecipientsFromAllLegacySubscriptions(
  recipientMap: Map<string, ArticleNotificationRecipient>,
): Promise<number> {
  let lastKey: string | undefined;
  let addedCount = 0;

  while (true) {
    const rows = await listLegacyNewsletterSubscriptionPage({
      startAfter: lastKey,
    });

    if (rows.length === 0) {
      return addedCount;
    }

    for (const row of rows) {
      const subscription = row.value as NewsletterSubscription | null;
      const email = subscription?.email?.trim().toLowerCase();
      if (!email || !subscription?.confirmed || subscription.active === false) continue;
      if (recipientMap.has(email)) continue;

      const firstName = subscription.name || extractFirstName(email);
      recipientMap.set(email, {
        email,
        firstName,
        name: subscription.name || firstName,
      });
      addedCount++;
    }

    if (rows.length < LEGACY_SUBSCRIPTION_PAGE_SIZE) {
      return addedCount;
    }

    lastKey = rows[rows.length - 1]?.key;
  }
}

export async function collectArticleNotificationRecipients(
  recipientEmails?: string[],
): Promise<ArticleNotificationRecipient[]> {
  const requestedEmails = recipientEmails?.length
    ? new Set(recipientEmails.map((email) => email.trim().toLowerCase()))
    : null;

  const recipientMap = new Map<string, ArticleNotificationRecipient>();

  if (!requestedEmails) {
    try {
      await backfillLegacyNewsletterSubscribersToGroup();
    } catch (err) {
      log.error(
        'Legacy newsletter subscriber backfill failed before recipient collection (non-blocking)',
        err,
      );
    }
  }

  try {
    const addedFromGroup = await collectRecipientsFromNewsletterGroup(
      recipientMap,
      requestedEmails,
    );
    log.info('Collected article notification recipients from Newsletter Contacts group', {
      requestedRecipientCount: requestedEmails?.size ?? null,
      addedFromGroup,
      totalUniqueRecipients: recipientMap.size,
    });
  } catch (err) {
    log.error('Failed to fetch Newsletter Contacts group recipients (non-blocking)', err);
  }

  if (requestedEmails) {
    const addedFromLegacyRequested = await collectRecipientsFromRequestedLegacySubscriptions(
      recipientMap,
      requestedEmails,
    );
    log.info('Resolved requested legacy newsletter recipients', {
      requestedRecipientCount: requestedEmails.size,
      addedFromLegacyRequested,
      totalUniqueRecipients: recipientMap.size,
    });
  } else {
    try {
      const addedFromLegacy = await collectRecipientsFromAllLegacySubscriptions(recipientMap);
      log.info('Collected article notification recipients from legacy newsletter subscriptions', {
        addedFromLegacy,
        totalUniqueRecipients: recipientMap.size,
      });
    } catch (err) {
      log.error('Failed to fetch recipients from legacy newsletter subscriptions', err);
    }
  }

  return [...recipientMap.values()].sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Refresh the denormalized recipient names on a batch of tracking records to the
 * client's CURRENT name before delivery.
 *
 * Article notification names are frozen into tracking records at queue time.
 * Retry jobs and the cron scheduler can deliver days later, by which point an
 * admin may have renamed the client in the client manager. This re-resolves the
 * current names (via the same recipient-collection precedence, so live profiles
 * beat stale external contacts) and rewrites only the records whose names
 * actually changed — keeping the admin engagement UI consistent too.
 *
 * Non-blocking by design: any failure logs a warning and returns the original
 * records so delivery is never held up by name resolution.
 */
export async function refreshTrackingRecordRecipientNames(
  records: ArticleEmailTrackingRecord[],
): Promise<ArticleEmailTrackingRecord[]> {
  if (records.length === 0) return records;

  try {
    const uniqueEmails = [...new Set(records.map((record) => record.recipientEmail))];
    const recipients = await collectArticleNotificationRecipients(uniqueEmails);
    const recipientByEmail = new Map(recipients.map((recipient) => [recipient.email, recipient]));

    const changed: ArticleEmailTrackingRecord[] = [];
    const result = records.map((record) => {
      const recipient = recipientByEmail.get(record.recipientEmail);
      if (!recipient) return record;

      const nextFirstName = recipient.firstName || record.recipientFirstName;
      const nextName = recipient.name || record.recipientName;

      if (nextFirstName === record.recipientFirstName && nextName === record.recipientName) {
        return record;
      }

      const updated: ArticleEmailTrackingRecord = {
        ...record,
        recipientFirstName: nextFirstName,
        recipientName: nextName,
      };
      changed.push(updated);
      return updated;
    });

    if (changed.length > 0) {
      await persistArticleEmailTrackingRecords(changed);
      log.info('Refreshed recipient names on tracking records before delivery', {
        batchSize: records.length,
        changed: changed.length,
      });
    }

    return result;
  } catch (error) {
    log.warn('Failed to refresh tracking record recipient names — using stored names', {
      batchSize: records.length,
      error: normalizeSendError(error),
    });
    return records;
  }
}
