/**
 * Shared authentication for scheduled (pg_cron) endpoints.
 *
 * WHY THIS MODULE EXISTS
 *
 * Cron auth used to be re-implemented per route as
 *
 *   token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 *
 * in at least four places. On 2026-08-25 every one of those routes was
 * answering 401 to its own scheduled job, and had been for as long as the logs
 * retain. The comparison itself is fine — `constantTimeEqual` was read and is
 * correct — but the two sides held different strings: the cron rows carried a
 * service-role key byte-identical to the Vault copy, while the value the
 * function sees is something else. A rotation the cron rows never picked up is
 * the likeliest explanation, and it cannot be confirmed from SQL because Edge
 * Function secrets are not readable through the Management API.
 *
 * The failure mode is what makes this worth centralising. Nothing reported it:
 * pg_cron marks `net.http_post` succeeded as soon as the request is *enqueued*,
 * so `cron.job_run_details` stays green for a 401 forever. See
 * docs/runbooks/scheduled-jobs.md.
 *
 * SO THE MECHANISM IS REPLACED, NOT THE VALUE. Jobs send a dedicated token
 * pulled from Vault at call time, and this module verifies it through
 * `public.verify_cron_auth_token`, a SECURITY DEFINER boolean oracle — the
 * secret is compared inside Postgres and never crosses into the function. That
 * removes the dependency on an env var this side cannot read, takes the
 * service-role key out of `cron.job.command` (where any role that can read
 * `cron.job` could select it), and makes rotation a single `vault.update_secret`
 * with no job edits.
 *
 * The legacy env comparison is kept as a second branch on purpose: it is what
 * an operator's `curl -H "Authorization: Bearer $SERVICE_ROLE_KEY"` uses, and
 * removing it would break local development and manual runs. It is a fallback,
 * not the primary path.
 */
import { type Context, type Next } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { constantTimeEqual } from './crypto-utils.ts';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('cron-auth');

/** Header carrying the Vault-backed shared token. */
export const CRON_AUTH_HEADER = 'x-nw-cron-auth';

/** Name of the Vault secret the oracle checks against. */
export const CRON_AUTH_VAULT_SECRET = 'navigatewealth_cron_auth_token';

// Lazy client — must NOT be constructed at module top level, or the function
// crashes on deploy (same constraint as security-shared.ts).
const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** The subset of Context this module reads, so tests need not build a full one. */
export interface CronAuthContext {
  req: { header: (name: string) => string | undefined };
}

/**
 * True when the request carries valid cron credentials.
 *
 * Branch order is deliberate: the Vault token is the path scheduled jobs use
 * and is checked first, so the common case does not depend on the env var whose
 * drift caused the outage this module exists to fix.
 */
export async function isAuthorizedCronRequest(c: CronAuthContext): Promise<boolean> {
  const shared = (c.req.header(CRON_AUTH_HEADER) || '').trim();
  if (shared) {
    try {
      const { data, error } = await getSupabase().rpc('verify_cron_auth_token', {
        candidate: shared,
      });
      if (error) {
        // Do not fail closed on an infrastructure error alone — fall through to
        // the env branch so a PostgREST blip cannot take every job down at once.
        log.warn('verify_cron_auth_token returned an error', { error: error.message });
      } else if (data === true) {
        return true;
      }
    } catch (error) {
      log.warn('verify_cron_auth_token threw', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const bearer = (c.req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return false;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const superAdminPw = Deno.env.get('SUPER_ADMIN_PASSWORD') || '';

  return (
    (serviceRoleKey !== '' && constantTimeEqual(bearer, serviceRoleKey)) ||
    (superAdminPw !== '' && constantTimeEqual(bearer, superAdminPw))
  );
}

/** Hono middleware form of {@link isAuthorizedCronRequest}. */
export async function requireCronAuth(c: Context, next: Next) {
  if (await isAuthorizedCronRequest(c)) return next();

  return c.json({ error: 'Unauthorized — cron auth required', code: 'CRON_AUTH_REQUIRED' }, 401);
}
