/**
 * publications-tags-scheduling-routes.ts — article tags + scheduled-publish cron
 * (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', tagsSchedulingRoutes)`. Owns tag CRUD/links and the
 * scheduled-publishing cron (which publishes due articles and kicks their
 * notification blast). Behaviour-preserving; the publications route contract
 * suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  createArticleNotificationQueueFailedCampaign,
  getArticleNotificationCampaign,
  processArticleNotificationJobs,
  sendArticlePublishedNotificationsBlastThenRetryQueue,
} from './publications-notification-service.ts';
import {
  generateId,
  generateSlug,
  kickArticleNotificationJob,
  isAuthorizedPublicationsCronRequest,
  PUBLICATIONS_CRON_SHARED_HEADER,
  type ArticleTag,
  type ArticleTagLink,
} from './publications-route-helpers.ts';

const log = createModuleLogger('publications-tags-scheduling-routes');

const tagsSchedulingRoutes = new Hono();

// ============================================================================
// TAGS ROUTES
// ============================================================================

tagsSchedulingRoutes.get('/tags', async (c) => {
  try {
    const tags = await kv.getByPrefix('article_tag:');
    return c.json({ success: true, data: tags });
  } catch (error) {
    log.error('Error fetching tags', error);
    return c.json({ success: false, error: 'Failed to fetch tags' }, 500);
  }
});

tagsSchedulingRoutes.post('/tags', async (c) => {
  try {
    const body = await c.req.json();
    const { name } = body;

    if (!name) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }

    const id = generateId();
    const slug = generateSlug(name);
    const now = new Date().toISOString();

    const tag: ArticleTag = {
      id,
      name,
      slug,
      created_at: now,
      updated_at: now,
    };

    await kv.set(`article_tag:${id}`, tag);

    return c.json({ success: true, data: tag }, 201);
  } catch (error) {
    log.error('Error creating tag', error);
    return c.json({ success: false, error: 'Failed to create tag' }, 500);
  }
});

tagsSchedulingRoutes.post('/articles/:articleId/tags/:tagId', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const tagId = c.req.param('tagId')!;

    const link: ArticleTagLink = {
      article_id: articleId,
      tag_id: tagId,
    };

    await kv.set(`article_tag_link:${articleId}:${tagId}`, link);

    return c.json({ success: true, data: link }, 201);
  } catch (error) {
    log.error('Error linking tag', error);
    return c.json({ success: false, error: 'Failed to link tag' }, 500);
  }
});

tagsSchedulingRoutes.delete('/articles/:articleId/tags/:tagId', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const tagId = c.req.param('tagId')!;

    await kv.del(`article_tag_link:${articleId}:${tagId}`);

    return c.json({ success: true });
  } catch (error) {
    log.error('Error unlinking tag', error);
    return c.json({ success: false, error: 'Failed to unlink tag' }, 500);
  }
});

tagsSchedulingRoutes.get('/articles/:articleId/tags', async (c) => {
  try {
    const articleId = c.req.param('articleId')!;
    const links = await kv.getByPrefix(`article_tag_link:${articleId}:`);

    const tags = [];
    for (const link of links) {
      const tag = await kv.get(`article_tag:${link.tag_id}`);
      if (tag) {
        tags.push(tag);
      }
    }

    return c.json({ success: true, data: tags });
  } catch (error) {
    log.error('Error fetching article tags', error);
    return c.json({ success: false, error: 'Failed to fetch article tags' }, 500);
  }
});

// ============================================================================
// SCHEDULED PUBLISHING (Cron Job)
// ============================================================================

/**
 * POST /cron/process-scheduled
 * Cron-safe endpoint for scheduled article publishing.
 * Authenticated via a Supabase JWT plus the shared publications cron header,
 * or directly via SUPABASE_SERVICE_ROLE_KEY / SUPER_ADMIN_PASSWORD.
 */
tagsSchedulingRoutes.post('/cron/process-scheduled', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const sharedCronToken = c.req.header(PUBLICATIONS_CRON_SHARED_HEADER) || '';

    if (!(await isAuthorizedPublicationsCronRequest(token, sharedCronToken))) {
      return c.json({ error: 'Unauthorized - cron auth required' }, 401);
    }

    log.info('CRON: Processing scheduled articles');

    const articles = await kv.getByPrefix('article:');
    const now = new Date();
    let processedCount = 0;
    const published: string[] = [];

    for (const article of articles) {
      if (article.status === 'scheduled' && article.scheduled_for) {
        const scheduledDate = new Date(article.scheduled_for);

        if (scheduledDate <= now) {
          article.status = 'published';
          article.published_at = article.scheduled_for;
          article.scheduled_for = undefined;
          article.updated_at = now.toISOString();

          const shouldNotify = article.notify_on_publish !== false;
          delete article.notify_on_publish;

          await kv.set(`article:${article.id}`, article);
          processedCount++;
          published.push(article.title);

          if (shouldNotify) {
            try {
              const publishResult = await sendArticlePublishedNotificationsBlastThenRetryQueue({
                id: article.id,
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt,
              });
              let notificationJob = publishResult.retryJob;
              if (notificationJob && notificationJob.recipientCount > 0) {
                notificationJob =
                  (await kickArticleNotificationJob(notificationJob.id)) ?? notificationJob;
              }
              const notificationCampaign =
                publishResult.publishCampaign ??
                (notificationJob ? await getArticleNotificationCampaign(notificationJob.id) : null);
              log.info(`Scheduled article notifications complete for ${article.id}`, {
                recipientCount: publishResult.blast.recipientCount,
                notificationJobId: notificationJob?.id ?? null,
                notificationCampaignId: notificationCampaign?.id ?? null,
                notificationCampaignStatus: notificationCampaign?.status ?? null,
                status: notificationJob?.status ?? null,
              });
            } catch (notificationError) {
              log.error(
                `Failed to send notifications for scheduled article ${article.id}`,
                notificationError,
              );
              await createArticleNotificationQueueFailedCampaign(
                {
                  id: article.id,
                  title: article.title,
                  slug: article.slug,
                  excerpt: article.excerpt,
                },
                {
                  lastError:
                    notificationError instanceof Error
                      ? notificationError.message
                      : 'Notification delivery failed',
                },
              );
            }
          }
        }
      }
    }

    log.info(`CRON: Processed ${processedCount} scheduled article(s)`, { published });
    const notificationResult = await processArticleNotificationJobs({
      mode: 'cron',
    });

    return c.json({
      success: true,
      data: {
        processed: processedCount,
        published,
        notificationJobs: notificationResult,
      },
      message: `Processed ${processedCount} scheduled articles`,
    });
  } catch (error) {
    log.error('CRON: Error processing scheduled articles', error);
    return c.json({ success: false, error: 'Failed to process scheduled articles' }, 500);
  }
});

tagsSchedulingRoutes.post('/process-scheduled', async (c) => {
  try {
    const articles = await kv.getByPrefix('article:');
    const now = new Date();
    let processedCount = 0;

    for (const article of articles) {
      if (article.status === 'scheduled' && article.scheduled_for) {
        const scheduledDate = new Date(article.scheduled_for);

        if (scheduledDate <= now) {
          article.status = 'published';
          article.published_at = article.scheduled_for;
          article.scheduled_for = undefined;
          article.updated_at = now.toISOString();

          // Preserve the notify_on_publish preference, then clear it after use
          const shouldNotify = article.notify_on_publish !== false; // Default true for backward compatibility
          delete article.notify_on_publish;

          await kv.set(`article:${article.id}`, article);
          processedCount++;

          // Notify newsletter subscribers only if opted-in at scheduling time
          if (shouldNotify) {
            try {
              const publishResult = await sendArticlePublishedNotificationsBlastThenRetryQueue({
                id: article.id,
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt,
              });
              let notificationJob = publishResult.retryJob;
              if (notificationJob && notificationJob.recipientCount > 0) {
                notificationJob =
                  (await kickArticleNotificationJob(notificationJob.id)) ?? notificationJob;
              }
              const notificationCampaign =
                publishResult.publishCampaign ??
                (notificationJob ? await getArticleNotificationCampaign(notificationJob.id) : null);
              log.info(`Scheduled article notifications complete for ${article.id}`, {
                recipientCount: publishResult.blast.recipientCount,
                notificationJobId: notificationJob?.id ?? null,
                notificationCampaignId: notificationCampaign?.id ?? null,
                notificationCampaignStatus: notificationCampaign?.status ?? null,
                status: notificationJob?.status ?? null,
              });
            } catch (notificationError) {
              log.error(
                `Failed to send notifications for scheduled article ${article.id}`,
                notificationError,
              );
              await createArticleNotificationQueueFailedCampaign(
                {
                  id: article.id,
                  title: article.title,
                  slug: article.slug,
                  excerpt: article.excerpt,
                },
                {
                  lastError:
                    notificationError instanceof Error
                      ? notificationError.message
                      : 'Notification delivery failed',
                },
              );
            }
          } else {
            log.info(
              `Skipping email notifications for scheduled article ${article.id} — notify_on_publish was disabled`,
            );
          }
        }
      }
    }

    return c.json({
      success: true,
      data: { processed: processedCount },
      message: `Processed ${processedCount} scheduled articles`,
    });
  } catch (error) {
    log.error('Error processing scheduled articles', error);
    return c.json({ success: false, error: 'Failed to process scheduled articles' }, 500);
  }
});

export default tagsSchedulingRoutes;
