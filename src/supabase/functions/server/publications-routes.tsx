import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { sendEmail } from './email-service.ts';
import { createArticleNotificationEmail } from './article-notification-template.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { runArticleNotificationDelivery, sendArticlePublishedNotifications } from './publications-notification-service.ts';
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  CreateTypeSchema,
  UpdateTypeSchema,
  CreateArticleSchema,
  UpdateArticleSchema,
  ArticleReshareSchema,
} from './publications-validation.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { TemplateService, VersionService } from './publications-phase4-service.ts';
import { requireAuth, requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { AdminAuditService } from './admin-audit-service.ts';

const publications = new Hono();
const log = createModuleLogger('publications');

// Root handlers
publications.get('/', (c) => c.json({ service: 'publications', status: 'active' }));
publications.get('', (c) => c.json({ service: 'publications', status: 'active' }));

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon_key?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArticleType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Article {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  body: string;
  category_id: string;
  type_id: string;
  author_id?: string;
  author_name?: string;
  hero_image_url?: string;
  thumbnail_image_url?: string;
  reading_time_minutes: number;
  status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';
  is_featured: boolean;
  published_at?: string;
  scheduled_for?: string;
  seo_title?: string;
  seo_description?: string;
  seo_canonical_url?: string;
  created_at: string;
  updated_at: string;
  last_edited_by: string;
  view_count?: number;
  notify_on_publish?: boolean; // New field to control email notifications on publish
  /** Optional press category — when set, the article appears on the public Press page */
  press_category?: 'company_news' | 'product_launch' | 'awards' | 'team_news' | 'industry_insights' | null;
}

export interface ArticleTag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleTagLink {
  article_id: string;
  tag_id: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateId(): string {
  return crypto.randomUUID();
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

publications.get('/categories', async (c) => {
  try {
    const categories = await kv.getByPrefix('article_category:');
    const articles = await kv.getByPrefix('article:');
    
    // Filter only published articles for counts
    const publishedArticles = articles.filter((a: Article) => a.status === 'published');
    
    // Add article counts to each category
    const categoriesWithCounts = categories.map((category: ArticleCategory) => {
      const article_count = publishedArticles.filter(
        (a: Article) => a.category_id === category.id
      ).length;
      
      return {
        ...category,
        article_count
      };
    });
    
    // Sort by sort_order
    categoriesWithCounts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    return c.json({ success: true, data: categoriesWithCounts });
  } catch (error) {
    log.error('Error fetching categories', error);
    return c.json({ success: false, error: 'Failed to fetch categories' }, 500);
  }
});

publications.get('/categories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const category = await kv.get(`article_category:${id}`);
    
    if (!category) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }
    
    return c.json({ success: true, data: category });
  } catch (error) {
    log.error('Error fetching category', error);
    return c.json({ success: false, error: 'Failed to fetch category' }, 500);
  }
});

publications.post('/categories', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, icon_key, sort_order, is_active = true } = body;
    
    if (!name) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }
    
    const id = generateId();
    const slug = generateSlug(name);
    const now = new Date().toISOString();
    
    const category: ArticleCategory = {
      id,
      name,
      slug,
      description,
      icon_key,
      sort_order: sort_order ?? 0,
      is_active,
      created_at: now,
      updated_at: now,
    };
    
    await kv.set(`article_category:${id}`, category);
    
    return c.json({ success: true, data: category }, 201);
  } catch (error) {
    log.error('Error creating category', error);
    return c.json({ success: false, error: 'Failed to create category' }, 500);
  }
});

publications.put('/categories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await kv.get(`article_category:${id}`);
    
    if (!existing) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }
    
    log.info(`Updating category ${id}`, body);
    
    const updated: ArticleCategory = {
      ...existing,
      ...body,
      id,
      updated_at: new Date().toISOString(),
    };
    
    if (body.name && body.name !== existing.name) {
      updated.slug = generateSlug(body.name);
    }
    
    await kv.set(`article_category:${id}`, updated);
    
    log.success(`Category ${id} updated. New sort_order: ${updated.sort_order}`);
    
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating category', error);
    return c.json({ success: false, error: 'Failed to update category' }, 500);
  }
});

publications.delete('/categories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`article_category:${id}`);
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting category', error);
    return c.json({ success: false, error: 'Failed to delete category' }, 500);
  }
});

// ============================================================================
// TYPES ROUTES
// ============================================================================

publications.get('/types', async (c) => {
  try {
    const types = await kv.getByPrefix('article_type:');
    return c.json({ success: true, data: types });
  } catch (error) {
    log.error('Error fetching types', error);
    return c.json({ success: false, error: 'Failed to fetch types' }, 500);
  }
});

publications.get('/types/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const type = await kv.get(`article_type:${id}`);
    
    if (!type) {
      return c.json({ success: false, error: 'Type not found' }, 404);
    }
    
    return c.json({ success: true, data: type });
  } catch (error) {
    log.error('Error fetching type', error);
    return c.json({ success: false, error: 'Failed to fetch type' }, 500);
  }
});

publications.post('/types', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, sort_order, is_active = true } = body;
    
    if (!name) {
      return c.json({ success: false, error: 'Name is required' }, 400);
    }
    
    const id = generateId();
    const slug = generateSlug(name);
    const now = new Date().toISOString();
    
    const type: ArticleType = {
      id,
      name,
      slug,
      description,
      sort_order: sort_order ?? 0,
      is_active,
      created_at: now,
      updated_at: now,
    };
    
    await kv.set(`article_type:${id}`, type);
    
    return c.json({ success: true, data: type }, 201);
  } catch (error) {
    log.error('Error creating type', error);
    return c.json({ success: false, error: 'Failed to create type' }, 500);
  }
});

publications.put('/types/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = await kv.get(`article_type:${id}`);
    
    if (!existing) {
      return c.json({ success: false, error: 'Type not found' }, 404);
    }
    
    const updated: ArticleType = {
      ...existing,
      ...body,
      id,
      updated_at: new Date().toISOString(),
    };
    
    if (body.name && body.name !== existing.name) {
      updated.slug = generateSlug(body.name);
    }
    
    await kv.set(`article_type:${id}`, updated);
    
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating type', error);
    return c.json({ success: false, error: 'Failed to update type' }, 500);
  }
});

publications.delete('/types/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`article_type:${id}`);
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting type', error);
    return c.json({ success: false, error: 'Failed to delete type' }, 500);
  }
});

// ============================================================================
// ARTICLES ROUTES
// ============================================================================

publications.get('/articles', async (c) => {
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
      articles = articles.filter((a: Article) => 
        a.title.toLowerCase().includes(searchLower) ||
        a.excerpt?.toLowerCase().includes(searchLower) ||
        a.subtitle?.toLowerCase().includes(searchLower)
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
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    log.error('Error fetching articles', error);
    return c.json({ success: false, error: 'Failed to fetch articles' }, 500);
  }
});

publications.get('/articles/:id', async (c) => {
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

publications.get('/articles/by-slug/:slug', async (c) => {
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
    const type = article.type_id 
      ? types.find((t: ArticleType) => t.id === article.type_id) 
      : null;
    
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

publications.get('/articles/slug/:slug', async (c) => {
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
    const type = article.type_id 
      ? types.find((t: ArticleType) => t.id === article.type_id) 
      : null;
    
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

publications.post('/articles', async (c) => {
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
      return c.json({ 
        success: false, 
        error: 'Title, excerpt, body, category_id, and type_id are required' 
      }, 400);
    }
    
    const id = generateId();
    const slug = customSlug || generateSlug(title);
    const now = new Date().toISOString();
    const reading_time_minutes = calculateReadingTime(articleBody);
    
    // Check if slug already exists
    const existingArticles = await kv.getByPrefix('article:');
    const slugExists = existingArticles.some((a: Article) => a.slug === slug);
    
    if (slugExists) {
      return c.json({ 
        success: false, 
        error: 'An article with this slug already exists' 
      }, 400);
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

publications.put('/articles/:id', async (c) => {
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
      return c.json({ 
        success: false, 
        error: 'scheduled_for is required when status is scheduled' 
      }, 400);
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
    
    // If status just changed to published, notify newsletter subscribers
    if (body.status === 'published' && existing.status !== 'published') {
      sendArticlePublishedNotifications({
        id: updated.id,
        title: updated.title,
        slug: updated.slug,
        excerpt: updated.excerpt,
      }).catch((nErr) => {
        log.error('Failed to send article published notifications via update', nErr);
      });
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
      },
    }).catch(() => {});
    
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error updating article', error);
    return c.json({ success: false, error: 'Failed to update article' }, 500);
  }
});

publications.post('/articles/:id/publish', async (c) => {
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
    
    // Fire-and-forget: notify newsletter subscribers about the new article
    if (notifySubscribers) {
      sendArticlePublishedNotifications({
        id: updated.id,
        title: updated.title,
        slug: updated.slug,
        excerpt: updated.excerpt,
      }).catch((nErr) => {
        log.error('Failed to send article published notifications', nErr);
      });
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
      metadata: { notifySubscribers },
    }).catch(() => {});
    
    return c.json({ success: true, data: updated });
  } catch (error) {
    log.error('Error publishing article', error);
    return c.json({ success: false, error: 'Failed to publish article' }, 500);
  }
});

publications.post('/articles/:id/reshare', requireAuth, requireAdmin, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const parsed = ArticleReshareSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  const article = await kv.get(`article:${id}`) as Article | null;
  if (!article) {
    return c.json({ success: false, error: 'Article not found' }, 404);
  }

  if (article.status !== 'published' || !article.published_at) {
    return c.json({ success: false, error: 'Only published articles can be reshared' }, 400);
  }

  const recipientEmails = parsed.data.targetMode === 'selected'
    ? parsed.data.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    : undefined;

  if (parsed.data.targetMode === 'selected' && (!recipientEmails || recipientEmails.length === 0)) {
    return c.json({ success: false, error: 'Select at least one newsletter subscriber' }, 400);
  }

  const result = await runArticleNotificationDelivery({
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
  }, {
    dryRun: parsed.data.dryRun,
    recipientEmails,
  });

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
}));

publications.post('/articles/:id/archive', async (c) => {
  try {
    const id = c.req.param('id');
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

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: c.get('userId') || 'system',
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

publications.post('/articles/:id/unarchive', async (c) => {
  try {
    const id = c.req.param('id');
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
      actorId: c.get('userId') || 'system',
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

publications.post('/articles/:id/unpublish', async (c) => {
  try {
    const id = c.req.param('id');
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

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: c.get('userId') || 'system',
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

publications.post('/articles/:id/schedule', async (c) => {
  try {
    const id = c.req.param('id');
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

publications.delete('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`article:${id}`);
    
    // Also delete any tag links
    const tagLinks = await kv.getByPrefix(`article_tag_link:${id}:`);
    for (const link of tagLinks) {
      await kv.del(`article_tag_link:${id}:${link.tag_id}`);
    }

    // Audit trail (non-blocking — §12.2)
    AdminAuditService.record({
      actorId: 'system',
      actorRole: 'admin',
      category: 'configuration',
      action: 'article_deleted',
      summary: 'Article deleted',
      severity: 'warning',
      entityType: 'article',
      entityId: id,
    }).catch(() => {});
    
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting article', error);
    return c.json({ success: false, error: 'Failed to delete article' }, 500);
  }
});

publications.post('/articles/:id/duplicate', async (c) => {
  try {
    const id = c.req.param('id');
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

publications.post('/articles/:id/increment-views', async (c) => {
  try {
    const id = c.req.param('id');
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

publications.post('/articles/:id/view', async (c) => {
  try {
    const id = c.req.param('id');
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

// ============================================================================
// TAGS ROUTES
// ============================================================================

publications.get('/tags', async (c) => {
  try {
    const tags = await kv.getByPrefix('article_tag:');
    return c.json({ success: true, data: tags });
  } catch (error) {
    log.error('Error fetching tags', error);
    return c.json({ success: false, error: 'Failed to fetch tags' }, 500);
  }
});

publications.post('/tags', async (c) => {
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

publications.post('/articles/:articleId/tags/:tagId', async (c) => {
  try {
    const articleId = c.req.param('articleId');
    const tagId = c.req.param('tagId');
    
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

publications.delete('/articles/:articleId/tags/:tagId', async (c) => {
  try {
    const articleId = c.req.param('articleId');
    const tagId = c.req.param('tagId');
    
    await kv.del(`article_tag_link:${articleId}:${tagId}`);
    
    return c.json({ success: true });
  } catch (error) {
    log.error('Error unlinking tag', error);
    return c.json({ success: false, error: 'Failed to unlink tag' }, 500);
  }
});

publications.get('/articles/:articleId/tags', async (c) => {
  try {
    const articleId = c.req.param('articleId');
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
 * Authenticated via SUPABASE_SERVICE_ROLE_KEY or SUPER_ADMIN_PASSWORD.
 */
publications.post('/cron/process-scheduled', async (c) => {
  try {
    const authHeader = c.req.header('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const superAdminPw = Deno.env.get('SUPER_ADMIN_PASSWORD') || '';

    if (
      (!serviceRoleKey || token !== serviceRoleKey) &&
      (!superAdminPw || token !== superAdminPw)
    ) {
      return c.json({ error: 'Unauthorized — cron auth required' }, 401);
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
            sendArticlePublishedNotifications({
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
            }).catch((nErr) => {
              log.error(`Failed to send notifications for scheduled article ${article.id}`, nErr);
            });
          }
        }
      }
    }

    log.info(`CRON: Processed ${processedCount} scheduled article(s)`, { published });
    return c.json({
      success: true,
      data: { processed: processedCount, published },
      message: `Processed ${processedCount} scheduled articles`,
    });
  } catch (error) {
    log.error('CRON: Error processing scheduled articles', error);
    return c.json({ success: false, error: 'Failed to process scheduled articles' }, 500);
  }
});

publications.post('/process-scheduled', async (c) => {
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
            sendArticlePublishedNotifications({
              id: article.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
            }).catch((nErr) => {
              log.error(`Failed to send notifications for scheduled article ${article.id}`, nErr);
            });
          } else {
            log.info(`Skipping email notifications for scheduled article ${article.id} — notify_on_publish was disabled`);
          }
        }
      }
    }
    
    return c.json({ 
      success: true, 
      data: { processed: processedCount },
      message: `Processed ${processedCount} scheduled articles` 
    });
  } catch (error) {
    log.error('Error processing scheduled articles', error);
    return c.json({ success: false, error: 'Failed to process scheduled articles' }, 500);
  }
});

// ============================================================================
// STATISTICS ROUTE
// ============================================================================

publications.get('/stats', async (c) => {
  try {
    const articles = await kv.getByPrefix('article:');
    const categories = await kv.getByPrefix('article_category:');
    const types = await kv.getByPrefix('article_type:');

    // Count articles by category
    const byCategory: Record<string, number> = {};
    for (const cat of categories) {
      byCategory[cat.id] = articles.filter((a: Article) => a.category_id === cat.id).length;
    }

    // Count articles by type
    const byType: Record<string, number> = {};
    for (const t of types) {
      byType[t.id] = articles.filter((a: Article) => a.type_id === t.id).length;
    }

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentPublished = articles.filter(
      (a: Article) => a.status === 'published' && a.published_at && a.published_at >= sevenDaysAgo
    ).length;
    const recentUpdated = articles.filter(
      (a: Article) => a.updated_at >= sevenDaysAgo
    ).length;

    const stats = {
      total: articles.length,
      by_status: {
        draft: articles.filter((a: Article) => a.status === 'draft').length,
        in_review: articles.filter((a: Article) => a.status === 'in_review').length,
        scheduled: articles.filter((a: Article) => a.status === 'scheduled').length,
        published: articles.filter((a: Article) => a.status === 'published').length,
        archived: articles.filter((a: Article) => a.status === 'archived').length,
      },
      featured: articles.filter((a: Article) => a.is_featured).length,
      by_category: byCategory,
      by_type: byType,
      recent_published: recentPublished,
      recent_updated: recentUpdated,
    };

    return c.json({ success: true, data: stats });
  } catch (error) {
    log.error('Error fetching stats', error);
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

// ============================================================================
// INITIALIZATION - Seed Default Categories & Types
// ============================================================================

publications.post('/initialize', async (c) => {
  try {
    // Check if already initialized
    const existingCategories = await kv.getByPrefix('article_category:');
    const existingTypes = await kv.getByPrefix('article_type:');
    
    if (existingCategories.length > 0 || existingTypes.length > 0) {
      return c.json({ 
        success: false, 
        error: 'System already initialized. Categories or types already exist.' 
      }, 400);
    }
    
    const now = new Date().toISOString();
    
    // Seed Categories
    const categories = [
      { name: 'Market & Economic Insights', icon_key: 'TrendingUp', sort_order: 1 },
      { name: 'Personal Finance', icon_key: 'PiggyBank', sort_order: 2 },
      { name: 'Retirement Planning', icon_key: 'Target', sort_order: 3 },
      { name: 'Risk & Insurance', icon_key: 'Shield', sort_order: 4 },
      { name: 'Estate & Tax Planning', icon_key: 'FileText', sort_order: 5 },
      { name: 'Financial Literacy', icon_key: 'GraduationCap', sort_order: 6 },
      { name: 'Global Markets', icon_key: 'Globe', sort_order: 7 },
      { name: "Adviser's Corner", icon_key: 'Users', sort_order: 8 },
    ];
    
    for (const cat of categories) {
      const id = generateId();
      const category: ArticleCategory = {
        id,
        name: cat.name,
        slug: generateSlug(cat.name),
        description: `Articles related to ${cat.name}`,
        icon_key: cat.icon_key,
        sort_order: cat.sort_order,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await kv.set(`article_category:${id}`, category);
    }
    
    // Seed Types
    const types = [
      { name: 'Insights & Education', sort_order: 1 },
      { name: 'Market Watch', sort_order: 2 },
      { name: 'Market News', sort_order: 3 },
    ];
    
    for (const typ of types) {
      const id = generateId();
      const type: ArticleType = {
        id,
        name: typ.name,
        slug: generateSlug(typ.name),
        description: `${typ.name} content`,
        sort_order: typ.sort_order,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      await kv.set(`article_type:${id}`, type);
    }
    
    return c.json({ 
      success: true, 
      message: 'Publications system initialized with default categories and types' 
    });
  } catch (error) {
    log.error('Error initializing publications', error);
    return c.json({ success: false, error: 'Failed to initialize publications' }, 500);
  }
});

// Export all articles (for backup/migration)
publications.get('/export', async (c) => {
  try {
    const articles = await kv.getByPrefix('article:');
    const categories = await kv.getByPrefix('category:');
    const types = await kv.getByPrefix('article_type:');
    
    const exportData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        articles: articles || [],
        categories: categories || [],
        types: types || []
      }
    };
    
    return c.json({ success: true, data: exportData });
  } catch (error) {
    log.error('Error exporting data:', error);
    return c.json({ success: false, error: 'Failed to export data' }, 500);
  }
});

// Import articles (from backup/migration)
publications.post('/import', async (c) => {
  try {
    const body = await c.req.json();
    
    if (!body.data) {
      return c.json({ success: false, error: 'Invalid import data format' }, 400);
    }
    
    let imported = {
      articles: 0,
      categories: 0,
      types: 0
    };
    
    // Import categories
    if (body.data.categories && Array.isArray(body.data.categories)) {
      for (const category of body.data.categories) {
        await kv.set(`category:${category.id}`, category);
        imported.categories++;
      }
    }
    
    // Import types
    if (body.data.types && Array.isArray(body.data.types)) {
      for (const type of body.data.types) {
        await kv.set(`article_type:${type.id}`, type);
        imported.types++;
      }
    }
    
    // Import articles
    if (body.data.articles && Array.isArray(body.data.articles)) {
      for (const article of body.data.articles) {
        await kv.set(`article:${article.id}`, article);
        imported.articles++;
      }
    }
    
    return c.json({ 
      success: true, 
      message: 'Data imported successfully',
      imported 
    });
  } catch (error) {
    log.error('Error importing data:', error);
    return c.json({ success: false, error: 'Failed to import data' }, 500);
  }
});

// Clear all drafts (maintenance operation)
publications.delete('/maintenance/clear-drafts', async (c) => {
  try {
    const articles = await kv.getByPrefix('article:');
    let deleted = 0;
    
    for (const article of articles) {
      if (article.status === 'draft') {
        await kv.del(`article:${article.id}`);
        deleted++;
      }
    }
    
    return c.json({ 
      success: true, 
      message: `Deleted ${deleted} draft articles` 
    });
  } catch (error) {
    log.error('Error clearing drafts:', error);
    return c.json({ success: false, error: 'Failed to clear drafts' }, 500);
  }
});

// Image upload endpoint
publications.post('/upload-image', async (c) => {
  try {
    const bucketName = 'make-91ed8379-publications';
    
    // Ensure bucket exists
    const { data: buckets } = await getSupabase().storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error: createError } = await getSupabase().storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (createError) {
        log.error('Error creating bucket:', createError);
        return c.json({ success: false, error: 'Failed to create storage bucket' }, 500);
      }
    }
    
    // Get form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return c.json({ success: false, error: 'File must be an image' }, 400);
    }
    
    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ success: false, error: 'File size must be less than 5MB' }, 400);
    }
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `articles/${fileName}`;
    
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error: uploadError } = await getSupabase().storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      log.error('Upload error:', uploadError);
      return c.json({ success: false, error: uploadError.message }, 500);
    }
    
    // Get public URL
    const { data: urlData } = getSupabase().storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    return c.json({ 
      success: true, 
      data: { 
        url: urlData.publicUrl,
        path: filePath
      } 
    });
  } catch (error) {
    log.error('Error uploading image:', error);
    return c.json({ success: false, error: 'Failed to upload image' }, 500);
  }
});

// Send article notification to user groups
publications.post('/articles/:id/send-notifications', async (c) => {
  try {
    const articleId = c.req.param('id');
    const body = await c.req.json();
    const { groupIds } = body;
    
    if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
      return c.json({ success: false, error: 'At least one group must be selected' }, 400);
    }
    
    // Get article
    const article = await kv.get(`article:${articleId}`);
    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }
    
    // Build article URL
    const articleUrl = `https://navigatewealth.co/resources/article/${article.slug}`;
    
    // Get all users from Supabase Auth
    const { data: { users }, error: usersError } = await getSupabase().auth.admin.listUsers();
    if (usersError) {
      log.error('Error fetching users:', usersError);
      return c.json({ success: false, error: 'Failed to fetch users' }, 500);
    }
    
    // Create a map of users by ID for quick lookup
    const userMap = new Map<string, { id: string; email: string; emailVerified: boolean; firstName: string; lastName: string }>();
    users.forEach((user: { id: string; email: string; email_confirmed_at: string | null; user_metadata?: Record<string, unknown> }) => {
      userMap.set(user.id, {
        id: user.id,
        email: user.email,
        emailVerified: user.email_confirmed_at !== null,
        firstName: (user.user_metadata?.firstName as string) || (user.user_metadata?.first_name as string) || 'Valued Client',
        lastName: (user.user_metadata?.surname as string) || (user.user_metadata?.lastName as string) || ''
      });
    });
    
    // Collect recipients from all groups
    const recipientMap = new Map();
    
    for (const groupId of groupIds) {
      const group = await kv.get(`communication:groups:${groupId}`);
      if (!group) {
        log.warn(`Group ${groupId} not found, skipping`);
        continue;
      }
      
      // Get recipients from group clientIds
      if (group.clientIds && Array.isArray(group.clientIds)) {
        for (const clientId of group.clientIds) {
          const user = userMap.get(clientId);
          if (user && user.email && user.emailVerified) {
            recipientMap.set(user.email, {
              email: user.email,
              firstName: user.firstName
            });
          }
        }
      }
    }
    
    const recipients = Array.from(recipientMap.values());
    
    if (recipients.length === 0) {
      return c.json({ 
        success: false, 
        error: 'No verified recipients found in the selected groups' 
      }, 400);
    }
    
    // Send emails
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    for (const recipient of recipients) {
      try {
        const unsubscribeUrl = `https://navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
        const { html, text } = await createArticleNotificationEmail({
          firstName: recipient.firstName,
          articleTitle: article.title,
          articleExcerpt: article.excerpt,
          articleUrl,
          unsubscribeUrl,
        });
        
        await sendEmail({
          to: recipient.email,
          subject: `New article: ${article.title}`,
          html,
          text,
        });
        
        successCount++;
        log.info(`✅ Article notification sent to ${recipient.email}`);
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${recipient.email}: ${errorMsg}`);
        log.error(`❌ Failed to send to ${recipient.email}:`, errorMsg);
      }
    }
    
    return c.json({
      success: true,
      data: {
        total: recipients.length,
        sent: successCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    log.error('Error sending article notifications:', error);
    return c.json({ success: false, error: 'Failed to send notifications' }, 500);
  }
});

// ============================================================================
// CONTENT TEMPLATES ROUTES (Phase 4)
// ============================================================================

// Static paths must be registered before parameterised /:id routes (§14.2)
publications.post('/templates/seed', async (c) => {
  try {
    const templates = await TemplateService.seedDefaults();
    return c.json({ success: true, data: templates });
  } catch (error) {
    log.error('Error seeding templates', error);
    return c.json({ success: false, error: 'Failed to seed templates' }, 500);
  }
});

publications.get('/templates', async (c) => {
  try {
    const includeInactive = c.req.query('all') === 'true';
    const templates = includeInactive
      ? await TemplateService.listAll()
      : await TemplateService.list();
    return c.json({ success: true, data: templates });
  } catch (error) {
    log.error('Error fetching templates', error);
    return c.json({ success: false, error: 'Failed to fetch templates' }, 500);
  }
});

publications.post('/templates', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.description) {
      return c.json({ success: false, error: 'Name and description are required' }, 400);
    }
    const template = await TemplateService.create(body);
    return c.json({ success: true, data: template }, 201);
  } catch (error) {
    log.error('Error creating template', error);
    return c.json({ success: false, error: 'Failed to create template' }, 500);
  }
});

publications.get('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const template = await TemplateService.get(id);
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true, data: template });
  } catch (error) {
    log.error('Error fetching template', error);
    return c.json({ success: false, error: 'Failed to fetch template' }, 500);
  }
});

publications.put('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const template = await TemplateService.update(id, body);
    if (!template) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true, data: template });
  } catch (error) {
    log.error('Error updating template', error);
    return c.json({ success: false, error: 'Failed to update template' }, 500);
  }
});

publications.delete('/templates/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await TemplateService.delete(id);
    if (!deleted) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting template', error);
    return c.json({ success: false, error: 'Failed to delete template' }, 500);
  }
});

// ============================================================================
// VERSION HISTORY ROUTES (Phase 4)
// ============================================================================

publications.get('/versions/:articleId', async (c) => {
  try {
    const articleId = c.req.param('articleId');
    const versions = await VersionService.listVersions(articleId);
    return c.json({ success: true, data: versions });
  } catch (error) {
    log.error('Error fetching versions', error);
    return c.json({ success: false, error: 'Failed to fetch versions' }, 500);
  }
});

publications.post('/versions/:articleId', async (c) => {
  try {
    const articleId = c.req.param('articleId');
    const article = await kv.get(`article:${articleId}`);
    if (!article) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }
    const body = await c.req.json().catch(() => ({}));
    const editedBy = body.edited_by || 'system';
    const version = await VersionService.createVersion(articleId, article, editedBy);
    return c.json({ success: true, data: version }, 201);
  } catch (error) {
    log.error('Error creating version', error);
    return c.json({ success: false, error: 'Failed to create version' }, 500);
  }
});

publications.post('/versions/:articleId/:versionId/restore', async (c) => {
  try {
    const articleId = c.req.param('articleId');
    const versionId = c.req.param('versionId');

    const version = await VersionService.getVersion(articleId, versionId);
    if (!version) {
      return c.json({ success: false, error: 'Version not found' }, 404);
    }

    const existing = await kv.get(`article:${articleId}`);
    if (!existing) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    // Save current state as a new version before restoring
    await VersionService.createVersion(articleId, existing, 'system');

    // Restore from snapshot
    const restored: Article = {
      ...existing,
      ...version.snapshot,
      id: articleId,
      updated_at: new Date().toISOString(),
    };

    await kv.set(`article:${articleId}`, restored);

    return c.json({ success: true, data: restored });
  } catch (error) {
    log.error('Error restoring version', error);
    return c.json({ success: false, error: 'Failed to restore version' }, 500);
  }
});

// ============================================================================
// ADMIN PRESS CONFIG ENDPOINTS (require auth)
// ============================================================================

/**
 * GET /publications/press/config
 * Returns the current press page config (admin only).
 */
publications.get('/press/config', requireAuth, asyncHandler(async (c) => {
  const config = await kv.get('config:press_stats');
  return c.json({
    success: true,
    data: {
      aum: (config as any)?.aum || 'R500 mil+',
      yearsInBusiness: (config as any)?.yearsInBusiness || '15+',
      combinedExperience: (config as any)?.combinedExperience || '55+',
    },
  });
}));

/**
 * PUT /publications/press/config
 * Updates the config:press_stats KV entry (admin only).
 * Body: { aum?: string, yearsInBusiness?: string, combinedExperience?: string }
 */
publications.put('/press/config', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { aum, yearsInBusiness, combinedExperience } = body;

  // Fetch existing config to merge
  const existing = (await kv.get('config:press_stats') as Record<string, unknown>) || {};

  const updated = {
    ...existing,
    ...(aum !== undefined ? { aum: String(aum).trim() } : {}),
    ...(yearsInBusiness !== undefined ? { yearsInBusiness: String(yearsInBusiness).trim() } : {}),
    ...(combinedExperience !== undefined ? { combinedExperience: String(combinedExperience).trim() } : {}),
    updatedAt: new Date().toISOString(),
  };

  await kv.set('config:press_stats', updated);

  log.info('Press stats config updated', { aum: updated.aum, yearsInBusiness: updated.yearsInBusiness });

  return c.json({ success: true, data: updated });
}));

// ============================================================================
// PUBLIC PRESS PAGE ENDPOINTS (No auth required)
// ============================================================================

/**
 * GET /publications/press/stats
 * Public endpoint returning company stats for the Press page.
 * Active client count is derived from KV; other stats are config-driven.
 */
publications.get('/press/stats', async (c) => {
  try {
    const profiles = await kv.getByPrefix('user_profile:');
    // Count non-closed profiles
    const activeClients = profiles.filter((p: Record<string, unknown>) => {
      if (!p || typeof p !== 'object') return false;
      return p.accountStatus !== 'closed';
    }).length;

    // Config-based stats (update here as the business evolves)
    const pressConfig = await kv.get('config:press_stats');
    const config = (pressConfig as Record<string, unknown>) || {};

    return c.json({
      success: true,
      data: {
        aum: (config.aum as string) || 'R500 mil+',
        activeClients,
        activeClientsLabel: activeClients >= 1000
          ? `${Math.floor(activeClients / 1000)},${String(activeClients % 1000).padStart(3, '0')}+`
          : `${activeClients}+`,
        yearsInBusiness: (config.yearsInBusiness as string) || '15+',
        combinedExperience: (config.combinedExperience as string) || '55+',
      },
    });
  } catch (error) {
    log.error('Error fetching press stats', error);
    return c.json({ success: true, data: {
      aum: 'R500 mil+', activeClients: 0, activeClientsLabel: '—',
      yearsInBusiness: '15+', combinedExperience: '55+',
    }});
  }
});

/**
 * GET /publications/press/articles
 * Public endpoint returning published articles tagged with a press_category.
 * Optional ?category= filter for tab filtering on the Press page.
 */
publications.get('/press/articles', async (c) => {
  try {
    const categoryFilter = c.req.query('category') || undefined;
    const articles = await kv.getByPrefix('article:');

    // Filter to published articles with a press_category set
    let pressArticles = articles.filter((a: Article) =>
      a.status === 'published' && a.press_category
    );

    if (categoryFilter && categoryFilter !== 'all') {
      pressArticles = pressArticles.filter((a: Article) => a.press_category === categoryFilter);
    }

    // Sort by published_at descending
    pressArticles.sort((a: Article, b: Article) => {
      const aDate = a.published_at || a.created_at;
      const bDate = b.published_at || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Return only public-safe fields
    const publicArticles = pressArticles.map((a: Article) => ({
      id: a.id,
      title: a.title,
      subtitle: a.subtitle,
      slug: a.slug,
      excerpt: a.excerpt,
      press_category: a.press_category,
      hero_image_url: a.hero_image_url,
      thumbnail_image_url: a.thumbnail_image_url,
      published_at: a.published_at,
      author_name: a.author_name,
      reading_time_minutes: a.reading_time_minutes,
    }));

    return c.json({ success: true, data: publicArticles });
  } catch (error) {
    log.error('Error fetching press articles', error);
    return c.json({ success: true, data: [] });
  }
});

// ============================================================================
// TEAM MEMBER ENDPOINTS
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  title: string;
  credentials: string;
  bio: string;
  specialties: string[];
  image: string;
  linkedinUrl?: string;
  email?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /publications/team — Public endpoint returning active team members
 */
publications.get('/team', async (c) => {
  try {
    const entries = await kv.getByPrefix('team_member:');
    const members = (entries as TeamMember[])
      .filter((m) => m && m.id && m.active !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

    return c.json({ success: true, data: members });
  } catch (error) {
    log.error('Error fetching team members', error);
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /publications/team/admin — Admin endpoint returning all team members (including inactive)
 */
publications.get('/team/admin', requireAuth, asyncHandler(async (c) => {
  const entries = await kv.getByPrefix('team_member:');
  const members = (entries as TeamMember[])
    .filter((m) => m && m.id)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));

  return c.json({ success: true, data: members, total: members.length });
}));

/**
 * POST /publications/team/admin — Create a new team member
 */
publications.post('/team/admin', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { name, title: role, credentials, bio, specialties, image, linkedinUrl, email: memberEmail, sortOrder } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return c.json({ error: 'Name is required (min 2 characters)' }, 400);
  }
  if (!role || typeof role !== 'string') {
    return c.json({ error: 'Title/role is required' }, 400);
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const member: TeamMember = {
    id,
    name: name.trim(),
    title: role.trim(),
    credentials: credentials?.trim() || '',
    bio: bio?.trim() || '',
    specialties: Array.isArray(specialties) ? specialties : [],
    image: image?.trim() || '',
    linkedinUrl: linkedinUrl?.trim() || '',
    email: memberEmail?.trim() || '',
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 99,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await kv.set(`team_member:${id}`, member);
  log.info('Team member created', { id, name: member.name });

  return c.json({ success: true, data: member });
}));

/**
 * PUT /publications/team/admin/:id — Update a team member
 */
publications.put('/team/admin/:id', requireAuth, asyncHandler(async (c) => {
  const { id } = c.req.param();
  const existing = await kv.get(`team_member:${id}`) as TeamMember | null;

  if (!existing) {
    return c.json({ error: 'Team member not found' }, 404);
  }

  const body = await c.req.json();
  const updated: TeamMember = {
    ...existing,
    name: body.name?.trim() ?? existing.name,
    title: body.title?.trim() ?? existing.title,
    credentials: body.credentials?.trim() ?? existing.credentials,
    bio: body.bio?.trim() ?? existing.bio,
    specialties: Array.isArray(body.specialties) ? body.specialties : existing.specialties,
    image: body.image?.trim() ?? existing.image,
    linkedinUrl: body.linkedinUrl?.trim() ?? existing.linkedinUrl,
    email: body.email?.trim() ?? existing.email,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : existing.sortOrder,
    active: typeof body.active === 'boolean' ? body.active : existing.active,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`team_member:${id}`, updated);
  log.info('Team member updated', { id, name: updated.name });

  return c.json({ success: true, data: updated });
}));

/**
 * DELETE /publications/team/admin/:id — Soft-delete a team member
 */
publications.delete('/team/admin/:id', requireAuth, asyncHandler(async (c) => {
  const { id } = c.req.param();
  const existing = await kv.get(`team_member:${id}`) as TeamMember | null;

  if (!existing) {
    return c.json({ error: 'Team member not found' }, 404);
  }

  const updated = {
    ...existing,
    active: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`team_member:${id}`, updated);
  log.info('Team member soft-deleted', { id, name: existing.name });

  return c.json({ success: true, message: `${existing.name} removed from team page` });
}));

// ============================================================================
// CAREERS / JOB LISTING ENDPOINTS
// ============================================================================

interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /publications/careers — Public endpoint returning active job listings
 */
publications.get('/careers', async (c) => {
  try {
    const entries = await kv.getByPrefix('job_listing:');
    const listings = (entries as JobListing[])
      .filter((j) => j && j.id && j.active !== false)
      .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    return c.json({ success: true, data: listings });
  } catch (error) {
    log.error('Error fetching job listings', error);
    return c.json({ success: true, data: [] });
  }
});

/**
 * GET /publications/careers/admin — Admin endpoint returning all job listings
 */
publications.get('/careers/admin', requireAuth, asyncHandler(async (c) => {
  const entries = await kv.getByPrefix('job_listing:');
  const listings = (entries as JobListing[])
    .filter((j) => j && j.id)
    .sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
  return c.json({ success: true, data: listings, total: listings.length });
}));

/**
 * POST /publications/careers/admin — Create a new job listing
 */
publications.post('/careers/admin', requireAuth, asyncHandler(async (c) => {
  const body = await c.req.json();
  const { title, category, location, type: jobType, description, requirements, benefits, closingDate, sortOrder } = body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return c.json({ error: 'Title is required (min 3 characters)' }, 400);
  }
  if (!category || typeof category !== 'string') {
    return c.json({ error: 'Category is required' }, 400);
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const listing: JobListing = {
    id,
    title: title.trim(),
    category: category.trim(),
    location: location?.trim() || 'Pretoria, South Africa',
    type: jobType?.trim() || 'full-time',
    description: description?.trim() || '',
    requirements: Array.isArray(requirements) ? requirements : [],
    benefits: Array.isArray(benefits) ? benefits : [],
    closingDate: closingDate || '',
    active: true,
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 99,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await kv.set(`job_listing:${id}`, listing);
  log.info('Job listing created', { id, title: listing.title });
  return c.json({ success: true, data: listing });
}));

/**
 * PUT /publications/careers/admin/:id — Update a job listing
 */
publications.put('/careers/admin/:id', requireAuth, asyncHandler(async (c) => {
  const { id } = c.req.param();
  const existing = await kv.get(`job_listing:${id}`) as JobListing | null;
  if (!existing) return c.json({ error: 'Job listing not found' }, 404);

  const body = await c.req.json();
  const updated: JobListing = {
    ...existing,
    title: body.title?.trim() ?? existing.title,
    category: body.category?.trim() ?? existing.category,
    location: body.location?.trim() ?? existing.location,
    type: body.type?.trim() ?? existing.type,
    description: body.description?.trim() ?? existing.description,
    requirements: Array.isArray(body.requirements) ? body.requirements : existing.requirements,
    benefits: Array.isArray(body.benefits) ? body.benefits : existing.benefits,
    closingDate: body.closingDate ?? existing.closingDate,
    active: typeof body.active === 'boolean' ? body.active : existing.active,
    sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : existing.sortOrder,
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`job_listing:${id}`, updated);
  log.info('Job listing updated', { id, title: updated.title });
  return c.json({ success: true, data: updated });
}));

/**
 * DELETE /publications/careers/admin/:id — Soft-delete a job listing
 */
publications.delete('/careers/admin/:id', requireAuth, asyncHandler(async (c) => {
  const { id } = c.req.param();
  const existing = await kv.get(`job_listing:${id}`) as JobListing | null;
  if (!existing) return c.json({ error: 'Job listing not found' }, 404);

  const updated = {
    ...existing,
    active: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await kv.set(`job_listing:${id}`, updated);
  log.info('Job listing soft-deleted', { id, title: existing.title });
  return c.json({ success: true, message: `"${existing.title}" removed from careers page` });
}));

export default publications;
