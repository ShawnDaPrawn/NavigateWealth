/**
 * auth-admin-routes.ts — super-admin auth utilities (Phase 7 max-lines).
 * ============================================================================
 *
 * Mounted via `authRoutes.route('/', adminAuthRoutes)`.
 *
 * WHAT USED TO LIVE HERE, AND WHY IT IS GONE
 * ------------------------------------------
 * Three routes — `create-superadmin`, `ensure-dev-user` and `clear-rate-limit` —
 * were gated by nothing but the static `SUPER_ADMIN_PASSWORD` secret in the
 * request body. No session, no rate limit on guesses, no audit record.
 * `ensure-dev-user` reset the password of ANY existing account, the owner's
 * included, and `create-superadmin` minted a new super-admin. Whoever held (or
 * guessed) one string could take over the platform in a single request and
 * leave no trace in the admin audit trail. Neither had a caller: the owner
 * account exists, and the dev helper was never meant for production.
 *
 * `clear-rate-limit` is the one with a real support use — unlocking a client
 * who locked themselves out — so it stays, behind a super-admin SESSION rather
 * than a shared secret, and every use is written to the admin audit trail.
 * The shared secret still guards server-to-server cron calls (cron-auth.ts);
 * it just no longer opens account-level doors.
 */
import { Hono } from 'npm:hono';
import { clearRateLimit, normalizeRateLimitEmail } from './rateLimiter.ts';
import { requireSuperAdmin } from './auth-mw.ts';
import { validateBody } from './validate.ts';
import { ClearRateLimitSchema } from './auth-validation.ts';
import { AdminAuditService } from './admin-audit-service.ts';
import { createModuleLogger } from './stderr-logger.ts';

const adminAuthRoutes = new Hono();
const log = createModuleLogger('auth-admin-routes');

/**
 * POST /auth/clear-rate-limit
 * Lift the login lockout on one account (super-admin support utility).
 *
 * Clears the per-ACCOUNT bucket only. The per-IP bucket belongs to whoever is
 * calling from that address, and the super-admin's own IP is not the locked-out
 * client's, so clearing it here only ever handed the caller extra guesses.
 */
adminAuthRoutes.post(
  '/clear-rate-limit',
  requireSuperAdmin,
  validateBody(ClearRateLimitSchema),
  async (c) => {
    try {
      const { email } = await c.req.json();
      const accountKey = normalizeRateLimitEmail(email);

      await clearRateLimit(accountKey, 'login');

      await AdminAuditService.record({
        actorId: c.get('userId') as string,
        actorRole: c.get('userRole') as string,
        category: 'security',
        action: 'login_rate_limit_cleared',
        summary: 'Cleared the login lockout on an account',
        severity: 'warning',
        entityType: 'rate_limit',
      });

      return c.json({ success: true, message: 'Rate limits cleared successfully' }, 200);
    } catch (error) {
      log.error('clear-rate-limit failed', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  },
);

export default adminAuthRoutes;
