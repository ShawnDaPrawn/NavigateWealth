/**
 * P7.1 — Org metrics service.
 *
 * Aggregates envelope and audit data to produce the org-wide health
 * view used by the admin dashboard. All reads are firm-scoped by the
 * caller; this service takes an optional firmId and silently filters.
 *
 * What it exposes:
 *   • Status counts (sent / viewed / partially_signed / completed /
 *     declined / expired / voided / drafts).
 *   • Funnel counts (sent → opened → started → completed), with per
 *     stage % conversion.
 *   • Average time-to-sign across completed envelopes, broken down by
 *     template (template_id → { count, avgMs }).
 *   • Stuck envelopes — sent ≥ 7 days ago with no `viewed_at` on any
 *     signer, limited to the top 10 oldest.
 *   • A moving-window throughput chart — completed per day over the
 *     last 30 days, suitable for a small sparkline.
 *
 * The service deliberately works directly off the KV store today so
 * the metrics dashboard ships without needing the Phase-0 Postgres
 * migration to land first. When that migration is complete the
 * aggregation will be swapped for indexed SQL without touching any
 * caller.
 */

import * as kv from './kv_store.tsx';
import { EsignKeys } from './esign-keys.ts';
import { mgetIdLists, mgetKeyed } from './kv-batch.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { EsignEnvelope, EsignSigner } from './esign-types.ts';

const log = createModuleLogger('esign-metrics');

/** Envelopes sent this many days ago without any view are "stuck". */
const STUCK_THRESHOLD_DAYS = 7;

export interface StatusCounts {
  draft: number;
  sent: number;
  viewed: number;
  partially_signed: number;
  completing: number;
  completed: number;
  declined: number;
  expired: number;
  voided: number;
  total: number;
}

export interface Funnel {
  sent: number;
  opened: number;
  started: number;
  completed: number;
  /** Sent → opened, opened → started, started → completed percentages. */
  sentToOpenedPct: number;
  openedToStartedPct: number;
  startedToCompletedPct: number;
}

export interface TimeToSign {
  completedCount: number;
  averageMs: number | null;
  medianMs: number | null;
  byTemplate: Array<{ templateId: string | null; count: number; averageMs: number }>;
}

export interface StuckEnvelope {
  id: string;
  title: string;
  sent_at?: string;
  days_since_sent: number;
  signer_count: number;
  client_id?: string;
}

export interface ThroughputPoint {
  date: string; // yyyy-mm-dd
  completed: number;
}

export interface EsignMetrics {
  firm_id: string;
  generated_at: string;
  statusCounts: StatusCounts;
  funnel: Funnel;
  timeToSign: TimeToSign;
  stuckEnvelopes: StuckEnvelope[];
  throughput30d: ThroughputPoint[];
}

function isEnvelopeRecord(item: unknown): item is EsignEnvelope {
  return (
    !!item &&
    typeof item === 'object' &&
    !Array.isArray(item) &&
    typeof (item as { id?: unknown }).id === 'string' &&
    typeof (item as { status?: unknown }).status === 'string' &&
    typeof (item as { document_id?: unknown }).document_id === 'string'
  );
}

/**
 * Scan KV for every envelope belonging to a firm (or all firms when
 * `firmId === '__all__'`). Soft-deleted rows are excluded.
 */
async function listFirmEnvelopes(firmId: string): Promise<EsignEnvelope[]> {
  const all = await kv.getByPrefix(EsignKeys.PREFIX_ENVELOPE);
  return (all as unknown[])
    .filter(isEnvelopeRecord)
    .filter((e) => !e.deleted_at)
    .filter((e) => firmId === '__all__' || (e.firm_id || 'standalone') === firmId);
}

/**
 * Signers for each envelope, in the same order as `envelopes`.
 *
 * Both callers below used to read these inline: await the envelope's signer-id
 * list, then await each signer ONE AT A TIME in a nested `for` loop. That made
 * the cost strictly sequential in envelopes x signers — a hundred envelopes of
 * two signers was three hundred round trips in series, and the E-Signature
 * dashboard waited for all of them. Two batched reads replace the lot.
 */
async function loadSignersByEnvelope(envelopes: EsignEnvelope[]): Promise<EsignSigner[][]> {
  if (envelopes.length === 0) return [];

  const signerIdLists = await mgetIdLists(envelopes.map((e) => EsignKeys.envelopeSigners(e.id)));
  const signersById = await mgetKeyed<EsignSigner>(EsignKeys.PREFIX_SIGNER, signerIdLists.flat());

  return signerIdLists.map(
    (ids) => ids.map((id) => signersById.get(id)).filter(Boolean) as EsignSigner[],
  );
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.round((n / d) * 1000) / 10;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Compute the dashboard metrics bundle for a firm. Expensive in the
 * KV-era (O(N) in envelopes); cheap with the Phase-0 indexed schema.
 */
export async function getEsignMetrics(firmId: string): Promise<EsignMetrics> {
  const startedAt = Date.now();
  const envelopes = await listFirmEnvelopes(firmId);

  // ── Status counts ────────────────────────────────────────────────
  const status: StatusCounts = {
    draft: 0,
    sent: 0,
    viewed: 0,
    partially_signed: 0,
    completing: 0,
    completed: 0,
    declined: 0,
    expired: 0,
    voided: 0,
    total: envelopes.length,
  };
  for (const e of envelopes) {
    const s = e.status as keyof StatusCounts;
    if (s in status) status[s] = (status[s] as number) + 1;
  }

  // ── Funnel: we count distinct envelopes reaching each stage ──────
  // `sent` = anything ever dispatched; `opened` = at least one signer
  // viewed; `started` = at least one signer began filling fields;
  // `completed` = reached the completed status.
  const funnelCounts = { sent: 0, opened: 0, started: 0, completed: 0 };
  const completedSigningDurationsMs: number[] = [];
  const timeByTemplate = new Map<string | null, { count: number; sumMs: number }>();
  const throughputBuckets = new Map<string, number>();

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < 30; i++) {
    const d = new Date(windowStart.getTime() + i * 24 * 60 * 60 * 1000);
    throughputBuckets.set(ymd(d), 0);
  }

  const stuckCandidates: Array<{ envelope: EsignEnvelope; signers: EsignSigner[] }> = [];
  const stuckThresholdMs = STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const signersByEnvelope = await loadSignersByEnvelope(envelopes);

  for (const [index, envelope] of envelopes.entries()) {
    const signers = signersByEnvelope[index];

    const sentAt = (envelope as { sent_at?: string }).sent_at;
    if (sentAt || envelope.status !== 'draft') funnelCounts.sent += 1;

    // Opened = any signer has a viewed timestamp
    const opened = signers.some((s) => !!s.viewed_at);
    if (opened) funnelCounts.opened += 1;

    // Started = any signer has a field-started / partial audit fingerprint.
    // Cheap heuristic — if there are any signed signers OR at least one
    // signer that is past 'pending' (viewed / signed), we count it.
    const started = signers.some((s) => s.status && s.status !== 'pending');
    if (started) funnelCounts.started += 1;

    if (envelope.status === 'completed') {
      funnelCounts.completed += 1;

      // Time-to-sign from sent_at → completed_at.
      const completedAt = (envelope as { completed_at?: string }).completed_at;
      if (sentAt && completedAt) {
        const ms = new Date(completedAt).getTime() - new Date(sentAt).getTime();
        if (Number.isFinite(ms) && ms > 0) {
          completedSigningDurationsMs.push(ms);
          const tplId = (envelope as { template_id?: string | null }).template_id ?? null;
          const agg = timeByTemplate.get(tplId) || { count: 0, sumMs: 0 };
          agg.count += 1;
          agg.sumMs += ms;
          timeByTemplate.set(tplId, agg);
        }

        // 30-day throughput bucket.
        const completedDate = new Date(completedAt);
        if (completedDate >= windowStart && completedDate <= now) {
          const key = ymd(completedDate);
          throughputBuckets.set(key, (throughputBuckets.get(key) ?? 0) + 1);
        }
      }
    }

    // Stuck detection: sent ≥ 7d ago, nobody has viewed.
    if (sentAt && ['sent', 'viewed', 'partially_signed'].includes(envelope.status)) {
      const ageMs = now.getTime() - new Date(sentAt).getTime();
      if (ageMs >= stuckThresholdMs && !opened) {
        stuckCandidates.push({ envelope, signers });
      }
    }
  }

  const avgMs = completedSigningDurationsMs.length
    ? Math.round(
        completedSigningDurationsMs.reduce((a, b) => a + b, 0) / completedSigningDurationsMs.length,
      )
    : null;
  const medianMs = completedSigningDurationsMs.length
    ? completedSigningDurationsMs.slice().sort((a, b) => a - b)[
        Math.floor(completedSigningDurationsMs.length / 2)
      ]
    : null;

  const byTemplate = Array.from(timeByTemplate.entries())
    .map(([templateId, agg]) => ({
      templateId,
      count: agg.count,
      averageMs: Math.round(agg.sumMs / agg.count),
    }))
    .sort((a, b) => b.count - a.count);

  const stuckEnvelopes: StuckEnvelope[] = stuckCandidates
    .map(({ envelope, signers }) => {
      const sentAt = (envelope as { sent_at?: string }).sent_at;
      const days = sentAt
        ? Math.floor((now.getTime() - new Date(sentAt).getTime()) / (24 * 60 * 60 * 1000))
        : 0;
      return {
        id: envelope.id,
        title: envelope.title,
        sent_at: sentAt,
        days_since_sent: days,
        signer_count: signers.length,
        client_id: envelope.client_id,
      };
    })
    .sort((a, b) => b.days_since_sent - a.days_since_sent)
    .slice(0, 10);

  const throughput30d: ThroughputPoint[] = Array.from(throughputBuckets.entries())
    .map(([date, completed]) => ({ date, completed }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const funnel: Funnel = {
    sent: funnelCounts.sent,
    opened: funnelCounts.opened,
    started: funnelCounts.started,
    completed: funnelCounts.completed,
    sentToOpenedPct: pct(funnelCounts.opened, funnelCounts.sent),
    openedToStartedPct: pct(funnelCounts.started, funnelCounts.opened),
    startedToCompletedPct: pct(funnelCounts.completed, funnelCounts.started),
  };

  const durationMs = Date.now() - startedAt;
  log.info(`Metrics computed for firm ${firmId} in ${durationMs}ms (N=${envelopes.length})`);

  return {
    firm_id: firmId,
    generated_at: new Date().toISOString(),
    statusCounts: status,
    funnel,
    timeToSign: {
      completedCount: completedSigningDurationsMs.length,
      averageMs: avgMs,
      medianMs,
      byTemplate,
    },
    stuckEnvelopes,
    throughput30d,
  };
}

/**
 * Scheduler callback: returns the id list of currently stuck envelopes
 * for a firm (used by P7.2 alerts). Keeps the threshold consistent
 * with the metrics view.
 */
export async function findStuckEnvelopes(
  firmId: string,
): Promise<Array<{ envelope: EsignEnvelope; days: number }>> {
  const envelopes = await listFirmEnvelopes(firmId);
  const now = Date.now();
  const stuckThresholdMs = STUCK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  // Age and status rule an envelope out without reading anything, so narrow
  // first and only load signers for what is left — then load those together
  // rather than one signer at a time inside the loop.
  const candidates = envelopes
    .map((envelope) => {
      const sentAt = (envelope as { sent_at?: string }).sent_at;
      if (!['sent', 'viewed', 'partially_signed'].includes(envelope.status) || !sentAt) return null;
      const ageMs = now - new Date(sentAt).getTime();
      if (ageMs < stuckThresholdMs) return null;
      return { envelope, ageMs };
    })
    .filter(Boolean) as Array<{ envelope: EsignEnvelope; ageMs: number }>;

  const signersByCandidate = await loadSignersByEnvelope(candidates.map((c) => c.envelope));

  return candidates
    .filter((_, index) => !signersByCandidate[index].some((signer) => signer.viewed_at))
    .map(({ envelope, ageMs }) => ({
      envelope,
      days: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
    }));
}
