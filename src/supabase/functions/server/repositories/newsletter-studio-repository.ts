/**
 * Newsletter Studio — typed KV repositories.
 *
 * All studio storage goes through these instances rather than direct
 * `kv.*` calls (kv-direct-access ratchet). Namespaces live under
 * `nlstudio:` — NOT `newsletter:`, which newsletter-service.ts scans
 * wholesale as subscriber records.
 */
import { createKvRepository } from './kv-repository.ts';
import type {
  NewsletterCampaign,
  NewsletterCampaignAudience,
  NewsletterCampaignRecipient,
  NewsletterProcessorState,
  NewsletterStudioTemplate,
} from '../newsletter-studio-types.ts';

export const NEWSLETTER_CAMPAIGN_NAMESPACE = 'nlstudio:campaign:';
export const NEWSLETTER_AUDIENCE_NAMESPACE = 'nlstudio:audience:';
export const NEWSLETTER_RECIPIENT_NAMESPACE = 'nlstudio:recipient:';
export const NEWSLETTER_TEMPLATE_NAMESPACE = 'nlstudio:template:';
export const NEWSLETTER_PROCESSOR_NAMESPACE = 'nlstudio:processor:';

/** Fixed id of the singleton processor-state record. */
export const NEWSLETTER_PROCESSOR_STATE_ID = 'state';

export const newsletterCampaigns = createKvRepository<NewsletterCampaign>(
  NEWSLETTER_CAMPAIGN_NAMESPACE,
);

/** Audience worklists — id is the campaign id. */
export const newsletterAudiences = createKvRepository<NewsletterCampaignAudience>(
  NEWSLETTER_AUDIENCE_NAMESPACE,
);

/** Per-recipient delivery/engagement records — id is `${campaignId}:${token}`. */
export const newsletterRecipients = createKvRepository<NewsletterCampaignRecipient>(
  NEWSLETTER_RECIPIENT_NAMESPACE,
);

export const newsletterTemplates = createKvRepository<NewsletterStudioTemplate>(
  NEWSLETTER_TEMPLATE_NAMESPACE,
);

export const newsletterProcessorState = createKvRepository<NewsletterProcessorState>(
  NEWSLETTER_PROCESSOR_NAMESPACE,
);

/**
 * Legacy broadcast summaries (`broadcast:{id}`) — newsletter-service getStats()
 * already reads this prefix for its "broadcasts this month" KPIs, so finished
 * campaigns write a compact summary here and the existing subscriber dashboard
 * lights up with real numbers unchanged.
 */
export interface LegacyBroadcastSummary {
  id: string;
  subject: string;
  bodySnippet: string;
  recipientCount: number;
  sent: number;
  failed: number;
  sentAt: string;
}

export const legacyBroadcasts = createKvRepository<LegacyBroadcastSummary>('broadcast:');

/**
 * Subscriber consent records (`newsletter:{email}`, id = lowercased email) —
 * the same records newsletter-service.ts owns. The studio touches them for
 * exactly one thing: RFC 8058 one-click unsubscribe, which must be able to
 * upsert an `active: false` record even for group members who never had one.
 */
export interface NewsletterSubscriberRecord {
  email: string;
  name?: string;
  firstName?: string;
  surname?: string;
  source?: string;
  confirmed?: boolean;
  active?: boolean;
  subscribedAt?: string;
  unsubscribedAt?: string;
  removedBy?: string;
  [key: string]: unknown;
}

export const newsletterSubscriberRecords =
  createKvRepository<NewsletterSubscriberRecord>('newsletter:');

/** Recipient record id for one campaign/token pair. */
export function recipientRecordId(campaignId: string, token: string): string {
  return `${campaignId}:${token}`;
}
