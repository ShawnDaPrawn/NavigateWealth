/**
 * P7.3 — Firm-scoped global audit search.
 *
 * Scans every `esign:audit:*` KV record, filters by the caller's firm
 * (resolved via the audit event's envelope), then applies the
 * optional filters. Results are returned newest-first and capped.
 *
 * Why the scan? Until the Phase-0 Postgres migration lands the audit
 * trail is KV-only. The scan is O(A) in audit events which, for
 * reasonable firm sizes (thousands of envelopes × ~dozen events each),
 * completes in a few hundred ms. Post-migration this service becomes
 * a parameterised SQL query and the implementation swap is local.
 *
 * All reads are firm-scoped — audit events whose envelope does not
 * belong to the caller's firm are filtered out, and the envelope
 * metadata is enriched into each returned row so the UI can render
 * contextually.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { EsignAuditEvent, EsignEnvelope } from './esign-types.ts';

const log = createModuleLogger('esign-audit-search');

export interface AuditSearchFilters {
  firmId: string;
  signerEmail?: string;
  action?: string;
  from?: string;
  to?: string;
  envelopeId?: string;
  limit?: number;
}

export interface AuditSearchHit {
  id: string;
  envelope_id: string;
  envelope_title: string;
  firm_id: string;
  actor_type: string;
  actor_id?: string;
  action: string;
  at: string;
  ip?: string;
  user_agent?: string;
  email?: string;
  phone?: string;
  metadata: Record<string, unknown>;
}

export interface AuditSearchResult {
  hits: AuditSearchHit[];
  total: number;
  truncated: boolean;
  scanned: number;
  durationMs: number;
}

function isAuditEvent(item: unknown): item is EsignAuditEvent {
  return !!item
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { envelope_id?: unknown }).envelope_id === 'string'
    && typeof (item as { action?: unknown }).action === 'string'
    && typeof (item as { at?: unknown }).at === 'string';
}

export async function searchAuditEvents(filters: AuditSearchFilters): Promise<AuditSearchResult> {
  const start = Date.now();
  const limit = filters.limit ?? 100;

  const raw = await kv.getByPrefix(EsignKeys.PREFIX_AUDIT);
  const all = (raw as unknown[]).filter(isAuditEvent);

  // Prefetch envelope lookups we need to enforce firm scope and render
  // titles. We cache by envelope_id to avoid N lookups for N events on
  // the same envelope.
  const envelopeCache = new Map<string, EsignEnvelope | null>();
  const resolveEnvelope = async (envelopeId: string): Promise<EsignEnvelope | null> => {
    if (envelopeCache.has(envelopeId)) return envelopeCache.get(envelopeId)!;
    const record = await kv.get(EsignKeys.envelope(envelopeId));
    const envelope = (record && typeof record === 'object' && 'id' in record)
      ? record as EsignEnvelope
      : null;
    envelopeCache.set(envelopeId, envelope);
    return envelope;
  };

  // Early coarse filter by action / dates / email / envelope to keep
  // the per-event envelope lookup footprint small.
  const actionFilter = filters.action?.trim().toLowerCase();
  const emailFilter = filters.signerEmail?.trim().toLowerCase();
  const fromMs = filters.from ? new Date(filters.from).getTime() : null;
  const toMs = filters.to ? new Date(filters.to).getTime() : null;

  const scoredCandidates = all.filter((event) => {
    if (filters.envelopeId && event.envelope_id !== filters.envelopeId) return false;
    if (actionFilter && !event.action.toLowerCase().includes(actionFilter)) return false;
    if (emailFilter && event.email?.toLowerCase() !== emailFilter) return false;
    if (fromMs || toMs) {
      const t = new Date(event.at).getTime();
      if (fromMs && t < fromMs) return false;
      if (toMs && t > toMs) return false;
    }
    return true;
  });

  // Firm scope + title enrichment. We iterate newest-first so we stop
  // at `limit` without scanning the long tail.
  scoredCandidates.sort((a, b) => (a.at < b.at ? 1 : -1));

  const hits: AuditSearchHit[] = [];
  let truncated = false;
  for (const event of scoredCandidates) {
    const envelope = await resolveEnvelope(event.envelope_id);
    if (!envelope) continue;
    if (envelope.deleted_at) continue;
    const firmId = envelope.firm_id || 'standalone';
    if (filters.firmId !== '__all__' && firmId !== filters.firmId) continue;

    hits.push({
      id: event.id,
      envelope_id: event.envelope_id,
      envelope_title: envelope.title,
      firm_id: firmId,
      actor_type: event.actor_type,
      actor_id: event.actor_id,
      action: event.action,
      at: event.at,
      ip: event.ip,
      user_agent: event.user_agent,
      email: event.email,
      phone: event.phone,
      metadata: event.metadata,
    });

    if (hits.length >= limit) {
      truncated = true;
      break;
    }
  }

  const durationMs = Date.now() - start;
  log.info(
    `Audit search firm=${filters.firmId} scanned=${all.length} filtered=${scoredCandidates.length} hits=${hits.length} truncated=${truncated} durationMs=${durationMs}`,
  );

  return {
    hits,
    total: hits.length,
    truncated,
    scanned: all.length,
    durationMs,
  };
}
