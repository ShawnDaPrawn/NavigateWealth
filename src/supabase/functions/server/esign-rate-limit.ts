/**
 * E-Sign Rate-Limit Middleware (Phase 0.3)
 *
 * Hono middleware factory that wraps `checkRateLimit()` from `rateLimiter.ts`
 * with esign-specific actions and identifier extraction. The plan calls for
 * limits keyed on `(route, signer_id, ip)`:
 *   • OTP send / verify          — per signer-token + per IP, strict
 *   • Signer access (validate)   — per envelope + per IP, lenient
 *   • Sender bulk operations     — per user, moderate
 *
 * IP fallback: if `x-forwarded-for` is missing (e.g. local dev), we fall back
 * to a stable per-process bucket so the limiter still works rather than
 * silently passing every request.
 *
 * @module server/esign-rate-limit
 */

import type { MiddlewareHandler } from 'npm:hono';
import { checkRateLimit, type RateLimitConfig } from './rateLimiter.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-rate-limit');

// ── Pre-tuned configs per action ──────────────────────────────────────────
// Numbers chosen to be:
//   • Tight enough to slow brute-force attacks on signing tokens / OTPs.
//   • Loose enough that legitimate retries on flaky mobile networks succeed.
//
// All windows / blocks are in milliseconds.
export const ESIGN_RATE_LIMITS = {
  /** Signer requests an OTP (we send an email/SMS). */
  OTP_SEND: {
    maxAttempts: 3,
    windowMs: 5 * 60 * 1000,        // 5 minutes
    blockDurationMs: 15 * 60 * 1000, // 15 minute block
  },
  /** Signer submits an OTP code for verification. */
  OTP_VERIFY: {
    maxAttempts: 6,
    windowMs: 15 * 60 * 1000,
    blockDurationMs: 60 * 60 * 1000,
  },
  /** Signer hits /signer/validate to open the envelope. */
  SIGNER_ACCESS: {
    maxAttempts: 30,
    windowMs: 5 * 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  },
  /** Signer tries to submit signed fields. */
  SIGNER_SUBMIT: {
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
    blockDurationMs: 30 * 60 * 1000,
  },
  /** Sender admin POSTing many envelopes / firing maintenance jobs. */
  SENDER_BULK: {
    maxAttempts: 30,
    windowMs: 60 * 1000,
    blockDurationMs: 60 * 1000,
  },
  /** Generic mutation guard — applied to most write endpoints. */
  SENDER_MUTATE: {
    maxAttempts: 120,
    windowMs: 60 * 1000,
    blockDurationMs: 60 * 1000,
  },
} as const satisfies Record<string, RateLimitConfig>;

export type EsignRateLimitAction = keyof typeof ESIGN_RATE_LIMITS;

/** Pulls a usable client identifier from the request — preferring the most
 *  specific identifier available so two callers can't share a bucket.
 *  Order: explicit signer-token > IP > 'unknown'. */
function defaultIdentifier(c: { req: { header: (n: string) => string | undefined; param: (n: string) => string | undefined } }): string {
  const token = c.req.param('token') || c.req.header('x-signer-token');
  if (token) return `tkn:${token.slice(0, 32)}`;
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    || c.req.header('x-real-ip')
    || 'noip';
  return `ip:${ip}`;
}

interface RateLimitMiddlewareOpts {
  /** Custom identifier extractor (e.g. user.id once auth has resolved). */
  identifier?: (c: any) => string | Promise<string>;
  /** When true, return 429 silently (no body) — useful for high-volume
   *  endpoints where we don't want to leak that limiting is happening. */
  silent?: boolean;
}

/**
 * Hono middleware factory.
 *
 *   esignRoutes.post(
 *     '/signer/:token/otp',
 *     rateLimit('OTP_SEND'),
 *     handler,
 *   );
 *
 * On hit: returns 429 with `Retry-After` and `X-RateLimit-*` headers.
 * On miss: continues to the next handler with the headers attached.
 */
export function rateLimit(
  action: EsignRateLimitAction,
  opts: RateLimitMiddlewareOpts = {},
): MiddlewareHandler {
  const config = ESIGN_RATE_LIMITS[action];
  return async (c, next) => {
    const id = await (opts.identifier ? opts.identifier(c) : Promise.resolve(defaultIdentifier(c)));
    const result = await checkRateLimit(id, action, config);

    c.header('X-RateLimit-Limit', String(config.maxAttempts));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

    if (!result.allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
      c.header('Retry-After', String(retryAfterSec));
      log.info('Rate limit blocked', { action, idHashPrefix: id.slice(0, 16) });
      if (opts.silent) {
        return c.body(null, 429);
      }
      return c.json(
        {
          error: result.reason ?? 'Too many requests. Please slow down and try again.',
          code: 'rate_limited',
          retryAfterSeconds: retryAfterSec,
        },
        429,
      );
    }

    await next();
  };
}
