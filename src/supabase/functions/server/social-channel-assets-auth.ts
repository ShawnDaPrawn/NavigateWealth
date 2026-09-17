/**
 * Social library integration token — Vault-backed.
 *
 * The Assets endpoint is meant to be called by an outside agent (ChatGPT
 * today) that has no user session, so it authenticates with a shared secret in
 * the `x-nw-social-assets-token` header.
 *
 * The secret lives in Vault rather than an Edge Function env var for the
 * reason cron-auth.ts records in full: Edge Function secrets cannot be read or
 * set through the Management API or MCP, so a mismatch is invisible from SQL
 * and uncorrectable from here — the exact silent drift that took every cron
 * job down on 2026-08-25. Verification goes through
 * `public.verify_social_assets_token`, a SECURITY DEFINER boolean oracle
 * granted to service_role only, so the secret is compared inside Postgres and
 * never crosses into the function. Rotation is one `vault.update_secret`.
 *
 * Mirrors newsletter-intake-auth.ts, which is the same problem solved the same
 * way one module earlier.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('social-channel-assets-auth');

/** Name of the Vault secret the oracle checks against. */
export const SOCIAL_ASSETS_VAULT_SECRET = 'navigatewealth_social_assets_token';

let _client: SupabaseClient | null = null;

// Lazy — must NOT be constructed at module top level, or the function crashes
// on deploy (same constraint as cron-auth.ts and newsletter-intake-auth.ts).
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
export function resetSocialAssetsAuthClient(): void {
  _client = null;
}

/**
 * True when `candidate` matches the Vault token. An infrastructure error is
 * logged and reads as "not verified" so the caller falls through to its other
 * branches — never a 500 on an agent's upload.
 */
export async function verifySocialAssetsToken(candidate: string): Promise<boolean> {
  const trimmed = (candidate || '').trim();
  if (!trimmed) return false;
  try {
    const { data, error } = await getSupabase().rpc('verify_social_assets_token', {
      candidate: trimmed,
    });
    if (error) {
      log.warn('verify_social_assets_token returned an error', { error: error.message });
      return false;
    }
    return data === true;
  } catch (error) {
    log.warn('verify_social_assets_token threw', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
