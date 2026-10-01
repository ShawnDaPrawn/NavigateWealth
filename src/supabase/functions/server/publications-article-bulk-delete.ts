/**
 * Bulk article delete
 * ===================
 *
 * WHY THIS EXISTS (2026-10-01)
 * ----------------------------
 * The Articles list's "Delete selected" used to loop `DELETE /articles/:id`
 * one id at a time and refetch the entire article list twice after each one.
 * Deleting 120 drafts took 7.5 minutes: every id paid its own CORS preflight
 * (the browser caches a preflight per URL, and every id is a new URL) and its
 * own ~2 s request, while 225 full-list refetches ran alongside. The rows did
 * not leave the screen until the loop ended and the refresh spinner never
 * stopped. This does the same work in a handful of round-trips.
 *
 * LIVE ARTICLES ARE NEVER DELETED HERE
 * ------------------------------------
 * A published article is reported back as `kept` and left alone; deleting one
 * stays a deliberate, one-at-a-time act through `DELETE /articles/:id`. The
 * check is enforced twice: once on the rows as read, and again inside the
 * DELETE statement itself (`removeManyUnless`), so an article the scheduler
 * publishes between the read and the delete is kept as well.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { removeArticlesFromIndexInBackground } from './vasco-index-sync.ts';
import {
  ARTICLE_TAG_LINK_NAMESPACE,
  articleTagLinks,
  articles,
  deletedArticles,
} from './repositories/articles-repository.ts';
import type { Article, DeletedArticleRecord } from './publications-route-helpers.ts';

const log = createModuleLogger('publications-article-bulk-delete');

/**
 * Keys per KV round-trip. `getMany` and the deletes put every key into the
 * request URL (`key=in.(…)`); 50 article keys is about 2.5 kB of URL, where a
 * full 200-id request would be about 9 kB and risk a proxy's URL limit.
 */
const KV_BATCH_SIZE = 50;

/** Per-article tag-link lookups in flight at once. */
const TAG_LINK_LOOKUP_CONCURRENCY = 10;

export interface BulkDeleteArticlesResult {
  /** Deleted by this call. */
  deleted: string[];
  /** Published (live) articles, left untouched. */
  kept: string[];
  /** Already gone: deleted earlier, or never existed. Safe to treat as deleted. */
  notFound: string[];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function removeTagLinks(articleIds: readonly string[]): Promise<void> {
  const linkIds: string[] = [];
  for (const batch of chunk(articleIds, TAG_LINK_LOOKUP_CONCURRENCY)) {
    const rows = await Promise.all(
      batch.map((id) => articleTagLinks.listWithKeys('bulk article delete: tag links', `${id}:`)),
    );
    for (const row of rows.flat()) {
      linkIds.push(row.key.slice(ARTICLE_TAG_LINK_NAMESPACE.length));
    }
  }
  for (const batch of chunk(linkIds, KV_BATCH_SIZE)) {
    await articleTagLinks.removeMany(batch);
  }
}

export async function bulkDeleteArticles(
  ids: readonly string[],
  actorId: string,
): Promise<BulkDeleteArticlesResult> {
  const unique = [...new Set(ids)];

  const found: Array<{ id: string; article: Article }> = [];
  const notFound: string[] = [];
  for (const batch of chunk(unique, KV_BATCH_SIZE)) {
    const rows = await articles.getMany(batch);
    rows.forEach((article, i) => {
      if (article) found.push({ id: batch[i], article });
      else notFound.push(batch[i]);
    });
  }

  const kept = found.filter((f) => f.article.status === 'published').map((f) => f.id);
  const candidates = found.filter((f) => f.article.status !== 'published');

  const removed = new Set<string>();
  for (const batch of chunk(candidates, KV_BATCH_SIZE)) {
    const ids = await articles.removeManyUnless(
      batch.map((c) => c.id),
      { field: 'status', equals: 'published' },
    );
    ids.forEach((id) => removed.add(id));
  }

  const deleted = candidates.filter((c) => removed.has(c.id));
  // A candidate the guarded delete did not remove changed under us — most
  // likely published by the scheduler — so it is reported as kept.
  for (const c of candidates) {
    if (!removed.has(c.id)) kept.push(c.id);
  }

  if (deleted.length === 0) {
    return { deleted: [], kept, notFound };
  }

  // Tombstones are written after the delete, and only for rows actually
  // removed, so a kept article never gains one.
  const deletedAt = new Date().toISOString();
  for (const batch of chunk(deleted, KV_BATCH_SIZE)) {
    await deletedArticles.putMany(
      batch.map(({ id, article }): [string, DeletedArticleRecord] => [
        id,
        {
          id,
          title: article.title,
          slug: article.slug,
          published_at: article.published_at ?? null,
          deleted_at: deletedAt,
          deleted_by: actorId,
          previous_status: article.status,
        },
      ]),
    );
  }

  const deletedIds = deleted.map((d) => d.id);
  await removeTagLinks(deletedIds);
  await removeArticlesFromIndexInBackground(deletedIds, 'article_bulk_deleted');

  // One entry for the whole batch. Audit keys are `<timestamp>:<actorId>`, so
  // one entry per article written in the same millisecond would overwrite
  // each other.
  await AdminAuditService.record({
    actorId,
    actorRole: 'admin',
    category: 'configuration',
    action: 'articles_bulk_deleted',
    summary: `${deleted.length} article(s) deleted in bulk`,
    severity: 'warning',
    entityType: 'article',
    metadata: {
      deletedAt,
      articles: deleted.map(({ id, article }) => ({
        id,
        title: article.title,
        previousStatus: article.status,
      })),
      kept,
      notFound,
    },
  }).catch(() => {});

  log.info('Bulk article delete', {
    deleted: deleted.length,
    kept: kept.length,
    notFound: notFound.length,
  });

  return { deleted: deletedIds, kept, notFound };
}
