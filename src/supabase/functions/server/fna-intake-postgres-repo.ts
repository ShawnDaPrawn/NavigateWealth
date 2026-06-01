/**
 * FNA Intake Postgres Repository — dual-write migration (mirrors esign-postgres-repo.ts)
 *
 * Env flags:
 *   FNA_INTAKE_DUAL_WRITE=false (default) — Postgres shadow writes disabled
 *   FNA_INTAKE_DUAL_WRITE=true — write KV + Postgres
 *   FNA_INTAKE_READ_FROM=kv|postgres — read source (Postgres falls back to null → caller uses KV)
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import type {
  FnaIntakeDomain,
  FnaIntakeSession,
  FnaIntakeSubmittedBy,
} from './fna-intake-types.ts';

const log = createModuleLogger('fna-intake-pg-repo');

function envGet(key: string): string | undefined {
  if (typeof Deno !== 'undefined') return Deno.env.get(key);
  if (typeof process !== 'undefined') return process.env[key];
  return undefined;
}

export type FnaIntakeReadSource = 'kv' | 'postgres';

export const fnaIntakeDualWriteEnabled: boolean =
  (envGet('FNA_INTAKE_DUAL_WRITE') ?? 'false').toLowerCase() === 'true';

export const fnaIntakeReadSource: FnaIntakeReadSource =
  (envGet('FNA_INTAKE_READ_FROM') ?? 'kv').toLowerCase() === 'postgres' ? 'postgres' : 'kv';

export const fnaIntakePostgresOnly: boolean =
  !fnaIntakeDualWriteEnabled && fnaIntakeReadSource === 'postgres';

let _client: SupabaseClient | null = null;

function pgClient(): SupabaseClient {
  if (_client) return _client;
  const url = envGet('SUPABASE_URL');
  const key = envGet('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });
  return _client;
}

async function shadowWrite<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  if (!fnaIntakeDualWriteEnabled && !fnaIntakePostgresOnly) return null;
  try {
    return await fn();
  } catch (err) {
    if (fnaIntakePostgresOnly) throw err;
    log.warn(`Shadow write '${label}' failed (canonical KV write succeeded)`, { err });
    return null;
  }
}

interface SessionRow {
  id: string;
  client_id: string;
  domain: string;
  status: string;
  inputs: Record<string, unknown>;
  progress_percent: number;
  consent_accepted_at: string | null;
  consent_text_version: string | null;
  submitted_at: string | null;
  submitted_by: FnaIntakeSubmittedBy | null;
  accepted_at: string | null;
  accepted_by: FnaIntakeSubmittedBy | null;
  linked_fna_id: string | null;
  request_info_at: string | null;
  intake_source: string;
  created_at: string;
  updated_at: string;
}

export function sessionToRow(session: FnaIntakeSession): SessionRow {
  return {
    id: session.id,
    client_id: session.clientId,
    domain: session.domain,
    status: session.status,
    inputs: session.inputs,
    progress_percent: session.progressPercent,
    consent_accepted_at: session.consentAcceptedAt ?? null,
    consent_text_version: session.consentTextVersion ?? null,
    submitted_at: session.submittedAt ?? null,
    submitted_by: session.submittedBy ?? null,
    accepted_at: session.acceptedAt ?? null,
    accepted_by: session.acceptedBy ?? null,
    linked_fna_id: session.linkedFnaId ?? null,
    request_info_at: session.requestInfoAt ?? null,
    intake_source: session.intakeSource,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function rowToSession(row: SessionRow): FnaIntakeSession {
  return {
    id: row.id,
    clientId: row.client_id,
    domain: row.domain as FnaIntakeDomain,
    status: row.status as FnaIntakeSession['status'],
    inputs: row.inputs ?? {},
    progressPercent: row.progress_percent ?? 0,
    consentAcceptedAt: row.consent_accepted_at,
    consentTextVersion: row.consent_text_version ?? undefined,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    linkedFnaId: row.linked_fna_id,
    requestInfoAt: row.request_info_at,
    intakeSource: 'client',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const fnaIntakePgRepo = {
  async upsertSession(session: FnaIntakeSession): Promise<void> {
    const row = sessionToRow(session);
    const write = async () => {
      const { error } = await pgClient()
        .from('fna_intake_sessions')
        .upsert(row, { onConflict: 'id' });
      if (error) throw error;
    };

    if (fnaIntakePostgresOnly) {
      await write();
      return;
    }
    await shadowWrite('upsertSession', write);
  },

  async getSessionById(sessionId: string): Promise<FnaIntakeSession | null> {
    if (fnaIntakeReadSource !== 'postgres' && !fnaIntakePostgresOnly) return null;
    const { data, error } = await pgClient()
      .from('fna_intake_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSession(data as SessionRow) : null;
  },

  async getActiveSession(
    clientId: string,
    domain: FnaIntakeDomain,
  ): Promise<FnaIntakeSession | null> {
    if (fnaIntakeReadSource !== 'postgres' && !fnaIntakePostgresOnly) return null;
    const { data, error } = await pgClient()
      .from('fna_intake_sessions')
      .select('*')
      .eq('client_id', clientId)
      .eq('domain', domain)
      .in('status', ['client_draft', 'submitted'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToSession(data as SessionRow) : null;
  },

  async listSubmittedSessions(): Promise<FnaIntakeSession[]> {
    if (fnaIntakeReadSource !== 'postgres' && !fnaIntakePostgresOnly) return [];
    const { data, error } = await pgClient()
      .from('fna_intake_sessions')
      .select('*')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data ?? []).map((row) => rowToSession(row as SessionRow));
  },

  /**
   * Atomically claim a submitted session for accept (prevents duplicate draft creation).
   * Sets linked_fna_id to a pending placeholder until finalizeAccept completes.
   */
  async claimSessionForAccept(
    sessionId: string,
    admin: FnaIntakeSubmittedBy,
    placeholderLinkedId: string,
  ): Promise<
    | { kind: 'claimed'; session: FnaIntakeSession }
    | { kind: 'already_accepted'; session: FnaIntakeSession }
    | null
  > {
    const run = async () => {
      const existing = await fnaIntakePgRepo.getSessionById(sessionId);
      if (!existing) return null;
      if (
        existing.status === 'accepted' &&
        existing.linkedFnaId &&
        !existing.linkedFnaId.startsWith('pending:')
      ) {
        return { kind: 'already_accepted' as const, session: existing };
      }
      if (existing.status !== 'submitted') return null;

      const now = new Date().toISOString();
      const { data, error } = await pgClient()
        .from('fna_intake_sessions')
        .update({
          status: 'accepted',
          accepted_at: now,
          accepted_by: admin,
          linked_fna_id: placeholderLinkedId,
          updated_at: now,
        })
        .eq('id', sessionId)
        .eq('status', 'submitted')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        return { kind: 'claimed' as const, session: rowToSession(data as SessionRow) };
      }

      const after = await fnaIntakePgRepo.getSessionById(sessionId);
      if (after?.status === 'accepted' && after.linkedFnaId) {
        return { kind: 'already_accepted' as const, session: after };
      }
      return null;
    };

    if (fnaIntakePostgresOnly || fnaIntakeReadSource === 'postgres') {
      return run();
    }
    return shadowWrite('claimSessionForAccept', run);
  },

  async finalizeAccept(sessionId: string, linkedFnaId: string): Promise<FnaIntakeSession | null> {
    const run = async () => {
      const now = new Date().toISOString();
      const { data, error } = await pgClient()
        .from('fna_intake_sessions')
        .update({ linked_fna_id: linkedFnaId, updated_at: now })
        .eq('id', sessionId)
        .eq('status', 'accepted')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data ? rowToSession(data as SessionRow) : null;
    };

    if (fnaIntakePostgresOnly || fnaIntakeReadSource === 'postgres') {
      return run();
    }
    await shadowWrite('finalizeAccept', run);
    return null;
  },
};
