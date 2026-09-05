/**
 * Vasco index sync — background hooks for the Publications routes.
 *
 * Publishing an article used to leave Vasco's knowledge index untouched until
 * an admin remembered to press "re-index". These helpers let the article
 * routes keep the index current without taking the embedding call (and its
 * failure modes) onto the request path.
 *
 * A bare un-awaited promise is not enough on the Supabase edge runtime: the
 * isolate may suspend as soon as the response is returned, and the sync would
 * stop at its first KV/OpenAI await — an unpublished article could stay
 * retrievable. So the work is registered with `EdgeRuntime.waitUntil`, the
 * supported way to keep work alive past the response; where that hook does
 * not exist (Vitest, a plain Deno process) the returned promise is the work
 * itself and callers `await` it. Either way the promise never rejects.
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
 * Keep `work` alive past the response. Returns a promise the caller should
 * await: already-resolved when the runtime took ownership of the work,
 * otherwise the work itself.
 */
function keepAlive(work: Promise<void>): Promise<void> {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;

  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(work);
    return Promise.resolve();
  }
  return work;
}

/**
 * Re-embed a published article (or drop it from the index if it is no longer
 * published). Safe to call on every article write; never rejects.
 */
export function syncArticleIndexInBackground(
  article: SyncableArticle,
  reason: string,
): Promise<void> {
  const work = Promise.resolve()
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
  return keepAlive(work);
}

/** Drop a deleted article from the index. Safe for un-indexed ids; never rejects. */
export function removeArticleFromIndexInBackground(
  articleId: string,
  reason: string,
): Promise<void> {
  const work = Promise.resolve()
    .then(() => removeArticleFromIndex(articleId))
    .catch((err) => {
      log.warn('Article index removal failed (non-fatal)', {
        id: articleId,
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  return keepAlive(work);
}
