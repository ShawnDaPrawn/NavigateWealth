/**
 * AI usage limits for the AUTHENTICATED surfaces.
 * ===============================================
 *
 * WHAT WAS MISSING
 * ----------------
 * `vasco-guardrails.ts` gives the logged-out Ask Vasco experience a real
 * budget: per-visitor and per-IP daily caps, a burst window, an estimated
 * token ceiling and a circuit breaker. Every AI surface BEHIND authentication
 * had none of that. Their only bound was the per-call `max_tokens` on each
 * OpenAI request, which caps the size of one answer and says nothing about how
 * many answers one account may ask for.
 *
 * The exposure is not abuse by strangers — these routes all require a valid
 * session — it is that a single credential is enough to spend without limit.
 * One phished adviser login, one leaked service account, or one client-side
 * retry loop shipped by accident, and the bill is bounded only by how long it
 * takes someone to notice. Metered third-party spend needs a cap in the same
 * way that a database needs a connection limit.
 *
 * WHY IT IS A SEPARATE MODULE FROM `esign-rate-limit.ts`
 * -----------------------------------------------------
 * Same underlying counter (`checkRateLimit`, the atomic Postgres RPC, which
 * fails CLOSED), different identity. The e-sign limiter keys on a signer token
 * or an IP, because its callers are anonymous signers. These routes always
 * have an authenticated principal, and the meaningful unit of spend is the
 * ACCOUNT — an adviser on a phone, a laptop and an office desktop is one payer
 * on three IPs, and an office behind one NAT is many payers on one IP. Keying
 * this on IP would throttle the wrong people and miss the actual case.
 *
 * HOW THE PRINCIPAL IS RESOLVED
 * -----------------------------
 * From the `sub` claim of the bearer token, read locally without a network
 * call — see `readTokenSubject`. This middleware runs BEFORE the sub-router's
 * own `requireAuth`, which is what verifies the signature, so the claim it
 * reads is unverified at this point.
 *
 * That is sound here, and the reason is worth stating plainly. A forged token
 * buys a fresh counter, but the request it is attached to is rejected by
 * `requireAuth` moments later and never reaches OpenAI — so the forger has
 * bought a free bucket for requests that cost nothing. The counter exists to
 * bound SPEND, and only a genuine token can cause spend. The IP dimension
 * below still bounds the volume of forged attempts.
 *
 * DEFAULTS, AND WHY THEY ARE WHERE THEY ARE
 * -----------------------------------------
 * Set to sit well above real use and well below a runaway: an adviser working
 * hard through a day of drafting might reach a few dozen AI calls, so the
 * daily cap is several times that, while still turning an unattended loop into
 * a bounded incident. Every value is env-overridable so a limit can be raised
 * during an incident without a deploy.
 *
 * @module server/ai-usage-limit
 */

import type { MiddlewareHandler } from 'npm:hono';
import { checkRateLimit, type RateLimitConfig } from './rateLimiter.ts';
import { readTokenSubject } from './jwt-claims.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('ai-usage-limit');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Read a positive integer from the environment, or fall back. */
function envInt(name: string, fallback: number): number {
  try {
    const raw = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The two dimensions, both enforced on every AI request.
 *
 * `PER_USER_BURST` is what stops a retry loop inside a single page from
 * spending a whole day's allowance in ninety seconds; `PER_USER_DAILY` is what
 * bounds the day. `PER_IP_DAILY` is the backstop for forged or rotated
 * identities, and is deliberately the loosest of the three because a shared
 * office address is one IP and many legitimate users.
 */
export function aiUsageLimits(): Record<string, RateLimitConfig> {
  return {
    PER_USER_BURST: {
      maxAttempts: envInt('NW_AI_BURST_MAX', 20),
      windowMs: envInt('NW_AI_BURST_WINDOW_MINUTES', 5) * 60 * 1000,
      blockDurationMs: envInt('NW_AI_BURST_BLOCK_MINUTES', 10) * 60 * 1000,
    },
    PER_USER_DAILY: {
      maxAttempts: envInt('NW_AI_DAILY_MAX', 250),
      windowMs: DAY_MS,
      blockDurationMs: DAY_MS,
    },
    PER_IP_DAILY: {
      maxAttempts: envInt('NW_AI_IP_DAILY_MAX', 800),
      windowMs: DAY_MS,
      blockDurationMs: DAY_MS,
    },
  };
}

/** Client IP, from the proxy headers Supabase sets. */
function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'noip'
  );
}

export interface AiUsageLimitOptions {
  /**
   * Label recorded in the counter key and the logs, e.g. 'publications-ai'.
   * Buckets are per-surface so one runaway feature cannot exhaust the
   * allowance of every other AI feature the same user relies on.
   */
  surface: string;
  /**
   * Methods to meter. Defaults to POST/PUT/PATCH — a GET on these routers is
   * reading stored output (a saved draft, a past conversation) and costs
   * nothing at the provider, so metering it would only punish the UI for
   * re-rendering.
   */
  methods?: readonly string[];
}

/**
 * Hono middleware factory.
 *
 *   app.use('/make-server-91ed8379/ai-advisor/*', aiUsageLimit({ surface: 'ai-advisor' }));
 *
 * On hit: 429 with `Retry-After` and `X-RateLimit-*`. On miss: continues, with
 * the headers attached so a client can back off before it is refused.
 *
 * FAILS CLOSED, via `checkRateLimit`: if the counter cannot be consulted the
 * request is refused. That is the correct direction for a spend limit — an
 * outage of the limiter must not become unlimited spending — and it matches
 * what the login limiter already does.
 */
export function aiUsageLimit(options: AiUsageLimitOptions): MiddlewareHandler {
  const { surface, methods = ['POST', 'PUT', 'PATCH'] } = options;
  const allowedMethods = new Set(methods.map((m) => m.toUpperCase()));

  return async (c, next) => {
    if (!allowedMethods.has(c.req.method.toUpperCase())) return next();

    const limits = aiUsageLimits();
    const subject = readTokenSubject(c.req.header('Authorization'));
    const ip = clientIp(c);

    // Ordered cheapest-signal-first so a burst is caught before the daily
    // counters are touched, and so the user-scoped dimensions (the ones that
    // reflect real spend) decide the outcome ahead of the shared IP bucket.
    const dimensions: Array<{ id: string; action: string; config: RateLimitConfig }> = [];
    if (subject) {
      dimensions.push(
        {
          id: `usr:${subject}`,
          action: `ai_burst:${surface}`,
          config: limits.PER_USER_BURST,
        },
        {
          id: `usr:${subject}`,
          action: `ai_daily:${surface}`,
          config: limits.PER_USER_DAILY,
        },
      );
    }
    dimensions.push({ id: `ip:${ip}`, action: 'ai_daily_ip', config: limits.PER_IP_DAILY });

    for (const dimension of dimensions) {
      const result = await checkRateLimit(dimension.id, dimension.action, dimension.config);

      c.header('X-RateLimit-Limit', String(dimension.config.maxAttempts));
      c.header('X-RateLimit-Remaining', String(result.remaining));
      c.header('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));

      if (!result.allowed) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
        c.header('Retry-After', String(retryAfter));
        log.warn('AI usage limit reached', {
          surface,
          action: dimension.action,
          // Never the raw subject or IP: this log is read on the admin quality
          // dashboard, and neither value needs to be there to act on it.
          idHashPrefix: dimension.id.slice(0, 12),
        });
        return c.json(
          {
            error:
              'You have reached the AI usage limit for now. Please try again later, or contact your administrator if you need a higher limit.',
            code: 'AI_USAGE_LIMIT',
            retryAfterSeconds: retryAfter,
          },
          429,
        );
      }
    }

    await next();
  };
}
