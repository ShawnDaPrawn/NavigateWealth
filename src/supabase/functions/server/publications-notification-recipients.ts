import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { backfillLegacyNewsletterSubscribersToGroup } from './newsletter-group-service.ts';
import {
  chunkArray,
  LEGACY_SUBSCRIPTION_PAGE_SIZE,
  NEWSLETTER_GROUP_KEY,
  NEWSLETTER_PREFIX,
  normalizeSendError,
  PROFILE_LOOKUP_BATCH_SIZE,
} from './publications-notification-helpers.ts';
import type {
  ArticleNotificationRecipient,
  ExternalContact,
  LegacySubscriptionPageOptions,
  NewsletterGroup,
  NewsletterSubscription,
} from './publications-notification-types.ts';

const log = createModuleLogger('article-notifications');

export function extractFirstName(email: string): string {
  const local = email.split('@')[0] || 'Subscriber';
  const cleaned = local.replace(/[._-]/g, ' ').replace(/\d+/g, '').trim();

  if (!cleaned) return 'Subscriber';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).split(' ')[0];
}

function getProfileEmail(profile: Record<string, unknown> | null | undefined): string | null {
  if (!profile) return null;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const contactDetails = (profile.contactDetails || {}) as Record<string, unknown>;
  const email = profile.email || personalInformation.email || contactDetails.email;

  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

function getProfileFirstName(
  profile: Record<string, unknown> | null | undefined,
  fallbackEmail: string,
): string {
  if (!profile) return extractFirstName(fallbackEmail);

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const firstName = profile.firstName || personalInformation.firstName || profile.preferredName;

  return typeof firstName === 'string' && firstName.trim()
    ? firstName.trim()
    : extractFirstName(fallbackEmail);
}

function getProfileFullName(
  profile: Record<string, unknown> | null | undefined,
  firstName: string,
): string {
  if (!profile) return firstName;

  const personalInformation = (profile.personalInformation || {}) as Record<string, unknown>;
  const name = profile.name;
  const first = profile.firstName || personalInformation.firstName;
  const last = profile.lastName || personalInformation.lastName || personalInformation.surname;

  if (typeof name === 'string' && name.trim()) return name.trim();
  if ((typeof first === 'string' && first.trim()) || (typeof last === 'string' && last.trim())) {
    return `${typeof first === 'string' ? first.trim() : ''} ${typeof last === 'string' ? last.trim() : ''}`.trim();
  }

  return firstName;
}

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

  const clientIds = Array.isArray(group.clientIds) ? group.clientIds.filter(Boolean) : [];
  if (clientIds.length === 0) return addedCount;

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
