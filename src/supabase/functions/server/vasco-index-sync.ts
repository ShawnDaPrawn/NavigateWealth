/**
 * Vasco index sync — fire-and-forget hooks for the Publications routes.
 *
 * Publishing an article used to leave Vasco's knowledge index untouched until
 * an admin remembered to press "re-index". These helpers let the article
 * routes keep the index current without taking the embedding call (and its
 * failure modes) onto the request path: they schedule the work, log a
 * warning if it fails, and never throw.
 *
 * Kept in its own module so the Publications contract tests can stub it out
 * with one line instead of pulling the whole RAG service into their graph.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { removeArticleFromIndex, syncArticle } from './vasco-rag-service.ts';

const log = createModuleLogger('vasco-index-sync');

interface SyncableArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  body?: string;
  content?: string;
  excerpt?: string;
}

/**
 * Re-embed a published article (or drop it from the index if it is no longer
 * published). Safe to call on every article write.
 */
export function syncArticleIndexInBackground(article: SyncableArticle, reason: string): void {
  Promise.resolve()
    .then(() => syncArticle(article))
    .then((result) => {
      log.info('Article index sync complete', { id: article.id, reason, ...result });
    })
    .catch((err) => {
      log.warn('Article index sync failed (non-fatal — rebuild from AI Management → Knowledge)', {
        id: article.id,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

/** Drop a deleted article from the index. Safe to call for un-indexed ids. */
export function removeArticleFromIndexInBackground(articleId: string, reason: string): void {
  Promise.resolve()
    .then(() => removeArticleFromIndex(articleId))
    .catch((err) => {
      log.warn('Article index removal failed (non-fatal)', {
        id: articleId,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
