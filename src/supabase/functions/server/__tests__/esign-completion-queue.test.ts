/**
 * The completion queue must never lose a job.
 *
 * Incident 2026-11-23: a drain started by the scheduler's interval tick ran
 * in an isolate the edge runtime then dropped as idle. The queue had deleted
 * the job before working on it, so the envelope was left marked completed
 * with no signed copy and no emails, and nothing ever retried it. These tests
 * pin the lease semantics that replaced delete-then-work.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const work = vi.hoisted(() => ({
  complete: vi.fn(
    async (_id: string) => ({ success: true }) as { success: boolean; error?: string },
  ),
  status: vi.fn(async () => undefined),
  audit: vi.fn(async () => undefined),
}));
vi.mock('../esign-workflow.ts', () => ({ completeEnvelope: work.complete }));
vi.mock('../esign-services.ts', () => ({
  updateEnvelopeStatus: work.status,
  logAuditEvent: work.audit,
  getEnvelopeDetails: vi.fn(async () => ({ status: 'sent' })),
}));

import { kvStore } from './helpers/contract-harness.ts';
import {
  COMPLETION_LEASE_MS,
  drainCompletionQueue,
  enqueueCompletion,
  getQueueDepth,
  kickCompletionDrain,
  type CompletionJob,
} from '../esign-completion-queue.ts';

const QUEUE_KEY = 'esign:completion-queue:pending';
const queue = () => (kvStore.get(QUEUE_KEY) ?? []) as CompletionJob[];

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  work.complete.mockImplementation(async () => ({ success: true }));
  vi.useRealTimers();
});

describe('esign completion queue', () => {
  it('enqueues once and flips the envelope to completing', async () => {
    await enqueueCompletion('env-1');
    await enqueueCompletion('env-1');
    expect(queue()).toHaveLength(1);
    expect(work.status).toHaveBeenCalledWith('env-1', 'completing');
  });

  it('removes a job only after it has completed', async () => {
    await enqueueCompletion('env-1');
    let seenDuringWork: CompletionJob[] = [];
    work.complete.mockImplementation(async () => {
      seenDuringWork = queue();
      return { success: true };
    });

    const result = await drainCompletionQueue();

    // While the work ran, the job was still in the queue — leased, not gone.
    expect(seenDuringWork).toHaveLength(1);
    expect(seenDuringWork[0].leasedUntil).toBeTruthy();
    expect(seenDuringWork[0].attempts).toBe(1);
    expect(result).toEqual({ processed: 1, failed: 0, deadLettered: 0, remaining: 0 });
    expect(await getQueueDepth()).toBe(0);
  });

  it('retries a job whose isolate died mid-way once its lease expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T23:52:49Z'));
    await enqueueCompletion('env-1');

    // The isolate is dropped mid-job: completeEnvelope never settles.
    work.complete.mockImplementation(() => new Promise(() => undefined));
    void drainCompletionQueue();
    await vi.waitFor(() => expect(work.complete).toHaveBeenCalledTimes(1));
    expect(queue()[0].leasedUntil).toBeTruthy();

    // A second drain while the lease is live leaves the job alone…
    work.complete.mockImplementation(async () => ({ success: true }));
    expect((await drainCompletionQueue()).processed).toBe(0);
    expect(work.complete).toHaveBeenCalledTimes(1);

    // …and takes it over once the lease has run out.
    vi.setSystemTime(Date.now() + COMPLETION_LEASE_MS + 1);
    const result = await drainCompletionQueue();
    expect(result.processed).toBe(1);
    expect(work.complete).toHaveBeenCalledTimes(2);
    expect(await getQueueDepth()).toBe(0);
  });

  it('releases a failed job for retry, then dead-letters it after three attempts', async () => {
    await enqueueCompletion('env-1');
    work.complete.mockImplementation(async () => ({ success: false, error: 'seal failed' }));

    const first = await drainCompletionQueue();
    expect(first.failed).toBe(1);
    expect(queue()[0]).toMatchObject({ attempts: 1, lastError: 'seal failed' });
    expect(queue()[0].leasedUntil).toBeUndefined();

    await drainCompletionQueue();
    const third = await drainCompletionQueue();
    expect(third.deadLettered).toBe(1);
    expect(await getQueueDepth()).toBe(0);
    expect(work.status).toHaveBeenLastCalledWith('env-1', 'partially_signed');
    expect(work.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'completion_dead_lettered' }),
    );
  });

  it('dead-letters a job whose isolate died on every attempt, instead of retrying forever', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T23:52:49Z'));
    await enqueueCompletion('env-1');
    // Every attempt is cut off by the runtime: completeEnvelope never returns.
    work.complete.mockImplementation(() => new Promise(() => undefined));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      void drainCompletionQueue();
      await vi.waitFor(() => expect(work.complete).toHaveBeenCalledTimes(attempt));
      vi.setSystemTime(Date.now() + COMPLETION_LEASE_MS + 1);
    }

    const result = await drainCompletionQueue();
    expect(work.complete).toHaveBeenCalledTimes(3);
    expect(result.deadLettered).toBe(1);
    expect(await getQueueDepth()).toBe(0);
    expect(work.status).toHaveBeenLastCalledWith('env-1', 'partially_signed');
    expect(work.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'completion_dead_lettered' }),
    );
  });

  it('a kick during a running drain still gets its envelope completed in that protected drain', async () => {
    const waitUntil = vi.fn();
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = { waitUntil };
    try {
      let release!: () => void;
      work.complete.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ success: true });
          }),
      );
      await enqueueCompletion('env-1');
      kickCompletionDrain();
      await vi.waitFor(() => expect(work.complete).toHaveBeenCalledWith('env-1'));

      // A second envelope completes while env-1's drain is mid-flight.
      await enqueueCompletion('env-2');
      kickCompletionDrain();
      release();

      // Both kicks hold the same protected promise, which must not settle
      // until env-2 is done too.
      expect(waitUntil.mock.calls[1][0]).toBe(waitUntil.mock.calls[0][0]);
      await waitUntil.mock.calls[0][0];
      expect(work.complete).toHaveBeenCalledWith('env-2');
      expect(await getQueueDepth()).toBe(0);
    } finally {
      delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
    }
  });

  it('kickCompletionDrain holds the isolate open with EdgeRuntime.waitUntil', async () => {
    const waitUntil = vi.fn();
    (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime = { waitUntil };
    try {
      await enqueueCompletion('env-1');
      kickCompletionDrain();
      expect(waitUntil).toHaveBeenCalledTimes(1);
      await waitUntil.mock.calls[0][0];
      expect(work.complete).toHaveBeenCalledWith('env-1');
      expect(await getQueueDepth()).toBe(0);
    } finally {
      delete (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime;
    }
  });
});
