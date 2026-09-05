/**
 * publications-lifecycle-routes.ts — article lifecycle + view/engagement pings
 * (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', lifecycleRoutes)`. Owns archive / unarchive /
 * unpublish / schedule / delete / duplicate / increment-views / view plus the
 * public email-open / email-read tracking pings. Behaviour-preserving; the
 * publications route contract suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { ArticleEmailEngagementEventSchema } from './publications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  markArticleEmailOpened,
  markArticleEmailRead,
} from './publications-email-engagement-service.ts';
import {
  generateId,
  generateSlug,
  type Article,
  type DeletedArticleRecord,
} from './publications-route-helpers.ts';
import { triggerSiteRebuild } from './site-rebuild-trigger.ts';
import { requireAdmin } from './auth-mw.ts';
import {
  removeArticleFromIndexInBackground,
  syncArticleIndexInBackground,
} from './vasco-index-sync.ts';

const log = createModuleLogger('publications-lifecycle-routes');

const lifecycleRoutes = new Hono();

for (const path of [
  '/articles/:id/archive',
  '/articles/:id/unarchive',
  '/articles/:id/unpublish',
  '/articles/:id/schedule',
  '/articles/:id',
  '/articles/:id/duplicate',
]) {
  lifecycleRoutes.use(path, requireAdmin);
}

lifecycleRoutes.post('/articles/:id/archive', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    const updated: Article = {
      ...article,
      status: 'archived',
      updated_at: now,
    };

    await kv.set(`article:${id}`, updated);

    if (article.status === 'published') {
      triggerSiteRebuild(`article_archived:${id}`);
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: (c.get('userId') as string | undefined) || 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_archived',
      summary: `Article archived: ${article.title}`,
      severity: 'warning',
      entityType: 'article',
      entityId: id,
      metadata: { previousStatus: article.status },
    }).catch(() => {});

    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error archiving article', error);
    return c.json({ success: false, error: 'Failed to archive article' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/unarchive', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    const updated: Article = {
      ...article,
      status: 'draft',
      updated_at: now,
    };

    await kv.set(`article:${id}`, updated);

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: (c.get('userId') as string | undefined) || 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_unarchived',
      summary: `Article unarchived (restored to draft): ${article.title}`,
      severity: 'info',
      entityType: 'article',
      entityId: id,
    }).catch(() => {});

    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error unarchiving article', error);
    return c.json({ success: false, error: 'Failed to unarchive article' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/unpublish', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    const updated: Article = {
      ...article,
      status: 'draft',
      // We don't clear published_at to keep history, or should we?
      // Usually "unpublish" means reverting to draft.
      updated_at: now,
    };

    await kv.set(`article:${id}`, updated);

    triggerSiteRebuild(`article_unpublished:${id}`);
    // Unpublished content must stop being retrievable by Vasco.
    syncArticleIndexInBackground(updated, 'article_unpublished');

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: (c.get('userId') as string | undefined) || 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_unpublished',
      summary: `Article unpublished (reverted to draft): ${article.title}`,
      severity: 'warning',
      entityType: 'article',
      entityId: id,
      metadata: { originalPublishedAt: article.published_at },
    }).catch(() => {});

    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error unpublishing article', error);
    return c.json({ success: false, error: 'Failed to unpublish article' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/schedule', async (c) => {
  try {
    const id = c.req.param('id')!;
    const body = await c.req.json();
    const { scheduled_publish_at } = body;

    if (!scheduled_publish_at) {
      return c.json({ success: false, error: 'Scheduled date is required' }, 400);
    }

    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const now = new Date().toISOString();

    const updated: Article = {
      ...article,
      status: 'scheduled',
      scheduled_for: scheduled_publish_at,
      updated_at: now,
    };

    await kv.set(`article:${id}`, updated);

    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error scheduling article', error);
    return c.json({ success: false, error: 'Failed to schedule article' }, 500);
  }
});

lifecycleRoutes.delete('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = (await kv.get(`article:${id}`)) as Article | null;

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const deletedAt = new Date().toISOString();
    const deletedArticle: DeletedArticleRecord = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      published_at: article.published_at ?? null,
      deleted_at: deletedAt,
      deleted_by: 'system',
      previous_status: article.status,
    };

    await kv.set(`article_deleted:${id}`, deletedArticle);
    await kv.del(`article:${id}`);
    removeArticleFromIndexInBackground(id, 'article_deleted');

    // Also delete any tag links
    const tagLinks = await kv.getByPrefix(`article_tag_link:${id}:`);
    for (const link of tagLinks) {
      await kv.del(`article_tag_link:${id}:${link.tag_id}`);
    }

    if (article.status === 'published') {
      triggerSiteRebuild(`article_deleted:${id}`);
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_deleted',
      summary: `Article deleted: ${article.title}`,
      severity: 'warning',
      entityType: 'article',
      entityId: id,
      metadata: {
        title: article.title,
        previousStatus: article.status,
        deletedAt,
      },
    }).catch(() => {});

    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting article', error);
    return c.json({ success: false, error: 'Failed to delete article' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/duplicate', async (c) => {
  try {
    const id = c.req.param('id')!;
    const existing = await kv.get(`article:${id}`);

    if (!existing) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    const newId = generateId();
    const now = new Date().toISOString();

    const duplicated: Article = {
      ...existing,
      id: newId,
      title: `${existing.title} (Copy)`,
      slug: generateSlug(`${existing.title} (Copy)`),
      status: 'draft',
      is_featured: false,
      published_at: undefined,
      scheduled_for: undefined,
      created_at: now,
      updated_at: now,
    };

    await kv.set(`article:${newId}`, duplicated);

    return c.json({ success: true, data: duplicated }, 201);
  } catch (error) {
    log.error('Error duplicating article', error);
    return c.json({ success: false, error: 'Failed to duplicate article' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/increment-views', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    article.view_count = (article.view_count || 0) + 1;
    await kv.set(`article:${id}`, article);

    return c.json({ success: true, data: { view_count: article.view_count } });
  } catch (error) {
    log.error('Error incrementing views', error);
    return c.json({ success: false, error: 'Failed to increment views' }, 500);
  }
});

lifecycleRoutes.post('/articles/:id/view', async (c) => {
  try {
    const id = c.req.param('id')!;
    const article = await kv.get(`article:${id}`);

    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    article.view_count = (article.view_count || 0) + 1;
    await kv.set(`article:${id}`, article);

    return c.json({ success: true, data: { view_count: article.view_count } });
  } catch (error) {
    log.error('Error incrementing views', error);
    return c.json({ success: false, error: 'Failed to increment views' }, 500);
  }
});

lifecycleRoutes.post(
  '/email-engagement/open',
  asyncHandler(async (c) => {
    const parsed = ArticleEmailEngagementEventSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const record = await markArticleEmailOpened(parsed.data.token);
    if (!record) {
      return c.json({ success: true, data: { tracked: false } });
    }

    return c.json({
      success: true,
      data: {
        tracked: true,
        articleId: record.articleId,
        openedAt: record.openedAt,
        openCount: record.openCount,
      },
    });
  }),
);

lifecycleRoutes.post(
  '/email-engagement/read',
  asyncHandler(async (c) => {
    const parsed = ArticleEmailEngagementEventSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }

    const record = await markArticleEmailRead(parsed.data.token);
    if (!record) {
      return c.json({ success: true, data: { tracked: false } });
    }

    return c.json({
      success: true,
      data: {
        tracked: true,
        articleId: record.articleId,
        readAt: record.readAt,
        readCount: record.readCount,
      },
    });
  }),
);

export default lifecycleRoutes;
