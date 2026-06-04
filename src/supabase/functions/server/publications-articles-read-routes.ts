/**
 * publications-articles-read-routes.ts — article read surface: list, by-id,
 * by-slug, and legacy /slug (Phase 7 max-lines split). Extracted verbatim from
 * publications-articles-routes.ts; mounted via
 * `articlesRoutes.route('/', articlesReadRoutes)`. Pure kv reads — no auth
 * middleware (published-article reads are public). Behaviour-preserving.
 */
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import {
  type Article,
  type ArticleCategory,
  type ArticleType,
} from './publications-route-helpers.ts';

const log = createModuleLogger('publications-articles-read-routes');

const articlesReadRoutes = new Hono();

articlesReadRoutes.get('/articles', async (c) => {
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

articlesReadRoutes.get('/articles/:id', async (c) => {
  try {
    const id = c.req.param('id')!;
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

articlesReadRoutes.get('/articles/by-slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')!;
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

articlesReadRoutes.get('/articles/slug/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')!;
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

export default articlesReadRoutes;
