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
import { requireAuth, requireAdmin } from './auth-mw.ts';
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
  type ArticleCategory,
  type ArticleType,
} from './publications-route-helpers.ts';

const log = createModuleLogger('publications-articles-routes');

const articlesRoutes = new Hono();

// ============================================================================
// ARTICLES ROUTES
// ============================================================================

articlesRoutes.get('/articles', async (c) => {
  try {
    const status = c.req.query('status');
    const type_id = c.req.query('type_id');
    const category_id = c.req.query('category_id');
    const search = c.req.query('search');
    const is_featured = c.req.query('is_featured');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '1000');

    let articles = await kv.getByPrefix('article:');

    // Apply filters
    if (status) {
      articles = articles.filter((a: Article) => a.status === status);
    }

    if (type_id) {
      articles = articles.filter((a: Article) => a.type_id === type_id);
    }

    if (category_id) {
      articles = articles.filter((a: Article) => a.category_id === category_id);
    }

    if (is_featured === 'true') {
      articles = articles.filter((a: Article) => a.is_featured === true);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      articles = articles.filter(
        (a: Article) =>
          a.title.toLowerCase().includes(searchLower) ||
          a.excerpt?.toLowerCase().includes(searchLower) ||
          a.subtitle?.toLowerCase().includes(searchLower),
      );
    }

    // Sort by published_at or created_at (newest first)
    articles.sort((a: Article, b: Article) => {
      const dateA = new Date(a.published_at || a.created_at).getTime();
      const dateB = new Date(b.published_at || b.created_at).getTime();
      return dateB - dateA;
    });

    // Enrich articles with category and type names
    const categories = await kv.getByPrefix('article_category:');
    const types = await kv.getByPrefix('article_type:');

    const categoryMap = new Map(categories.map((cat: ArticleCategory) => [cat.id, cat]));
    const typeMap = new Map(types.map((type: ArticleType) => [type.id, type]));

    const enrichedArticles = articles.map((article: Article) => {
      const category = article.category_id ? categoryMap.get(article.category_id) : null;
      const type = article.type_id ? typeMap.get(article.type_id) : null;

      return {
        ...article,
        category_name: category?.name || 'Uncategorized',
        category_slug: category?.slug || 'uncategorized',
        type_name: type?.name || 'Article',
        type_slug: type?.slug || 'article',
      };
    });

    // Pagination
    const total = enrichedArticles.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedArticles = enrichedArticles.slice(startIndex, endIndex);

    return c.json({
      success: true,
      data: paginatedArticles,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.error('Error fetching articles', error);
    return c.json({ success: false, error: 'Failed to fetch articles' }, 500);
  }
});

articlesRoutes.get('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    return c.json({ success: true, data: article });
  } catch (error) {
    log.error('Error fetching article', error);
    return c.json({ success: false, error: 'Failed to fetch article' }, 500);
  }
});

articlesRoutes.get('/articles/by-slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const articles = await kv.getByPrefix('article:');
    const article = articles.find((a: Article) => a.slug === slug);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Only serve published articles to the public — archived/draft articles
    // must not be accessible via slug lookup on the website
    if (article.status !== 'published') {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Enrich with category and type names
    const categories = await kv.getByPrefix('article_category:');
    const types = await kv.getByPrefix('article_type:');
    const category = article.category_id
      ? categories.find((cat: ArticleCategory) => cat.id === article.category_id)
      : null;
    const type = article.type_id ? types.find((t: ArticleType) => t.id === article.type_id) : null;

    const enrichedArticle = {
      ...article,
      category_name: category?.name || 'Uncategorized',
      category_slug: category?.slug || 'uncategorized',
      type_name: type?.name || 'Article',
      type_slug: type?.slug || 'article',
    };

    return c.json({ success: true, data: enrichedArticle });
  } catch (error) {
    log.error('Error fetching article by slug', error);
    return c.json({ success: false, error: 'Failed to fetch article' }, 500);
  }
});

articlesRoutes.get('/articles/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const articles = await kv.getByPrefix('article:');
    const article = articles.find((a: Article) => a.slug === slug);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Only serve published articles to the public — archived/draft articles
    // must not be accessible via slug lookup on the website
    if (article.status !== 'published') {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Enrich with category and type names
    const categories = await kv.getByPrefix('article_category:');
    const types = await kv.getByPrefix('article_type:');
    const category = article.category_id
      ? categories.find((cat: ArticleCategory) => cat.id === article.category_id)
      : null;
    const type = article.type_id ? types.find((t: ArticleType) => t.id === article.type_id) : null;

    const enrichedArticle = {
      ...article,
      category_name: category?.name || 'Uncategorized',
      category_slug: category?.slug || 'uncategorized',
      type_name: type?.name || 'Article',
      type_slug: type?.slug || 'article',
    };

    return c.json({ success: true, data: enrichedArticle });
  } catch (error) {
    log.error('Error fetching article by slug', error);
    return c.json({ success: false, error: 'Failed to fetch article' }, 500);
  }
});

articlesRoutes.post('/articles', async (c) => {
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

    // Create initial version snapshot (Phase 4)
    try {
      await VersionService.createVersion(id, article, last_edited_by || 'system');
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

articlesRoutes.put('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');
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

    // Auto-create version snapshot on article update (Phase 4)
    try {
      const editedBy = body.last_edited_by || 'system';
      await VersionService.createVersion(id, updated, editedBy);
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

articlesRoutes.post('/articles/:id/publish', async (c) => {
  try {
    const id = c.req.param('id');
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
  requireAuth,
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id');
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
    const adminUserId = c.get('userId') || 'system';
    AdminAuditService.record({
      actorId: adminUserId,
      actorRole: c.get('userRole') || 'admin',
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
