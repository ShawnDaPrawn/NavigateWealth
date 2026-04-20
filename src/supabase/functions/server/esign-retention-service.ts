/**
 * P7.7 — Long-term retention policy service.
 *
 * Every firm can configure how long the platform keeps envelopes
 * (and their artifacts) past a terminal state. The default policy
 * keeps everything indefinitely — firms opt in to purging by setting
 * retention windows. Retention is measured from the envelope's
 * completed_at / expired_at / recalled_at / declined_at timestamp,
 * whichever is latest.
 *
 * Three independent windows are supported:
 *   • completed_retention_days     — envelopes in status `completed`
 *   • terminated_retention_days    — envelopes in status
 *     `declined` | `voided` | `expired`
 *   • draft_retention_days         — inactive drafts (never sent)
 *
 * When `delete_artifacts` is true the sweep also removes the
 * generated Storage objects (signed PDF, certificate, attachments).
 * Otherwise it only soft-deletes the envelope record and lets the
 * Storage lifecycle rules (if configured externally) handle the
 * files.
 *
 * The sweep is firm-scoped: it loads every known policy, then scans
 * envelopes per firm. Absent a policy for a firm, that firm's rows
 * are left alone — zero cost.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { EsignEnvelope } from './esign-types.ts';
import { logAuditEvent } from './esign-services.ts';
import { hardDeleteEnvelope } from './esign-recovery-bin.ts';

const log = createModuleLogger('esign-retention');

export interface RetentionPolicy {
  firm_id: string;
  completed_retention_days: number | null;
  terminated_retention_days: number | null;
  draft_retention_days: number | null;
  /** If true, permanently purge artifacts from Storage instead of just
   *  marking the envelope soft-deleted. */
  delete_artifacts: boolean;
  updated_at: string;
}

export interface RetentionPolicyInput {
  completed_retention_days?: number | null;
  terminated_retention_days?: number | null;
  draft_retention_days?: number | null;
  delete_artifacts?: boolean;
}

export interface RetentionSweepResult {
  scanned: number;
  purged: number;
  softDeleted: number;
  skipped: number;
  errors: number;
}

// ─────────────────────────────────────────────────────────────────────
// Policy CRUD
// ─────────────────────────────────────────────────────────────────────

function validateDays(n: number | null | undefined): number | null {
  if (n == null) return null;
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export async function getRetentionPolicy(firmId: string): Promise<RetentionPolicy | null> {
  const raw = await kv.get(EsignKeys.retentionPolicy(firmId));
  if (!raw || typeof raw !== 'object') return null;
  return raw as RetentionPolicy;
}

export async function setRetentionPolicy(
  firmId: string,
  input: RetentionPolicyInput,
): Promise<RetentionPolicy> {
  const existing = await getRetentionPolicy(firmId);
  const next: RetentionPolicy = {
    firm_id: firmId,
    completed_retention_days:
      input.completed_retention_days === undefined
        ? existing?.completed_retention_days ?? null
        : validateDays(input.completed_retention_days),
    terminated_retention_days:
      input.terminated_retention_days === undefined
        ? existing?.terminated_retention_days ?? null
        : validateDays(input.terminated_retention_days),
    draft_retention_days:
      input.draft_retention_days === undefined
        ? existing?.draft_retention_days ?? null
        : validateDays(input.draft_retention_days),
    delete_artifacts: input.delete_artifacts ?? existing?.delete_artifacts ?? false,
    updated_at: new Date().toISOString(),
  };
  await kv.set(EsignKeys.retentionPolicy(firmId), next);

  // Keep a lightweight index of firms with active policies so the
  // sweeper can iterate without scanning every KV key.
  const indexRaw = await kv.get(EsignKeys.retentionPoliciesIndex());
  const index: string[] = Array.isArray(indexRaw) ? indexRaw : [];
  if (!index.includes(firmId)) {
    await kv.set(EsignKeys.retentionPoliciesIndex(), [...index, firmId]);
  }

  log.info(
    `Retention policy updated for firm ${firmId}: ` +
    `completed=${next.completed_retention_days}d, ` +
    `terminated=${next.terminated_retention_days}d, ` +
    `draft=${next.draft_retention_days}d, ` +
    `artifacts=${next.delete_artifacts}`,
  );
  return next;
}

export async function deleteRetentionPolicy(firmId: string): Promise<void> {
  await kv.del(EsignKeys.retentionPolicy(firmId));
  const indexRaw = await kv.get(EsignKeys.retentionPoliciesIndex());
  const index: string[] = Array.isArray(indexRaw) ? indexRaw : [];
  await kv.set(EsignKeys.retentionPoliciesIndex(), index.filter((id) => id !== firmId));
}

// ─────────────────────────────────────────────────────────────────────
// Sweeper
// ─────────────────────────────────────────────────────────────────────

function isEnvelopeRecord(item: unknown): item is EsignEnvelope {
  return !!item
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { status?: unknown }).status === 'string'
    && typeof (item as { document_id?: unknown }).document_id === 'string';
}

function terminalTimestamp(envelope: EsignEnvelope): number | null {
  const candidates: string[] = [];
  const rec = envelope as unknown as Record<string, unknown>;
  for (const key of ['completed_at', 'expired_at', 'declined_at', 'recalled_at', 'voided_at']) {
    const value = rec[key];
    if (typeof value === 'string') candidates.push(value);
  }
  if (!candidates.length) return null;
  return Math.max(...candidates.map((iso) => new Date(iso).getTime()).filter((t) => Number.isFinite(t)));
}

function draftIdleTimestamp(envelope: EsignEnvelope): number | null {
  const rec = envelope as unknown as Record<string, unknown>;
  const updated = typeof rec.updated_at === 'string' ? rec.updated_at : null;
  const created = typeof rec.created_at === 'string' ? rec.created_at : null;
  const iso = updated || created;
  return iso ? new Date(iso).getTime() : null;
}

function isPastRetention(timestamp: number | null, retentionDays: number | null): boolean {
  if (timestamp == null || retentionDays == null) return false;
  const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  return ageDays >= retentionDays;
}

async function listAllEnvelopes(): Promise<EsignEnvelope[]> {
  const all = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
  return (all as unknown[]).filter(isEnvelopeRecord);
}

/**
 * Run the retention sweep across every firm that has configured a
 * policy. Returns an aggregate summary. Safe to call at any time.
 */
export async function runRetentionSweep(): Promise<RetentionSweepResult> {
  const result: RetentionSweepResult = { scanned: 0, purged: 0, softDeleted: 0, skipped: 0, errors: 0 };

  const indexRaw = await kv.get(EsignKeys.retentionPoliciesIndex());
  const firmIds: string[] = Array.isArray(indexRaw) ? indexRaw : [];
  if (!firmIds.length) return result;

  const policies = new Map<string, RetentionPolicy>();
  for (const id of firmIds) {
    const p = await getRetentionPolicy(id);
    if (p) policies.set(id, p);
  }
  if (!policies.size) return result;

  const envelopes = await listAllEnvelopes();
  result.scanned = envelopes.length;

  for (const envelope of envelopes) {
    if (envelope.deleted_at) continue;
    const firmId = envelope.firm_id || 'standalone';
    const policy = policies.get(firmId);
    if (!policy) { result.skipped += 1; continue; }

    let eligible = false;
    if (envelope.status === 'completed') {
      eligible = isPastRetention(terminalTimestamp(envelope), policy.completed_retention_days);
    } else if (envelope.status === 'declined' || envelope.status === 'voided' || envelope.status === 'expired') {
      eligible = isPastRetention(terminalTimestamp(envelope), policy.terminated_retention_days);
    } else if (envelope.status === 'draft') {
      eligible = isPastRetention(draftIdleTimestamp(envelope), policy.draft_retention_days);
    }

    if (!eligible) { result.skipped += 1; continue; }

    try {
      await logAuditEvent({
        envelopeId: envelope.id,
        actorType: 'system',
        action: policy.delete_artifacts ? 'retention_purged' : 'retention_soft_deleted',
        metadata: {
          firm_id: firmId,
          status_at_purge: envelope.status,
          policy: {
            completed_days: policy.completed_retention_days,
            terminated_days: policy.terminated_retention_days,
            draft_days: policy.draft_retention_days,
          },
        },
      });

      if (policy.delete_artifacts) {
        await hardDeleteEnvelope(envelope.id);
        result.purged += 1;
      } else {
        // Soft-delete: stamp deleted_at, leave artifacts intact.
        const stamped: EsignEnvelope = {
          ...envelope,
          deleted_at: new Date().toISOString(),
          deleted_by: 'system:retention',
          delete_reason: 'retention_policy',
        };
        await kv.set(EsignKeys.envelope(envelope.id), stamped);
        result.softDeleted += 1;
      }
    } catch (err) {
      result.errors += 1;
      log.error(`Retention action failed for envelope ${envelope.id}: ${String(err)}`);
    }
  }

  log.info(
    `Retention sweep: scanned=${result.scanned} purged=${result.purged} softDeleted=${result.softDeleted} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}
