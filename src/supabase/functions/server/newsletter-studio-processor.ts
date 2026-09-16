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
 * Every newsletter carries its PDF as an attachment, so the attachment is
 * built once per campaign per tick and the concurrent batch is sized from
 * its encoded length (newsletter-studio-attachment.ts).
 *
 * Invoked from three places, mirroring the platform doctrine "cron is the
 * authoritative driver, the admin browser is a best-effort accelerator":
 *   - POST /newsletter-studio/cron/process        (pg_cron, requireCronAuth)
 *   - POST /newsletter-studio/process             (admin manual/accelerator)
 *   - after send-now/resume, opportunistically inline (fire-and-forget).
 *
 * The cron tick additionally sweeps the SQL intake table for routine
 * hand-overs (newsletter-intake-service.ts) before delivering anything.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { getFooterSettings, sendEmail } from './email-service.ts';
import type { EmailFooterSettings } from './email-core.ts';
import { listSubscribers } from './newsletter-service.ts';
import {
  chunkArray,
  classifyDeliveryFailure,
  IDLE_HEARTBEAT_INTERVAL_MS,
  isHeartbeatWithin,
  isSenderConfigurationFailure,
  normalizeSendError,
  sleep,
} from './publications-notification-state.ts';
import {
  buildCampaignEmailHeaders,
  buildReadUrl,
  NEWSLETTER_DEFAULT_FROM_NAME,
  NEWSLETTER_FROM_EMAIL,
  NEWSLETTER_REPLY_TO,
  renderNewsletterEmail,
} from './newsletter-studio-render.ts';
import { buildPdfAttachment, deliveryBatchSize } from './newsletter-studio-attachment.ts';
import type { PdfAttachment } from './newsletter-studio-attachment.ts';
import {
  acquireCampaignLease,
  CAMPAIGN_LOCK_TTL_MS,
  persistProgress,
  releaseCampaignLease,
  releaseCampaignSafely,
  withLeaseHeartbeat,
} from './newsletter-studio-lease.ts';
import { nowIso, promoteDueScheduledCampaign } from './newsletter-studio-service.ts';
import { RECIPIENT_FETCH_CHUNK } from './newsletter-studio-engagement.ts';
import { sweepNewsletterIntake } from './newsletter-intake-service.ts';
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

export {
  CAMPAIGN_LOCK_SETTLE_MS,
  CAMPAIGN_LOCK_TTL_MS,
  LEASE_HEARTBEAT_MS,
} from './newsletter-studio-lease.ts';
export { DELIVERY_BATCH_SIZE } from './newsletter-studio-attachment.ts';
export { sendCampaignTestEmails } from './newsletter-studio-test-send.ts';
export type { TestSendOutcome } from './newsletter-studio-test-send.ts';

const log = createModuleLogger('newsletter-studio-processor');

// Budgets and pacing — aligned with the article-notification engine.
export const MAX_SEND_ATTEMPTS_PER_DELIVERY = 3;
export const RETRY_DELAYS_MS = [750, 1500];
export const RETRYABLE_REQUEUE_DELAY_MS = 30_000;
/** Total attempts across ticks before a retryable failure becomes terminal. */
export const MAX_TOTAL_ATTEMPTS = 5;
/**
 * Deadline on a single provider call. Without one a hung SendGrid/SES request
 * has no upper bound, so a batch could outlive its lease and be reclaimed by
 * another tick — which `recipientReadiness` would then treat as retryable,
 * duplicating the email (review finding). Three attempts plus the retry
 * sleeps stay under CAMPAIGN_LOCK_TTL_MS at this value.
 */
export const PROVIDER_REQUEST_TIMEOUT_MS = 15_000;
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

/**
 * Emails that have explicitly opted out, re-read once per tick so an
 * unsubscribe landing after the audience was frozen still suppresses
 * delivery on every later batch (POPIA — review finding).
 */
async function loadOptedOutEmails(): Promise<Set<string>> {
  try {
    const subscribers = await listSubscribers();
    return new Set(subscribers.filter((s) => s.active === false).map((s) => s.email.toLowerCase()));
  } catch (error) {
    log.warn('Opt-out re-check scan failed — proceeding with queue-time exclusions only', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new Set();
  }
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

/** Everything a tick loads once for a campaign and shares across its recipients. */
interface CampaignSendContext {
  attachment: PdfAttachment;
  footerSettings: EmailFooterSettings;
}

/**
 * `sender_fault` means the send failed for a reason that is ours, not the
 * recipient's, and carries the operator-facing message. Its recipient record is
 * left exactly as it was found so the campaign can resume once the cause is
 * fixed.
 */
type DeliveryOutcome =
  | { kind: 'sent' | 'retryable' | 'terminal' }
  | { kind: 'sender_fault'; message: string };

function blankRecord(
  campaign: NewsletterCampaign,
  item: NewsletterAudienceItem,
): NewsletterCampaignRecipient {
  return {
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
}

async function deliverToRecipient(
  campaign: NewsletterCampaign,
  item: NewsletterAudienceItem,
  existing: NewsletterCampaignRecipient | null,
  optedOut: Set<string>,
  ctx: CampaignSendContext,
): Promise<DeliveryOutcome> {
  const recordId = recipientRecordId(campaign.id, item.token);
  const priorAttempts = existing?.attemptCount ?? 0;

  // POPIA: an opt-out recorded after the audience was frozen still wins.
  if (optedOut.has(item.email.toLowerCase())) {
    await newsletterRecipients.put(recordId, {
      ...(existing ?? blankRecord(campaign, item)),
      deliveryStatus: 'failed_terminal',
      deliveryError: 'Recipient opted out after the campaign was queued — skipped (POPIA)',
    });
    return { kind: 'terminal' };
  }

  // Give-up cap: a retryable failure that has exhausted its budget goes
  // terminal without another provider call.
  if (existing?.deliveryStatus === 'failed_retryable' && priorAttempts >= MAX_TOTAL_ATTEMPTS) {
    await newsletterRecipients.put(recordId, {
      ...existing,
      deliveryStatus: 'failed_terminal',
      deliveryError: `${existing.deliveryError || 'delivery failed'} (retry budget exhausted)`,
    });
    return { kind: 'terminal' };
  }

  const attemptStarted: NewsletterCampaignRecipient = {
    ...(existing ?? blankRecord(campaign, item)),
    deliveryStatus: 'sending',
    attemptCount: priorAttempts + 1,
    lastAttemptedAt: nowIso(),
  };
  await newsletterRecipients.put(recordId, attemptStarted);

  const { html, text } = renderNewsletterEmail({
    campaign,
    recipient: item,
    readUrl: buildReadUrl(campaign.id, item.token),
    footerSettings: ctx.footerSettings,
  });

  let lastFailure: { message: string; disposition: 'retryable' | 'terminal' } | null = null;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS_PER_DELIVERY; attempt++) {
    try {
      await sendEmail({
        to: item.email,
        subject: campaign.title,
        html,
        text,
        from: {
          email: NEWSLETTER_FROM_EMAIL,
          name: campaign.fromName || NEWSLETTER_DEFAULT_FROM_NAME,
        },
        replyTo: NEWSLETTER_REPLY_TO,
        headers: buildCampaignEmailHeaders(campaign.id, item.token),
        attachments: [ctx.attachment],
        customArgs: { type: 'newsletter_campaign', campaign_id: campaign.id },
        throwOnError: true,
        timeoutMs: PROVIDER_REQUEST_TIMEOUT_MS,
      });
      await newsletterRecipients.put(recordId, {
        ...attemptStarted,
        deliveryStatus: 'sent',
        deliveryError: null,
        sentAt: nowIso(),
      });
      return { kind: 'sent' };
    } catch (error) {
      // Our configuration, not this recipient's address. Put the record back
      // exactly as we found it — no attempt consumed, no failure recorded —
      // and let the caller stop the campaign. Retrying cannot help, and
      // recording it against recipients would burn the audience.
      if (isSenderConfigurationFailure(error)) {
        if (existing) await newsletterRecipients.put(recordId, existing);
        else await newsletterRecipients.remove(recordId);
        return { kind: 'sender_fault', message: normalizeSendError(error) };
      }
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
  return { kind: terminal ? 'terminal' : 'retryable' };
}

// ── Per-campaign tick ────────────────────────────────────────────────────────

interface CampaignTickTally {
  sent: number;
  failed: number;
  finished: boolean;
  /** Set when the run stopped because the provider rejected our sender. */
  senderFault?: string;
}

function progressPercent(processed: number, total: number): number {
  return total > 0 ? Math.round((processed / total) * 1000) / 10 : 100;
}

/**
 * Load the PDF and footer once for the tick. A PDF that cannot be read is a
 * fault on our side — the campaign is parked the same way a rejected sender
 * is, with no recipient burned.
 */
async function loadSendContext(campaign: NewsletterCampaign): Promise<CampaignSendContext> {
  if (!campaign.pdf) throw new Error('The newsletter has no PDF to attach');
  const [attachment, footerSettings] = await Promise.all([
    buildPdfAttachment(campaign.pdf),
    getFooterSettings(),
  ]);
  return { attachment, footerSettings };
}

async function processOneCampaign(
  leased: NewsletterCampaign,
  maxBatches: number,
  optedOut: Set<string>,
): Promise<CampaignTickTally> {
  const tally: CampaignTickTally = { sent: 0, failed: 0, finished: false };
  const audience = await newsletterAudiences.get(leased.id);
  if (!audience || audience.items.length === 0) {
    await releaseCampaignSafely(leased, 'finished', {
      completedAt: nowIso(),
      progressPercent: 100,
      lastError: 'Audience record missing — nothing to deliver',
    });
    tally.finished = true;
    return tally;
  }

  let ctx: CampaignSendContext;
  try {
    ctx = await loadSendContext(leased);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Campaign paused — the newsletter PDF could not be loaded', {
      campaignId: leased.id,
      error: message,
    });
    await releaseCampaignSafely(leased, 'paused', {
      lastError: `Paused — the newsletter PDF could not be loaded, not a recipient problem: ${message}`,
    });
    tally.senderFault = message;
    return tally;
  }
  const batchSize = deliveryBatchSize(ctx.attachment.content.length);

  let campaign = leased;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
    // Respect a cancel written by the admin between batches.
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
        await releaseCampaignSafely(campaign, 'queued');
      }
      return tally;
    }

    const batch = readyIndexes.slice(0, batchSize);
    const outcomes = await withLeaseHeartbeat(campaign, () =>
      Promise.allSettled(
        batch.map((index) =>
          deliverToRecipient(campaign, audience.items[index], records[index], optedOut, ctx),
        ),
      ),
    );
    let senderFault: string | null = null;
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        if (outcome.value.kind === 'sent') {
          sentCount++;
          tally.sent++;
        } else if (outcome.value.kind === 'terminal') {
          failedCount++;
          tally.failed++;
        } else if (outcome.value.kind === 'sender_fault') {
          senderFault ??= outcome.value.message;
        }
      } else {
        log.error('Unexpected delivery rejection', { error: String(outcome.reason) });
      }
    }

    // Our identity, credentials, account standing or quota — every remaining
    // recipient would fail identically. Pause with the provider's own words so
    // an operator can fix the cause and retry, rather than grinding the
    // audience down against a problem no retry can clear.
    if (senderFault) {
      log.error('Campaign paused — email provider rejected the sender', {
        campaignId: campaign.id,
        error: senderFault,
      });
      const halted = sentCount + failedCount;
      await persistProgress(campaign, {
        sentCount,
        failedCount,
        processedCount: halted,
        progressPercent: progressPercent(halted, audience.items.length),
      });
      await releaseCampaignSafely(campaign, 'paused', {
        lastError: `Paused — the email provider rejected the sender, not the recipients: ${senderFault}`,
      });
      tally.senderFault = senderFault;
      return tally;
    }

    const processed = sentCount + failedCount;
    const progress = await persistProgress(campaign, {
      sentCount,
      failedCount,
      processedCount: processed,
      progressPercent: progressPercent(processed, audience.items.length),
    });
    campaign = progress.campaign;
    // An admin cancelled while the batch was in flight — their status
    // stands (persistProgress kept it) and delivery stops here.
    if (progress.halted) return tally;

    if (processed >= audience.items.length) {
      await finalizeCampaign(campaign, audience.items.length, sentCount, failedCount);
      tally.finished = true;
      return tally;
    }
  }

  // Batch budget spent — hand back to the queue for the next tick.
  await releaseCampaignSafely(campaign, 'queued');
  return tally;
}

async function finalizeCampaign(
  campaign: NewsletterCampaign,
  recipientCount: number,
  sentCount: number,
  failedCount: number,
): Promise<void> {
  const timestamp = nowIso();
  // A cancel that landed during the final batch stands; everything else
  // that reached this point is genuinely finished.
  const latest = (await newsletterCampaigns.get(campaign.id)) ?? campaign;
  await releaseCampaignLease(latest, {
    status: latest.status === 'cancelled' ? 'cancelled' : 'finished',
    sentCount,
    failedCount,
    processedCount: sentCount + failedCount,
    progressPercent: 100,
    completedAt: timestamp,
    lastProgressAt: timestamp,
    lastError: failedCount > 0 ? `${failedCount} recipient(s) failed permanently` : null,
  });

  // Light up the legacy subscriber-dashboard KPIs (getStats scans broadcast:).
  await legacyBroadcasts.put(campaign.id, {
    id: campaign.id,
    subject: campaign.title,
    bodySnippet: campaign.description.replace(/\s+/g, ' ').trim().slice(0, 280),
    recipientCount,
    sent: sentCount,
    failed: failedCount,
    sentAt: timestamp,
  });

  log.info('Campaign finished', { campaignId: campaign.id, sentCount, failedCount });
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
    intakeProcessed: 0,
    sent: 0,
    failed: 0,
    finished: [],
    errors: [],
  };

  try {
    // 0) Routine hand-overs waiting in the SQL intake table (cron only — the
    //    browser accelerator must not be what makes drafts appear).
    if (mode === 'cron') {
      try {
        const swept = await sweepNewsletterIntake();
        result.intakeProcessed = swept.processed;
        result.errors.push(...swept.errors);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`intake sweep: ${message}`);
        log.error('Intake sweep failed', { message });
      }
    }

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

    // One opt-out scan per tick — every batch this tick honours it.
    const optedOut = active.length > 0 ? await loadOptedOutEmails() : new Set<string>();

    for (const campaign of active) {
      const leased = await acquireCampaignLease(campaign);
      if (!leased) continue;
      result.campaignsProcessed++;
      try {
        const tally = await processOneCampaign(leased, maxBatches, optedOut);
        result.sent += tally.sent;
        result.failed += tally.failed;
        if (tally.finished) result.finished.push(campaign.id);
        // A sender fault stops delivery without throwing, so without this the
        // run looks clean: result.errors stays empty, writeProcessorState
        // clears lastError, and the dashboard reports the processor Healthy
        // while nothing is going out.
        if (tally.senderFault) {
          result.errors.push(
            `campaign ${campaign.id}: paused — the email provider rejected the sender: ${tally.senderFault}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`campaign ${campaign.id}: ${message}`);
        log.error('Campaign tick failed', { campaignId: campaign.id, message });
        await releaseCampaignSafely(leased, 'queued', { lastError: message }).catch(() => {});
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
    // Only a real cron tick refreshes this, so a browser accelerator run
    // cannot mask an uninstalled scheduled job.
    lastCronRunAt: mode === 'cron' ? timestamp : (previous?.lastCronRunAt ?? null),
    // A fatal error preserves the previous success mark; a clean run stamps now.
    lastSuccessAt: fatalError ? (previous?.lastSuccessAt ?? null) : timestamp,
    lastError: fatalError ?? (result.errors.length > 0 ? result.errors[0] : null),
    lastHeartbeatAt: timestamp,
    activeCampaignCount: result.campaignsProcessed,
    processedInLastRun: result.sent + result.failed,
    sentInLastRun: result.sent,
    failedInLastRun: result.failed,
  };
  // An idle tick inside the heartbeat interval changes nothing but the
  // timestamps; skipping the upsert is what keeps the delivery cron from
  // being the KV table's busiest writer (see IDLE_HEARTBEAT_INTERVAL_MS).
  if (canSkipIdleNewsletterProcessorStateWrite(previous, state)) return;
  await newsletterProcessorState.put(NEWSLETTER_PROCESSOR_STATE_ID, state);
}

function isIdleNewsletterProcessorState(state: NewsletterProcessorState): boolean {
  return (
    state.lastError === null &&
    state.activeCampaignCount === 0 &&
    state.processedInLastRun === 0 &&
    state.sentInLastRun === 0 &&
    state.failedInLastRun === 0
  );
}

/**
 * True when persisting `next` would change nothing a reader can act on: the
 * previous row already says "idle, no error, same mode" and its heartbeat is
 * younger than IDLE_HEARTBEAT_INTERVAL_MS. A cron tick additionally needs the
 * stored `lastCronRunAt` to be that fresh, because the dashboard's live/stale
 * verdict (SCHEDULER_STALE_AFTER_MS) reads that field, not the heartbeat.
 */
export function canSkipIdleNewsletterProcessorStateWrite(
  previous: NewsletterProcessorState | null,
  next: NewsletterProcessorState,
): boolean {
  if (!previous) return false;
  if (previous.mode !== next.mode) return false;
  if (!isIdleNewsletterProcessorState(previous) || !isIdleNewsletterProcessorState(next)) {
    return false;
  }
  if (!isHeartbeatWithin(previous.lastHeartbeatAt, IDLE_HEARTBEAT_INTERVAL_MS)) return false;
  if (next.mode === 'cron') {
    return isHeartbeatWithin(previous.lastCronRunAt, IDLE_HEARTBEAT_INTERVAL_MS);
  }
  return true;
}
