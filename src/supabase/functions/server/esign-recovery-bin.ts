/**
 * P6.8 — Recovery bin + retention sweep.
 *
 * The e-sign module uses soft-deletion: when an admin discards a draft
 * or sent envelope we stamp `deleted_at` / `deleted_by` / `delete_reason`
 * instead of hard-removing the KV records. This module exposes three
 * pieces of functionality:
 *
 *   • `listRecoveryBin(firmId)` — envelopes available to restore.
 *   • `restoreEnvelope(envelopeId, actor)` — clear the soft-delete stamp.
 *   • `purgeExpiredDeletedEnvelopes()` — permanently remove envelopes
 *     whose `deleted_at` is older than the retention window (90 days).
 *     Called by the scheduler and exposed on an admin-only route.
 *
 * Hard deletion intentionally clears every related key (signers,
 * fields, audit, manifests, client index membership) so the bin stays
 * cheap to scan. Attachment + certificate PDFs currently stay in
 * Supabase Storage; we leave those in place because (a) they may be
 * referenced by the evidence-pack exporter and (b) storage cleanup is
 * out of scope for the retention sweep.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { EsignEnvelope } from './esign-types.ts';

const log = createModuleLogger('esign-recovery-bin');

/** Retention window: how long soft-deleted envelopes stay recoverable. */
export const RECOVERY_RETENTION_DAYS = 90;

function isSoftDeleted(envelope: Record<string, unknown>): envelope is EsignEnvelope & { deleted_at: string } {
  return typeof envelope?.deleted_at === 'string' && envelope.deleted_at.length > 0;
}

/** List soft-deleted envelopes for a firm (most recently binned first). */
export async function listRecoveryBin(firmId: string): Promise<Array<EsignEnvelope & { deleted_at: string }>> {
  const all = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
  const records = (all as Array<Record<string, unknown>>).filter((item) =>
    item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof item.id === 'string' &&
    typeof item.status === 'string' &&
    isSoftDeleted(item),
  ) as Array<EsignEnvelope & { deleted_at: string }>;
  const scoped = records.filter((e) => (e.firm_id || 'standalone') === (firmId || 'standalone') || firmId === '__all__');
  return scoped.sort((a, b) => (a.deleted_at > b.deleted_at ? -1 : 1));
}

/**
 * Restore an envelope by clearing the soft-delete stamp. Returns the
 * updated envelope, or `null` if nothing matched.
 */
export async function restoreEnvelope(envelopeId: string, actorId: string): Promise<EsignEnvelope | null> {
  const record = await kv.get(EsignKeys.envelope(envelopeId)) as Record<string, unknown> | null;
  if (!record || !isSoftDeleted(record)) return null;

  const updated = { ...record } as Record<string, unknown>;
  delete updated.deleted_at;
  delete updated.deleted_by;
  delete updated.delete_reason;
  updated.updated_at = new Date().toISOString();
  updated.restored_at = new Date().toISOString();
  updated.restored_by = actorId;

  await kv.set(EsignKeys.envelope(envelopeId), updated);
  log.info(`Restored envelope ${envelopeId} from recovery bin`);
  return updated as EsignEnvelope;
}

/**
 * Permanently hard-delete an envelope. Used both by the retention
 * sweeper and by the explicit "purge" admin action on the recovery bin.
 */
export async function hardDeleteEnvelope(envelopeId: string): Promise<void> {
  try {
    const envelope = (await kv.get(EsignKeys.envelope(envelopeId))) as Record<string, unknown> | null;
    if (!envelope) return;

    const signerIds = (await kv.get(EsignKeys.envelopeSigners(envelopeId))) as string[] | null;
    if (Array.isArray(signerIds)) {
      for (const id of signerIds) {
        const signer = await kv.get(EsignKeys.PREFIX_SIGNER + id);
        if (signer?.access_token) {
          try { await kv.del(EsignKeys.signerToken(signer.access_token)); } catch { /* ignore */ }
        }
        try { await kv.del(EsignKeys.PREFIX_SIGNER + id); } catch { /* ignore */ }
      }
    }
    try { await kv.del(EsignKeys.envelopeSigners(envelopeId)); } catch { /* ignore */ }

    const fieldIds = (await kv.get(EsignKeys.envelopeFields(envelopeId))) as unknown;
    if (Array.isArray(fieldIds)) {
      for (const item of fieldIds) {
        if (typeof item === 'string') {
          try { await kv.del(EsignKeys.field(item)); } catch { /* ignore */ }
        }
      }
    }
    try { await kv.del(EsignKeys.envelopeFields(envelopeId)); } catch { /* ignore */ }

    const auditIds = (await kv.get(EsignKeys.envelopeAudit(envelopeId))) as string[] | null;
    if (Array.isArray(auditIds)) {
      for (const id of auditIds) {
        try { await kv.del(EsignKeys.PREFIX_AUDIT + id); } catch { /* ignore */ }
      }
    }
    try { await kv.del(EsignKeys.envelopeAudit(envelopeId)); } catch { /* ignore */ }

    try { await kv.del(EsignKeys.envelopeManifest(envelopeId)); } catch { /* ignore */ }
    try { await kv.del(EsignKeys.envelopeAttachments(envelopeId)); } catch { /* ignore */ }

    const clientId = (envelope as { client_id?: string }).client_id;
    if (clientId) {
      const list = (await kv.get(EsignKeys.clientEnvelopes(clientId))) as string[] | null;
      if (Array.isArray(list)) {
        const updated = list.filter((id) => id !== envelopeId);
        try { await kv.set(EsignKeys.clientEnvelopes(clientId), updated); } catch { /* ignore */ }
      }
    }

    try { await kv.del(EsignKeys.envelope(envelopeId)); } catch { /* ignore */ }
    log.info(`Hard-deleted envelope ${envelopeId}`);
  } catch (err) {
    log.warn(`Failed to hard-delete envelope ${envelopeId}:`, err);
  }
}

export interface RecoveryBinSweepResult {
  scannedCount: number;
  purgedCount: number;
  durationMs: number;
}

/** Scheduler entry point: purge anything deleted longer than 90 days ago. */
export async function purgeExpiredDeletedEnvelopes(
  retentionDays: number = RECOVERY_RETENTION_DAYS,
): Promise<RecoveryBinSweepResult> {
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const all = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
  const records = (all as Array<Record<string, unknown>>).filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      typeof item.id === 'string' &&
      typeof item.status === 'string',
  );

  let purged = 0;
  for (const env of records) {
    if (!isSoftDeleted(env)) continue;
    const deletedAt = new Date(env.deleted_at).getTime();
    if (!Number.isFinite(deletedAt)) continue;
    if (deletedAt > cutoff.getTime()) continue;
    await hardDeleteEnvelope(env.id as string);
    purged += 1;
  }

  const durationMs = Date.now() - startedAt;
  log.info(`Recovery bin sweep: scanned=${records.length}, purged=${purged}, duration=${durationMs}ms`);
  return { scannedCount: records.length, purgedCount: purged, durationMs };
}
