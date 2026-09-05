/**
 * Newsletter Studio — campaign service (CRUD, audience, stats, dashboard).
 *
 * The delivery engine lives in newsletter-studio-processor.ts; route handlers
 * in newsletter-studio-routes.ts stay thin dispatchers (§4.2).
 *
 * Audiences are the existing communication groups — the studio deliberately
 * introduces no parallel list system. POPIA invariant: anyone whose
 * `newsletter:{email}` record says `active: false` is excluded from every
 * campaign audience, whatever group membership says.
 */

import { NotFoundError, ValidationError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getGroupById, getGroups } from './communication-repo.ts';
import { getAllClients } from './communication-messaging.ts';
import { listSubscribers, getStats as getSubscriberStats } from './newsletter-service.ts';
import { removeNewsletterSubscriber } from './newsletter-group-service.ts';
import { extractCampaignLinks } from './newsletter-studio-render.ts';
import {
  newsletterAudiences,
  newsletterCampaigns,
  newsletterProcessorState,
  newsletterRecipients,
  newsletterSubscriberRecords,
  newsletterTemplates,
  recipientRecordId,
  NEWSLETTER_PROCESSOR_STATE_ID,
} from './repositories/newsletter-studio-repository.ts';
import type {
  NewsletterAudienceItem,
  NewsletterCampaign,
  NewsletterCampaignAudience,
  NewsletterCampaignRecipient,
  NewsletterCampaignStats,
  NewsletterCampaignView,
  NewsletterDashboardSummary,
  NewsletterListView,
  NewsletterStudioTemplate,
} from './newsletter-studio-types.ts';
import { EDITABLE_CAMPAIGN_STATUSES } from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio');

/** Campaign considered stuck when active with no progress for this long. */
export const CAMPAIGN_STUCK_THRESHOLD_MS = 180_000;

/** Chunk size for recipient-record fan-in reads. */
export const RECIPIENT_FETCH_CHUNK = 100;

/** Engagement counters cached on terminal campaigns are refreshed at most this often. */
const STATS_CACHE_TTL_MS = 60_000;

export const nowIso = () => new Date().toISOString();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The studio's always-present audience: every confirmed newsletter subscriber
 * who has not opted out. It shares its id with the "Newsletter Contacts"
 * communication group so existing campaigns keep resolving, but it is backed
 * by the `newsletter:{email}` consent records directly — the group is only
 * lazily created/backfilled by the subscription flow, and a store with
 * subscribers but no group record (seen in production) must still be
 * reachable from the studio.
 */
export const SUBSCRIBER_LIST_ID = 'sys_newsletter_contacts';
const SUBSCRIBER_LIST_NAME = 'Newsletter Contacts';
const SUBSCRIBER_LIST_DESCRIPTION =
  'Every confirmed newsletter subscriber who has not opted out. Kept in sync automatically.';

type SubscriberRecord = Awaited<ReturnType<typeof listSubscribers>>[number];

/** Confirmed and still-active subscribers — the only ones a campaign may reach. */
function eligibleSubscribers(subscribers: SubscriberRecord[]): SubscriberRecord[] {
  return subscribers.filter((s) => s.confirmed && s.active);
}

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
      (c) => c.name.toLowerCase().includes(needle) || c.subject.toLowerCase().includes(needle),
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

// ── Campaign writes ──────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  name: string;
  subject: string;
  preheader?: string;
  fromName?: string;
  listIds: string[];
  bodyHtml: string;
  templateId?: string | null;
  trackClicks?: boolean;
}

async function resolveListNames(listIds: string[]): Promise<string[]> {
  const groups = await Promise.all(listIds.map((id) => getGroupById(id)));
  // The subscriber list is virtual: valid even before its group record exists.
  const missing = listIds.filter((id, i) => !groups[i] && id !== SUBSCRIBER_LIST_ID);
  if (missing.length > 0) {
    throw new ValidationError(`Unknown audience list(s): ${missing.join(', ')}`);
  }
  return listIds.map((id, i) => (groups[i]?.name as string | undefined) ?? SUBSCRIBER_LIST_NAME);
}

export async function createCampaign(
  input: CreateCampaignInput,
  createdBy: string,
): Promise<NewsletterCampaignView> {
  const listNames = await resolveListNames(input.listIds);
  const timestamp = nowIso();
  const campaign: NewsletterCampaign = {
    id: crypto.randomUUID(),
    name: input.name,
    subject: input.subject,
    preheader: input.preheader || undefined,
    fromName: input.fromName?.trim() || 'Navigate Wealth',
    listIds: input.listIds,
    listNames,
    bodyHtml: input.bodyHtml,
    templateId: input.templateId ?? null,
    trackClicks: input.trackClicks ?? true,
    status: 'draft',
    scheduledAt: null,
    links: [],
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    processedCount: 0,
    progressPercent: 0,
    openCount: 0,
    clickCount: 0,
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
  log.info('Campaign created', { campaignId: campaign.id });
  return toCampaignView(campaign);
}

export interface UpdateCampaignInput {
  name?: string;
  subject?: string;
  preheader?: string | null;
  fromName?: string;
  listIds?: string[];
  bodyHtml?: string;
  templateId?: string | null;
  trackClicks?: boolean;
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignInput,
): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} campaign can no longer be edited`);
  }

  const listIds = patch.listIds ?? campaign.listIds;
  const listNames = patch.listIds ? await resolveListNames(patch.listIds) : campaign.listNames;

  const updated: NewsletterCampaign = {
    ...campaign,
    name: patch.name ?? campaign.name,
    subject: patch.subject ?? campaign.subject,
    preheader: patch.preheader === null ? undefined : (patch.preheader ?? campaign.preheader),
    fromName: patch.fromName?.trim() || campaign.fromName,
    listIds,
    listNames,
    bodyHtml: patch.bodyHtml ?? campaign.bodyHtml,
    templateId: patch.templateId === undefined ? campaign.templateId : patch.templateId,
    trackClicks: patch.trackClicks ?? campaign.trackClicks,
    updatedAt: nowIso(),
  };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

/** Draft/finished/cancelled campaigns can be deleted; active ones must be cancelled first. */
export async function deleteCampaign(id: string): Promise<void> {
  const campaign = await getCampaignOrThrow(id);
  if (!['draft', 'finished', 'cancelled'].includes(campaign.status)) {
    throw new ValidationError(
      `Cancel the campaign before deleting it (status: ${campaign.status})`,
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
  log.info('Campaign deleted', { campaignId: id });
}

export async function duplicateCampaign(
  id: string,
  createdBy: string,
): Promise<NewsletterCampaignView> {
  const source = await getCampaignOrThrow(id);
  return createCampaign(
    {
      name: `${source.name} (copy)`,
      subject: source.subject,
      preheader: source.preheader,
      fromName: source.fromName,
      listIds: source.listIds,
      bodyHtml: source.bodyHtml,
      templateId: source.templateId,
      trackClicks: source.trackClicks,
    },
    createdBy,
  );
}

// ── Audience resolution & lifecycle transitions ──────────────────────────────

export interface ResolvedAudience {
  items: NewsletterAudienceItem[];
  excludedUnsubscribed: number;
  excludedInvalid: number;
}

function firstNameOf(name: string | undefined, email: string): string {
  const first = (name || '').trim().split(/\s+/)[0] || '';
  return first || email.split('@')[0] || '';
}

/**
 * Resolve group membership into a frozen recipient snapshot.
 * External contacts come straight off the groups; client members are resolved
 * through the communication client list (active clients only). Explicit
 * newsletter opt-outs are removed last, whatever group they sit in.
 */
export async function resolveAudience(listIds: string[]): Promise<ResolvedAudience> {
  const groups = (await Promise.all(listIds.map((gid) => getGroupById(gid)))).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  const needsClients = groups.some((g) => (g.clientIds || []).length > 0);
  const clientById = new Map<string, { email: string; name: string }>();
  if (needsClients) {
    const clients = await getAllClients();
    for (const client of clients) {
      if (client.id && client.email) {
        clientById.set(client.id, { email: client.email, name: client.name || client.email });
      }
    }
  }

  const subscribers = await listSubscribers();
  const unsubscribed = new Set(
    subscribers.filter((s) => s.active === false).map((s) => s.email.toLowerCase()),
  );

  const byEmail = new Map<string, NewsletterAudienceItem>();
  let excludedUnsubscribed = 0;
  let excludedInvalid = 0;

  const consider = (rawEmail: string | undefined, name: string | undefined) => {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      excludedInvalid++;
      return;
    }
    if (unsubscribed.has(email)) {
      excludedUnsubscribed++;
      return;
    }
    if (byEmail.has(email)) return;
    const displayName = (name || '').trim() || email;
    byEmail.set(email, {
      email,
      name: displayName,
      firstName: firstNameOf(name, email),
      token: crypto.randomUUID().replace(/-/g, ''),
    });
  };

  // The subscriber base itself, whether or not its group record has been
  // created or backfilled yet. Only confirmed, active consent records count.
  if (listIds.includes(SUBSCRIBER_LIST_ID)) {
    for (const subscriber of eligibleSubscribers(subscribers)) {
      consider(subscriber.email, subscriber.name);
    }
  }

  for (const group of groups) {
    for (const contact of group.externalContacts || []) {
      consider(contact.email, contact.name);
    }
    for (const clientId of group.clientIds || []) {
      const client = clientById.get(clientId);
      if (client) consider(client.email, client.name);
    }
  }

  return { items: [...byEmail.values()], excludedUnsubscribed, excludedInvalid };
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
      lastError: 'No eligible recipients in the selected lists',
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
    links: extractCampaignLinks(latest.bodyHtml),
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
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} campaign cannot be scheduled`);
  }
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
  if (!EDITABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
    throw new ValidationError(`A ${campaign.status} campaign cannot be sent`);
  }
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

export async function pauseCampaign(id: string): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'queued' && campaign.status !== 'sending') {
    throw new ValidationError(`A ${campaign.status} campaign cannot be paused`);
  }
  const updated: NewsletterCampaign = { ...campaign, status: 'paused', updatedAt: nowIso() };
  await newsletterCampaigns.put(id, updated);
  return toCampaignView(updated);
}

export async function resumeCampaign(id: string): Promise<NewsletterCampaignView> {
  const campaign = await getCampaignOrThrow(id);
  if (campaign.status !== 'paused') {
    throw new ValidationError(`Only paused campaigns can be resumed (status: ${campaign.status})`);
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
    throw new ValidationError(`A ${campaign.status} campaign cannot be cancelled`);
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

// ── Recipients & stats ───────────────────────────────────────────────────────

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
  await getCampaignOrThrow(campaignId);
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
 * Live delivery + engagement stats from recipient records. On terminal
 * campaigns the engagement counters are cached back onto the campaign record
 * (throttled) so the dashboard can aggregate without scanning every campaign.
 */
export async function getCampaignStats(campaignId: string): Promise<NewsletterCampaignStats> {
  const campaign = await getCampaignOrThrow(campaignId);
  const audience = await newsletterAudiences.get(campaignId);
  const items = audience?.items ?? [];
  const records = await loadRecipientRecords(campaignId, items);

  let sent = 0;
  let failed = 0;
  let opened = 0;
  let clickedRecipients = 0;
  let totalClicks = 0;
  const clicksByLink = new Map<string, number>();

  for (const record of records) {
    if (!record) continue;
    if (record.deliveryStatus === 'sent') sent++;
    if (record.deliveryStatus === 'failed_terminal') failed++;
    if (record.openedAt) opened++;
    if (record.clicks.length > 0) {
      clickedRecipients++;
      totalClicks += record.clicks.length;
      for (const click of record.clicks) {
        clicksByLink.set(click.linkId, (clicksByLink.get(click.linkId) ?? 0) + 1);
      }
    }
  }

  const denominator = sent > 0 ? sent : 0;
  const rate = (n: number) => (denominator > 0 ? Math.round((n / denominator) * 1000) / 10 : 0);

  const stats: NewsletterCampaignStats = {
    campaignId,
    recipientCount: items.length,
    sentCount: sent,
    failedCount: failed,
    pendingCount: Math.max(items.length - sent - failed, 0),
    openCount: opened,
    clickCount: totalClicks,
    clickedRecipientCount: clickedRecipients,
    openRate: rate(opened),
    clickRate: rate(clickedRecipients),
    links: campaign.links.map((link) => ({
      ...link,
      clickCount: clicksByLink.get(link.id) ?? 0,
    })),
  };

  const isTerminal = campaign.status === 'finished' || campaign.status === 'cancelled';
  const cacheStale =
    !campaign.statsRefreshedAt ||
    Date.now() - new Date(campaign.statsRefreshedAt).getTime() > STATS_CACHE_TTL_MS;
  if (isTerminal && cacheStale) {
    await newsletterCampaigns.put(campaignId, {
      ...campaign,
      openCount: opened,
      clickCount: totalClicks,
      statsRefreshedAt: nowIso(),
    });
  }

  return stats;
}

/**
 * Public click-through: record the click (which is also the open — this
 * platform records engagement on real interaction, not pixels) and return
 * the stored destination. Unknown tokens/links resolve to null so the route
 * can 404 without leaking anything.
 */
export async function recordCampaignClick(
  campaignId: string,
  token: string,
  linkId: string,
): Promise<{ url: string } | null> {
  const campaign = await newsletterCampaigns.get(campaignId);
  if (!campaign) return null;
  const link = campaign.links.find((l) => l.id === linkId);
  if (!link) return null;

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
  return { url: link.url };
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

// ── Lists (audiences) ────────────────────────────────────────────────────────

export async function listAudienceLists(): Promise<NewsletterListView[]> {
  // getGroups paginates in memory over the full namespace; 1000 is the
  // repository's own MAX_PAGE_SIZE and far above any realistic group count.
  const [{ data: groups }, subscribers] = await Promise.all([
    getGroups({ limit: 1000 }),
    listSubscribers().catch(() => [] as SubscriberRecord[]),
  ]);
  const eligibleEmails = new Set(
    eligibleSubscribers(subscribers).map((s) => s.email.toLowerCase()),
  );

  const lists = groups.map((group): NewsletterListView => {
    const externalContacts = group.externalContacts || [];
    const clientIds = group.clientIds || [];
    if (group.id === SUBSCRIBER_LIST_ID) {
      // The group record may lag behind the consent records — count the
      // union of unique addresses so the estimate matches what
      // resolveAudience will reach. Client members of this group are there
      // BECAUSE they are confirmed subscribers, so their address is already
      // in the eligible set; adding clientIds.length would count them twice.
      const reachable = new Set([
        ...eligibleEmails,
        ...externalContacts.map((c) => c.email.toLowerCase()),
      ]);
      return {
        id: group.id,
        name: group.name,
        description: group.description || SUBSCRIBER_LIST_DESCRIPTION,
        type: 'system',
        memberCount: reachable.size,
        externalContactCount: reachable.size,
        clientCount: clientIds.length,
      };
    }
    return {
      id: group.id,
      name: group.name,
      description: group.description || '',
      type: group.type === 'system' ? 'system' : 'custom',
      memberCount: group.clientCount ?? clientIds.length + externalContacts.length,
      externalContactCount: externalContacts.length,
      clientCount: clientIds.length,
    };
  });

  if (!lists.some((list) => list.id === SUBSCRIBER_LIST_ID)) {
    lists.push({
      id: SUBSCRIBER_LIST_ID,
      name: SUBSCRIBER_LIST_NAME,
      description: SUBSCRIBER_LIST_DESCRIPTION,
      type: 'system',
      memberCount: eligibleEmails.size,
      externalContactCount: eligibleEmails.size,
      clientCount: 0,
    });
  }

  // Subscriber base first — it is the default audience — then by reach.
  return lists.sort((a, b) => {
    if (a.id === SUBSCRIBER_LIST_ID) return -1;
    if (b.id === SUBSCRIBER_LIST_ID) return 1;
    return b.memberCount - a.memberCount;
  });
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface TemplateInput {
  name: string;
  description?: string;
  subject?: string;
  bodyHtml: string;
}

export async function listTemplates(): Promise<NewsletterStudioTemplate[]> {
  const { items } = await newsletterTemplates.list({ limit: 500 });
  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function createTemplate(
  input: TemplateInput,
  createdBy: string,
): Promise<NewsletterStudioTemplate> {
  const timestamp = nowIso();
  const template: NewsletterStudioTemplate = {
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description || '',
    subject: input.subject || '',
    bodyHtml: input.bodyHtml,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await newsletterTemplates.put(template.id, template);
  return template;
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<NewsletterStudioTemplate> {
  const existing = await newsletterTemplates.get(id);
  if (!existing) throw new NotFoundError(`Template ${id} not found`);
  const updated: NewsletterStudioTemplate = {
    ...existing,
    name: input.name,
    description: input.description ?? existing.description,
    subject: input.subject ?? existing.subject,
    bodyHtml: input.bodyHtml,
    updatedAt: nowIso(),
  };
  await newsletterTemplates.put(id, updated);
  return updated;
}

export async function deleteTemplate(id: string): Promise<void> {
  const existing = await newsletterTemplates.get(id);
  if (!existing) throw new NotFoundError(`Template ${id} not found`);
  await newsletterTemplates.remove(id);
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<NewsletterDashboardSummary> {
  const [{ items: campaigns }, subscriberStats, processor, lists, templates] = await Promise.all([
    newsletterCampaigns.list({ limit: 1000 }),
    getSubscriberStats().catch(() => null),
    newsletterProcessorState.get(NEWSLETTER_PROCESSOR_STATE_ID),
    listAudienceLists().catch(() => [] as NewsletterListView[]),
    listTemplates().catch(() => [] as NewsletterStudioTemplate[]),
  ]);

  const byStatus = (status: NewsletterCampaign['status']) =>
    campaigns.filter((c) => c.status === status).length;

  const summary: NewsletterDashboardSummary = {
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
      scheduled: byStatus('scheduled'),
      active: byStatus('queued') + byStatus('sending') + byStatus('paused'),
      finished: byStatus('finished'),
      cancelled: byStatus('cancelled'),
    },
    delivery: {
      totalSent: campaigns.reduce((sum, c) => sum + c.sentCount, 0),
      totalFailed: campaigns.reduce((sum, c) => sum + c.failedCount, 0),
      totalOpens: campaigns.reduce((sum, c) => sum + c.openCount, 0),
      totalClicks: campaigns.reduce((sum, c) => sum + c.clickCount, 0),
    },
    recentCampaigns: campaigns
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      .slice(0, 5)
      .map(toCampaignView),
    processor,
    listCount: lists.length,
    templateCount: templates.length,
  };
  return summary;
}
