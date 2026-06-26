import React from 'react';
import { isChunkLoadError, reloadOnceForChunkLoadFailure } from './chunkLoad';
import { logger } from './logger';

interface LazyRetryOptions {
  /** Number of additional attempts after the first failure. */
  retries?: number;
  /** Base backoff between attempts; grows linearly per attempt. */
  baseDelayMs?: number;
}

/**
 * Drop-in replacement for `React.lazy` that transparently retries the dynamic
 * import when it fails for chunk-load reasons.
 *
 * Why: every route is code-split, so each navigation fetches a JS chunk. On a
 * flaky connection a single dropped request would otherwise propagate straight
 * to the error boundary and show a "Page Error" card mid-navigation. Retrying
 * recovers in place — React keeps showing the Suspense fallback (the branded
 * loader) the whole time, so the user just sees a normal load, never an error.
 *
 * Recovery ladder:
 *   1. Retry the import a few times with a short linear backoff (transient blip).
 *   2. If every retry still fails with a chunk-load error, reload once to fetch
 *      the freshly deployed app shell (stale-deploy case). While the reload is
 *      in flight we keep the promise pending so Suspense holds the loader rather
 *      than flashing the error card.
 *   3. If even that is throttled (already reloaded recently), rethrow so the
 *      error boundary can show its "a new version is available" message as a
 *      genuine last resort.
 *
 * A non-chunk error (a real bug inside the module) is rethrown immediately —
 * retrying would not help and the error boundary should surface it.
 */
export function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  { retries = 3, baseDelayMs = 300 }: LazyRetryOptions = {},
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;

        if (!isChunkLoadError(error)) {
          throw error;
        }

        if (attempt < retries) {
          logger.warn('Chunk load failed — retrying dynamic import', {
            attempt: attempt + 1,
            retries,
          });
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
        }
      }
    }

    // Every retry failed on a chunk-load error. The tab is most likely running
    // an outdated app shell after a deploy — reload once to pick up the new one.
    logger.error('Chunk load failed after retries — attempting recovery reload', lastError);
    if (reloadOnceForChunkLoadFailure()) {
      // Keep Suspense showing the branded loader (not the error card) while the
      // full-page reload navigates away by never settling this promise.
      await new Promise<never>(() => {});
    }

    throw lastError;
  });
}
