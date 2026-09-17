/**
 * Newsletter Studio — Type Definitions
 *
 * A PDF-newsletter sender embedded in the admin platform: the newsletter is
 * produced elsewhere as a finished PDF (by hand or by a monthly routine), and
 * the studio's job is to attach it to a short branded email, send it to one
 * or more communication groups with batched background delivery, and report
 * delivery and read rate. It deliberately has no composer, no templates and
 * no merge fields — those were removed when the module was simplified.
 *
 * Storage lives under the `nlstudio:` KV namespace (see
 * repositories/newsletter-studio-repository.ts). The `newsletter:` prefix is
 * deliberately NOT used: newsletter-service.ts scans that whole prefix as
 * subscriber records. The PDF itself lives in Supabase Storage
 * (newsletter-studio-storage.ts), never in KV.
 */

/**
 * Campaign lifecycle.
 *
 * draft ──schedule──▶ scheduled ──due──▶ queued ──processor──▶ sending ──▶ finished
 *   │                     │                │                      │
 *   └──────send-now───────┴───────────────▶│      paused ◀─────── ┤ (sender fault only)
 *                                          │        │  resume     │
 *                                     cancelled ◀───┴─────────────┘
 *
 * `paused` is not an admin control any more: the processor parks a campaign
 * there when the email provider rejects OUR sender (credentials, identity,
 * quota), so the audience is not burned against a fault no retry can clear.
 * The admin sees it as "stopped" with the provider's message and a Retry.
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

/** The one tracked link every newsletter email carries: the "Read the newsletter" button. */
export const PDF_LINK_ID = 'pdf';

/** Where a campaign came from — an admin in the studio, or the monthly routine. */
export type NewsletterCampaignSource = 'admin' | 'routine';

/** The stored newsletter PDF. Bytes live in Storage; this is the pointer. */
export interface NewsletterPdf {
  /** Object path inside the newsletters bucket (`<campaignId>/<uuid>.pdf`). */
  storagePath: string;
  /** Original file name, shown to the admin and used as the attachment name. */
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * A campaign's live presence on the public website.
 *
 * The PDF is copied into a PUBLIC bucket on publish and served from a
 * permanent URL: an indexable page cannot hang off a signed URL that expires,
 * and a published newsletter has already been emailed to every subscriber, so
 * there is nothing left to gate. The private bucket stays the system of record
 * for drafts and for the tracked click-through.
 */
export interface NewsletterWebsitePublication {
  /** URL segment under /resources/newsletter/. Stable once published. */
  slug: string;
  publishedAt: string;
  /** Permanent public URL of the copied PDF. */
  pdfUrl: string;
  /** Object path inside the public bucket, kept so unpublish can remove it. */
  publicPath: string;
  pdfFileName: string;
  pdfSizeBytes: number;
}

/**
 * What the public website reads. Deliberately NOT the campaign record: an
 * unauthenticated endpoint must never carry recipient counts, audience names,
 * delivery errors or lease state.
 */
export interface PublishedNewsletter {
  slug: string;
  campaignId: string;
  title: string;
  description: string;
  /** 'YYYY-MM' — the issue this is, not the day it was sent. */
  issueMonth: string;
  year: number;
  /** 1–12. */
  month: number;
  pdfUrl: string;
  pdfFileName: string;
  pdfSizeBytes: number;
  publishedAt: string;
}

export interface NewsletterCampaign {
  id: string;
  /** Doubles as the email subject. */
  title: string;
  /** Short intro shown in the email above the "Read the newsletter" button. */
  description: string;
  /** Display name on the from address (address itself is fixed per deliverability config). */
  fromName: string;
  /**
   * Communication group ids this campaign targets. May be empty: a newsletter
   * can be published on the website without being emailed to anyone. An
   * audience is required at send time, not at create time.
   */
  listIds: string[];
  /** Names snapshot of the targeted groups, for history display after a group is renamed/deleted. */
  listNames: string[];
  /** Required before the campaign can be scheduled or sent. */
  pdf: NewsletterPdf | null;
  source: NewsletterCampaignSource;
  /** The routine's idempotency key, so a replayed hand-over never creates a second draft. */
  sourceRef: string | null;
  /** When the "a draft is waiting for review" admin email went out (routine drafts). */
  reviewNotifiedAt: string | null;

  /**
   * Which issue this is, as 'YYYY-MM'. Decides the year/month it files under
   * on the website, so the September issue published on 2 October still files
   * under September. Defaults to the month the campaign was created.
   */
  issueMonth: string;
  /** Intent: publish on the website when the send finishes. Default true. */
  publishToWebsite: boolean;
  /** Set once live on the website; null otherwise. */
  website: NewsletterWebsitePublication | null;

  status: NewsletterCampaignStatus;
  /** ISO timestamp for scheduled sends; null when immediate/draft. */
  scheduledAt: string | null;

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

  /** Unique recipients who clicked through to the PDF (cached from recipient records). */
  readCount: number;
  /** When the engagement counter was last recomputed. */
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
  /** First read (click-derived — this platform deliberately uses no tracking pixel). */
  openedAt: string | null;
  clicks: NewsletterRecipientClick[];
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

export interface NewsletterCampaignStats {
  campaignId: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  /** Unique recipients who clicked through to the PDF. */
  readCount: number;
  /** readCount / sentCount, as a percentage with one decimal. */
  readRate: number;
}

/** A communication group projected as an audience for the studio UI. */
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
    /** Routine-submitted drafts still waiting for an admin to send them. */
    awaitingReview: number;
    scheduled: number;
    active: number;
    finished: number;
    cancelled: number;
  };
  delivery: {
    totalSent: number;
    totalFailed: number;
    totalRead: number;
  };
  recentCampaigns: NewsletterCampaignView[];
  processor: NewsletterProcessorState | null;
  listCount: number;
}

export interface ProcessNewsletterCampaignsResult {
  mode: 'manual' | 'cron';
  campaignsExamined: number;
  campaignsProcessed: number;
  promotedScheduled: number;
  /** Routine hand-overs promoted from the SQL intake table this tick (cron only). */
  intakeProcessed: number;
  sent: number;
  failed: number;
  finished: string[];
  errors: string[];
}
