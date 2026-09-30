/**
 * Portfolio table integration token — Vault-backed.
 *
 * `/integrations/portfolio-table` is meant to be called by an outside agent
 * on a schedule, with no user session, so it authenticates with a shared
 * secret in the `x-nw-portfolio-token` header.
 *
 * The secret lives in Vault rather than an Edge Function env var for the
 * reason cron-auth.ts records in full: Edge Function secrets cannot be read or
 * set through the Management API or MCP, so a mismatch is invisible from SQL
 * and uncorrectable from here — the silent drift that took every cron job
 * down on 2026-08-25. Verification goes through
 * `public.verify_portfolio_table_token`, a SECURITY DEFINER boolean oracle
 * granted to service_role only, so the secret is compared inside Postgres and
 * never crosses into the function. Rotation is one `vault.update_secret`.
 *
 * Mirrors social-channel-assets-auth.ts and newsletter-intake-auth.ts, which
 * are the same problem solved the same way.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('integrations-portfolio-table-auth');

/** Name of the Vault secret the oracle checks against. */
export const PORTFOLIO_TABLE_VAULT_SECRET = 'navigatewealth_portfolio_table_token';

let _client: SupabaseClient | null = null;

// Lazy — must NOT be constructed at module top level, or the function crashes
// on deploy (same constraint as cron-auth.ts).
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
export function resetPortfolioTableAuthClient(): void {
  _client = null;
}

/**
 * True when `candidate` matches the Vault token. An infrastructure error is
 * logged and reads as "not verified" so the caller falls through to its other
 * branches — never a 500 on an agent's scheduled call.
 */
export async function verifyPortfolioTableToken(candidate: string): Promise<boolean> {
  const trimmed = (candidate || '').trim();
  if (!trimmed) return false;
  try {
    const { data, error } = await getSupabase().rpc('verify_portfolio_table_token', {
      candidate: trimmed,
    });
    if (error) {
      log.warn('verify_portfolio_table_token returned an error', { error: error.message });
      return false;
    }
    return data === true;
  } catch (error) {
    log.warn('verify_portfolio_table_token threw', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
