/**
 * Client totals refresh — the worker's side of `public.client_totals_refresh`.
 * ==========================================================================
 *
 * The migration `client_totals_refresh` marks a client stale whenever their
 * `policies:client:{clientId}` row is written straight into the database
 * (the update bot, through the Supabase connector) rather than through the
 * app. This module is the two calls the Edge worker makes against it: list
 * the stale clients, and record one recalculated. Both are SECURITY DEFINER
 * functions, executable by service_role only.
 *
 * Each direct write bumps a per-client counter. The worker reports the
 * counter it read, so a write that lands while it recalculates leaves the
 * client stale for the next pass instead of being marked done.
 *
 * Before the migration is applied the functions do not exist. That reads as
 * "nothing stale", logged once, so deploying this code first is harmless.
 *
 * WHY THE SERVICE-ROLE CLIENT: lazy for the same reason as every other client
 * here — constructing it at module top level crashes the function on deploy.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('client-totals-refresh-repository');

/** A client whose totals may be stale, and the write counter to report back. */
export interface StaleClient {
  clientId: string;
  dirtySeq: number;
}

/**
 * "The function does not exist": PostgREST's schema-cache miss, or Postgres's
 * own undefined_function when the call reaches the database.
 */
const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883']);
let warnedMissing = false;

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return _client;
}

/** Test hook. */
export function resetClientTotalsRefreshClient(): void {
  _client = null;
  warnedMissing = false;
}

/** Up to `limit` stale clients, the oldest change first. */
export async function listStaleClients(limit: number): Promise<StaleClient[]> {
  const { data, error } = await db().rpc('client_totals_refresh_due', { p_limit: limit });
  if (error) {
    if (MISSING_FUNCTION_CODES.has(error.code ?? '')) {
      if (!warnedMissing) {
        warnedMissing = true;
        log.warn('client_totals_refresh_due not found — apply the client_totals_refresh migration');
      }
      return [];
    }
    throw new Error(`client_totals_refresh_due failed: ${error.message}`);
  }
  return ((data ?? []) as Array<{ client_id: string; dirty_seq: number | string }>).map((row) => ({
    clientId: row.client_id,
    dirtySeq: Number(row.dirty_seq),
  }));
}

/**
 * Record a recalculation made after reading `dirtySeq`. True when the client
 * is now up to date; false when a newer write arrived meanwhile.
 */
export async function markClientTotalsRefreshed(client: StaleClient): Promise<boolean> {
  const { data, error } = await db().rpc('client_totals_refresh_done', {
    p_client_id: client.clientId,
    p_seq: client.dirtySeq,
  });
  if (error) throw new Error(`client_totals_refresh_done failed: ${error.message}`);
  return data === true;
}
