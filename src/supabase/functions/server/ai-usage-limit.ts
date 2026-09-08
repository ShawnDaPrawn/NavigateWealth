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
 * From `c.get('userId')` — the id the route's OWN auth middleware already put
 * on the context after verifying the token. This guard is always registered
 * after that middleware, so by the time it runs the principal is established
 * and there is nothing here to verify.
 *
 * It took two wrong turns to get there, and both are worth recording.
 *
 * First it read the `sub` claim from the bearer token locally, without
 * checking the signature, and argued that a forged token only buys a bucket
 * for a request that will be rejected anyway. That had the threat backwards:
 * the attack is forging a VICTIM's subject, not a new one. Anyone who knew a
 * user's UUID could spend that user's whole daily allowance on requests that
 * fail downstream — a denial-of-service against a named account, driven by a
 * stranger, and the failing requests do not give the quota back.
 *
 * Then it verified the token itself with `auth.getUser`, which fixed the
 * attack and introduced two new problems: a second auth round trip on every
 * AI request, and a hand-rolled token verifier outside `auth-mw.ts` — which
 * `auth-consolidation.test.ts` catches, correctly, because a module that
 * verifies tokens and does not apply the account-security policy is how the
 * two drift apart.
 *
 * Reading the id the route's own guard already resolved has none of those
 * costs. Where a router authenticates INSIDE its handler rather than in
 * middleware (`will-chat-routes.ts`, `tax-agent-routes.ts`), the handler calls
 * `chargeAiUsage` directly once it has the user, rather than this middleware.
 *
 * With no principal on the context, only the IP dimension applies. That is the
 * honest answer for an unauthenticated request, and the route's own auth is
 * what rejects it moments later.
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

import type { Context, MiddlewareHandler } from 'npm:hono';
import { checkRateLimit, type RateLimitConfig } from './rateLimiter.ts';
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
 * Apply the caps for one request. Returns a 429 `Response` when a dimension is
 * exhausted, or null to continue.
 *
 * Exported for handlers that authenticate inside themselves rather than in
 * middleware, where `c.get('userId')` is not set when a middleware would run.
 * Call it immediately after the user is resolved and return its result if it
 * is not null.
 */
export async function chargeAiUsage(
  c: Context,
  options: { surface: string; userId?: string | null },
): Promise<Response | null> {
  const { surface, userId } = options;
  const limits = aiUsageLimits();
  const ip = clientIp(c);

  // IP first: it is the only bound on an unauthenticated flood, and it costs
  // nothing to apply before the account dimensions.
  const dimensions: Array<{ id: string; action: string; config: RateLimitConfig }> = [
    { id: `ip:${ip}`, action: 'ai_daily_ip', config: limits.PER_IP_DAILY },
  ];

  if (userId) {
    dimensions.push(
      { id: `usr:${userId}`, action: `ai_burst:${surface}`, config: limits.PER_USER_BURST },
      { id: `usr:${userId}`, action: `ai_daily:${surface}`, config: limits.PER_USER_DAILY },
    );
  }

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
        // Never the raw id or IP: this log is read on the admin quality
        // dashboard, and neither value is needed to act on it.
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

  return null;
}

/**
 * Hono middleware factory.
 *
 *   app.post('/chat', requireAuth, aiUsageLimit({ surface: 'ai-advisor' }), handler);
 *
 * or, for a router where every route spends and shares one auth guard:
 *
 *   app.use('*', requireAdmin);
 *   app.use('*', aiUsageLimit({ surface: 'transcription' }));
 *
 * MUST be registered after the route's own auth guard — that is what puts the
 * verified `userId` on the context. Registered before it, this degrades to
 * IP-only metering silently, which is the failure mode
 * `ai-usage-limit-coverage.test.ts` exists to make visible. That is also why
 * neither example mounts it on the parent app in `mount-modules.ts`: a guard
 * there runs before the sub-router authenticates, so it has no principal to
 * charge — see the note at the top of that file.
 *
 * FAILS CLOSED, via `checkRateLimit`: if the counter cannot be consulted the
 * request is refused. That is the correct direction for a spend limit — an
 * outage of the limiter must not become unlimited spending.
 */
export function aiUsageLimit(options: AiUsageLimitOptions): MiddlewareHandler {
  const { surface, methods = ['POST', 'PUT', 'PATCH'] } = options;
  const allowedMethods = new Set(methods.map((m) => m.toUpperCase()));

  return async (c, next) => {
    if (!allowedMethods.has(c.req.method.toUpperCase())) return next();

    const userId = c.get('userId') as string | undefined;
    const refusal = await chargeAiUsage(c, { surface, userId });
    if (refusal) return refusal;

    await next();
  };
}
