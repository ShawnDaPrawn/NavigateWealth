/**
 * Publications Notification Service
 *
 * On publish we send to the full audience immediately (batched), then enqueue
 * only undelivered recipients into the existing retry job processor so cron /
 * manual runs can finish delivery without leaving a stuck "publish" queue.
 *
 * Reshare delivery remains an explicit direct-send workflow because it is a
 * manually targeted admin action.
 *
 * @module publications/notification-service
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  isArticleEmailDeliveryTerminalStatus,
  listUndeliveredArticleEmailTrackingRecords,
  type ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';
import {
  ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX,
  ARTICLE_NOTIFICATION_JOB_PREFIX,
  acquireArticleNotificationJobLease,
  buildArticleNotificationProcessorState,
  campaignFromJobSnapshot,
  createAndDeliverTrackingRecord,
  DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB,
  DEFAULT_AUTOMATED_MAX_JOBS,
  DEFAULT_MANUAL_MAX_BATCHES_PER_JOB,
  DEFAULT_MANUAL_MAX_JOBS,
  DELIVERY_BATCH_SIZE,
  deliverTrackedNotificationRecord,
  finalizeArticleNotificationJob,
  getActiveArticleNotificationJob,
  getArticleNotificationCampaignRecord,
  getArticleNotificationJobRecord,
  getArticleNotificationProcessorStateRecord,
  hydrateArticleNotificationJob,
  isSenderConfigurationFailure,
  listReadyJobTrackingRecords,
  normalizeSendError,
  nowIso,
  persistArticleNotificationCampaign,
  persistArticleNotificationJob,
  persistArticleNotificationProcessorState,
  preparePublishJobTrackingBatch,
  PUBLISH_TRACKING_CAMPAIGN_ID,
  queueArticleNotificationJob,
  releaseArticleNotificationJobLease,
  removeActiveJobPointer,
  resolvePublishedArticleForDelivery,
  resumeArticleNotificationJob,
  syncArticleNotificationCampaignFromJob,
  syncPublishNotificationCampaignFromTrackingState,
} from './publications-notification-helpers.ts';
import { collectArticleNotificationRecipients } from './publications-notification-recipients.ts';

export type {
  ArticleNotificationCampaign,
  ArticleNotificationCampaignStatus,
  ArticleNotificationJob,
  ArticleNotificationJobItem,
  ArticleNotificationJobKind,
  ArticleNotificationJobPhase,
  ArticleNotificationJobSnapshot,
  ArticleNotificationProcessorResult,
  ArticleNotificationProcessorState,
  ArticleNotificationProcessorStuckJob,
  ArticleNotificationRecipient,
  ArticleNotificationRunResult,
  PublishedArticle,
} from './publications-notification-types.ts';

export type {
  ArticleEmailTrackingRecord,
  ArticleEmailTrackingSource,
} from './publications-email-engagement-service.ts';

import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  ArticleNotificationJobSnapshot,
  ArticleNotificationProcessorOptions,
  ArticleNotificationProcessorResult,
  ArticleNotificationProcessorState,
  ArticleNotificationRunResult,
  PublishedArticle,
} from './publications-notification-types.ts';

const log = createModuleLogger('article-notifications');

/**
 * Completes any in-flight publish/retry jobs for an article so a new blast or
 * retry queue can be created without colliding with active job pointers.
 */
export async function finalizeActiveArticleNotificationJobsForPublish(
  articleId: string,
): Promise<void> {
  for (const kind of ['publish', 'retry_undelivered'] as const) {
    const job = await getActiveArticleNotificationJob(articleId, 'publish', kind);
    if (!job) continue;
    if (job.status === 'completed' || job.status === 'completed_with_failures') {
      await removeActiveJobPointer(job);
      continue;
    }
    await finalizeArticleNotificationJob(job);
  }
}

export async function runArticleNotificationDelivery(
  article: PublishedArticle,
  options?: {
    dryRun?: boolean;
    recipientEmails?: string[];
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationRunResult> {
  const dryRun = options?.dryRun ?? false;
  const source = options?.source ?? 'publish';

  if (!dryRun && source === 'publish') {
    await resolvePublishedArticleForDelivery(article);
  }

  const recipients = await collectArticleNotificationRecipients(options?.recipientEmails);

  if (recipients.length === 0) {
    return {
      dryRun,
      recipientCount: 0,
      sent: 0,
      failed: 0,
      recipients: [],
      errors: [],
    };
  }

  if (dryRun) {
    return {
      dryRun: true,
      recipientCount: recipients.length,
      sent: 0,
      failed: 0,
      recipients,
      errors: [],
    };
  }

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let start = 0; start < recipients.length; start += DELIVERY_BATCH_SIZE) {
    const batch = recipients.slice(start, start + DELIVERY_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((recipient) =>
        createAndDeliverTrackingRecord(article, recipient, options?.source ?? 'publish').then(
          () => ({ email: recipient.email }),
        ),
      ),
    );

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const recipient = batch[index];
      if (result.status === 'fulfilled') {
        sent++;
        continue;
      }

      failed++;
      const msg = normalizeSendError(result.reason);
      errors.push(`${recipient.email}: ${msg}`);
      log.error(`Failed to send article notification to ${recipient.email}: ${msg}`);
    }

    log.info('Processed direct article notification batch', {
      articleId: article.id,
      processed: Math.min(start + batch.length, recipients.length),
      total: recipients.length,
      sent,
      failed,
    });
  }

  return {
    dryRun: false,
    recipientCount: recipients.length,
    sent,
    failed,
    recipients,
    errors,
  };
}

export async function sendArticlePublishedNotifications(
  article: PublishedArticle,
): Promise<ArticleNotificationJobSnapshot> {
  log.info('Queueing article publish notifications', {
    articleId: article.id,
    title: article.title,
  });
  const recipients = await collectArticleNotificationRecipients();
  return queueArticleNotificationJob(article, recipients, {
    kind: 'publish',
    source: 'publish',
  });
}

/**
 * Send publish notifications to all subscribers immediately, then queue only
 * undelivered addresses for the existing retry processor (cron / manual).
 */
export async function sendArticlePublishedNotificationsBlastThenRetryQueue(
  article: PublishedArticle,
): Promise<{
  blast: ArticleNotificationRunResult;
  retryJob: ArticleNotificationJobSnapshot | null;
  publishCampaign: ArticleNotificationCampaign | null;
}> {
  const blast = await runArticleNotificationDelivery(article, { source: 'publish' });

  let retryJob: ArticleNotificationJobSnapshot | null = null;
  let publishCampaign: ArticleNotificationCampaign | null;

  try {
    const blastFullyDelivered =
      blast.recipientCount > 0 && blast.failed === 0 && blast.sent === blast.recipientCount;

    if (blast.recipientCount > 0 && !blastFullyDelivered) {
      const undelivered = await listUndeliveredArticleEmailTrackingRecords(article.id, 'publish');
      if (undelivered.length > 0) {
        try {
          retryJob = await retryUndeliveredArticleNotifications(article, { source: 'publish' });
        } catch (error) {
          log.error('Failed to queue undelivered publish recipients after blast', {
            articleId: article.id,
            error: normalizeSendError(error),
          });
        }
      }
    }

    publishCampaign = await syncPublishNotificationCampaignFromTrackingState(article, {
      retryJobId: retryJob?.id ?? null,
      blast,
    });
  } catch (postBlastError) {
    const lastError = normalizeSendError(postBlastError);
    log.error('Post-blast publish notification sync failed', {
      articleId: article.id,
      blastSent: blast.sent,
      blastFailed: blast.failed,
      error: lastError,
    });
    publishCampaign = await createArticleNotificationQueueFailedCampaign(article, {
      source: 'publish',
      lastError,
      blast,
    });
  }

  return { blast, retryJob, publishCampaign };
}

export async function retryUndeliveredArticleNotifications(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationJobSnapshot> {
  const source = options?.source ?? 'publish';
  const undeliveredRecords = await listUndeliveredArticleEmailTrackingRecords(article.id, source);

  log.info('Queueing article notification retry job', {
    articleId: article.id,
    source,
    recipientCount: undeliveredRecords.length,
  });

  return queueArticleNotificationJob(article, undeliveredRecords, {
    kind: 'retry_undelivered',
    source,
  });
}

export async function resumeArticleNotificationDelivery(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
  },
): Promise<ArticleNotificationJobSnapshot> {
  const source = options?.source ?? 'publish';

  const activeRetryJob = await getActiveArticleNotificationJob(
    article.id,
    source,
    'retry_undelivered',
  );
  if (activeRetryJob) {
    log.info('Resuming active article notification retry job', {
      articleId: article.id,
      jobId: activeRetryJob.id,
      source,
    });
    return resumeArticleNotificationJob(activeRetryJob);
  }

  const activePublishJob = await getActiveArticleNotificationJob(article.id, source, 'publish');
  if (activePublishJob) {
    log.info('Resuming active article notification publish job', {
      articleId: article.id,
      jobId: activePublishJob.id,
      source,
    });
    return resumeArticleNotificationJob(activePublishJob);
  }

  return retryUndeliveredArticleNotifications(article, { source });
}

export async function getArticleNotificationCampaign(
  campaignId: string,
): Promise<ArticleNotificationCampaign | null> {
  const campaign = await getArticleNotificationCampaignRecord(campaignId);
  if (!campaign) return null;
  if (!campaign.jobId) return campaign;

  const job = await getArticleNotificationJobRecord(campaign.jobId);
  if (!job) return campaign;

  const snapshot = await hydrateArticleNotificationJob(job);
  const liveCampaign = campaignFromJobSnapshot(snapshot);
  await persistArticleNotificationCampaign(liveCampaign);
  return liveCampaign;
}

export async function listArticleNotificationCampaigns(options?: {
  articleId?: string;
  source?: ArticleEmailTrackingSource;
}): Promise<ArticleNotificationCampaign[]> {
  const campaigns = (await kv.getByPrefix(
    ARTICLE_NOTIFICATION_CAMPAIGN_PREFIX,
  )) as ArticleNotificationCampaign[];

  return campaigns
    .filter((campaign) => {
      if (options?.articleId && campaign.articleId !== options.articleId) return false;
      if (options?.source && campaign.source !== options.source) return false;
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );
}

export async function getLatestArticleNotificationCampaign(
  articleId: string,
  source: ArticleEmailTrackingSource = 'publish',
): Promise<ArticleNotificationCampaign | null> {
  const campaigns = await listArticleNotificationCampaigns({ articleId, source });
  if (campaigns.length === 0) return null;

  const trackingCampaignId = PUBLISH_TRACKING_CAMPAIGN_ID(articleId);
  const preferred =
    campaigns.find((campaign) => campaign.id === trackingCampaignId && campaign.sentCount > 0) ??
    campaigns.find(
      (campaign) =>
        campaign.status !== 'queue_failed' ||
        campaign.sentCount > 0 ||
        campaign.intendedRecipientCount > 0,
    ) ??
    campaigns[0];

  return getArticleNotificationCampaign(preferred.id);
}

export async function getArticleNotificationProcessorState(): Promise<ArticleNotificationProcessorState | null> {
  return getArticleNotificationProcessorStateRecord();
}

export async function createArticleNotificationQueueFailedCampaign(
  article: PublishedArticle,
  options?: {
    source?: ArticleEmailTrackingSource;
    lastError?: string | null;
    blast?: Pick<ArticleNotificationRunResult, 'recipientCount' | 'sent' | 'failed'>;
  },
): Promise<ArticleNotificationCampaign> {
  const source = options?.source ?? 'publish';
  const lastError = options?.lastError ?? 'Notification campaign could not be queued';

  if (source === 'publish') {
    try {
      const repaired = await repairPublishNotificationCampaignFromTracking(article, {
        lastError,
      });
      if (repaired) {
        return repaired;
      }
    } catch (error) {
      log.warn('Could not repair publish campaign from tracking after queue failure', {
        articleId: article.id,
        error: normalizeSendError(error),
      });
    }
  }

  const blast = options?.blast;
  const now = nowIso();
  const intended = blast?.recipientCount ?? 0;
  const sent = blast?.sent ?? 0;
  const failedTerminal = blast?.failed ?? 0;
  const processedCount = sent + failedTerminal;
  const progressPercent = intended > 0 ? Math.round((processedCount / intended) * 1000) / 10 : 0;
  const existing =
    blast && source === 'publish'
      ? await getArticleNotificationCampaignRecord(PUBLISH_TRACKING_CAMPAIGN_ID(article.id))
      : null;

  let status: ArticleNotificationCampaign['status'];
  if (sent <= 0) {
    status = 'queue_failed';
  } else if (failedTerminal > 0 || (intended > 0 && processedCount < intended)) {
    status = 'completed_with_failures';
  } else {
    status = 'completed';
  }

  const campaign: ArticleNotificationCampaign = {
    id:
      blast && source === 'publish'
        ? PUBLISH_TRACKING_CAMPAIGN_ID(article.id)
        : crypto.randomUUID(),
    articleId: article.id,
    articleTitle: article.title,
    articleSlug: article.slug,
    articleExcerpt: article.excerpt,
    source,
    status,
    phase: 'completed',
    intendedRecipientCount: intended,
    preparedCount: intended,
    unpreparedCount: 0,
    pendingCount: Math.max(0, intended - processedCount),
    sendingCount: 0,
    sentCount: sent,
    failedRetryableCount: 0,
    failedTerminalCount: failedTerminal,
    processedCount,
    progressPercent,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    startedAt: existing?.startedAt ?? (sent > 0 ? now : null),
    completedAt: now,
    lastActivityAt: now,
    lastError,
    jobId: null,
    stuck: false,
  };

  await persistArticleNotificationCampaign(campaign);
  return campaign;
}

export async function repairPublishNotificationCampaignFromTracking(
  article: PublishedArticle,
  options?: {
    lastError?: string | null;
    retryJobId?: string | null;
  },
): Promise<ArticleNotificationCampaign | null> {
  const repaired = await syncPublishNotificationCampaignFromTrackingState(article, {
    retryJobId: options?.retryJobId ?? null,
  });
  if (!repaired) {
    return null;
  }

  if (!options?.lastError) {
    return repaired;
  }

  const withError: ArticleNotificationCampaign = {
    ...repaired,
    lastError: options.lastError,
    updatedAt: nowIso(),
    lastActivityAt: nowIso(),
  };
  await persistArticleNotificationCampaign(withError);
  return withError;
}

export async function getArticleNotificationJob(
  jobId: string,
): Promise<ArticleNotificationJobSnapshot | null> {
  const job = await getArticleNotificationJobRecord(jobId);
  if (!job) return null;
  const snapshot = await hydrateArticleNotificationJob(job);
  await syncArticleNotificationCampaignFromJob(snapshot);
  return snapshot;
}

export async function processArticleNotificationJobs(
  options?: ArticleNotificationProcessorOptions,
): Promise<ArticleNotificationProcessorResult> {
  const mode = options?.mode ?? 'manual';
  const defaultMaxJobs = mode === 'manual' ? DEFAULT_MANUAL_MAX_JOBS : DEFAULT_AUTOMATED_MAX_JOBS;
  const defaultMaxBatchesPerJob =
    mode === 'manual' ? DEFAULT_MANUAL_MAX_BATCHES_PER_JOB : DEFAULT_AUTOMATED_MAX_BATCHES_PER_JOB;
  const requestedMaxJobs = Math.max(1, Math.min(options?.maxJobs ?? defaultMaxJobs, 5));
  const requestedMaxBatchesPerJob = Math.max(
    1,
    Math.min(options?.maxBatchesPerJob ?? defaultMaxBatchesPerJob, 5),
  );
  const maxJobs = mode === 'manual' ? requestedMaxJobs : Math.max(defaultMaxJobs, requestedMaxJobs);
  const maxBatchesPerJob =
    mode === 'manual'
      ? requestedMaxBatchesPerJob
      : Math.max(defaultMaxBatchesPerJob, requestedMaxBatchesPerJob);
  const previousProcessorState = await getArticleNotificationProcessorStateRecord();

  try {
    const jobsToProcess: ArticleNotificationJob[] = [];

    if (options?.jobId) {
      const job = await getArticleNotificationJobRecord(options.jobId);
      if (job && (job.status === 'queued' || job.status === 'processing')) {
        jobsToProcess.push(job);
      }
    } else {
      const allJobs = (await kv.getByPrefix(
        ARTICLE_NOTIFICATION_JOB_PREFIX,
      )) as ArticleNotificationJob[];
      const queuedJobs = allJobs
        .filter((job) => job.status === 'queued' || job.status === 'processing')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      jobsToProcess.push(...queuedJobs);
    }

    const snapshots: ArticleNotificationJobSnapshot[] = [];
    let advancedJobs = 0;
    let completedJobs = 0;
    let inspectedJobs = 0;

    for (const job of jobsToProcess) {
      if (advancedJobs >= maxJobs) break;
      inspectedJobs++;

      const leasedJob = await acquireArticleNotificationJobLease(job);
      if (!leasedJob) continue;

      let workingJob = leasedJob;
      let prepareSteps = 0;
      let deliverySteps = 0;
      let didAdvanceJob = false;

      try {
        const leasedSnapshot = await hydrateArticleNotificationJob(leasedJob);
        if (leasedSnapshot.pendingCount === 0 && leasedSnapshot.sendingCount === 0) {
          const completed = await finalizeArticleNotificationJob(leasedJob);
          snapshots.push(completed);
          completedJobs++;
          advancedJobs++;
          continue;
        }

        const article: PublishedArticle = {
          id: leasedJob.articleId,
          title: leasedJob.articleTitle,
          slug: leasedJob.articleSlug,
          excerpt: leasedJob.articleExcerpt,
        };

        if (workingJob.kind === 'publish') {
          while (prepareSteps < maxBatchesPerJob) {
            const preparationResult = await preparePublishJobTrackingBatch(workingJob, article);
            workingJob = preparationResult.job;

            if (preparationResult.preparedCount <= 0) {
              break;
            }

            prepareSteps++;
            didAdvanceJob = true;

            const preparationSnapshot = await hydrateArticleNotificationJob(workingJob);
            workingJob = {
              ...workingJob,
              currentIndex: preparationSnapshot.currentIndex,
            };
            await syncArticleNotificationCampaignFromJob(preparationSnapshot);
          }
        }

        while (deliverySteps < maxBatchesPerJob) {
          const readyRecords = await listReadyJobTrackingRecords(workingJob);
          const batch = readyRecords.slice(0, DELIVERY_BATCH_SIZE);
          if (batch.length === 0) break;

          const batchResults = await Promise.allSettled(
            batch.map(async (tracking) => {
              if (isArticleEmailDeliveryTerminalStatus(tracking.deliveryStatus)) {
                return { email: tracking.recipientEmail, skipped: true };
              }

              await deliverTrackedNotificationRecord(article, tracking);
              return { email: tracking.recipientEmail, skipped: false };
            }),
          );

          const errors = batchResults
            .map((result, index) => {
              if (result.status === 'fulfilled') return null;
              return `${batch[index]?.recipientEmail || 'unknown'}: ${normalizeSendError(result.reason)}`;
            })
            .filter((value): value is string => Boolean(value));

          const deliveryTimestamp = nowIso();
          workingJob = {
            ...workingJob,
            currentIndex: workingJob.currentIndex,
            updatedAt: deliveryTimestamp,
            lastProgressAt: deliveryTimestamp,
            lastDeliveredAt: deliveryTimestamp,
            lastError: errors[0] ?? workingJob.lastError,
            status: 'processing',
          };

          await persistArticleNotificationJob(workingJob);
          deliverySteps++;
          didAdvanceJob = true;

          // Sender-side fault: our identity, credentials, account standing or
          // quota. Every remaining recipient would fail the same way, so stop
          // the job rather than walk the rest of the audience into it. Records
          // stay retryable, so the job resumes intact once the cause is fixed.
          const senderFault = batchResults.find(
            (entry) => entry.status === 'rejected' && isSenderConfigurationFailure(entry.reason),
          );
          if (senderFault && senderFault.status === 'rejected') {
            const message = `Paused — the email provider rejected the sender, not the recipients: ${normalizeSendError(senderFault.reason)}`;
            log.error('Article notification job halted — provider rejected the sender', {
              articleId: article.id,
              error: message,
            });
            workingJob = { ...workingJob, lastError: message, updatedAt: nowIso() };
            await persistArticleNotificationJob(workingJob);
            break;
          }

          const intermediateSnapshot = await hydrateArticleNotificationJob(workingJob);
          workingJob = {
            ...workingJob,
            currentIndex: intermediateSnapshot.currentIndex,
          };
          await syncArticleNotificationCampaignFromJob(intermediateSnapshot);

          if (intermediateSnapshot.pendingCount === 0 && intermediateSnapshot.sendingCount === 0) {
            break;
          }
        }

        const refreshedSnapshot = await hydrateArticleNotificationJob(workingJob);
        const snapshot =
          refreshedSnapshot.pendingCount === 0 && refreshedSnapshot.sendingCount === 0
            ? await finalizeArticleNotificationJob(workingJob)
            : await (async () => {
                const releasableJob = await releaseArticleNotificationJobLease(workingJob, {
                  currentIndex: refreshedSnapshot.currentIndex,
                });
                return hydrateArticleNotificationJob(releasableJob);
              })();

        snapshots.push(snapshot);
        if (
          didAdvanceJob ||
          snapshot.status === 'completed' ||
          snapshot.status === 'completed_with_failures'
        ) {
          advancedJobs++;
        }

        await syncArticleNotificationCampaignFromJob(snapshot);

        if (snapshot.status === 'completed' || snapshot.status === 'completed_with_failures') {
          completedJobs++;
        }

        log.info('Processed article notification job batch', {
          jobId: snapshot.id,
          articleId: snapshot.articleId,
          source: snapshot.source,
          kind: snapshot.kind,
          status: snapshot.status,
          prepareSteps,
          deliverySteps,
          processedCount: snapshot.processedCount,
          pendingCount: snapshot.pendingCount,
          sentCount: snapshot.sentCount,
          failedCount: snapshot.failedCount,
        });
      } catch (error) {
        const errorMessage = normalizeSendError(error);
        log.error('Article notification job processing failed', {
          jobId: workingJob.id,
          articleId: workingJob.articleId,
          source: workingJob.source,
          kind: workingJob.kind,
          prepareSteps,
          deliverySteps,
          error: errorMessage,
        });

        try {
          const releasedJob = await releaseArticleNotificationJobLease(workingJob, {
            status: 'queued',
            lastError: errorMessage,
          });
          const snapshot = await hydrateArticleNotificationJob(releasedJob);
          snapshots.push(snapshot);
          await syncArticleNotificationCampaignFromJob(snapshot);
        } catch (releaseError) {
          log.error('Failed to release article notification job after processing error', {
            jobId: workingJob.id,
            articleId: workingJob.articleId,
            error: normalizeSendError(releaseError),
          });
        }
      }
    }

    const result = {
      processedJobs: inspectedJobs,
      advancedJobs,
      completedJobs,
      jobs: snapshots,
    };

    await persistArticleNotificationProcessorState(
      await buildArticleNotificationProcessorState({
        mode,
        lastHeartbeatAt: nowIso(),
        lastRunAt: nowIso(),
        lastSuccessAt: nowIso(),
        lastError: null,
        maxJobs,
        maxBatchesPerJob,
        processedJobs: result.processedJobs,
        advancedJobs: result.advancedJobs,
        completedJobs: result.completedJobs,
      }),
    );

    return result;
  } catch (error) {
    const errorMessage = normalizeSendError(error);
    await persistArticleNotificationProcessorState(
      await buildArticleNotificationProcessorState({
        mode,
        lastHeartbeatAt: nowIso(),
        lastRunAt: nowIso(),
        lastSuccessAt: previousProcessorState?.lastSuccessAt ?? null,
        lastError: errorMessage,
        maxJobs,
        maxBatchesPerJob,
        processedJobs: 0,
        advancedJobs: 0,
        completedJobs: 0,
      }),
    );
    throw error;
  }
}
