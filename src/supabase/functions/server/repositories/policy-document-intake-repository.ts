/**
 * Policy document intake — the Edge side of `public.policy_document_intake`.
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
 * It also owns the calls the HTTPS upload makes to hand a PDF over the same
 * way an agent does in SQL: look a key up, submit the PDF. The SQL functions
 * validate and queue exactly as they do for the agent, so the two doors
 * cannot drift apart.
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

export type IntakeStatus = 'pending' | 'processing' | 'processed' | 'failed';

/** A hand-over as `policy_document_intake_status` reports it. */
export interface IntakeStatusRow {
  id: string;
  client_id: string;
  policy_id: string;
  document_type: IntakeDocumentType;
  file_name: string;
  file_size: number | null;
  status: IntakeStatus;
  attempts: number;
  error: string | null;
  storage_key: string | null;
  created_at: string;
  processed_at: string | null;
}

/**
 * A hand-over the SQL side refused, with its own reason: a client without that
 * policy, a file that is not a PDF, one over 20 MB, a key already submitted.
 * The caller's mistake, not ours, so it is reported back rather than retried.
 */
export class IntakeRejectedError extends Error {
  override name = 'IntakeRejectedError';
}

/** SQLSTATE of a plain `raise exception`, which is how the functions refuse. */
const RAISED = 'P0001';

/**
 * The functions prefix every refusal with their own name. Anything else (a
 * timeout, a missing function) is ours to fix, and is thrown as an Error.
 */
function failureOf(fn: string, error: { code?: string; message: string }): Error {
  const prefix = `${fn}:`;
  if (error.code === RAISED && error.message.startsWith(prefix)) {
    return new IntakeRejectedError(error.message.slice(prefix.length).trim());
  }
  return new Error(`${fn} failed: ${error.message}`);
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

/** The hand-over submitted under `idempotencyKey`, or null when there is none. */
export async function findIntake(idempotencyKey: string): Promise<IntakeStatusRow | null> {
  const { data, error } = await db().rpc('policy_document_intake_status', {
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw failureOf('policy_document_intake_status', error);
  const [row] = (data ?? []) as IntakeStatusRow[];
  return row ?? null;
}

/**
 * Queue a whole PDF as one hand-over, exactly as an agent's SQL submit does:
 * the SQL side checks it, records the row and wakes the worker, all in one
 * transaction. `existed` is true when the key had been submitted already,
 * which is how two requests racing with one key settle on one hand-over.
 *
 * In one call on purpose, rather than staged in parts: parts staged under a
 * key are shared by every request using that key, so two overlapping uploads
 * could clear or interleave each other's. One submit is atomic, and it also
 * clears any parts an earlier attempt left under the key.
 */
export async function submitIntake(params: {
  clientId: string;
  policyId: string;
  documentType: IntakeDocumentType;
  fileName: string;
  idempotencyKey: string;
  submittedBy: string;
  pdfBase64: string;
}): Promise<{ id: string; existed: boolean; status: IntakeStatus }> {
  const { data, error } = await db().rpc('policy_document_intake_submit', {
    p_client_id: params.clientId,
    p_policy_id: params.policyId,
    p_file_name: params.fileName,
    p_idempotency_key: params.idempotencyKey,
    p_pdf_base64: params.pdfBase64,
    p_mime_type: 'application/pdf',
    p_document_type: params.documentType,
    p_submitted_by: params.submittedBy,
  });
  if (error) throw failureOf('policy_document_intake_submit', error);
  const [row] = (data ?? []) as Array<{ id: string; existed: boolean; status: IntakeStatus }>;
  if (!row) throw new Error('policy_document_intake_submit returned no row');
  return row;
}
