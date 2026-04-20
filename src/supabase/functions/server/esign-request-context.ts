/**
 * E-Sign Request Context (Phase 0.4)
 *
 * Thin helpers that bridge the Hono request to our structured logger so
 * every esign log line carries the `x-request-id` set by the global
 * middleware in `index.tsx`. This was the missing 50% of Phase 0.4 — the
 * request-id was being set on the response header but never reached the
 * log stream.
 *
 * Usage:
 *
 *   import { withCtx } from './esign-request-context.ts';
 *   const log = createModuleLogger('esign-routes');
 *   ...
 *   const ctx = withCtx(c, { action: 'envelope.create', userId });
 *   log.info('Creating envelope', ctx);
 *
 * The returned object is a plain `LogContext` so it composes naturally
 * with downstream `log.error(msg, err, ctx)` calls.
 *
 * @module server/esign-request-context
 */

import type { Context } from 'npm:hono';
import type { LogContext } from './shared-logger-types.ts';

/** Extract the request-id set by the global middleware. */
export function getRequestId(c: Context | { get: (k: string) => unknown }): string | undefined {
  const v = (c as { get: (k: string) => unknown }).get('requestId');
  return typeof v === 'string' ? v : undefined;
}

/** Build a `LogContext` pre-populated with the request-id. */
export function withCtx(
  c: Context | { get: (k: string) => unknown },
  extra: LogContext = {},
): LogContext {
  const requestId = getRequestId(c);
  return requestId ? { ...extra, requestId } : extra;
}

/** Convenience: build a LogContext without a Hono context (for jobs / cron). */
export function jobCtx(jobName: string, extra: LogContext = {}): LogContext {
  return {
    ...extra,
    requestId: `job:${jobName}:${crypto.randomUUID().slice(0, 8)}`,
    module: extra.module ?? jobName,
  };
}
