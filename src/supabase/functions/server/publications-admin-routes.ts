/**
 * publications-admin-routes.ts — stats, seed/initialize, export/import, draft
 * maintenance, hero-image upload, and the simple send-notifications email
 * (Phase 5c).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.tsx; mounted via
 * `publications.route('/', adminRoutes)`. Owns the lazy Supabase client
 * (storage + auth.admin) used only by this admin surface. Behaviour-preserving;
 * the publications route contract suite + `deno check` guard the move.
 */
import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { sendEmail } from './email-service.ts';
import { createArticleNotificationEmail } from './article-notification-template.ts';
import { SITE_ORIGIN_APEX } from '../../../utils/siteOrigin.ts';
import { requireAdmin } from './auth-mw.ts';
import {
  generateId,
  generateSlug,
  type Article,
  type ArticleCategory,
  type ArticleType,
} from './publications-route-helpers.ts';

const log = createModuleLogger('publications-admin-routes');

const adminRoutes = new Hono();

// Lazy Supabase client — must NOT be top-level to avoid deployment crashes in edge functions.
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

// ============================================================================
// STATISTICS ROUTE
// ============================================================================

adminRoutes.get('/stats', requireAdmin, async (c) => {
  try {
    const [articles, categories, types] = await Promise.all([
      kv.getByPrefix('article:'),
      kv.getByPrefix('article_category:'),
      kv.getByPrefix('article_type:'),
    ]);

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
      (a: Article) => a.status === 'published' && a.published_at && a.published_at >= sevenDaysAgo,
    ).length;
    const recentUpdated = articles.filter((a: Article) => a.updated_at >= sevenDaysAgo).length;

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

adminRoutes.post('/initialize', requireAdmin, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const shouldCreateCategories = body?.create_default_categories !== false;
    const shouldCreateTypes = body?.create_default_types !== false;

    // Check current state and backfill anything missing.
    const [existingCategories, existingTypes] = await Promise.all([
      kv.getByPrefix('article_category:'),
      kv.getByPrefix('article_type:'),
    ]);

    const needsCategories = existingCategories.length === 0 && shouldCreateCategories;
    const needsTypes = existingTypes.length === 0 && shouldCreateTypes;

    if (!needsCategories && !needsTypes) {
      return c.json({
        success: true,
        message: 'Publications system already initialized',
        data: {
          created: {
            categories: 0,
            types: 0,
          },
          has_categories: existingCategories.length > 0,
          has_types: existingTypes.length > 0,
        },
      });
    }

    const now = new Date().toISOString();

    let createdCategories = 0;
    let createdTypes = 0;

    if (needsCategories) {
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
        createdCategories++;
      }
    }

    if (needsTypes) {
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
        createdTypes++;
      }
    }

    return c.json({
      success: true,
      message: 'Publications system initialized successfully',
      data: {
        created: {
          categories: createdCategories,
          types: createdTypes,
        },
        has_categories: existingCategories.length > 0 || createdCategories > 0,
        has_types: existingTypes.length > 0 || createdTypes > 0,
      },
    });
  } catch (error) {
    log.error('Error initializing publications', error);
    return c.json({ success: false, error: 'Failed to initialize publications' }, 500);
  }
});

// Export all articles (for backup/migration)
adminRoutes.get('/export', requireAdmin, async (c) => {
  try {
    const [articles, categories, types] = await Promise.all([
      kv.getByPrefix('article:'),
      kv.getByPrefix('article_category:'),
      kv.getByPrefix('article_type:'),
    ]);

    const exportData = {
      version: '1.0.0',
      exported_at: new Date().toISOString(),
      data: {
        articles: articles || [],
        categories: categories || [],
        types: types || [],
      },
    };

    return c.json({ success: true, data: exportData });
  } catch (error) {
    log.error('Error exporting data:', error);
    return c.json({ success: false, error: 'Failed to export data' }, 500);
  }
});

// Import articles (from backup/migration)
adminRoutes.post('/import', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.data) {
      return c.json({ success: false, error: 'Invalid import data format' }, 400);
    }

    const imported = {
      articles: 0,
      categories: 0,
      types: 0,
    };

    // Import categories
    if (body.data.categories && Array.isArray(body.data.categories)) {
      for (const category of body.data.categories) {
        await kv.set(`article_category:${category.id}`, category);
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
      imported,
    });
  } catch (error) {
    log.error('Error importing data:', error);
    return c.json({ success: false, error: 'Failed to import data' }, 500);
  }
});

// Clear all drafts (maintenance operation)
adminRoutes.delete('/maintenance/clear-drafts', requireAdmin, async (c) => {
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
      message: `Deleted ${deleted} draft articles`,
    });
  } catch (error) {
    log.error('Error clearing drafts:', error);
    return c.json({ success: false, error: 'Failed to clear drafts' }, 500);
  }
});

// Image upload endpoint
adminRoutes.post('/upload-image', requireAdmin, async (c) => {
  try {
    const bucketName = 'make-91ed8379-publications';

    // Ensure bucket exists
    const { data: buckets } = await getSupabase().storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === bucketName);

    if (!bucketExists) {
      const { error: createError } = await getSupabase().storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
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
    const { error: uploadError } = await getSupabase()
      .storage.from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      log.error('Upload error:', uploadError);
      return c.json({ success: false, error: uploadError.message }, 500);
    }

    // Get public URL
    const { data: urlData } = getSupabase().storage.from(bucketName).getPublicUrl(filePath);

    return c.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath,
      },
    });
  } catch (error) {
    log.error('Error uploading image:', error);
    return c.json({ success: false, error: 'Failed to upload image' }, 500);
  }
});

// Send article notification to user groups
adminRoutes.post('/articles/:id/send-notifications', requireAdmin, async (c) => {
  try {
    const articleId = c.req.param('id')!;
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

    // Build article URL on the apex origin (NOT www) so the link is outside the
    // installed PWA's scope and always opens in the browser instead of being
    // captured into the portal-only app. The apex 301-redirects to the canonical
    // www URL in-browser. See SITE_ORIGIN_APEX.
    const articleUrl = `${SITE_ORIGIN_APEX}/resources/article/${article.slug}`;

    // Get all users from Supabase Auth
    const {
      data: { users },
      error: usersError,
    } = await getSupabase().auth.admin.listUsers();
    if (usersError) {
      log.error('Error fetching users:', usersError);
      return c.json({ success: false, error: 'Failed to fetch users' }, 500);
    }

    // Create a map of users by ID for quick lookup
    const userMap = new Map<
      string,
      { id: string; email: string; emailVerified: boolean; firstName: string; lastName: string }
    >();
    users.forEach((user) => {
      userMap.set(user.id, {
        id: user.id,
        email: user.email ?? '',
        emailVerified: user.email_confirmed_at !== null,
        firstName:
          (user.user_metadata?.firstName as string) ||
          (user.user_metadata?.first_name as string) ||
          'Valued Client',
        lastName:
          (user.user_metadata?.surname as string) || (user.user_metadata?.lastName as string) || '',
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
              firstName: user.firstName,
            });
          }
        }
      }
    }

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      return c.json(
        {
          success: false,
          error: 'No verified recipients found in the selected groups',
        },
        400,
      );
    }

    // Send emails
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        const unsubscribeUrl = `https://www.navigatewealth.co/newsletter/unsubscribe?email=${encodeURIComponent(recipient.email)}`;
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
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    log.error('Error sending article notifications:', error);
    return c.json({ success: false, error: 'Failed to send notifications' }, 500);
  }
});

export default adminRoutes;
