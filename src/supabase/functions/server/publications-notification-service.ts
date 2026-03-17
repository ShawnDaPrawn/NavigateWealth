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
 *   newsletter:{email}                                — Individual subscriber records
 *   communication:groups:sys_newsletter_contacts       — Newsletter Contacts group
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

/**
 * Send article notification emails to all confirmed newsletter subscribers.
 *
 * This is designed to be called fire-and-forget after an article is published.
 * It never throws — all errors are logged internally.
 *
 * @param article - The published article (must have id, title, slug, excerpt)
 */
export async function sendArticlePublishedNotifications(article: PublishedArticle): Promise<void> {
  try {
    log.info('Starting article publish notifications', { articleId: article.id, title: article.title });

    const articleUrl = `https://navigatewealth.co/resources/article/${article.slug}`;

    // ── Collect all confirmed subscriber emails ──────────────────────

    const recipientMap = new Map<string, string>(); // email → firstName

    // Source 1: Direct newsletter KV entries (newsletter:{email})
    try {
      const allSubs = await kv.getByPrefix(NEWSLETTER_PREFIX) as NewsletterSubscription[];
      for (const sub of allSubs) {
        if (sub.confirmed && sub.active !== false && sub.email) {
          const email = sub.email.toLowerCase();
          if (!recipientMap.has(email)) {
            recipientMap.set(email, sub.name || extractFirstName(email));
          }
        }
      }
      log.info(`Found ${recipientMap.size} confirmed subscribers from KV`);
    } catch (err) {
      log.error('Failed to fetch newsletter KV entries (non-blocking)', err);
    }

    // Source 2: Newsletter Contacts group external contacts
    try {
      const group = await kv.get(NEWSLETTER_GROUP_KEY) as NewsletterGroup | null;
      if (group?.externalContacts?.length) {
        for (const contact of group.externalContacts) {
          const email = contact.email.toLowerCase();
          if (!recipientMap.has(email)) {
            recipientMap.set(email, contact.name || extractFirstName(email));
          }
        }
        log.info(`Added ${group.externalContacts.length} external contacts from Newsletter group`);
      }
    } catch (err) {
      log.error('Failed to fetch Newsletter Contacts group (non-blocking)', err);
    }

    if (recipientMap.size === 0) {
      log.info('No confirmed subscribers found — skipping notifications');
      return;
    }

    // ── Send emails ──────────────────────────────────────────────────

    let successCount = 0;
    let failedCount = 0;

    for (const [email, firstName] of recipientMap) {
      try {
        const unsubscribeUrl = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
        const { html, text } = await createArticleNotificationEmail({
          firstName,
          articleTitle: article.title,
          articleExcerpt: article.excerpt || 'A new article has been published on Navigate Wealth.',
          articleUrl,
          unsubscribeUrl,
        });

        await sendEmail({
          to: email,
          subject: `New article: ${article.title}`,
          html,
          text,
        });

        successCount++;
      } catch (err) {
        failedCount++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log.error(`Failed to send article notification to ${email}: ${msg}`);
      }
    }

    log.info('Article publish notifications complete', {
      articleId: article.id,
      total: recipientMap.size,
      sent: successCount,
      failed: failedCount,
    });
  } catch (err) {
    // Top-level catch — never propagate errors to the caller
    log.error('Article publish notification service failed', err);
  }
}

/**
 * Extract a reasonable first name from an email address.
 * Fallback when no name is stored.
 */
function extractFirstName(email: string): string {
  const local = email.split('@')[0] || 'Subscriber';
  // Capitalise and clean up
  const cleaned = local
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .trim();
  if (!cleaned) return 'Subscriber';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).split(' ')[0];
}