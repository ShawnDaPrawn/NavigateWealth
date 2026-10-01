/**
 * Client totals refresh — the worker's side of `public.client_totals_refresh`.
 * ==========================================================================
 *
 * The migration `client_totals_refresh` marks a client stale whenever their
 * `policies:client:{clientId}` row is written straight into the database
 * (the update bot, through the Supabase connector) rather than through the
 * app. This module is the three calls the Edge worker makes against it, all
 * SECURITY DEFINER functions executable by service_role only
 * (`client_totals_refresh_claims` migration):
 *
 *  - claim the oldest free stale client, for 2 minutes, with its policies as
 *    they are now and their md5;
 *  - write the totals worked out from exactly those policies. The database
 *    stores them and records the client current in one transaction, and only
 *    while the claim is still this worker's and the policies still have that
 *    md5. Otherwise nothing is stored;
 *  - or record that working them out failed, which backs the client off.
 *
 * Nothing here can record a client current without its totals being stored,
 * and an older run cannot store totals over a newer one.
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

/** A stale client this worker holds, and what it holds it with. */
export interface ClaimedClient {
  clientId: string;
  /** The write counter the claim read; the policies include every write it counts. */
  dirtySeq: number;
  claimToken: string;
  /** The client's policies when claimed: null when there is no policies row. */
  policies: unknown;
  /** md5 of those policies as the database stores them, for the fenced write. */
  policiesMd5: string | null;
}

/**
 * What the fenced write did:
 *  - `refreshed`  stored; the client is current;
 *  - `stale`      stored; a newer write is waiting, so the client stays stale;
 *  - `superseded` not stored; the policies changed after the claim read them;
 *  - `lost`       not stored; the claim lapsed and another worker took over.
 */
export type TotalsWriteOutcome = 'refreshed' | 'stale' | 'superseded' | 'lost';

const WRITE_OUTCOMES: ReadonlySet<string> = new Set<TotalsWriteOutcome>([
  'refreshed',
  'stale',
  'superseded',
  'lost',
]);

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

interface ClaimRow {
  client_id: string;
  dirty_seq: number | string;
  claim_token: string;
  policies: unknown;
  policies_md5: string | null;
}

/** Take the oldest free stale client for 2 minutes, or null when there is none. */
export async function claimStaleClient(): Promise<ClaimedClient | null> {
  const { data, error } = await db().rpc('client_totals_refresh_claim');
  if (error) {
    if (MISSING_FUNCTION_CODES.has(error.code ?? '')) {
      if (!warnedMissing) {
        warnedMissing = true;
        log.warn(
          'client_totals_refresh_claim not found — apply the client_totals_refresh_claims migration',
        );
      }
      return null;
    }
    throw new Error(`client_totals_refresh_claim failed: ${error.message}`);
  }
  const row = ((data ?? []) as ClaimRow[])[0];
  if (!row) return null;
  return {
    clientId: row.client_id,
    dirtySeq: Number(row.dirty_seq),
    claimToken: row.claim_token,
    policies: row.policies,
    policiesMd5: row.policies_md5,
  };
}

/** Store a claimed client's totals and record it current, if the claim still stands. */
export async function writeClientTotals(
  claim: ClaimedClient,
  totals: Record<string, number>,
): Promise<TotalsWriteOutcome> {
  const { data, error } = await db().rpc('client_totals_refresh_write', {
    p_client_id: claim.clientId,
    p_claim_token: claim.claimToken,
    p_policies_md5: claim.policiesMd5,
    p_totals: totals,
  });
  if (error) throw new Error(`client_totals_refresh_write failed: ${error.message}`);
  if (typeof data !== 'string' || !WRITE_OUTCOMES.has(data)) {
    throw new Error(`client_totals_refresh_write returned ${JSON.stringify(data)}`);
  }
  return data as TotalsWriteOutcome;
}

/**
 * Record that working out a claimed client's totals failed: the claim is
 * released and the client backed off. False when the claim had already
 * lapsed, and nothing was recorded.
 */
export async function failClientTotalsRefresh(
  claim: ClaimedClient,
  reason: string,
): Promise<boolean> {
  const { data, error } = await db().rpc('client_totals_refresh_fail', {
    p_client_id: claim.clientId,
    p_claim_token: claim.claimToken,
    p_error: reason,
  });
  if (error) throw new Error(`client_totals_refresh_fail failed: ${error.message}`);
  return data === true;
}
