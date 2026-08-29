/**
 * Newsletter Studio — background delivery processor.
 *
 * Same production-proven shape as the article-notification engine
 * (publications-notification-*): an advisory KV lease per campaign, bounded
 * per-tick budgets, batched Promise.allSettled delivery, and terminal vs
 * retryable failure classification. Two improvements over that engine, both
 * deliberate:
 *
 *   1. A retry give-up cap (MAX_TOTAL_ATTEMPTS): a permanently soft-failing
 *      address becomes failed_terminal instead of being retried by cron
 *      forever.
 *   2. Counters are recomputed from the recipient records each batch, so a
 *      crashed tick can never leave the campaign's numbers drifted from
 *      reality.
 *
 * Invoked from three places, mirroring the platform doctrine "cron is the
 * authoritative driver, the admin browser is a best-effort accelerator":
 *   - POST /newsletter-studio/cron/process        (pg_cron, requireCronAuth)
 *   - POST /newsletter-studio/process             (admin manual/accelerator)
 *   - after send-now/resume, opportunistically inline (fire-and-forget).
 */

import { createModuleLogger } from './stderr-logger.ts';
import { sendEmail } from './email-service.ts';
import { chunkArray, classifyDeliveryFailure, sleep } from './publications-notification-state.ts';
import {
  buildCampaignEmailHeaders,
  buildUnsubscribeUrl,
  NEWSLETTER_DEFAULT_FROM_NAME,
  NEWSLETTER_FROM_EMAIL,
  NEWSLETTER_REPLY_TO,
  renderCampaignEmail,
} from './newsletter-studio-render.ts';
import {
  nowIso,
  promoteDueScheduledCampaign,
  RECIPIENT_FETCH_CHUNK,
} from './newsletter-studio-service.ts';
import {
  legacyBroadcasts,
  newsletterAudiences,
  newsletterCampaigns,
  newsletterProcessorState,
  newsletterRecipients,
  recipientRecordId,
  NEWSLETTER_PROCESSOR_STATE_ID,
} from './repositories/newsletter-studio-repository.ts';
import { ACTIVE_CAMPAIGN_STATUSES } from './newsletter-studio-types.ts';
import type {
  NewsletterAudienceItem,
  NewsletterCampaign,
  NewsletterCampaignRecipient,
  NewsletterProcessorState,
  ProcessNewsletterCampaignsResult,
} from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio-processor');

// Budgets and pacing — aligned with the article-notification engine.
export const DELIVERY_BATCH_SIZE = 20;
export const MAX_SEND_ATTEMPTS_PER_DELIVERY = 3;
export const RETRY_DELAYS_MS = [750, 1500];
export const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
/** Total attempts across ticks before a retryable failure becomes terminal. */
export const MAX_TOTAL_ATTEMPTS = 5;
export const CAMPAIGN_LOCK_TTL_MS = 60_000;
export const CAMPAIGN_LOCK_SETTLE_MS = 80;
export const DEFAULT_MANUAL_MAX_CAMPAIGNS = 2;
export const DEFAULT_MANUAL_MAX_BATCHES = 3;
export const DEFAULT_CRON_MAX_CAMPAIGNS = 3;
export const DEFAULT_CRON_MAX_BATCHES = 4;
const HARD_MAX = 5;

export interface ProcessOptions {
  mode?: 'manual' | 'cron';
  maxCampaigns?: number;
  maxBatchesPerCampaign?: number;
}

// ── Lease ────────────────────────────────────────────────────────────────────

/** Optimistic write→settle→read-back lease, identical in spirit to the jobs engine. */
async function acquireCampaignLease(
  campaign: NewsletterCampaign,
): Promise<NewsletterCampaign | null> {
  const expiresAt = campaign.lockExpiresAt ? new Date(campaign.lockExpiresAt).getTime() : 0;
  if (campaign.lockId && expiresAt > Date.now()) return null;

  const claimed: NewsletterCampaign = {
    ...campaign,
    status: campaign.status === 'queued' ? 'sending' : campaign.status,
    startedAt: campaign.startedAt || nowIso(),
    updatedAt: nowIso(),
    lockId: crypto.randomUUID(),
    lockExpiresAt: new Date(Date.now() + CAMPAIGN_LOCK_TTL_MS).toISOString(),
  };
  await newsletterCampaigns.put(campaign.id, claimed);
  await sleep(CAMPAIGN_LOCK_SETTLE_MS);

  const latest = await newsletterCampaigns.get(campaign.id);
  if (!latest || latest.lockId !== claimed.lockId) return null;
  return latest;
}

async function releaseCampaignLease(
  campaign: NewsletterCampaign,
  updates: Partial<NewsletterCampaign> = {},
): Promise<void> {
  await newsletterCampaigns.put(campaign.id, {
    ...campaign,
    ...updates,
    updatedAt: nowIso(),
    lockId: null,
    lockExpiresAt: null,
  });
}

// ── Recipient readiness ──────────────────────────────────────────────────────

type Readiness = 'ready' | 'wait' | 'done';

function recipientReadiness(record: NewsletterCampaignRecipient | null): Readiness {
  if (!record) return 'ready'; // never attempted
  switch (record.deliveryStatus) {
    case 'sent':
    case 'failed_terminal':
      return 'done';
    case 'pending':
      return 'ready';
    case 'sending': {
      // Crash recovery: a 'sending' mark older than the lease TTL is orphaned.
      const at = record.lastAttemptedAt ? new Date(record.lastAttemptedAt).getTime() : 0;
      return Date.now() - at >= CAMPAIGN_LOCK_TTL_MS ? 'ready' : 'wait';
    }
    case 'failed_retryable': {
      if (record.attemptCount >= MAX_TOTAL_ATTEMPTS) return 'ready'; // promoted to terminal below
      const at = record.lastAttemptedAt ? new Date(record.lastAttemptedAt).getTime() : 0;
      return Date.now() - at >= RETRYABLE_REQUEUE_DELAY_MS ? 'ready' : 'wait';
    }
  }
}

// ── Delivery ─────────────────────────────────────────────────────────────────

async function deliverToRecipient(
  campaign: NewsletterCampaign,
  item: NewsletterAudienceItem,
  existing: NewsletterCampaignRecipient | null,
): Promise<'sent' | 'retryable' | 'terminal'> {
  const recordId = recipientRecordId(campaign.id, item.token);
  const priorAttempts = existing?.attemptCount ?? 0;

  // Give-up cap: a retryable failure that has exhausted its budget goes
  // terminal without another provider call.
  if (existing?.deliveryStatus === 'failed_retryable' && priorAttempts >= MAX_TOTAL_ATTEMPTS) {
    await newsletterRecipients.put(recordId, {
      ...existing,
      deliveryStatus: 'failed_terminal',
      deliveryError: `${existing.deliveryError || 'delivery failed'} (retry budget exhausted)`,
    });
    return 'terminal';
  }

  const base: NewsletterCampaignRecipient = existing ?? {
    campaignId: campaign.id,
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

  const attemptStarted: NewsletterCampaignRecipient = {
    ...base,
    deliveryStatus: 'sending',
    attemptCount: priorAttempts + 1,
    lastAttemptedAt: nowIso(),
  };
  await newsletterRecipients.put(recordId, attemptStarted);

  const unsubscribeUrl = buildUnsubscribeUrl(item.email);
  const { html, text } = await renderCampaignEmail({ campaign, recipient: item });

  let lastFailure: { message: string; disposition: 'retryable' | 'terminal' } | null = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS_PER_DELIVERY; attempt++) {
    try {
      await sendEmail({
        to: item.email,
        subject: campaign.subject,
        html,
        text,
        from: {
          email: NEWSLETTER_FROM_EMAIL,
          name: campaign.fromName || NEWSLETTER_DEFAULT_FROM_NAME,
        },
        replyTo: NEWSLETTER_REPLY_TO,
        headers: buildCampaignEmailHeaders(campaign.id, item.token, unsubscribeUrl),
        customArgs: { type: 'newsletter_campaign', campaign_id: campaign.id },
        throwOnError: true,
      });
      await newsletterRecipients.put(recordId, {
        ...attemptStarted,
        deliveryStatus: 'sent',
        deliveryError: null,
        sentAt: nowIso(),
      });
      return 'sent';
    } catch (error) {
      lastFailure = classifyDeliveryFailure(error);
      if (lastFailure.disposition === 'terminal') break;
      const delay = RETRY_DELAYS_MS[attempt - 1];
      if (attempt < MAX_SEND_ATTEMPTS_PER_DELIVERY && delay) await sleep(delay);
    }
  }

  const exhaustedBudget = attemptStarted.attemptCount >= MAX_TOTAL_ATTEMPTS;
  const terminal = lastFailure?.disposition === 'terminal' || exhaustedBudget;
  await newsletterRecipients.put(recordId, {
    ...attemptStarted,
    deliveryStatus: terminal ? 'failed_terminal' : 'failed_retryable',
    deliveryError: lastFailure?.message || 'delivery failed',
  });
  return terminal ? 'terminal' : 'retryable';
}

// ── Per-campaign tick ────────────────────────────────────────────────────────

interface CampaignTickTally {
  sent: number;
  failed: number;
  finished: boolean;
}

async function processOneCampaign(
  leased: NewsletterCampaign,
  maxBatches: number,
): Promise<CampaignTickTally> {
  const tally: CampaignTickTally = { sent: 0, failed: 0, finished: false };
  const audience = await newsletterAudiences.get(leased.id);
  if (!audience || audience.items.length === 0) {
    await releaseCampaignLease(leased, {
      status: 'finished',
      completedAt: nowIso(),
      progressPercent: 100,
      lastError: 'Audience record missing — nothing to deliver',
    });
    tally.finished = true;
    return tally;
  }

  let campaign = leased;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
    // Respect pause/cancel written by the admin between batches.
    const fresh = await newsletterCampaigns.get(campaign.id);
    if (!fresh || !ACTIVE_CAMPAIGN_STATUSES.includes(fresh.status)) {
      if (fresh) await releaseCampaignLease(fresh);
      return tally;
    }
    campaign = fresh;

    // Load every recipient record and recompute the true counters.
    const records: (NewsletterCampaignRecipient | null)[] = [];
    for (const chunk of chunkArray(audience.items, RECIPIENT_FETCH_CHUNK)) {
      const loaded = await newsletterRecipients.getMany(
        chunk.map((item) => recipientRecordId(campaign.id, item.token)),
      );
      records.push(...loaded);
    }

    const readyIndexes: number[] = [];
    let sentCount = 0;
    let failedCount = 0;
    let waiting = 0;
    records.forEach((record, index) => {
      if (record?.deliveryStatus === 'sent') sentCount++;
      if (record?.deliveryStatus === 'failed_terminal') failedCount++;
      const readiness = recipientReadiness(record);
      if (readiness === 'ready') readyIndexes.push(index);
      if (readiness === 'wait') waiting++;
    });

    if (readyIndexes.length === 0) {
      const processed = sentCount + failedCount;
      if (waiting === 0 && processed >= audience.items.length) {
        await finalizeCampaign(campaign, audience.items.length, sentCount, failedCount);
        tally.finished = true;
      } else {
        // Everything left is inside a retry-delay window — release and let
        // the next tick pick it up.
        await releaseCampaignLease(campaign, { status: 'queued' });
      }
      return tally;
    }

    const batch = readyIndexes.slice(0, DELIVERY_BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map((index) => deliverToRecipient(campaign, audience.items[index], records[index])),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value === 'sent') {
          sentCount++;
          tally.sent++;
        } else if (outcome.value === 'terminal') {
          failedCount++;
          tally.failed++;
        }
      } else {
        log.error('Unexpected delivery rejection', { error: String(outcome.reason) });
      }
    }

    const processed = sentCount + failedCount;
    campaign = {
      ...campaign,
      sentCount,
      failedCount,
      processedCount: processed,
      progressPercent:
        audience.items.length > 0
          ? Math.round((processed / audience.items.length) * 1000) / 10
          : 100,
      lastProgressAt: nowIso(),
      updatedAt: nowIso(),
      lockExpiresAt: new Date(Date.now() + CAMPAIGN_LOCK_TTL_MS).toISOString(),
    };
    await newsletterCampaigns.put(campaign.id, campaign);

    if (processed >= audience.items.length) {
      await finalizeCampaign(campaign, audience.items.length, sentCount, failedCount);
      tally.finished = true;
      return tally;
    }
  }

  // Batch budget spent — hand back to the queue for the next tick.
  await releaseCampaignLease(campaign, { status: 'queued' });
  return tally;
}

async function finalizeCampaign(
  campaign: NewsletterCampaign,
  recipientCount: number,
  sentCount: number,
  failedCount: number,
): Promise<void> {
  const timestamp = nowIso();
  await releaseCampaignLease(campaign, {
    status: 'finished',
    sentCount,
    failedCount,
    processedCount: sentCount + failedCount,
    progressPercent: 100,
    completedAt: timestamp,
    lastProgressAt: timestamp,
    lastError: failedCount > 0 ? `${failedCount} recipient(s) failed permanently` : null,
  });

  // Light up the legacy subscriber-dashboard KPIs (getStats scans broadcast:).
  const snippet = campaign.bodyHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
  await legacyBroadcasts.put(campaign.id, {
    id: campaign.id,
    subject: campaign.subject,
    bodySnippet: snippet,
    recipientCount,
    sent: sentCount,
    failed: failedCount,
    sentAt: timestamp,
  });

  log.info('Campaign finished', { campaignId: campaign.id, sentCount, failedCount });
}

// ── Test sends ───────────────────────────────────────────────────────────────

export interface TestSendOutcome {
  email: string;
  ok: boolean;
  error?: string;
}

/**
 * Deliver the campaign to up to five test addresses. Subject is prefixed,
 * click tracking is disabled (links keep their real destinations), and
 * failures are reported per-address rather than thrown.
 */
export async function sendCampaignTestEmails(
  campaignId: string,
  emails: string[],
): Promise<TestSendOutcome[]> {
  const campaign = await newsletterCampaigns.get(campaignId);
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const links = campaign.links.length > 0 ? campaign.links : [];
  const outcomes: TestSendOutcome[] = [];
  for (const email of emails) {
    const recipient = {
      email,
      name: email,
      firstName: '',
      token: `test-${crypto.randomUUID().slice(0, 8)}`,
    };
    try {
      const { html, text } = await renderCampaignEmail({
        campaign: { ...campaign, links },
        recipient,
        disableClickTracking: true,
      });
      await sendEmail({
        to: email,
        subject: `[TEST] ${campaign.subject}`,
        html,
        text,
        from: {
          email: NEWSLETTER_FROM_EMAIL,
          name: campaign.fromName || NEWSLETTER_DEFAULT_FROM_NAME,
        },
        replyTo: NEWSLETTER_REPLY_TO,
        customArgs: { type: 'newsletter_campaign_test', campaign_id: campaign.id },
        throwOnError: true,
      });
      outcomes.push({ email, ok: true });
    } catch (error) {
      outcomes.push({
        email,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return outcomes;
}

// ── The tick ─────────────────────────────────────────────────────────────────

export async function processNewsletterCampaigns(
  options: ProcessOptions = {},
): Promise<ProcessNewsletterCampaignsResult> {
  const mode = options.mode ?? 'manual';
  const defaultCampaigns =
    mode === 'cron' ? DEFAULT_CRON_MAX_CAMPAIGNS : DEFAULT_MANUAL_MAX_CAMPAIGNS;
  const defaultBatches = mode === 'cron' ? DEFAULT_CRON_MAX_BATCHES : DEFAULT_MANUAL_MAX_BATCHES;
  const maxCampaigns = Math.max(1, Math.min(options.maxCampaigns ?? defaultCampaigns, HARD_MAX));
  const maxBatches = Math.max(
    1,
    Math.min(options.maxBatchesPerCampaign ?? defaultBatches, HARD_MAX),
  );

  const result: ProcessNewsletterCampaignsResult = {
    mode,
    campaignsExamined: 0,
    campaignsProcessed: 0,
    promotedScheduled: 0,
    sent: 0,
    failed: 0,
    finished: [],
    errors: [],
  };

  try {
    const { items: campaigns } = await newsletterCampaigns.list({ limit: 1000 });
    result.campaignsExamined = campaigns.length;

    // 1) Promote scheduled campaigns whose time has arrived.
    const now = Date.now();
    for (const campaign of campaigns) {
      if (
        campaign.status === 'scheduled' &&
        campaign.scheduledAt &&
        new Date(campaign.scheduledAt).getTime() <= now
      ) {
        try {
          await promoteDueScheduledCampaign(campaign);
          result.promotedScheduled++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`promote ${campaign.id}: ${message}`);
          log.error('Failed to promote scheduled campaign', { campaignId: campaign.id, message });
        }
      }
    }

    // 2) Work active campaigns, oldest first, within budget.
    const active = (
      result.promotedScheduled > 0
        ? (await newsletterCampaigns.list({ limit: 1000 })).items
        : campaigns
    )
      .filter((c) => ACTIVE_CAMPAIGN_STATUSES.includes(c.status))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, maxCampaigns);

    for (const campaign of active) {
      const leased = await acquireCampaignLease(campaign);
      if (!leased) continue;
      result.campaignsProcessed++;
      try {
        const tally = await processOneCampaign(leased, maxBatches);
        result.sent += tally.sent;
        result.failed += tally.failed;
        if (tally.finished) result.finished.push(campaign.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`campaign ${campaign.id}: ${message}`);
        log.error('Campaign tick failed', { campaignId: campaign.id, message });
        await releaseCampaignLease(leased, { status: 'queued', lastError: message }).catch(
          () => {},
        );
      }
    }

    await writeProcessorState(mode, result, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
    await writeProcessorState(mode, result, message).catch(() => {});
    throw error;
  }

  return result;
}

async function writeProcessorState(
  mode: 'manual' | 'cron',
  result: ProcessNewsletterCampaignsResult,
  fatalError: string | null,
): Promise<void> {
  const timestamp = nowIso();
  const previous = await newsletterProcessorState.get(NEWSLETTER_PROCESSOR_STATE_ID);
  const state: NewsletterProcessorState = {
    mode,
    lastRunAt: timestamp,
    // A fatal error preserves the previous success mark; a clean run stamps now.
    lastSuccessAt: fatalError ? (previous?.lastSuccessAt ?? null) : timestamp,
    lastError: fatalError ?? (result.errors.length > 0 ? result.errors[0] : null),
    lastHeartbeatAt: timestamp,
    activeCampaignCount: result.campaignsProcessed,
    processedInLastRun: result.sent + result.failed,
    sentInLastRun: result.sent,
    failedInLastRun: result.failed,
  };
  await newsletterProcessorState.put(NEWSLETTER_PROCESSOR_STATE_ID, state);
}
