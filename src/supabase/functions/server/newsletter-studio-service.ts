/**
 * Newsletter Studio — campaign service (CRUD, lifecycle, dashboard).
 *
 * A campaign is a PDF newsletter: title, description, the stored PDF and the
 * communication groups it goes to. The delivery engine lives in
 * newsletter-studio-processor.ts; audiences in newsletter-studio-audience.ts;
 * recipients/stats/click-through in newsletter-studio-engagement.ts; route
 * handlers in newsletter-studio-routes.ts stay thin dispatchers (§4.2).
 */

import { NotFoundError, ValidationError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getStats as getSubscriberStats } from './newsletter-service.ts';
import {
  listAudienceLists,
  resolveAudience,
  resolveListNames,
} from './newsletter-studio-audience.ts';
import { RECIPIENT_FETCH_CHUNK } from './newsletter-studio-engagement.ts';
import {
  NewsletterPdfValidationError,
  removeNewsletterPdf,
  removeNewsletterPdfs,
  signedNewsletterPdfUrl,
  storeNewsletterPdf,
} from './newsletter-studio-storage.ts';
import {
  newsletterAudiences,
  newsletterCampaigns,
  newsletterProcessorState,
  newsletterRecipients,
  recipientRecordId,
  NEWSLETTER_PROCESSOR_STATE_ID,
} from './repositories/newsletter-studio-repository.ts';
import type {
  NewsletterCampaign,
  NewsletterCampaignAudience,
  NewsletterCampaignSource,
  NewsletterCampaignView,
  NewsletterDashboardSummary,
  NewsletterListView,
} from './newsletter-studio-types.ts';
import { EDITABLE_CAMPAIGN_STATUSES } from './newsletter-studio-types.ts';

// Routes import the whole studio surface from here; the audience and
// engagement modules are implementation splits, not separate public APIs.
export {
  listAudienceLists,
  resolveAudience,
  SUBSCRIBER_LIST_ID,
} from './newsletter-studio-audience.ts';
export {
  getCampaignRecipients,
  getCampaignStats,
  recordCampaignClick,
  RECIPIENT_FETCH_CHUNK,
  unsubscribeByRecipientToken,
} from './newsletter-studio-engagement.ts';

const log = createModuleLogger('newsletter-studio');

/** Campaign considered stuck when active with no progress for this long. */
export const CAMPAIGN_STUCK_THRESHOLD_MS = 180_000;

export const nowIso = () => new Date().toISOString();

// ── Campaign reads ───────────────────────────────────────────────────────────

async function getCampaignOrThrow(id: string): Promise<NewsletterCampaign> {
  const campaign = await newsletterCampaigns.get(id);
  if (!campaign) throw new NotFoundError(`Campaign ${id} not found`);
  return campaign;
}

function isCampaignStuck(campaign: NewsletterCampaign): boolean {
  if (campaign.status !== 'queued' && campaign.status !== 'sending') return false;
  const last = campaign.lastProgressAt || campaign.startedAt || campaign.updatedAt;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() >= CAMPAIGN_STUCK_THRESHOLD_MS;
}

export function toCampaignView(campaign: NewsletterCampaign): NewsletterCampaignView {
  return {
    ...campaign,
    pendingCount: Math.max(campaign.recipientCount - campaign.processedCount, 0),
    stuck: isCampaignStuck(campaign),
  };
}

export interface CampaignListFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export type CampaignStatusCounts = Record<NewsletterCampaign['status'], number>;

export interface CampaignListResult {
  campaigns: NewsletterCampaignView[];
  total: number;
  page: number;
  limit: number;
  /**
   * Campaigns per status across the WHOLE (search-filtered) set, before the
   * status filter and pagination — what the list's status chips display.
   */
  statusCounts: CampaignStatusCounts;
}

const EMPTY_STATUS_COUNTS: CampaignStatusCounts = {
  draft: 0,
  scheduled: 0,
  queued: 0,
  sending: 0,
  paused: 0,
  finished: 0,
  cancelled: 0,
};

/**
 * Newest-first campaign listing with in-memory status/search filters.
 * One bounded repository page (max 1000) — same trade the communication
 * campaign history makes.
 */
export async function listCampaigns(
  filters: CampaignListFilters = {},
): Promise<CampaignListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);

  const { items } = await newsletterCampaigns.list({ limit: 1000 });
  let campaigns = items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    campaigns = campaigns.filter(
      (c) => c.title.toLowerCase().includes(needle) || c.description.toLowerCase().includes(needle),
    );
  }

  // Counted before the status filter so the chips stay accurate whichever
  // one is selected, and before pagination so they cover every campaign.
  const statusCounts: CampaignStatusCounts = { ...EMPTY_STATUS_COUNTS };
  for (const campaign of campaigns) {
    if (campaign.status in statusCounts) statusCounts[campaign.status]++;
  }

  // `status` may name several statuses, comma-separated ("queued,sending").
  const statuses = (filters.status ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'all');
  if (statuses.length > 0) {
    campaigns = campaigns.filter((c) => statuses.includes(c.status));
  }

  const total = campaigns.length;
  const start = (page - 1) * limit;
  return {
    campaigns: campaigns.slice(start, start + limit).map(toCampaignView),
    total,
    page,
    limit,
    statusCounts,
  };
}

export async function getCampaignView(id: string): Promise<NewsletterCampaignView> {
  return toCampaignView(await getCampaignOrThrow(id));
}

/** The campaign a routine hand-over already created, by its idempotency key. */
export async function findCampaignBySourceRef(
  sourceRef: string,
): Promise<NewsletterCampaign | null> {
  const { items } = await newsletterCampaigns.list({ limit: 1000 });
  return items.find((c) => c.source === 'routine' && c.sourceRef === sourceRef) ?? null;
}

// ── Campaign writes ──────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  title: string;
  description: string;
  listIds: string[];
  source?: NewsletterCampaignSource;
  sourceRef?: string | null;
}

export async function createCampaign(
  input: CreateCampaignInput,
  createdBy: string,
): Promise<NewsletterCampaignView> {
  const listNames = await resolveListNames(input.listIds);
  const timestamp = nowIso();
  const campaign: NewsletterCampaign = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description,
    fromName: 'Navigate Wealth',
    listIds: input.listIds,
    listNames,
    pdf: null,
    source: input.source ?? 'admin',
    sourceRef: input.sourceRef ?? null,
    reviewNotifiedAt: null,
    status: 'draft',
    scheduledAt: null,
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    processedCount: 0,
    progressPercent: 0,
    readCount: 0,
    statsRefreshedAt: null,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    startedAt: null,
    completedAt: null,
    lastProgressAt: null,
    lastError: null,
    lockId: null,
    lockExpiresAt: null,
  };
  await newsletterCampaigns.put(campaign.id, campaign);
  log.info('Campaign created', { campaignId: campaign.id, source: campaign.source });
  return toCampaignView(campaign);
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  listIds?: string[];
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} newsletter can no longer be edited`);
  }

  const listIds = patch.listIds ?? campaign.listIds;
  const listNames = patch.listIds ? await resolveListNames(patch.listIds) : campaign.listNames;

  const updated: NewsletterCampaign = {
    ...campaign,
    title: patch.title ?? campaign.title,
    description: patch.description ?? campaign.description,
    listIds,
    listNames,
    updatedAt: nowIso(),
  };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

/**
 * Store (or replace) the campaign's PDF. Only while still editable — the
 * processor reads `pdf` at delivery time, so swapping it under an active
 * send would put two different documents in one campaign's inboxes.
 */
export async function attachCampaignPdf(
  id: string,
  file: { bytes: Uint8Array; fileName: string },
): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} newsletter's PDF can no longer be changed`);
  }
  let pdf;
  try {
    pdf = await storeNewsletterPdf({ campaignId: id, bytes: file.bytes, fileName: file.fileName });
  } catch (error) {
    if (error instanceof NewsletterPdfValidationError) throw new ValidationError(error.message);
    throw error;
  }
  const previous = campaign.pdf;
  const updated: NewsletterCampaign = { ...campaign, pdf, updatedAt: nowIso() };
  await newsletterCampaigns.put(id, updated);
  if (previous) await removeNewsletterPdf(previous.storagePath);
  log.info('Campaign PDF stored', { campaignId: id, sizeBytes: pdf.sizeBytes });
  return toCampaignView(updated);
}

/** Short-lived signed URL for the admin's own preview of the PDF. */
export async function getCampaignPdfUrl(id: string): Promise<{ url: string; fileName: string }> {
  const campaign = await getCampaignOrThrow(id);
  if (!campaign.pdf) throw new NotFoundError('This newsletter has no PDF yet');
  return {
    url: await signedNewsletterPdfUrl(campaign.pdf.storagePath),
    fileName: campaign.pdf.fileName,
  };
}

/** Draft/finished/cancelled campaigns can be deleted; active ones must be cancelled first. */
export async function deleteCampaign(id: string): Promise<void> {
  const campaign = await getCampaignOrThrow(id);
  if (!['draft', 'finished', 'cancelled'].includes(campaign.status)) {
    throw new ValidationError(
      `Stop the newsletter before deleting it (status: ${campaign.status})`,
    );
  }

  const audience = await newsletterAudiences.get(id);
  if (audience) {
    for (let i = 0; i < audience.items.length; i += RECIPIENT_FETCH_CHUNK) {
      const chunk = audience.items.slice(i, i + RECIPIENT_FETCH_CHUNK);
      await Promise.all(
        chunk.map((item) => newsletterRecipients.remove(recipientRecordId(id, item.token))),
      );
    }
    await newsletterAudiences.remove(id);
  }
  await newsletterCampaigns.remove(id);
  if (campaign.pdf) await removeNewsletterPdfs(id);
  log.info('Campaign deleted', { campaignId: id });
}

// ── Lifecycle transitions ────────────────────────────────────────────────────

function assertSendable(campaign: NewsletterCampaign, verb: string): void {
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} newsletter cannot be ${verb}`);
  }
  if (!campaign.pdf) {
    throw new ValidationError('Upload the newsletter PDF before sending');
  }
}

/** Freeze the audience and hand the campaign to the processor. */
async function resolveAndQueue(campaign: NewsletterCampaign): Promise<NewsletterCampaignView> {
  // Resolving the audience reads groups, every client and every subscriber —
  // slow enough that an admin can cancel or edit the campaign while it runs.
  // Writing our pre-resolve copy back would resurrect a cancelled campaign or
  // send pre-edit content to a pre-edit audience (review finding), so the
  // record is re-verified immediately before each write and the resolve is
  // abandoned if anything moved underneath it.
  const resolved = await resolveAudience(campaign.listIds);
  const timestamp = nowIso();

  const latest = await newsletterCampaigns.get(campaign.id);
  if (!latest || latest.status !== campaign.status || latest.updatedAt !== campaign.updatedAt) {
    log.info('Campaign changed while its audience was resolving — queue write abandoned', {
      campaignId: campaign.id,
      expectedStatus: campaign.status,
      actualStatus: latest?.status ?? 'deleted',
    });
    if (!latest) throw new NotFoundError(`Campaign ${campaign.id} not found`);
    return toCampaignView(latest);
  }

  if (resolved.items.length === 0) {
    const finished: NewsletterCampaign = {
      ...latest,
      status: 'finished',
      recipientCount: 0,
      progressPercent: 100,
      completedAt: timestamp,
      updatedAt: timestamp,
      lastError: 'No eligible recipients in the selected audiences',
    };
    await newsletterCampaigns.put(campaign.id, finished);
    return toCampaignView(finished);
  }

  const audience: NewsletterCampaignAudience = {
    campaignId: campaign.id,
    items: resolved.items,
    resolvedAt: timestamp,
    excludedUnsubscribed: resolved.excludedUnsubscribed,
    excludedInvalid: resolved.excludedInvalid,
  };
  await newsletterAudiences.put(campaign.id, audience);

  const queued: NewsletterCampaign = {
    ...latest,
    status: 'queued',
    recipientCount: resolved.items.length,
    sentCount: 0,
    failedCount: 0,
    processedCount: 0,
    progressPercent: 0,
    updatedAt: timestamp,
    lastProgressAt: timestamp,
    lastError: null,
  };
  await newsletterCampaigns.put(campaign.id, queued);
  log.info('Campaign queued', {
    campaignId: campaign.id,
    recipients: resolved.items.length,
    excludedUnsubscribed: resolved.excludedUnsubscribed,
  });
  return toCampaignView(queued);
}

export async function scheduleCampaign(
  id: string,
  scheduledAt: string,
): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  assertSendable(campaign, 'scheduled');
  if (new Date(scheduledAt).getTime() <= Date.now()) {
    throw new ValidationError('scheduledAt must be in the future');
  }
  const updated: NewsletterCampaign = {
    ...campaign,
    status: 'scheduled',
    scheduledAt,
    updatedAt: nowIso(),
  };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

export async function sendCampaignNow(id: string): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  assertSendable(campaign, 'sent');
  return resolveAndQueue({ ...campaign, scheduledAt: null });
}

/** Called by the processor for scheduled campaigns whose time has arrived. */
export async function promoteDueScheduledCampaign(
  campaign: NewsletterCampaign,
): Promise<NewsletterCampaignView> {
  // Re-read before promoting: the admin may have cancelled or edited between
  // the processor's listing and this call, and a stale overwrite would
  // resurrect the campaign.
  const fresh = await newsletterCampaigns.get(campaign.id);
  if (!fresh || fresh.status !== 'scheduled') return toCampaignView(fresh ?? campaign);
  return resolveAndQueue(fresh);
}

/** Put a sender-fault-paused campaign back in the queue once the cause is fixed. */
export async function resumeCampaign(id: string): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'paused') {
    throw new ValidationError(
      `Only a stopped newsletter can be retried (status: ${campaign.status})`,
    );
  }
  const updated: NewsletterCampaign = {
    ...campaign,
    status: 'queued',
    updatedAt: nowIso(),
    lastProgressAt: nowIso(),
  };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

export async function cancelCampaign(id: string): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (!['scheduled', 'queued', 'sending', 'paused'].includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} newsletter cannot be cancelled`);
  }
  const updated: NewsletterCampaign = {
    ...campaign,
    status: 'cancelled',
    completedAt: nowIso(),
    updatedAt: nowIso(),
  };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<NewsletterDashboardSummary> {
  const [{ items: campaigns }, subscriberStats, processor, lists] = await Promise.all([
    newsletterCampaigns.list({ limit: 1000 }),
    getSubscriberStats().catch(() => null),
    newsletterProcessorState.get(NEWSLETTER_PROCESSOR_STATE_ID),
    listAudienceLists().catch(() => [] as NewsletterListView[]),
  ]);

  const byStatus = (status: NewsletterCampaign['status']) =>
    campaigns.filter((c) => c.status === status).length;

  return {
    subscribers: {
      total: subscriberStats?.totalSubscribers ?? 0,
      active: subscriberStats?.activeSubscribers ?? 0,
      pending: Math.max(
        (subscriberStats?.totalSubscribers ?? 0) - (subscriberStats?.confirmedSubscribers ?? 0),
        0,
      ),
      unsubscribed: Math.max(
        (subscriberStats?.confirmedSubscribers ?? 0) - (subscriberStats?.activeSubscribers ?? 0),
        0,
      ),
    },
    campaigns: {
      total: campaigns.length,
      draft: byStatus('draft'),
      awaitingReview: campaigns.filter((c) => c.status === 'draft' && c.source === 'routine')
        .length,
      scheduled: byStatus('scheduled'),
      active: byStatus('queued') + byStatus('sending') + byStatus('paused'),
      finished: byStatus('finished'),
      cancelled: byStatus('cancelled'),
    },
    delivery: {
      totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
      totalFailed: campaigns.reduce((sum, c) => sum + c.failedCount, 0),
      totalRead: campaigns.reduce((sum, c) => sum + c.readCount, 0),
    },
    recentCampaigns: campaigns
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 5)
      .map(toCampaignView),
    processor,
    listCount: lists.length,
  };
}
