/**
 * Newsletter Studio — Type Definitions
 *
 * A listmonk-style campaign engine embedded in the admin platform:
 * campaigns with a real lifecycle, batched background delivery, reusable
 * templates, and click-through engagement — built on the existing
 * communication groups (audiences) and newsletter subscriber records.
 *
 * Storage lives under the `nlstudio:` KV namespace (see
 * repositories/newsletter-studio-repository.ts). The `newsletter:` prefix is
 * deliberately NOT used: newsletter-service.ts scans that whole prefix as
 * subscriber records.
 */

/**
 * Campaign lifecycle.
 *
 * draft ──schedule──▶ scheduled ──due──▶ queued ──processor──▶ sending ──▶ finished
 *   │                     │                │                      │
 *   └──────send-now───────┴───────────────▶│      pause ◀──────── ┤
 *                                          │        │  resume     │
 *                                     cancelled ◀───┴─────────────┘
 */
export type NewsletterCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'sending'
  | 'paused'
  | 'finished'
  | 'cancelled';

/** Statuses the processor is allowed to pick up. */
export const ACTIVE_CAMPAIGN_STATUSES: NewsletterCampaignStatus[] = ['queued', 'sending'];

/** Statuses in which the campaign content/audience may still be edited. */
export const EDITABLE_CAMPAIGN_STATUSES: NewsletterCampaignStatus[] = ['draft', 'scheduled'];

/** A tracked link inside a campaign body, stored so click-through never redirects to an attacker-supplied URL. */
export interface NewsletterCampaignLink {
  /** Short stable id referenced from rewritten hrefs (`l1`, `l2`, …). */
  id: string;
  /** The original destination URL, exactly as authored. */
  url: string;
}

export interface NewsletterCampaign {
  id: string;
  name: string;
  subject: string;
  /** Hidden inbox-preview line injected at the top of the rendered body. */
  preheader?: string;
  /** Display name on the from address (address itself is fixed per deliverability config). */
  fromName: string;
  /** Communication group ids this campaign targets ("lists" in listmonk terms). */
  listIds: string[];
  /** Names snapshot of the targeted groups, for history display after a group is renamed/deleted. */
  listNames: string[];
  /** Rich HTML body authored in the studio editor. */
  bodyHtml: string;
  /** Optional studio template this campaign was started from. */
  templateId?: string | null;
  /** Rewrite links for click-through tracking. Defaults to true. */
  trackClicks: boolean;
  status: NewsletterCampaignStatus;
  /** ISO timestamp for scheduled sends; null when immediate/draft. */
  scheduledAt: string | null;

  /** Links extracted from bodyHtml at queue time (empty until queued). */
  links: NewsletterCampaignLink[];

  /** Audience size resolved at queue time. 0 until queued. */
  recipientCount: number;
  /** Delivered successfully. */
  sentCount: number;
  /** Terminal failures (bounces, invalid addresses, retry budget exhausted). */
  failedCount: number;
  /** sentCount + failedCount. */
  processedCount: number;
  /** 0–100 with one decimal. */
  progressPercent: number;

  /** Engagement counters, refreshed lazily from recipient records (see service). */
  openCount: number;
  clickCount: number;
  /** When the engagement counters were last recomputed. */
  statsRefreshedAt: string | null;

  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  /** Advanced whenever the processor makes progress; drives stuck detection. */
  lastProgressAt: string | null;
  lastError: string | null;

  /** Advisory processor lease (write → settle → read-back, same as publications jobs). */
  lockId: string | null;
  lockExpiresAt: string | null;
}

/** One resolved audience member, snapshotted at queue time. */
export interface NewsletterAudienceItem {
  email: string;
  name: string;
  firstName: string;
  /** Per-recipient tracking token; also the recipient record id suffix. */
  token: string;
}

/**
 * The frozen worklist for one campaign, written once at queue time.
 * Delivery state lives on per-recipient records, not here, so the audience
 * record is never contended between the sender and the click endpoint.
 */
export interface NewsletterCampaignAudience {
  campaignId: string;
  items: NewsletterAudienceItem[];
  resolvedAt: string;
  /** How many candidate members were dropped as explicitly unsubscribed (POPIA). */
  excludedUnsubscribed: number;
  /** How many candidate members were dropped as invalid/duplicate addresses. */
  excludedInvalid: number;
}

export type NewsletterDeliveryStatus =
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed_retryable'
  | 'failed_terminal';

export interface NewsletterRecipientClick {
  linkId: string;
  at: string;
}

/**
 * Per-recipient delivery + engagement record.
 * Repository id: `${campaignId}:${token}`.
 * Absence of a record means the recipient is still pending (created on first attempt).
 */
export interface NewsletterCampaignRecipient {
  campaignId: string;
  token: string;
  email: string;
  name: string;
  firstName: string;
  deliveryStatus: NewsletterDeliveryStatus;
  deliveryError: string | null;
  attemptCount: number;
  lastAttemptedAt: string | null;
  sentAt: string | null;
  /** First engagement (click-derived — this platform deliberately uses no tracking pixel). */
  openedAt: string | null;
  clicks: NewsletterRecipientClick[];
}

/** Reusable starting content for campaigns. */
export interface NewsletterStudioTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Heartbeat + last-run summary for the delivery processor. */
export interface NewsletterProcessorState {
  mode: 'manual' | 'cron';
  lastRunAt: string | null;
  /**
   * Last run driven by pg_cron specifically. Null means the scheduled job has
   * never checked in — scheduling then only advances while an admin has the
   * dashboard open, which the UI surfaces as a warning.
   */
  lastCronRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastHeartbeatAt: string | null;
  activeCampaignCount: number;
  processedInLastRun: number;
  sentInLastRun: number;
  failedInLastRun: number;
}

/** A campaign row enriched with live derived fields for the admin UI. */
export interface NewsletterCampaignView extends NewsletterCampaign {
  pendingCount: number;
  stuck: boolean;
}

/** Compact per-link click stats, computed on demand. */
export interface NewsletterCampaignLinkStats extends NewsletterCampaignLink {
  clickCount: number;
}

export interface NewsletterCampaignStats {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  openCount: number;
  clickCount: number;
  /** Unique recipients with ≥1 click. */
  clickedRecipientCount: number;
  openRate: number;
  clickRate: number;
  links: NewsletterCampaignLinkStats[];
}

/** A communication group projected as a listmonk-style "list" for the studio UI. */
export interface NewsletterListView {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'custom';
  memberCount: number;
  externalContactCount: number;
  clientCount: number;
}

export interface NewsletterDashboardSummary {
  subscribers: {
    total: number;
    active: number;
    pending: number;
    unsubscribed: number;
  };
  campaigns: {
    total: number;
    draft: number;
    scheduled: number;
    active: number;
    finished: number;
    cancelled: number;
  };
  delivery: {
    totalSent: number;
    totalFailed: number;
    totalOpens: number;
    totalClicks: number;
  };
  recentCampaigns: NewsletterCampaignView[];
  processor: NewsletterProcessorState | null;
  listCount: number;
  templateCount: number;
}

export interface ProcessNewsletterCampaignsResult {
  mode: 'manual' | 'cron';
  campaignsExamined: number;
  campaignsProcessed: number;
  promotedScheduled: number;
  sent: number;
  failed: number;
  finished: string[];
  errors: string[];
}
