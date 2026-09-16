/**
 * Newsletter Studio — recipients, stats, click-through and one-click unsubscribe.
 *
 * Engagement is click-derived: this platform records a "read" when a
 * recipient actually follows the "Read the newsletter" button, never from a
 * tracking pixel. The button's click-through resolves to a fresh signed URL
 * for the campaign's own stored PDF, so the URL space reachable through
 * /track/click is exactly one object per campaign — never caller input.
 *
 * Split out of newsletter-studio-service.ts (§20.1).
 */

import { NotFoundError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { removeNewsletterSubscriber } from './newsletter-group-service.ts';
import { signedNewsletterPdfUrl } from './newsletter-studio-storage.ts';
import {
  newsletterAudiences,
  newsletterCampaigns,
  newsletterRecipients,
  newsletterSubscriberRecords,
  recipientRecordId,
} from './repositories/newsletter-studio-repository.ts';
import { PDF_LINK_ID } from './newsletter-studio-types.ts';
import type {
  NewsletterAudienceItem,
  NewsletterCampaignRecipient,
  NewsletterCampaignStats,
} from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio-engagement');

/** Chunk size for recipient-record fan-in reads. */
export const RECIPIENT_FETCH_CHUNK = 100;

/** Engagement counters cached on terminal campaigns are refreshed at most this often. */
const STATS_CACHE_TTL_MS = 60_000;

const nowIso = () => new Date().toISOString();

async function loadRecipientRecords(
  campaignId: string,
  items: NewsletterAudienceItem[],
): Promise<(NewsletterCampaignRecipient | null)[]> {
  const records: (NewsletterCampaignRecipient | null)[] = [];
  for (let i = 0; i < items.length; i += RECIPIENT_FETCH_CHUNK) {
    const chunk = items.slice(i, i + RECIPIENT_FETCH_CHUNK);
    const loaded = await newsletterRecipients.getMany(
      chunk.map((item) => recipientRecordId(campaignId, item.token)),
    );
    records.push(...loaded);
  }
  return records;
}

export interface RecipientPageResult {
  recipients: NewsletterCampaignRecipient[];
  total: number;
  page: number;
  limit: number;
}

/** Paginated per-recipient delivery/engagement view for the campaign drill-down. */
export async function getCampaignRecipients(
  campaignId: string,
  options: { page?: number; limit?: number; status?: string } = {},
): Promise<RecipientPageResult> {
  if (!(await newsletterCampaigns.get(campaignId))) {
    throw new NotFoundError(`Campaign ${campaignId} not found`);
  }
  const audience = await newsletterAudiences.get(campaignId);
  const items = audience?.items ?? [];
  const records = await loadRecipientRecords(campaignId, items);

  let merged = items.map((item, i): NewsletterCampaignRecipient => {
    const record = records[i];
    if (record) return record;
    return {
      campaignId,
      token: item.token,
      email: item.email,
      name: item.name,
      firstName: item.firstName,
      deliveryStatus: 'pending',
      deliveryError: null,
      attemptCount: 0,
      lastAttemptedAt: null,
      sentAt: null,
      openedAt: null,
      clicks: [],
    };
  });

  if (options.status && options.status !== 'all') {
    merged = merged.filter((r) => r.deliveryStatus === options.status);
  }

  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const start = (page - 1) * limit;
  return {
    recipients: merged.slice(start, start + limit),
    total: merged.length,
    page,
    limit,
  };
}

/**
 * Live delivery + read stats from recipient records. On terminal campaigns
 * the read counter is cached back onto the campaign record (throttled) so the
 * dashboard can aggregate without scanning every campaign.
 */
export async function getCampaignStats(campaignId: string): Promise<NewsletterCampaignStats> {
  const campaign = await newsletterCampaigns.get(campaignId);
  if (!campaign) throw new NotFoundError(`Campaign ${campaignId} not found`);
  const audience = await newsletterAudiences.get(campaignId);
  const items = audience?.items ?? [];
  const records = await loadRecipientRecords(campaignId, items);

  let sent = 0;
  let failed = 0;
  let read = 0;
  for (const record of records) {
    if (!record) continue;
    if (record.deliveryStatus === 'sent') sent++;
    if (record.deliveryStatus === 'failed_terminal') failed++;
    if (record.openedAt) read++;
  }

  const stats: NewsletterCampaignStats = {
    campaignId,
    recipientCount: items.length,
    sentCount: sent,
    failedCount: failed,
    pendingCount: Math.max(items.length - sent - failed, 0),
    readCount: read,
    readRate: sent > 0 ? Math.round((read / sent) * 1000) / 10 : 0,
  };

  const isTerminal = campaign.status === 'finished' || campaign.status === 'cancelled';
  const cacheStale =
    !campaign.statsRefreshedAt ||
    Date.now() - new Date(campaign.statsRefreshedAt).getTime() > STATS_CACHE_TTL_MS;
  if (isTerminal && cacheStale) {
    await newsletterCampaigns.put(campaignId, {
      ...campaign,
      readCount: read,
      statsRefreshedAt: nowIso(),
    });
  }

  return stats;
}

/**
 * Public click-through: record the read and hand back a short-lived signed
 * URL for the campaign's PDF. The recipient record is resolved BEFORE any URL
 * is minted, so an unknown token can never obtain one. Unknown campaign,
 * token or link ids resolve to null so the route can 404 without leaking
 * anything.
 */
export async function recordCampaignClick(
  campaignId: string,
  token: string,
  linkId: string,
): Promise<{ url: string } | null> {
  if (linkId !== PDF_LINK_ID) return null;
  const campaign = await newsletterCampaigns.get(campaignId);
  if (!campaign?.pdf) return null;

  const recordId = recipientRecordId(campaignId, token);
  const record = await newsletterRecipients.get(recordId);
  if (!record) return null;

  const timestamp = nowIso();
  const updated: NewsletterCampaignRecipient = {
    ...record,
    openedAt: record.openedAt || timestamp,
    clicks: [...record.clicks, { linkId, at: timestamp }].slice(-200),
  };
  await newsletterRecipients.put(recordId, updated);
  return { url: await signedNewsletterPdfUrl(campaign.pdf.storagePath) };
}

/**
 * RFC 8058 one-click unsubscribe: resolve the opaque per-recipient token to
 * an email and record the opt-out. Upserts the consent record so even a
 * group member who never had a `newsletter:{email}` row ends up excluded by
 * every future audience resolution, then syncs the Newsletter Contacts
 * group. Returns null when the ids don't resolve (the route 404s without
 * leaking anything).
 */
export async function unsubscribeByRecipientToken(
  campaignId: string,
  token: string,
): Promise<{ email: string } | null> {
  const record = await newsletterRecipients.get(recipientRecordId(campaignId, token));
  if (!record) return null;

  const email = record.email.trim().toLowerCase();
  const existing = await newsletterSubscriberRecords.get(email);
  await newsletterSubscriberRecords.put(email, {
    ...(existing ?? {
      email,
      name: record.name || undefined,
      source: 'One-Click Unsubscribe',
      subscribedAt: nowIso(),
      confirmed: true,
    }),
    email,
    active: false,
    unsubscribedAt: nowIso(),
    removedBy: 'one-click',
  });
  await removeNewsletterSubscriber(email);
  log.info('One-click unsubscribe recorded', { campaignId });
  return { email };
}
