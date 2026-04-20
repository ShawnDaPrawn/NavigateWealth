/**
 * E-Sign Postgres Repository (Phase 0.1 — dual-write scaffold)
 * ==============================================================
 *
 * This module is the writer/reader for the new `esign_*` Postgres tables
 * created in `supabase/migrations/20260420000001_esign_core_tables.sql`.
 *
 * IMPORTANT — this is FEATURE-FLAGGED. By default, every method here is a
 * no-op so production traffic is unaffected. The migration phases:
 *
 *   Phase 1: ESIGN_DUAL_WRITE=false (default)
 *     • Writes go to KV only. Postgres methods are no-ops.
 *     • Existing behaviour preserved 100%.
 *
 *   Phase 2: ESIGN_DUAL_WRITE=true, ESIGN_READ_FROM=kv
 *     • Every mutation writes to BOTH KV (canonical) and Postgres (shadow).
 *     • Reads still come from KV.
 *     • Failures in Postgres are LOGGED and SWALLOWED — never break the
 *       request. The KV write is canonical.
 *
 *   Phase 3: ESIGN_DUAL_WRITE=true, ESIGN_READ_FROM=postgres
 *     • Reads come from Postgres. KV is the safety net.
 *     • If Postgres read returns null, fall back to KV.
 *
 *   Phase 4: ESIGN_DUAL_WRITE=false, ESIGN_READ_FROM=postgres
 *     • Postgres is canonical. KV is no longer touched.
 *     • Legacy KV keys are removed by a one-shot cleanup job.
 *
 * Every call site in `esign-services.ts` should look like:
 *
 *   await kv.set(EsignKeys.envelope(id), envelope);  // canonical write
 *   await esignPgRepo.upsertEnvelope(envelope).catch(logShadowFailure);
 *
 * That pattern ensures Postgres failures during the dual-write window
 * never block production.
 *
 * @module server/esign-postgres-repo
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('esign-pg-repo');

// ── Feature flags ───────────────────────────────────────────────────────────

export type ReadSource = 'kv' | 'postgres';

export const dualWriteEnabled: boolean =
  (Deno.env.get('ESIGN_DUAL_WRITE') ?? 'false').toLowerCase() === 'true';

export const readSource: ReadSource =
  ((Deno.env.get('ESIGN_READ_FROM') ?? 'kv').toLowerCase() === 'postgres')
    ? 'postgres'
    : 'kv';

// ── Lazy client (cold-start friendly) ───────────────────────────────────────

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return _client;
}

// ── Internal helpers ────────────────────────────────────────────────────────

/**
 * Wrap a Postgres call so it never throws in dual-write mode. The KV write
 * is canonical — a Postgres outage during the migration window must not
 * cause a request failure.
 */
async function shadowWrite<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  if (!dualWriteEnabled) return null;
  try {
    return await fn();
  } catch (err) {
    log.warn(`Shadow write '${label}' failed (canonical KV write succeeded — safe to ignore)`, { err });
    return null;
  }
}

// ── Public types — kept structurally compatible with current KV records ────

export interface EnvelopeRow {
  id: string;
  firm_id: string;
  created_by?: string | null;
  title: string;
  message?: string | null;
  status: string;
  signing_mode?: string;
  document_url?: string | null;
  document_hash?: string | null;
  document_pages?: number | null;
  expires_at?: string | null;
  sent_at?: string | null;
  completed_at?: string | null;
  voided_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface SignerRow {
  id: string;
  envelope_id: string;
  email: string;
  name: string;
  phone?: string | null;
  role?: string | null;
  kind?: 'signer' | 'witness' | 'cc';
  signing_order?: number;
  status?: string;
  access_token: string;
  otp_required?: boolean;
  access_code?: string | null;
  client_id?: string | null;
  is_system_client?: boolean;
  signed_at?: string | null;
  declined_at?: string | null;
  decline_reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface FieldRow {
  id: string;
  envelope_id: string;
  signer_id?: string | null;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required?: boolean;
  value?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditRow {
  envelope_id: string;
  actor_type: 'sender_user' | 'signer' | 'system' | 'witness';
  actor_id?: string | null;
  email?: string | null;
  action: string;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
}

// ── Repository surface ──────────────────────────────────────────────────────
//
// Intentionally minimal. We only expose the operations called from the
// hot paths of `esign-services.ts`. Anything not listed here keeps using
// KV exclusively (and will be added when its hot path migrates).

export const esignPgRepo = {
  /** Idempotent upsert of an envelope record. */
  upsertEnvelope(row: EnvelopeRow): Promise<unknown> {
    return shadowWrite('upsertEnvelope', async () => {
      const { error } = await client()
        .from('esign_envelopes')
        .upsert(row, { onConflict: 'id' });
      if (error) throw error;
    }) as Promise<unknown>;
  },

  upsertSigner(row: SignerRow): Promise<unknown> {
    return shadowWrite('upsertSigner', async () => {
      const { error } = await client()
        .from('esign_signers')
        .upsert(row, { onConflict: 'id' });
      if (error) throw error;
    }) as Promise<unknown>;
  },

  upsertField(row: FieldRow): Promise<unknown> {
    return shadowWrite('upsertField', async () => {
      const { error } = await client()
        .from('esign_fields')
        .upsert(row, { onConflict: 'id' });
      if (error) throw error;
    }) as Promise<unknown>;
  },

  /** Replace every field for an envelope atomically (used by /fields PUT). */
  replaceFields(envelopeId: string, rows: FieldRow[]): Promise<unknown> {
    return shadowWrite('replaceFields', async () => {
      // Postgres has no atomic "delete-then-insert" without a transaction
      // helper; the supabase-js client doesn't expose tx, so we do a
      // best-effort delete + upsert pair. Acceptable for shadow writes.
      const { error: delErr } = await client()
        .from('esign_fields')
        .delete()
        .eq('envelope_id', envelopeId);
      if (delErr) throw delErr;
      if (rows.length > 0) {
        const { error: insErr } = await client()
          .from('esign_fields')
          .insert(rows);
        if (insErr) throw insErr;
      }
    }) as Promise<unknown>;
  },

  insertAudit(row: AuditRow): Promise<unknown> {
    return shadowWrite('insertAudit', async () => {
      const { error } = await client()
        .from('esign_audit_events')
        .insert(row);
      if (error) throw error;
    }) as Promise<unknown>;
  },

  /** Remove every record for an envelope (used by hard-delete). */
  deleteEnvelope(envelopeId: string): Promise<unknown> {
    return shadowWrite('deleteEnvelope', async () => {
      // ON DELETE CASCADE on signers/fields/certificates handles the rest.
      const { error } = await client()
        .from('esign_envelopes')
        .delete()
        .eq('id', envelopeId);
      if (error) throw error;
    }) as Promise<unknown>;
  },
};
