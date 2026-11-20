/**
 * publications-route-helpers.ts — shared types, constants, and pure helpers for
 * the publications Edge Function routes (Phase 5c decomposition).
 * ============================================================================
 *
 * Extracted verbatim from publications-routes.ts so the route sub-apps can
 * import them without a cycle back through the composition root: the article /
 * category / type / tag domain interfaces, the cron-auth constants +
 * isAuthorizedPublicationsCronRequest, and the pure id / slug / reading-time +
 * article-tracking helpers. Behaviour-preserving; the publications route
 * contract suite + `deno check` guard the move.
 */
import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import {
  processArticleNotificationJobs,
  getArticleNotificationJob,
} from './publications-notification-service.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('publications-route-helpers');

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
  press_category?:
    'company_news' | 'product_launch' | 'awards' | 'team_news' | 'industry_insights' | null;
}

export const PUBLICATIONS_CRON_AUTH_KEY = 'system:publications:cron_auth_token';
export const PUBLICATIONS_CRON_SHARED_HEADER = 'x-publications-cron-auth';

export interface DeletedArticleRecord {
  id: string;
  title: string;
  slug: string;
  published_at?: string | null;
  deleted_at: string;
  deleted_by: string;
  previous_status: Article['status'];
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

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * The article fields anyone may read. Public reads return exactly these; an
 * admin session gets the whole record.
 *
 * An allow-list on purpose. Article records also carry editorial working
 * fields no public page shows: the research pipeline's `internal_*` notes,
 * source URLs, relevance scores and image briefs, plus `last_edited_by` and
 * `author_id`. Until 2026-11 the public reads returned all of them to anyone.
 * Naming what is public, rather than what is not, keeps the next such field
 * private by default. A field a public page needs must be added here.
 */
export const PUBLIC_ARTICLE_FIELDS = [
  'id',
  'slug',
  'title',
  'subtitle',
  'excerpt',
  'body',
  'status',
  'author_name',
  'hero_image_url',
  'thumbnail_image_url',
  'reading_time_minutes',
  'is_featured',
  'press_category',
  'view_count',
  'published_at',
  'created_at',
  'updated_at',
  'seo_title',
  'seo_description',
  'seo_canonical_url',
  'category_id',
  'category_name',
  'category_slug',
  'type_id',
  'type_name',
  'type_slug',
] as const;

/** The public view of an article record (see PUBLIC_ARTICLE_FIELDS). */
export function toPublicArticle(article: object): Record<string, unknown> {
  const source = article as Record<string, unknown>;
  const publicView: Record<string, unknown> = {};
  for (const field of PUBLIC_ARTICLE_FIELDS) {
    if (source[field] !== undefined) publicView[field] = source[field];
  }
  return publicView;
}

export function articleTrackingDetails(article: Article | null) {
  if (!article) return null;

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    published_at: article.published_at,
  };
}

export function deletedArticleTrackingDetails(article: DeletedArticleRecord | null) {
  if (!article) return null;

  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    published_at: article.published_at || undefined,
  };
}

export async function isAuthorizedPublicationsCronRequest(
  authToken: string,
  sharedToken?: string | null,
): Promise<boolean> {
  const normalizedAuthToken = authToken.trim();
  const normalizedSharedToken = (sharedToken || '').trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const superAdminPw = Deno.env.get('SUPER_ADMIN_PASSWORD') || '';
  // Constant-time, matching cron-auth.ts (M-1).
  if (
    (serviceRoleKey !== '' && constantTimeEqual(normalizedAuthToken, serviceRoleKey)) ||
    (superAdminPw !== '' && constantTimeEqual(normalizedAuthToken, superAdminPw))
  ) {
    return true;
  }

  try {
    const sharedCronToken = await kv.get(PUBLICATIONS_CRON_AUTH_KEY);
    return (
      typeof sharedCronToken === 'string' &&
      sharedCronToken.trim().length > 0 &&
      normalizedSharedToken.length > 0 &&
      constantTimeEqual(normalizedSharedToken, sharedCronToken)
    );
  } catch (error) {
    log.warn('Unable to load publications cron auth token from KV', {
      error: getErrMsg(error),
    });
    return false;
  }
}

export async function kickArticleNotificationJob(jobId: string | null | undefined) {
  if (!jobId) return null;

  try {
    const result = await processArticleNotificationJobs({
      jobId,
      maxJobs: 1,
      maxBatchesPerJob: 1,
    });

    return result.jobs[0] ?? (await getArticleNotificationJob(jobId));
  } catch (error) {
    log.warn('Failed to kick article notification job immediately', {
      jobId,
      error: getErrMsg(error),
    });
    return null;
  }
}
