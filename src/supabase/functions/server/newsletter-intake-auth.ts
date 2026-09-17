/**
 * Newsletter intake token verification — Vault-backed.
 *
 * WHY THIS MODULE EXISTS
 * The HTTPS hand-over path authenticates the monthly routine with a shared
 * secret in the `x-nw-newsletter-intake-token` header. Comparing that header
 * to an Edge Function env var is the mechanism whose silent drift took every
 * cron job down on 2026-08-25 (cron-auth.ts): Edge Function secrets cannot be
 * read or set from the Management API or MCP, so a mismatch is invisible and
 * uncorrectable from SQL.
 *
 * So the token lives in Vault (`navigatewealth_newsletter_intake_token`,
 * migration `newsletter_intake_token_vault`) and this module verifies a
 * candidate through `public.verify_newsletter_intake_token`, a SECURITY
 * DEFINER boolean oracle granted to service_role only. The secret is compared
 * inside Postgres and never crosses into the function. Rotation is a single
 * `vault.update_secret`; no job, secret or deploy changes.
 *
 * The env-var branch (`NW_NEWSLETTER_INTAKE_TOKEN`) survives in the route as a
 * local-development override, checked by the route itself. This module is the
 * primary path.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('newsletter-intake-auth');

/** Name of the Vault secret the oracle checks against. */
export const NEWSLETTER_INTAKE_VAULT_SECRET = 'navigatewealth_newsletter_intake_token';

let _client: SupabaseClient | null = null;

// Lazy — must NOT be constructed at module top level, or the function crashes
// on deploy (same constraint as security-shared.ts and cron-auth.ts).
function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _client;
}

/** Test hook. */
export function resetNewsletterIntakeAuthClient(): void {
  _client = null;
}

/**
 * True when `candidate` matches the Vault token. An infrastructure error
 * (PostgREST blip, missing oracle before the migration lands) is logged and
 * reads as "not verified" so the caller can fall through to its other
 * branches — never a 500 on the routine's hand-over.
 */
export async function verifyNewsletterIntakeToken(candidate: string): Promise<boolean> {
  const trimmed = (candidate || '').trim();
  if (!trimmed) return false;
  try {
    const { data, error } = await getSupabase().rpc('verify_newsletter_intake_token', {
      candidate: trimmed,
    });
    if (error) {
      log.warn('verify_newsletter_intake_token returned an error', { error: error.message });
      return false;
    }
    return data === true;
  } catch (error) {
    log.warn('verify_newsletter_intake_token threw', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
