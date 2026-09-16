/**
 * Newsletter Studio — the advisory campaign lease.
 *
 * Optimistic write → settle → read-back, identical in spirit to the
 * publications jobs engine. Split out of the processor (§20.1); the
 * behaviour is unchanged.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { sleep } from './publications-notification-state.ts';
import { nowIso } from './newsletter-studio-service.ts';
import { newsletterCampaigns } from './repositories/newsletter-studio-repository.ts';
import { ACTIVE_CAMPAIGN_STATUSES } from './newsletter-studio-types.ts';
import type { NewsletterCampaign } from './newsletter-studio-types.ts';

const log = createModuleLogger('newsletter-studio-lease');

export const CAMPAIGN_LOCK_TTL_MS = 60_000;
export const CAMPAIGN_LOCK_SETTLE_MS = 80;
/** How often an in-flight batch renews the lease it holds. */
export const LEASE_HEARTBEAT_MS = 20_000;

export async function acquireCampaignLease(
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

export async function releaseCampaignLease(
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

/**
 * Release built on the LATEST stored record, never this tick's copy: an
 * admin cancel written while the processor held the lease must survive the
 * write (review finding). An admin-written non-active status always wins
 * over `fallbackStatus`.
 */
export async function releaseCampaignSafely(
  campaign: NewsletterCampaign,
  fallbackStatus: NewsletterCampaign['status'],
  updates: Partial<NewsletterCampaign> = {},
): Promise<void> {
  const latest = (await newsletterCampaigns.get(campaign.id)) ?? campaign;
  const adminHalted = !ACTIVE_CAMPAIGN_STATUSES.includes(latest.status);
  await releaseCampaignLease(latest, {
    ...updates,
    status: adminHalted ? latest.status : fallbackStatus,
  });
}

/**
 * Persist delivery counters onto the LATEST record for the same reason.
 * Returns the merged record and whether the admin halted the campaign while
 * the batch was in flight — the caller must stop delivering when it did.
 */
export async function persistProgress(
  campaign: NewsletterCampaign,
  counters: Pick<
    NewsletterCampaign,
    'sentCount' | 'failedCount' | 'processedCount' | 'progressPercent'
  >,
): Promise<{ campaign: NewsletterCampaign; halted: boolean }> {
  const latest = (await newsletterCampaigns.get(campaign.id)) ?? campaign;
  const halted = !ACTIVE_CAMPAIGN_STATUSES.includes(latest.status);
  const merged: NewsletterCampaign = {
    ...latest,
    ...counters,
    lastProgressAt: nowIso(),
    updatedAt: nowIso(),
    lockId: halted ? null : campaign.lockId,
    lockExpiresAt: halted ? null : new Date(Date.now() + CAMPAIGN_LOCK_TTL_MS).toISOString(),
  };
  await newsletterCampaigns.put(campaign.id, merged);
  return { campaign: merged, halted };
}

/**
 * Run `work` while renewing the campaign's lease in the background, so a batch
 * that runs long cannot have its lease expire underneath it and be reclaimed
 * by a second worker (review finding). The heartbeat only ever extends
 * `lockExpiresAt` for the lease we still hold: if another worker has taken it,
 * or an admin halted the campaign, it stops renewing and leaves the record
 * alone.
 */
export async function withLeaseHeartbeat<T>(
  campaign: NewsletterCampaign,
  work: () => Promise<T>,
): Promise<T> {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const latest = await newsletterCampaigns.get(campaign.id);
        if (!latest || latest.lockId !== campaign.lockId) return;
        if (!ACTIVE_CAMPAIGN_STATUSES.includes(latest.status)) return;
        await newsletterCampaigns.put(campaign.id, {
          ...latest,
          lockExpiresAt: new Date(Date.now() + CAMPAIGN_LOCK_TTL_MS).toISOString(),
        });
      } catch (error) {
        log.warn('Lease heartbeat failed', {
          campaignId: campaign.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, LEASE_HEARTBEAT_MS);

  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}
