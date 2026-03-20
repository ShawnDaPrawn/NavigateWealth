/**
 * Publications Notification Service
 *
 * Sends article notification emails to confirmed newsletter subscribers
 * when an article is published. Uses the existing article notification
 * template and SendGrid email infrastructure.
 *
 * Subscriber sources:
 *  - `newsletter:{email}` KV entries with `confirmed: true`
 *  - External contacts in the Newsletter Contacts group
 *
 * This runs as a fire-and-forget background task to avoid blocking
 * the publish response. Errors are logged but never thrown to the caller.
 *
 * KV Key Convention:
 *   newsletter:{email}                          - Individual subscriber records
 *   communication:groups:sys_newsletter_contacts - Newsletter Contacts group
 *
 * @module publications/notification-service
 */

import * as kv from './kv_store.tsx';
import { sendEmail } from './email-service.ts';
import { createArticleNotificationEmail } from './article-notification-template.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('article-notifications');

const NEWSLETTER_PREFIX = 'newsletter:';
const NEWSLETTER_GROUP_KEY = 'communication:groups:sys_newsletter_contacts';

/** Minimal article shape needed for notifications */
interface PublishedArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
}

export interface ArticleNotificationRecipient {
  email: string;
  firstName: string;
  name: string;
}

export interface ArticleNotificationRunResult {
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  failed: number;
  recipients: ArticleNotificationRecipient[];
  errors: string[];
}

/** Subscriber record stored under newsletter:{email} */
interface NewsletterSubscription {
  email: string;
  name?: string;
  confirmed: boolean;
  active?: boolean;
}

/** External contact in the Newsletter Contacts group */
interface ExternalContact {
  email: string;
  name?: string;
  source: string;
  subscribedAt: string;
}

/** Newsletter Contacts group shape (partial) */
interface NewsletterGroup {
  clientIds: string[];
  externalContacts?: ExternalContact[];
}

async function collectArticleNotificationRecipients(
  recipientEmails?: string[],
): Promise<ArticleNotificationRecipient[]> {
  const requestedEmails = recipientEmails?.length
    ? new Set(recipientEmails.map((email) => email.trim().toLowerCase()))
    : null;

  const recipientMap = new Map<string, ArticleNotificationRecipient>();

  try {
    const allSubs = await kv.getByPrefix(NEWSLETTER_PREFIX) as NewsletterSubscription[];
    for (const sub of allSubs) {
      if (!sub.confirmed || sub.active === false || !sub.email) continue;

      const email = sub.email.toLowerCase();
      if (requestedEmails && !requestedEmails.has(email)) continue;
      if (!recipientMap.has(email)) {
        const firstName = sub.name || extractFirstName(email);
        recipientMap.set(email, {
          email,
          firstName,
          name: sub.name || firstName,
        });
      }
    }
    log.info(`Collected ${recipientMap.size} recipient(s) from newsletter KV`);
  } catch (err) {
    log.error('Failed to fetch newsletter KV entries (non-blocking)', err);
  }

  try {
    const group = await kv.get(NEWSLETTER_GROUP_KEY) as NewsletterGroup | null;
    if (group?.externalContacts?.length) {
      for (const contact of group.externalContacts) {
        const email = contact.email.toLowerCase();
        if (requestedEmails && !requestedEmails.has(email)) continue;
        if (!recipientMap.has(email)) {
          const firstName = contact.name || extractFirstName(email);
          recipientMap.set(email, {
            email,
            firstName,
            name: contact.name || firstName,
          });
        }
      }
      log.info(`Added ${group.externalContacts.length} external contact(s) from Newsletter group`);
    }
  } catch (err) {
    log.error('Failed to fetch Newsletter Contacts group (non-blocking)', err);
  }

  return [...recipientMap.values()].sort((a, b) => a.email.localeCompare(b.email));
}

export async function runArticleNotificationDelivery(
  article: PublishedArticle,
  options?: {
    dryRun?: boolean;
    recipientEmails?: string[];
  },
): Promise<ArticleNotificationRunResult> {
  const dryRun = options?.dryRun ?? false;
  const recipients = await collectArticleNotificationRecipients(options?.recipientEmails);

  if (recipients.length === 0) {
    return {
      dryRun,
      recipientCount: 0,
      sent: 0,
      failed: 0,
      recipients: [],
      errors: [],
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      recipientCount: recipients.length,
      sent: 0,
      failed: 0,
      recipients,
      errors: [],
    };
  }

  const articleUrl = `https://navigatewealth.co/resources/article/${article.slug}`;
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const unsubscribeUrl = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
      const { html, text } = await createArticleNotificationEmail({
        firstName: recipient.firstName,
        articleTitle: article.title,
        articleExcerpt: article.excerpt || 'A new article has been published on Navigate Wealth.',
        articleUrl,
        unsubscribeUrl,
      });

      await sendEmail({
        to: recipient.email,
        subject: `New article: ${article.title}`,
        html,
        text,
      });

      sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${recipient.email}: ${msg}`);
      log.error(`Failed to send article notification to ${recipient.email}: ${msg}`);
    }
  }

  return {
    dryRun: false,
    recipientCount: recipients.length,
    sent,
    failed,
    recipients,
    errors,
  };
}

/**
 * Send article notification emails to all confirmed newsletter subscribers.
 *
 * This is designed to be called fire-and-forget after an article is published.
 * It never throws - all errors are logged internally.
 *
 * @param article - The published article (must have id, title, slug, excerpt)
 */
export async function sendArticlePublishedNotifications(article: PublishedArticle): Promise<void> {
  try {
    log.info('Starting article publish notifications', { articleId: article.id, title: article.title });

    const result = await runArticleNotificationDelivery(article);
    if (result.recipientCount === 0) {
      log.info('No confirmed subscribers found - skipping notifications');
      return;
    }

    log.info('Article publish notifications complete', {
      articleId: article.id,
      total: result.recipientCount,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (err) {
    // Top-level catch - never propagate errors to the caller
    log.error('Article publish notification service failed', err);
  }
}

/**
 * Extract a reasonable first name from an email address.
 * Fallback when no name is stored.
 */
function extractFirstName(email: string): string {
  const local = email.split('@')[0] || 'Subscriber';
  const cleaned = local
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .trim();

  if (!cleaned) return 'Subscriber';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).split(' ')[0];
}
