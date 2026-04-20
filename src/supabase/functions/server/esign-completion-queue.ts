/**
 * P7.5 — Background signed-PDF completion queue.
 *
 * Before this service landed, the signer submit route `await`-ed
 * `completeEnvelope()`, which performs burn-in, certificate
 * generation, merge, PKCS#7 sealing, and upload. For a 50-page PDF
 * with multiple signers this can take 5-10 seconds — all while the
 * signer's browser holds an open request and a mobile device may
 * time out.
 *
 * Instead, the sign route now:
 *   1. Flips the envelope status to `completing`.
 *   2. Enqueues the envelope id into a KV-backed work queue.
 *   3. Returns immediately.
 *
 * The scheduler calls `drainCompletionQueue()` every ~15 seconds.
 * Each item is processed exactly once (delete-then-work) with a
 * retry count and a dead-letter status for permanent failures.
 *
 * The design is intentionally simple: we target one edge-function
 * instance and favour correctness over throughput. Enqueue is
 * idempotent — enqueueing the same envelope twice while the first
 * job is still in flight leaves the queue unchanged.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { completeEnvelope } from './esign-workflow.ts';
import { updateEnvelopeStatus, logAuditEvent, getEnvelopeDetails } from './esign-services.ts';

const log = createModuleLogger('esign-completion-queue');

const QUEUE_KEY = 'esign:completion-queue:pending';
const IN_FLIGHT_KEY = (envelopeId: string) => `esign:completion-queue:inflight:${envelopeId}`;
/** Max attempts before a job is dead-lettered. */
const MAX_ATTEMPTS = 3;

export interface CompletionJob {
  envelopeId: string;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

export interface DrainResult {
  processed: number;
  failed: number;
  deadLettered: number;
  remaining: number;
}

/**
 * Enqueue an envelope for background completion. Idempotent: if the
 * envelope is already pending OR in flight, this is a no-op.
 */
export async function enqueueCompletion(envelopeId: string): Promise<void> {
  const raw = await kv.get(QUEUE_KEY);
  const queue: CompletionJob[] = Array.isArray(raw) ? raw : [];
  if (queue.some((j) => j.envelopeId === envelopeId)) {
    log.info(`Completion already queued for envelope ${envelopeId}`);
    return;
  }
  const inFlight = await kv.get(IN_FLIGHT_KEY(envelopeId));
  if (inFlight) {
    log.info(`Completion already in flight for envelope ${envelopeId}`);
    return;
  }

  queue.push({
    envelopeId,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await kv.set(QUEUE_KEY, queue);

  // Best-effort status flip. If the envelope is already completed (e.g.
  // a race with the drain loop) we skip the transition.
  try {
    const envelope = await getEnvelopeDetails(envelopeId);
    if (envelope && envelope.status !== 'completed' && envelope.status !== 'voided' && envelope.status !== 'declined') {
      await updateEnvelopeStatus(envelopeId, 'completing');
      await logAuditEvent({
        envelopeId,
        actorType: 'system',
        action: 'completion_enqueued',
        metadata: { queue_depth: queue.length },
      });
    }
  } catch (err) {
    log.warn(`Failed to flip envelope ${envelopeId} to completing: ${String(err)}`);
  }
}

/**
 * Drain up to `maxJobs` items from the queue. Each job runs through
 * `completeEnvelope`; failures retry up to `MAX_ATTEMPTS` before
 * being dead-lettered (envelope is moved back to `partially_signed`
 * with a `completion_failed` audit event so an operator can retry
 * manually).
 */
export async function drainCompletionQueue(maxJobs = 5): Promise<DrainResult> {
  const raw = await kv.get(QUEUE_KEY);
  const queue: CompletionJob[] = Array.isArray(raw) ? raw : [];
  if (!queue.length) return { processed: 0, failed: 0, deadLettered: 0, remaining: 0 };

  const batch = queue.slice(0, maxJobs);
  const remaining = queue.slice(batch.length);
  // Persist the shorter queue first so we don't redo finished jobs
  // if this instance is torn down mid-drain.
  await kv.set(QUEUE_KEY, remaining);

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;
  const retryBucket: CompletionJob[] = [];

  for (const job of batch) {
    await kv.set(IN_FLIGHT_KEY(job.envelopeId), {
      startedAt: new Date().toISOString(),
      attempts: job.attempts + 1,
    });

    try {
      const result = await completeEnvelope(job.envelopeId);
      if (result.success) {
        processed += 1;
      } else {
        throw new Error(result.error || 'Unknown completion failure');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`Completion job failed for envelope ${job.envelopeId} (attempt ${job.attempts + 1}): ${msg}`);
      if (job.attempts + 1 >= MAX_ATTEMPTS) {
        deadLettered += 1;
        try {
          await updateEnvelopeStatus(job.envelopeId, 'partially_signed');
          await logAuditEvent({
            envelopeId: job.envelopeId,
            actorType: 'system',
            action: 'completion_dead_lettered',
            metadata: { attempts: job.attempts + 1, error: msg },
          });
        } catch (logErr) {
          log.error(`Dead-letter audit write failed for ${job.envelopeId}: ${String(logErr)}`);
        }
      } else {
        failed += 1;
        retryBucket.push({
          envelopeId: job.envelopeId,
          enqueuedAt: job.enqueuedAt,
          attempts: job.attempts + 1,
          lastError: msg,
        });
      }
    } finally {
      await kv.del(IN_FLIGHT_KEY(job.envelopeId));
    }
  }

  if (retryBucket.length) {
    const currentRaw = await kv.get(QUEUE_KEY);
    const current: CompletionJob[] = Array.isArray(currentRaw) ? currentRaw : [];
    await kv.set(QUEUE_KEY, [...current, ...retryBucket]);
  }

  const finalRaw = await kv.get(QUEUE_KEY);
  const finalQueue: CompletionJob[] = Array.isArray(finalRaw) ? finalRaw : [];

  return { processed, failed, deadLettered, remaining: finalQueue.length };
}

/** Diagnostic helper used by the dashboard and synthetic probe. */
export async function getQueueDepth(): Promise<number> {
  const raw = await kv.get(QUEUE_KEY);
  return Array.isArray(raw) ? raw.length : 0;
}
