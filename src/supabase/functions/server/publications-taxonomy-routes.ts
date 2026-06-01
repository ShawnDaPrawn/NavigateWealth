/**
 * publications-taxonomy-routes.ts — article categories + types CRUD (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', taxonomyRoutes)`. Behaviour-preserving; the
 * publications route contract suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { generateId, generateSlug } from './publications-route-helpers.ts';
import type { Article, ArticleCategory, ArticleType } from './publications-route-helpers.ts';

const log = createModuleLogger('publications-taxonomy-routes');

const taxonomyRoutes = new Hono();

// ============================================================================
// CATEGORIES ROUTES
// ============================================================================

taxonomyRoutes.get('/categories', async (c) => {
  try {
    const categories = await kv.getByPrefix('article_category:');
    const articles = await kv.getByPrefix('article:');

    // Filter only published articles for counts
    const publishedArticles = articles.filter((a: Article) => a.status === 'published');

    // Add article counts to each category
    const categoriesWithCounts = categories.map((category: ArticleCategory) => {
      const article_count = publishedArticles.filter(
        (a: Article) => a.category_id === category.id,
      ).length;

      return {
        ...category,
        article_count,
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

taxonomyRoutes.get('/categories/:id', async (c) => {
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

taxonomyRoutes.post('/categories', async (c) => {
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

taxonomyRoutes.put('/categories/:id', async (c) => {
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

taxonomyRoutes.delete('/categories/:id', async (c) => {
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

taxonomyRoutes.get('/types', async (c) => {
  try {
    const types = await kv.getByPrefix('article_type:');
    return c.json({ success: true, data: types });
  } catch (error) {
    log.error('Error fetching types', error);
    return c.json({ success: false, error: 'Failed to fetch types' }, 500);
  }
});

taxonomyRoutes.get('/types/:id', async (c) => {
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

taxonomyRoutes.post('/types', async (c) => {
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

taxonomyRoutes.put('/types/:id', async (c) => {
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

taxonomyRoutes.delete('/types/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`article_type:${id}`);
    return c.json({ success: true });
  } catch (error) {
    log.error('Error deleting type', error);
    return c.json({ success: false, error: 'Failed to delete type' }, 500);
  }
});

export default taxonomyRoutes;
