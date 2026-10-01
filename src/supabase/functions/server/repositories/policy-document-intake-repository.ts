/**
 * Policy document intake — the worker's side of `public.policy_document_intake`.
 * ============================================================================
 *
 * Owns the three calls the Edge worker makes against the table the
 * `policy_document_intake` migration created: claim the next due row, record
 * it stored, record an attempt that failed. All three are SECURITY DEFINER
 * functions rather than PostgREST table writes, because the claim needs
 * `FOR UPDATE SKIP LOCKED` (two wake-ups never take the same row) and the
 * retry schedule lives next to it in SQL, where the migration's smoke test
 * pins it. A claim carries a token; completing or failing with a token that
 * is no longer the row's changes nothing, so a worker that was taken over
 * cannot overwrite its successor.
 *
 * Before the migration is applied the functions do not exist. That reads as
 * "nothing to claim", logged once, so deploying this code first is harmless.
 *
 * WHY THE SERVICE-ROLE CLIENT: the functions are executable by service_role
 * only. Lazy for the same reason as every other client here — constructing it
 * at module top level crashes the function on deploy.
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from '../stderr-logger.ts';

const log = createModuleLogger('policy-document-intake-repository');

/** The document types the table's CHECK allows — `PolicyDocument['documentType']`. */
export type IntakeDocumentType =
  | 'policy_schedule'
  | 'amendment'
  | 'statement'
  | 'benefit_summary'
  | 'other';

/** One claimed hand-over: what the worker needs to store it, and its claim. */
export interface ClaimedIntake {
  id: string;
  client_id: string;
  policy_id: string;
  document_type: IntakeDocumentType;
  file_name: string;
  pdf_base64: string | null;
  submitted_by: string;
  attempts: number;
  claim_token: string;
}

/** What a failed attempt left the row as: retried later, or given up on. */
export type FailedIntakeStatus = 'pending' | 'failed';

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
export function resetPolicyDocumentIntakeClient(): void {
  _client = null;
  warnedMissing = false;
}

/** The oldest due hand-over, now claimed by this worker; null when none is due. */
export async function claimNextIntake(): Promise<ClaimedIntake | null> {
  const { data, error } = await db().rpc('policy_document_intake_claim');
  if (error) {
    if (MISSING_FUNCTION_CODES.has(error.code ?? '')) {
      if (!warnedMissing) {
        warnedMissing = true;
        log.warn(
          'policy_document_intake_claim not found — apply the policy_document_intake migration',
        );
      }
      return null;
    }
    throw new Error(`policy_document_intake_claim failed: ${error.message}`);
  }
  const [row] = (data ?? []) as ClaimedIntake[];
  return row ?? null;
}

/** Record the stored document. False when the claim had been taken over. */
export async function completeIntake(
  claim: ClaimedIntake,
  stored: { storageKey: string; fileSize: number },
): Promise<boolean> {
  const { data, error } = await db().rpc('policy_document_intake_complete', {
    p_id: claim.id,
    p_claim_token: claim.claim_token,
    p_storage_key: stored.storageKey,
    p_file_size: stored.fileSize,
  });
  if (error) throw new Error(`policy_document_intake_complete failed: ${error.message}`);
  return data === true;
}

/**
 * Record a failed attempt. The row goes back to pending with a delay, or to
 * failed after its third attempt; null when the claim had been taken over.
 */
export async function failIntake(
  claim: ClaimedIntake,
  message: string,
): Promise<FailedIntakeStatus | null> {
  const { data, error } = await db().rpc('policy_document_intake_fail', {
    p_id: claim.id,
    p_claim_token: claim.claim_token,
    p_error: message,
  });
  if (error) throw new Error(`policy_document_intake_fail failed: ${error.message}`);
  return data === 'pending' || data === 'failed' ? data : null;
}
