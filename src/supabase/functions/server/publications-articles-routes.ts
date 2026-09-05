/**
 * publications-articles-routes.ts — article CRUD + publish + reshare (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', articlesRoutes)`. Owns the article create/read/update
 * surface plus publish (which kicks off the notification blast) and the
 * admin-only reshare. Behaviour-preserving; the publications route contract
 * suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { ArticleReshareSchema } from './publications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { VersionService } from './publications-phase4-service.ts';
import {
  createArticleNotificationQueueFailedCampaign,
  getArticleNotificationCampaign,
  runArticleNotificationDelivery,
  sendArticlePublishedNotificationsBlastThenRetryQueue,
} from './publications-notification-service.ts';
import {
  generateId,
  generateSlug,
  calculateReadingTime,
  kickArticleNotificationJob,
  type Article,
} from './publications-route-helpers.ts';
import articlesReadRoutes from './publications-articles-read-routes.ts';
import { triggerSiteRebuild } from './site-rebuild-trigger.ts';
import { syncArticleIndexInBackground } from './vasco-index-sync.ts';

const log = createModuleLogger('publications-articles-routes');

const articlesRoutes = new Hono();

articlesRoutes.route('/', articlesReadRoutes);

// ============================================================================
// ARTICLES ROUTES
// ============================================================================

articlesRoutes.post('/articles', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const {
      title,
      subtitle,
      slug: customSlug,
      excerpt,
      body: articleBody,
      category_id,
      type_id,
      author_id,
      author_name,
      hero_image_url,
      thumbnail_image_url,
      status = 'draft',
      is_featured = false,
      scheduled_for,
      seo_title,
      seo_description,
      seo_canonical_url,
      last_edited_by,
    } = body;

    if (!title || !excerpt || !articleBody || !category_id || !type_id) {
      return c.json(
        {
          success: false,
          error: 'Title, excerpt, body, category_id, and type_id are required',
        },
        400,
      );
    }

    const id = generateId();
    const slug = customSlug || generateSlug(title);
    const now = new Date().toISOString();
    const reading_time_minutes = calculateReadingTime(articleBody);

    // Check if slug already exists
    const existingArticles = await kv.getByPrefix('article:');
    const slugExists = existingArticles.some((a: Article) => a.slug === slug);

    if (slugExists) {
      return c.json(
        {
          success: false,
          error: 'An article with this slug already exists',
        },
        400,
      );
    }

    const article: Article = {
      id,
      title,
      subtitle,
      slug,
      excerpt,
      body: articleBody,
      category_id,
      type_id,
      author_id,
      author_name: author_name || 'Navigate Wealth Editorial Team',
      hero_image_url,
      thumbnail_image_url,
      reading_time_minutes,
      status,
      is_featured,
      scheduled_for,
      seo_title: seo_title || title,
      seo_description: seo_description || excerpt,
      seo_canonical_url,
      created_at: now,
      updated_at: now,
      last_edited_by: last_edited_by || 'system',
      view_count: 0,
      press_category: body.press_category || null,
    };

    // If publishing now, set published_at
    if (status === 'published') {
      article.published_at = now;
    }

    await kv.set(`article:${id}`, article);

    if (status === 'published') {
      triggerSiteRebuild(`article_created_published:${id}`);
      // Vasco's knowledge index follows publication state — no manual re-index needed.
      await syncArticleIndexInBackground(article, 'article_created_published');
    }

    // Create initial version snapshot (Phase 4)
    try {
      await VersionService.createVersion(
        id,
        article as unknown as Record<string, unknown>,
        last_edited_by || 'system',
      );
    } catch (vErr) {
      log.error('Failed to create initial version snapshot', vErr);
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: last_edited_by || 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_created',
      summary: `Article created: ${title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
    }).catch(() => {});

    return c.json({ success: true, data: article }, 201);
  } catch (error) {
    log.error('Error creating article', error);
    return c.json({ success: false, error: 'Failed to create article' }, 500);
  }
});

articlesRoutes.put('/articles/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const existing = await kv.get(`article:${id}`);

    if (!existing) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    // Determine reading_time_minutes:
    // 1. If the client explicitly sent a value, honour it (manual override)
    // 2. Otherwise, recalculate if the body content changed
    // 3. Otherwise, keep the existing value
    let reading_time_minutes = existing.reading_time_minutes;
    if (body.reading_time_minutes != null) {
      // Client explicitly set reading time — use their value
      reading_time_minutes = body.reading_time_minutes;
    } else if (body.body && body.body !== existing.body) {
      // Body changed but no explicit reading time — auto-calculate
      reading_time_minutes = calculateReadingTime(body.body);
    }

    const updated: Article = {
      ...existing,
      ...body,
      id,
      reading_time_minutes,
      updated_at: now,
    };

    // If title changed and no custom slug provided, regenerate slug
    if (body.title && body.title !== existing.title && !body.slug) {
      const newSlug = generateSlug(body.title);

      // Check if new slug already exists
      const existingArticles = await kv.getByPrefix('article:');
      const slugExists = existingArticles.some((a: Article) => a.slug === newSlug && a.id !== id);

      if (!slugExists) {
        updated.slug = newSlug;
      }
    }

    // Handle status changes
    if (body.status === 'published' && existing.status !== 'published') {
      updated.published_at = now;
      updated.scheduled_for = undefined;
    }

    if (body.status === 'scheduled' && !body.scheduled_for) {
      return c.json(
        {
          success: false,
          error: 'scheduled_for is required when status is scheduled',
        },
        400,
      );
    }

    await kv.set(`article:${id}`, updated);

    // Rebuild the public site when the update affects what is publicly
    // visible: publishing, unpublishing via status change, or editing a
    // live article (title/slug/body feed the prerendered pages + sitemap).
    if (existing.status === 'published' || updated.status === 'published') {
      triggerSiteRebuild(`article_updated:${id}`);
      // Re-embed a live article (or drop one that just left publication).
      await syncArticleIndexInBackground(updated, 'article_updated');
    }

    // Auto-create version snapshot on article update (Phase 4)
    try {
      const editedBy = body.last_edited_by || 'system';
      await VersionService.createVersion(
        id,
        updated as unknown as Record<string, unknown>,
        editedBy,
      );
    } catch (vErr) {
      // Version creation failure is non-critical — log but don't fail the update
      log.error('Failed to create version snapshot on article update', vErr);
    }

    let publishNotificationJob:
      | Awaited<ReturnType<typeof sendArticlePublishedNotificationsBlastThenRetryQueue>>['retryJob']
      | null = null;
    let publishNotificationCampaign: Awaited<
      ReturnType<typeof getArticleNotificationCampaign>
    > | null = null;
    let publishNotificationError: string | null = null;
    let publishNotificationRecipientCount = 0;

    // If status just changed to published, notify newsletter subscribers
    if (body.status === 'published' && existing.status !== 'published') {
      try {
        const publishResult = await sendArticlePublishedNotificationsBlastThenRetryQueue({
          id: updated.id,
          title: updated.title,
          slug: updated.slug,
          excerpt: updated.excerpt,
        });
        publishNotificationRecipientCount = publishResult.blast.recipientCount;
        publishNotificationJob = publishResult.retryJob;
        if (publishNotificationJob && publishNotificationJob.recipientCount > 0) {
          publishNotificationJob =
            (await kickArticleNotificationJob(publishNotificationJob.id)) ?? publishNotificationJob;
        }
        publishNotificationCampaign =
          publishResult.publishCampaign ??
          (publishNotificationJob
            ? await getArticleNotificationCampaign(publishNotificationJob.id)
            : null);
      } catch (notificationError) {
        publishNotificationError =
          notificationError instanceof Error
            ? notificationError.message
            : 'Notification delivery failed';
        log.error('Article publish notifications via update failed', notificationError);
        publishNotificationCampaign = await createArticleNotificationQueueFailedCampaign(
          {
            id: updated.id,
            title: updated.title,
            slug: updated.slug,
            excerpt: updated.excerpt,
          },
          {
            lastError: publishNotificationError,
          },
        );
      }
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: body.last_edited_by || 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_updated',
      summary: `Article updated: ${updated.title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: updated.status,
        titleChanged: body.title !== undefined && body.title !== existing.title,
        notificationRecipientCount:
          publishNotificationRecipientCount || publishNotificationJob?.recipientCount || 0,
        notificationJobId: publishNotificationJob?.id ?? null,
        notificationCampaignId: publishNotificationCampaign?.id ?? null,
        notificationCampaignStatus: publishNotificationCampaign?.status ?? null,
        notificationStatus: publishNotificationJob?.status ?? null,
        notificationError: publishNotificationError,
      },
    }).catch(() => {});

    return c.json({
      success: true,
      data: updated,
      notificationJob: publishNotificationJob,
      notificationCampaign: publishNotificationCampaign,
      notification: publishNotificationJob
        ? {
            jobId: publishNotificationJob.id,
            campaignId: publishNotificationCampaign?.id ?? null,
            recipientCount:
              publishNotificationRecipientCount ||
              publishNotificationCampaign?.intendedRecipientCount ||
              publishNotificationJob.recipientCount,
            status: publishNotificationJob.status,
          }
        : publishNotificationCampaign
          ? {
              campaignId: publishNotificationCampaign.id,
              status: publishNotificationCampaign.status,
              recipientCount:
                publishNotificationRecipientCount ||
                publishNotificationCampaign.intendedRecipientCount,
              error: publishNotificationError,
            }
          : publishNotificationError
            ? { error: publishNotificationError }
            : null,
    });
  } catch (error) {
    log.error('Error updating article', error);
    return c.json({ success: false, error: 'Failed to update article' }, 500);
  }
});

articlesRoutes.post('/articles/:id/publish', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id')!;
    const body = await c.req.json().catch(() => ({}));
    const notifySubscribers = body.notify_subscribers !== false; // default true

    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    const updated: Article = {
      ...article,
      status: 'published',
      published_at: now,
      scheduled_for: undefined,
      updated_at: now,
    };

    await kv.set(`article:${id}`, updated);

    triggerSiteRebuild(`article_published:${id}`);
    await syncArticleIndexInBackground(updated, 'article_published');

    let notificationJob:
      | Awaited<ReturnType<typeof sendArticlePublishedNotificationsBlastThenRetryQueue>>['retryJob']
      | null = null;
    let notificationCampaign: Awaited<ReturnType<typeof getArticleNotificationCampaign>> | null =
      null;
    let notificationError: string | null = null;
    let notificationRecipientCount = 0;

    // Blast full list on publish; only failures stay on the retry queue for cron.
    if (notifySubscribers) {
      try {
        const publishResult = await sendArticlePublishedNotificationsBlastThenRetryQueue({
          id: updated.id,
          title: updated.title,
          slug: updated.slug,
          excerpt: updated.excerpt,
        });
        notificationRecipientCount = publishResult.blast.recipientCount;
        notificationJob = publishResult.retryJob;
        if (notificationJob && notificationJob.recipientCount > 0) {
          notificationJob =
            (await kickArticleNotificationJob(notificationJob.id)) ?? notificationJob;
        }
        notificationCampaign =
          publishResult.publishCampaign ??
          (notificationJob ? await getArticleNotificationCampaign(notificationJob.id) : null);
      } catch (deliveryError) {
        notificationError =
          deliveryError instanceof Error ? deliveryError.message : 'Notification delivery failed';
        log.error('Failed to deliver article published notifications', deliveryError);
        notificationCampaign = await createArticleNotificationQueueFailedCampaign(
          {
            id: updated.id,
            title: updated.title,
            slug: updated.slug,
            excerpt: updated.excerpt,
          },
          {
            lastError: notificationError,
          },
        );
      }
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_published',
      summary: `Article published: ${updated.title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
      metadata: {
        notifySubscribers,
        notificationRecipientCount:
          notificationRecipientCount || notificationJob?.recipientCount || 0,
        notificationJobId: notificationJob?.id ?? null,
        notificationCampaignId: notificationCampaign?.id ?? null,
        notificationCampaignStatus: notificationCampaign?.status ?? null,
        notificationStatus: notificationJob?.status ?? null,
        notificationError,
      },
    }).catch(() => {});

    return c.json({
      success: true,
      data: {
        article: updated,
        notificationJob,
        notificationCampaign,
        notificationError,
      },
      notification: notificationJob
        ? {
            jobId: notificationJob.id,
            campaignId: notificationCampaign?.id ?? null,
            recipientCount:
              notificationRecipientCount ||
              notificationCampaign?.intendedRecipientCount ||
              notificationJob.recipientCount,
            status: notificationJob.status,
          }
        : notificationCampaign
          ? {
              campaignId: notificationCampaign.id,
              status: notificationCampaign.status,
              recipientCount:
                notificationRecipientCount || notificationCampaign.intendedRecipientCount,
              error: notificationError,
            }
          : notificationError
            ? { error: notificationError }
            : null,
    });
  } catch (error) {
    log.error('Error publishing article', error);
    return c.json({ success: false, error: 'Failed to publish article' }, 500);
  }
});

articlesRoutes.post(
  '/articles/:id/reshare',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    const parsed = ArticleReshareSchema.safeParse(await c.req.json().catch(() => ({})));
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
      return c.json({ success: false, error: 'Only published articles can be reshared' }, 400);
    }

    const recipientEmails =
      parsed.data.targetMode === 'selected'
        ? parsed.data.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)
        : undefined;

    if (
      parsed.data.targetMode === 'selected' &&
      (!recipientEmails || recipientEmails.length === 0)
    ) {
      return c.json({ success: false, error: 'Select at least one newsletter subscriber' }, 400);
    }

    const result = await runArticleNotificationDelivery(
      {
        id: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt,
      },
      {
        dryRun: parsed.data.dryRun,
        recipientEmails,
        source: 'reshare',
      },
    );

    const action = parsed.data.dryRun ? 'article_reshare_preview' : 'article_reshared';
    const adminUserId = (c.get('userId') as string) || 'system';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: (c.get('userRole') as string | undefined) || 'admin',
      category: 'communication',
      action,
      summary: `${parsed.data.dryRun ? 'Previewed' : 'Reshared'} article notifications: ${article.title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
      metadata: {
        targetMode: parsed.data.targetMode,
        dryRun: parsed.data.dryRun,
        recipientCount: result.recipientCount,
        sent: result.sent,
        failed: result.failed,
      },
    }).catch(() => {});

    return c.json({
      success: true,
      dryRun: result.dryRun,
      message: parsed.data.dryRun
        ? `Preview ready - ${result.recipientCount} recipient(s)`
        : `Article reshared to ${result.sent} recipient(s)`,
      recipientCount: result.recipientCount,
      sent: result.sent,
      failed: result.failed,
      recipients: result.recipients,
      errors: result.errors,
    });
  }),
);

export default articlesRoutes;
