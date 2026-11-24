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
 *   3. Kicks a drain with `kickCompletionDrain()`, which registers the
 *      work with `EdgeRuntime.waitUntil` so the runtime keeps the
 *      isolate alive until it settles.
 *   4. Returns immediately.
 *
 * Step 3 is load-bearing (incident 2026-11-23). The queue used to be
 * drained only by a `setInterval` tick. A tick that fires after the last
 * request has returned runs in an isolate the runtime considers idle, and
 * Supabase drops idle isolates (`EarlyDrop`) without warning. The job died
 * two seconds in — after the envelope was marked completed, before the
 * signed PDF was built or any email was sent — and because the queue
 * deleted each job BEFORE working on it, nothing ever retried it. The
 * signer, the client and the adviser all got silence.
 *
 * So jobs are now LEASED, not deleted, while they run. A job stays in the
 * queue with a `leasedUntil` stamp; success removes it, failure clears the
 * lease for a retry, and a job whose isolate vanished simply has its lease
 * expire and is picked up by the next drain. `attempts` is counted when the
 * lease is taken, so a job that keeps killing its isolate still reaches
 * MAX_ATTEMPTS and is dead-lettered rather than retried forever.
 *
 * The interval tick in esign-scheduler.ts stays as a backstop for warm
 * isolates. KV has no compare-and-set, so two isolates draining at the same
 * instant can both take one job; `completeEnvelope` tolerates a second run,
 * so the cost of that race is duplicate work, not lost work.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { completeEnvelope } from './esign-workflow.ts';
import { updateEnvelopeStatus, logAuditEvent, getEnvelopeDetails } from './esign-services.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('esign-completion-queue');

const QUEUE_KEY = 'esign:completion-queue:pending';
/** Max attempts before a job is dead-lettered. */
const MAX_ATTEMPTS = 3;
/**
 * How long a drain holds a job before another drain may take it over.
 * Comfortably longer than the edge runtime's wall-clock limit, so a live job
 * is never taken over; short enough that a job whose isolate was dropped is
 * retried within minutes.
 */
export const COMPLETION_LEASE_MS = 7 * 60 * 1000;

export interface CompletionJob {
  envelopeId: string;
  enqueuedAt: string;
  attempts: number;
  /** ISO time until which a drain owns this job. Absent = available. */
  leasedUntil?: string;
  lastError?: string;
}

export interface DrainResult {
  processed: number;
  failed: number;
  deadLettered: number;
  remaining: number;
}

async function loadQueue(): Promise<CompletionJob[]> {
  const raw = await kv.get(QUEUE_KEY);
  return Array.isArray(raw) ? (raw as CompletionJob[]) : [];
}

async function saveQueue(queue: CompletionJob[]): Promise<void> {
  await kv.set(QUEUE_KEY, queue);
}

/** Re-read the queue and apply `change` to one envelope's job. */
async function updateJob(
  envelopeId: string,
  change: (job: CompletionJob) => CompletionJob | null,
): Promise<void> {
  const queue = await loadQueue();
  const next: CompletionJob[] = [];
  for (const job of queue) {
    if (job.envelopeId !== envelopeId) {
      next.push(job);
      continue;
    }
    const changed = change(job);
    if (changed) next.push(changed);
  }
  await saveQueue(next);
}

function isAvailable(job: CompletionJob, now: number): boolean {
  if (!job.leasedUntil) return true;
  const until = Date.parse(job.leasedUntil);
  return Number.isNaN(until) || until <= now;
}

/**
 * Enqueue an envelope for background completion. Idempotent: if the
 * envelope is already in the queue (waiting or leased), this is a no-op.
 */
export async function enqueueCompletion(envelopeId: string): Promise<void> {
  const queue = await loadQueue();
  if (queue.some((j) => j.envelopeId === envelopeId)) {
    log.info(`Completion already queued for envelope ${envelopeId}`);
    return;
  }

  queue.push({
    envelopeId,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await saveQueue(queue);

  // Best-effort status flip. If the envelope is already completed (e.g.
  // a race with the drain loop) we skip the transition.
  try {
    const envelope = await getEnvelopeDetails(envelopeId);
    if (
      envelope &&
      envelope.status !== 'completed' &&
      envelope.status !== 'voided' &&
      envelope.status !== 'declined'
    ) {
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
 * Drain up to `maxJobs` available items from the queue. Each job runs
 * through `completeEnvelope`; failures retry up to `MAX_ATTEMPTS` before
 * being dead-lettered (envelope is moved back to `partially_signed`
 * with a `completion_dead_lettered` audit event so an operator can retry
 * manually).
 */
export async function drainCompletionQueue(maxJobs = 5): Promise<DrainResult> {
  const now = Date.now();
  const queue = await loadQueue();
  if (!queue.length) return { processed: 0, failed: 0, deadLettered: 0, remaining: 0 };

  // Take the lease BEFORE working, and persist it, so a dropped isolate
  // leaves the job in the queue for the next drain instead of losing it.
  const leasedUntil = new Date(now + COMPLETION_LEASE_MS).toISOString();
  const batch: CompletionJob[] = [];
  const leased = queue.map((job) => {
    if (batch.length >= maxJobs || !isAvailable(job, now)) return job;
    const taken = { ...job, attempts: job.attempts + 1, leasedUntil };
    batch.push(taken);
    return taken;
  });
  if (!batch.length) {
    return { processed: 0, failed: 0, deadLettered: 0, remaining: queue.length };
  }
  await saveQueue(leased);

  let processed = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const job of batch) {
    let error: string | null = null;
    try {
      const result = await completeEnvelope(job.envelopeId);
      if (!result.success) error = result.error || 'Unknown completion failure';
    } catch (err) {
      error = getErrMsg(err);
    }

    if (error === null) {
      processed += 1;
      await updateJob(job.envelopeId, () => null);
      continue;
    }

    log.error(
      `Completion job failed for envelope ${job.envelopeId} (attempt ${job.attempts}): ${error}`,
    );
    if (job.attempts >= MAX_ATTEMPTS) {
      deadLettered += 1;
      await updateJob(job.envelopeId, () => null);
      try {
        await updateEnvelopeStatus(job.envelopeId, 'partially_signed');
        await logAuditEvent({
          envelopeId: job.envelopeId,
          actorType: 'system',
          action: 'completion_dead_lettered',
          metadata: { attempts: job.attempts, error },
        });
      } catch (logErr) {
        log.error(`Dead-letter audit write failed for ${job.envelopeId}: ${String(logErr)}`);
      }
    } else {
      failed += 1;
      const lastError = error;
      await updateJob(job.envelopeId, (j) => ({ ...j, leasedUntil: undefined, lastError }));
    }
  }

  return { processed, failed, deadLettered, remaining: (await loadQueue()).length };
}

/** One drain per isolate at a time; a second kick joins the running one. */
let activeDrain: Promise<DrainResult | void> | null = null;

/**
 * Start a drain that the runtime will not drop mid-way.
 *
 * Call from a request handler: the drain is registered with
 * `EdgeRuntime.waitUntil`, which holds the isolate open past the response
 * until the drain settles. Outside the edge runtime (tests, local dev) the
 * drain simply runs detached. Never throws.
 */
export function kickCompletionDrain(): void {
  if (!activeDrain) {
    activeDrain = drainCompletionQueue()
      .catch((err) => log.error(`Completion drain failed: ${getErrMsg(err)}`))
      .finally(() => {
        activeDrain = null;
      });
  }
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (typeof runtime?.waitUntil === 'function') {
    runtime.waitUntil(activeDrain);
  }
}

/** Diagnostic helper used by the dashboard and synthetic probe. */
export async function getQueueDepth(): Promise<number> {
  return (await loadQueue()).length;
}
