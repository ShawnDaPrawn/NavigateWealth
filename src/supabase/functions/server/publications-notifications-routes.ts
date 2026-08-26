/**
 * publications-notifications-routes.ts — email-engagement summaries + the
 * article-notification job/campaign management surface (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', notificationsRoutes)`. Carries the two
 * notification-shaped response helpers it owns (completedBlast / campaign-first
 * engagement summary). Behaviour-preserving; the publications route contract
 * suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { ArticleDeliveryRetrySchema } from './publications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  getArticleNotificationCampaign,
  getLatestArticleNotificationCampaign,
  getArticleNotificationJob,
  getArticleNotificationProcessorState,
  listArticleNotificationCampaigns,
  processArticleNotificationJobs,
  repairPublishNotificationCampaignFromTracking,
  resumeArticleNotificationDelivery,
  sendArticlePublishedNotificationsBlastThenRetryQueue,
  finalizeActiveArticleNotificationJobsForPublish,
  type ArticleNotificationJobSnapshot,
  type ArticleNotificationRunResult,
} from './publications-notification-service.ts';
import {
  listArticleIdsFromEmailTrackingKeyScan,
  listArticleEmailTrackingRecords,
  summarizeArticleEmailEngagement,
  summarizeTrackedRecipientDeliveries,
} from './publications-email-engagement-service.ts';
import {
  kickArticleNotificationJob,
  articleTrackingDetails,
  deletedArticleTrackingDetails,
  isAuthorizedPublicationsCronRequest,
  PUBLICATIONS_CRON_SHARED_HEADER,
  type Article,
  type DeletedArticleRecord,
} from './publications-route-helpers.ts';

const log = createModuleLogger('publications-notifications-routes');

const notificationsRoutes = new Hono();

/** When a blast finishes with no retry queue, the API still returns a job-shaped payload for the admin client. */
function completedBlastNotificationJobPlaceholder(
  article: Article,
  blast: ArticleNotificationRunResult,
): ArticleNotificationJobSnapshot {
  const now = new Date().toISOString();
  return {
    id: `blast-${article.id}`,
    articleId: article.id,
    articleTitle: article.title,
    articleSlug: article.slug,
    articleExcerpt: article.excerpt || '',
    source: 'publish',
    kind: 'publish',
    status: 'completed',
    recipientCount: 0,
    currentIndex: 0,
    prepareCursor: 0,
    items: [],
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: now,
    lastProgressAt: now,
    lastPreparedAt: null,
    lastDeliveredAt: now,
    lastError: null,
    lockId: null,
    lockExpiresAt: null,
    phase: 'completed',
    preparedCount: 0,
    unpreparedCount: 0,
    sentCount: blast.sent,
    failedCount: blast.failed,
    failedRetryableCount: 0,
    failedTerminalCount: blast.failed,
    pendingCount: 0,
    sendingCount: 0,
    processedCount: blast.sent + blast.failed,
    progressPercent: 100,
    stuck: false,
  };
}

function buildCampaignFirstEmailEngagementSummary(
  article: Article | null,
  deletedArticle: DeletedArticleRecord | null,
  records: Awaited<ReturnType<typeof listArticleEmailTrackingRecords>>,
  campaign: Awaited<ReturnType<typeof getArticleNotificationCampaign>> | null,
) {
  const articleDetails =
    articleTrackingDetails(article) || deletedArticleTrackingDetails(deletedArticle);
  const baseSummary = summarizeArticleEmailEngagement(articleDetails, records);
  const publishTotals = summarizeTrackedRecipientDeliveries(records, 'publish');
  const reshareTotals = summarizeTrackedRecipientDeliveries(records, 'reshare');

  if (!campaign) {
    return {
      ...baseSummary,
      isDeleted: Boolean(deletedArticle),
      deletedAt: deletedArticle?.deleted_at ?? null,
      campaignId: null,
      campaignStatus: null,
      intendedRecipientCount:
        publishTotals.sent + publishTotals.undelivered + publishTotals.failedTerminal,
      sendingCount: 0,
      failedRetryableCount: publishTotals.failedRetryable,
      failedTerminalCount: publishTotals.failedTerminal,
      lastActivityAt:
        baseSummary.latestReadAt ||
        baseSummary.latestOpenedAt ||
        baseSummary.latestSentAt ||
        baseSummary.publishedAt,
      lastError: null,
    };
  }

  const campaignPublishMisleading =
    (campaign.status === 'queue_failed' && campaign.sentCount === 0 && publishTotals.sent > 0) ||
    (campaign.intendedRecipientCount === 0 &&
      publishTotals.sent + publishTotals.undelivered + publishTotals.failedTerminal > 0);

  const publishPending = campaignPublishMisleading
    ? publishTotals.undelivered
    : campaign.pendingCount + campaign.sendingCount + campaign.failedRetryableCount;
  const publishFailed = campaignPublishMisleading
    ? publishTotals.failedTerminal
    : campaign.failedTerminalCount;
  const publishSent = campaignPublishMisleading
    ? publishTotals.sent
    : Math.max(campaign.sentCount, publishTotals.sent);
  const intendedRecipientCount = campaignPublishMisleading
    ? publishTotals.sent + publishTotals.undelivered + publishTotals.failedTerminal
    : Math.max(
        campaign.intendedRecipientCount,
        publishTotals.sent + publishTotals.undelivered + publishTotals.failedTerminal,
      );

  return {
    ...baseSummary,
    isDeleted: Boolean(deletedArticle),
    deletedAt: deletedArticle?.deleted_at ?? null,
    campaignId: campaign.id,
    campaignStatus:
      campaignPublishMisleading && publishSent > 0 && publishPending === 0
        ? publishFailed > 0
          ? 'completed_with_failures'
          : 'completed'
        : campaign.status,
    intendedRecipientCount,
    sendingCount: campaignPublishMisleading ? publishTotals.sending : campaign.sendingCount,
    failedRetryableCount: campaignPublishMisleading
      ? publishTotals.failedRetryable
      : campaign.failedRetryableCount,
    failedTerminalCount: publishFailed,
    lastActivityAt:
      campaign.lastActivityAt ||
      baseSummary.latestReadAt ||
      baseSummary.latestOpenedAt ||
      baseSummary.latestSentAt ||
      baseSummary.publishedAt,
    lastError: campaign.lastError,
    pending: publishPending + reshareTotals.pending,
    sent: publishSent + reshareTotals.sent,
    failed: publishFailed + reshareTotals.failed,
    undelivered: publishPending + reshareTotals.undelivered,
    publishPending,
    publishFailed,
    publishUndelivered: publishPending,
  };
}

notificationsRoutes.get(
  '/email-engagement/summary',
  requireAdmin,
  asyncHandler(async (c) => {
    const includeDeleted = c.req.query('include_deleted') === 'true';
    const articles = (await kv.getByPrefix('article:')) as Article[];
    const deletedArticles = (await kv.getByPrefix('article_deleted:')) as DeletedArticleRecord[];
    const campaigns = await listArticleNotificationCampaigns({ source: 'publish' });
    const articleMap = new Map(articles.map((article) => [article.id, article]));
    const deletedArticleMap = new Map(deletedArticles.map((article) => [article.id, article]));

    const trackingArticleIds = await listArticleIdsFromEmailTrackingKeyScan();
    const latestCampaignByArticle = new Map<string, (typeof campaigns)[number]>();
    for (const campaign of campaigns) {
      if (!latestCampaignByArticle.has(campaign.articleId)) {
        latestCampaignByArticle.set(campaign.articleId, campaign);
      }
    }

    const articleIds = new Set<string>([
      ...articles.map((a) => a.id),
      ...trackingArticleIds,
      ...latestCampaignByArticle.keys(),
      ...deletedArticleMap.keys(),
    ]);

    const grouped = new Map<string, Awaited<ReturnType<typeof listArticleEmailTrackingRecords>>>();
    const articleIdList = [...articleIds];
    const chunkSize = 10;
    for (let index = 0; index < articleIdList.length; index += chunkSize) {
      const chunk = articleIdList.slice(index, index + chunkSize);
      const rows = await Promise.all(
        chunk.map((articleId) => listArticleEmailTrackingRecords(articleId)),
      );
      chunk.forEach((articleId, offset) => {
        const articleRecords = rows[offset];
        if (articleRecords.length > 0) {
          grouped.set(articleId, articleRecords);
        }
      });
    }

    const summaries = [...articleIds]
      .map((articleId) => {
        const article = articleMap.get(articleId) || null;
        const deletedArticle = deletedArticleMap.get(articleId) || null;
        const articleRecords = grouped.get(articleId) || [];
        const campaign = latestCampaignByArticle.get(articleId) || null;
        return buildCampaignFirstEmailEngagementSummary(
          article,
          deletedArticle,
          articleRecords,
          campaign,
        );
      })
      .filter((summary) => includeDeleted || !summary.isDeleted)
      .sort((a, b) => {
        const aTime = new Date(a.lastActivityAt || a.latestSentAt || a.publishedAt || 0).getTime();
        const bTime = new Date(b.lastActivityAt || b.latestSentAt || b.publishedAt || 0).getTime();
        return bTime - aTime;
      });

    return c.json({ success: true, data: summaries });
  }),
);

notificationsRoutes.get(
  '/articles/:id/email-engagement',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const article = (await kv.get(`article:${id}`)) as Article | null;
    const deletedArticle = (await kv.get(`article_deleted:${id}`)) as DeletedArticleRecord | null;
    const records = await listArticleEmailTrackingRecords(id);
    let campaign = await getLatestArticleNotificationCampaign(id, 'publish');

    if (!article && !deletedArticle && records.length === 0 && !campaign) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const publishTotals = summarizeTrackedRecipientDeliveries(records, 'publish');
    const shouldRepairCampaign = Boolean(
      article &&
      publishTotals.sent > 0 &&
      (!campaign || (campaign.status === 'queue_failed' && campaign.sentCount === 0)),
    );

    if (shouldRepairCampaign && article) {
      try {
        campaign =
          (await repairPublishNotificationCampaignFromTracking(
            {
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
            },
            {
              lastError: campaign?.lastError ?? null,
            },
          )) ?? campaign;
      } catch (repairError) {
        log.warn('Failed to self-heal publish notification campaign from tracking', {
          articleId: id,
          error: repairError instanceof Error ? repairError.message : String(repairError),
        });
      }
    }

    const summary = buildCampaignFirstEmailEngagementSummary(
      article,
      deletedArticle,
      records,
      campaign,
    );

    return c.json({
      success: true,
      data: {
        summary,
        campaign,
        recipients: records,
      },
    });
  }),
);

notificationsRoutes.post(
  '/articles/:id/retry-undelivered',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const parsed = ArticleDeliveryRetrySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const article = (await kv.get(`article:${id}`)) as Article | null;
    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    if (article.status !== 'published' || !article.published_at) {
      return c.json({ success: false, error: 'Only published articles can retry delivery' }, 400);
    }

    const blastAll = parsed.data.source === 'publish' && parsed.data.blastAll === true;

    let liveNotificationJob: Awaited<ReturnType<typeof resumeArticleNotificationDelivery>>;
    let blastRecipientCount: number | null = null;

    if (blastAll) {
      await finalizeActiveArticleNotificationJobsForPublish(article.id);
      const publishResult = await sendArticlePublishedNotificationsBlastThenRetryQueue({
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
      });
      blastRecipientCount = publishResult.blast.recipientCount;
      let retryJob = publishResult.retryJob;
      if (retryJob && retryJob.recipientCount > 0) {
        retryJob = (await kickArticleNotificationJob(retryJob.id)) ?? retryJob;
      }
      liveNotificationJob =
        retryJob ??
        publishResult.retryJob ??
        completedBlastNotificationJobPlaceholder(article, publishResult.blast);
    } else {
      const notificationJob = await resumeArticleNotificationDelivery(
        {
          id: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
        },
        {
          source: parsed.data.source,
        },
      );
      liveNotificationJob =
        notificationJob.recipientCount > 0
          ? ((await kickArticleNotificationJob(notificationJob.id)) ?? notificationJob)
          : notificationJob;
    }

    const adminUserId = (c.get('userId') as string) || 'system';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action: blastAll ? 'article_delivery_blast_all' : 'article_delivery_retried',
      summary: blastAll
        ? `Blast publish to all subscribers: ${article.title}`
        : `Queued undelivered article notification retry: ${article.title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
      metadata: {
        source: parsed.data.source,
        blastAll,
        blastRecipientCount,
        recipientCount: liveNotificationJob.recipientCount,
        notificationJobId: liveNotificationJob.id,
        notificationStatus: liveNotificationJob.status,
      },
    }).catch(() => {});

    const message = blastAll
      ? blastRecipientCount !== null && blastRecipientCount > 0
        ? `Blast sent to ${blastRecipientCount} recipient(s)` +
          (liveNotificationJob.recipientCount > 0
            ? `; ${liveNotificationJob.recipientCount} queued for retry`
            : '')
        : 'Blast complete'
      : liveNotificationJob.recipientCount > 0
        ? `Queued retry for ${liveNotificationJob.recipientCount} undelivered recipient(s)`
        : 'No undelivered recipients remain for this source';

    return c.json({
      success: true,
      data: {
        ...liveNotificationJob,
        blastRecipientCount: blastRecipientCount ?? undefined,
        mode: blastAll ? ('blast_all' as const) : ('resume_undelivered' as const),
      },
      message,
    });
  }),
);

notificationsRoutes.get(
  '/notification-jobs/:jobId',
  requireAdmin,
  asyncHandler(async (c) => {
    const jobId = c.req.param('jobId')!;
    const job = await getArticleNotificationJob(jobId);

    if (!job) {
      return c.json({ success: false, error: 'Notification job not found' }, 404);
    }

    return c.json({ success: true, data: job });
  }),
);

notificationsRoutes.get(
  '/notification-campaigns/:campaignId',
  requireAdmin,
  asyncHandler(async (c) => {
    const campaignId = c.req.param('campaignId')!;
    const campaign = await getArticleNotificationCampaign(campaignId);

    if (!campaign) {
      return c.json({ success: false, error: 'Notification campaign not found' }, 404);
    }

    return c.json({ success: true, data: campaign });
  }),
);

notificationsRoutes.post(
  '/notification-jobs/process',
  requireAdmin,
  asyncHandler(async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const jobId =
      typeof body.jobId === 'string' && body.jobId.trim() ? body.jobId.trim() : undefined;
    const maxJobs = typeof body.maxJobs === 'number' ? body.maxJobs : undefined;
    const maxBatchesPerJob =
      typeof body.maxBatchesPerJob === 'number' ? body.maxBatchesPerJob : undefined;

    const result = await processArticleNotificationJobs({
      jobId,
      maxJobs,
      maxBatchesPerJob,
      mode: 'manual',
    });
    return c.json({ success: true, data: result });
  }),
);

notificationsRoutes.get(
  '/notification-jobs/processor-status',
  requireAdmin,
  asyncHandler(async (c) => {
    const state = await getArticleNotificationProcessorState();
    return c.json({ success: true, data: state });
  }),
);

notificationsRoutes.post('/cron/process-notification-jobs', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const sharedCronToken = c.req.header(PUBLICATIONS_CRON_SHARED_HEADER) || '';
    if (!(await isAuthorizedPublicationsCronRequest(token, sharedCronToken))) {
      return c.json({ error: 'Unauthorized - cron auth required' }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const maxJobs = typeof body.maxJobs === 'number' ? body.maxJobs : undefined;
    const maxBatchesPerJob =
      typeof body.maxBatchesPerJob === 'number' ? body.maxBatchesPerJob : undefined;
    const result = await processArticleNotificationJobs({
      maxJobs,
      maxBatchesPerJob,
      mode: 'cron',
    });

    log.info('CRON: Processed article notification jobs', {
      processedJobs: result.processedJobs,
      advancedJobs: result.advancedJobs,
      completedJobs: result.completedJobs,
    });

    return c.json({
      success: true,
      data: result,
      message: `Processed ${result.advancedJobs} article notification job batch(es)`,
    });
  } catch (error) {
    log.error('CRON: Error processing article notification jobs', error);
    return c.json({ success: false, error: 'Failed to process article notification jobs' }, 500);
  }
});

export default notificationsRoutes;
