/**
 * site-rebuild-trigger.ts — fire-and-forget Vercel Deploy Hook trigger.
 * ============================================================================
 *
 * The public site's SEO artifacts (sitemap.xml, prerendered article pages,
 * seo-route-manifest.json) are generated at Vercel build time from the set of
 * published articles. Publishing/unpublishing an article therefore requires a
 * site rebuild before search engines see the change. This module pings the
 * Vercel Deploy Hook configured via the `VERCEL_DEPLOY_HOOK_URL` secret so
 * article lifecycle changes trigger that rebuild automatically.
 *
 * Design constraints:
 * - Never blocks or fails the calling request: the fetch is not awaited by
 *   callers and all errors are swallowed (logged only).
 * - No-op when the secret is unset, so local/dev environments need no config.
 * - Coalesces rapid-fire triggers (e.g. the scheduler publishing several
 *   articles in one cron tick) within a short window; Vercel additionally
 *   dedupes queued builds for the same hook.
 * - Deliberately NOT built on webhook-service.ts: the deploy hook is
 *   idempotent and cheap to miss (the next publish or manual deploy catches
 *   up), so an outbox/retry queue would be complexity without benefit.
 */
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('site-rebuild-trigger');

/** Skip re-firing the hook when it already fired within this window. */
const COALESCE_WINDOW_MS = 30_000;

let lastFiredAt = 0;

/** Test-only: clear the coalescing state between test cases. */
export function resetSiteRebuildTriggerForTests(): void {
  lastFiredAt = 0;
}

/**
 * Ping the Vercel Deploy Hook so the public site rebuilds its SEO artifacts.
 * Fire-and-forget: returns immediately, never throws.
 *
 * @param reason Short human-readable cause (for logs), e.g. "article_published:<id>".
 */
export function triggerSiteRebuild(reason: string): void {
  try {
    const url = (Deno.env.get('VERCEL_DEPLOY_HOOK_URL') || '').trim();
    if (!url) {
      log.info(`Site rebuild skipped (${reason}): VERCEL_DEPLOY_HOOK_URL is not configured`);
      return;
    }

    const now = Date.now();
    if (now - lastFiredAt < COALESCE_WINDOW_MS) {
      log.info(`Site rebuild coalesced (${reason}): hook already fired recently`);
      return;
    }
    lastFiredAt = now;

    const request = fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    })
      .then((res) => {
        if (res.ok) {
          log.info(`Site rebuild triggered (${reason})`, { status: res.status });
        } else {
          log.warn(`Site rebuild hook responded with an error (${reason})`, {
            status: res.status,
          });
        }
        // Drain the body so the connection can be released.
        return res.body?.cancel();
      })
      .catch((err) => {
        log.error(`Site rebuild hook request failed (${reason})`, err);
      });

    // On the Supabase edge runtime an un-awaited promise may be cancelled when
    // the isolate finishes the request; waitUntil keeps it alive until settled.
    const edgeRuntime = (
      globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }
    ).EdgeRuntime;
    edgeRuntime?.waitUntil?.(request);
  } catch (err) {
    // Absolute backstop — a broken trigger must never break article writes.
    log.error(`Site rebuild trigger threw synchronously (${reason})`, err);
  }
}
