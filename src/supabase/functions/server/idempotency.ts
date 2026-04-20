/**
 * Idempotency Middleware (Phase 0.2)
 *
 * Implements RFC-style `Idempotency-Key` header support for mutating
 * endpoints. The first request with a given key executes normally; the
 * cached response is replayed for any subsequent request with the SAME key
 * for `IDEMPOTENCY_TTL_MS` (24h by default).
 *
 * Why this matters for e-signatures specifically:
 *   • Network retries after a 502 must not create duplicate envelopes.
 *   • Double-clicked "Send" buttons must not double-charge or double-mail.
 *   • Mobile clients on flaky connections frequently retry POSTs.
 *
 * Storage: KV-backed for now (cluster-wide via Supabase). Migration to
 * Postgres is straightforward once the dual-write window in Phase 0.1
 * lands — the interface stays identical.
 *
 * Scope: ANY route can opt-in via the `requireIdempotency()` middleware
 * factory below. Idempotency is OPTIONAL on a per-request basis — the
 * client must send the header. This matches Stripe / GitHub semantics:
 *   • No header → behave as before (legacy callers keep working).
 *   • Header sent → guaranteed at-most-once over the TTL.
 *
 * Conflict semantics (per Stripe's spec):
 *   • Same key + same body → replay original response.
 *   • Same key + DIFFERENT body → 409 (a misuse signal to the caller).
 *   • Same key + in-flight first request → 409 with retry-after hint
 *     (rather than fan-out, which is hard to reason about).
 *
 * @module server/idempotency
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import type { Context, MiddlewareHandler } from 'npm:hono';

const log = createModuleLogger('idempotency');

const IDEMPOTENCY_PREFIX = 'idempotency:';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const IN_FLIGHT_TTL_MS = 60 * 1000;             // 60s safety net for crashed handlers

/** Maximum stored response body size in bytes (256 KB).
 *  Larger responses bypass the cache and execute every retry — safer than
 *  filling KV with massive payloads. */
const MAX_CACHED_BODY_BYTES = 256 * 1024;

/** Loose key shape — UUIDs, ULIDs, opaque tokens are all fine.
 *  Reject anything obviously malicious (CRLF injection / path traversal). */
const KEY_PATTERN = /^[A-Za-z0-9_\-]{8,128}$/;

interface CachedRecord {
  /** Stable hash of the request body — used for "same key, different body" detection. */
  bodyHash: string;
  /** HTTP status to replay. */
  status: number;
  /** Response body to replay (string; may be JSON). */
  body: string;
  /** Recorded `content-type` so the replay matches exactly. */
  contentType: string;
  /** When the original request finished. */
  completedAt: number;
  /** When the cached entry expires. */
  expiresAt: number;
}

interface InFlightMarker {
  startedAt: number;
  expiresAt: number;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Compose the storage key. We bind the path so two endpoints can't
 *  collide on the same key (e.g. someone using "abc" for both /send and
 *  /void). */
function recordKey(path: string, key: string): string {
  return `${IDEMPOTENCY_PREFIX}${path}:${key}`;
}

/**
 * Hono middleware: enforce idempotency when an `Idempotency-Key` is sent.
 *
 * Usage:
 *   esignRoutes.post('/envelopes', requireIdempotency(), async (c) => { ... })
 *
 * If you want to ALWAYS require the header (e.g. on /send), pass
 * `{ required: true }`.
 */
export function requireIdempotency(opts?: { required?: boolean }): MiddlewareHandler {
  const required = opts?.required ?? false;

  return async (c, next) => {
    const key = c.req.header('Idempotency-Key') ?? c.req.header('idempotency-key');

    if (!key) {
      if (required) {
        return c.json(
          { error: 'Idempotency-Key header is required for this endpoint' },
          400,
        );
      }
      return next();
    }

    if (!KEY_PATTERN.test(key)) {
      return c.json(
        { error: 'Idempotency-Key must be 8-128 chars, [A-Za-z0-9_-] only' },
        400,
      );
    }

    const path = new URL(c.req.url).pathname;
    const storeKey = recordKey(path, key);

    // Capture the raw body once so we can:
    //   1. Hash it for body-mismatch detection.
    //   2. Replay it back into the handler (Hono only lets you read once).
    const rawBody = await c.req.text();
    const bodyHash = await sha256Hex(rawBody);

    // Re-attach the body for downstream handlers — Hono doesn't expose a
    // public way to do this, so we wrap the underlying Request.
    const originalReq = c.req.raw;
    const replay = new Request(originalReq.url, {
      method: originalReq.method,
      headers: originalReq.headers,
      body: rawBody.length === 0 ? null : rawBody,
    });
    // Hono's `req.raw` is read-only in the type defs but mutable at runtime;
    // this is the documented escape hatch for body re-reads. We cast through
    // `unknown` so the assignment compiles whether or not the npm:hono types
    // resolve in the host TS project (Deno tsc resolves them, Node tsc does
    // not — both must build).
    (c.req as unknown as { raw: Request }).raw = replay;

    // ── Existing record? ──
    const cached = (await kv.get(storeKey)) as CachedRecord | InFlightMarker | null;

    if (cached) {
      const now = Date.now();
      // In-flight marker (no body field)
      if (!('body' in cached)) {
        if (cached.expiresAt > now) {
          c.header('Retry-After', '5');
          return c.json(
            { error: 'A request with this Idempotency-Key is still in progress', code: 'idempotency_in_progress' },
            409,
          );
        }
        // Stale in-flight marker — let this attempt take over.
      } else {
        if (cached.expiresAt > now) {
          if (cached.bodyHash !== bodyHash) {
            log.warn('Idempotency-Key body mismatch', { path, keyHashPrefix: bodyHash.slice(0, 8) });
            return c.json(
              { error: 'Idempotency-Key was reused with a different request body', code: 'idempotency_body_mismatch' },
              409,
            );
          }
          // Replay the original response verbatim.
          c.header('Idempotency-Replayed', 'true');
          c.header('Content-Type', cached.contentType);
          return c.body(cached.body, cached.status);
        }
        // Expired — fall through and re-execute.
      }
    }

    // Mark in-flight so a parallel retry sees a clean 409 instead of racing.
    const now = Date.now();
    await kv.set(storeKey, {
      startedAt: now,
      expiresAt: now + IN_FLIGHT_TTL_MS,
    } satisfies InFlightMarker);

    await next();

    // ── Persist the response ──
    // Hono's `c.res` is the canonical response object the framework will
    // send. Read once, store, then re-attach a fresh Response (since we
    // consumed the body).
    const res = c.res;
    if (!res) return;

    const contentType = res.headers.get('content-type') ?? 'application/json';
    let body = '';
    try {
      body = await res.clone().text();
    } catch (err) {
      log.warn('Failed to capture idempotent response body', { err });
      // Drop the in-flight marker so the next retry can proceed.
      await kv.del(storeKey);
      return;
    }

    if (body.length > MAX_CACHED_BODY_BYTES) {
      log.info('Idempotent response too large — not caching', { path, sizeBytes: body.length });
      await kv.del(storeKey);
      return;
    }

    // Only cache "settled" responses. 5xx + 429 are likely transient and the
    // caller SHOULD retry — caching them defeats the purpose.
    if (res.status >= 500 || res.status === 429) {
      await kv.del(storeKey);
      return;
    }

    const completedAt = Date.now();
    await kv.set(storeKey, {
      bodyHash,
      status: res.status,
      body,
      contentType,
      completedAt,
      expiresAt: completedAt + IDEMPOTENCY_TTL_MS,
    } satisfies CachedRecord);
  };
}

/**
 * Manual purge — exposed mainly for tests; production code should let TTLs
 * expire naturally.
 */
export async function _purgeIdempotencyKey(path: string, key: string): Promise<void> {
  await kv.del(recordKey(path, key));
}
