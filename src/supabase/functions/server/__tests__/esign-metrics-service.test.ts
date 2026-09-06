/**
 * E-Signature org metrics — funnel, stuck detection, and the read shape.
 *
 * `getEsignMetrics` backs the E-Signature dashboard and `findStuckEnvelopes`
 * the stuck-envelope alert job. Both used to read signers inline: the
 * envelope's signer-id list, then each signer ONE AT A TIME in a nested `for`
 * loop. Nothing was concurrent, so the cost was strictly sequential in
 * envelopes x signers — a hundred envelopes of two signers meant three hundred
 * round trips in series before the dashboard could paint.
 *
 * The service had no tests at all, so this covers the aggregation it computes
 * as well as the read shape: the funnel and stuck rules are real logic that a
 * loop restructure can quietly change, and the read shape is what the
 * restructure exists for.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/esign-metrics-service.test.ts
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

beforeAll(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: { get: (key: string) => `test-${key}` },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { kvStore } = await import('./helpers/contract-harness.ts');
const kv = await import('../kv_store.tsx');
const { getEsignMetrics, findStuckEnvelopes } = await import('../esign-metrics-service.ts');

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

interface SeedSigner {
  status?: string;
  viewed_at?: string;
}

/** Seed an envelope plus its signer index and signer rows. */
function seedEnvelope(
  id: string,
  envelope: Record<string, unknown>,
  signers: SeedSigner[] = [],
): void {
  kvStore.set(`esign:envelope:${id}`, {
    id,
    firm_id: 'firm-1',
    document_id: `doc-${id}`,
    status: 'sent',
    ...envelope,
  });

  const signerIds = signers.map((_, i) => `${id}-s${i}`);
  kvStore.set(`esign:envelope:${id}:signers`, signerIds);
  signers.forEach((signer, i) => {
    kvStore.set(`esign:signer:${signerIds[i]}`, {
      id: signerIds[i],
      status: signer.status ?? 'pending',
      ...(signer.viewed_at ? { viewed_at: signer.viewed_at } : {}),
    });
  });
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('getEsignMetrics — aggregation', () => {
  it('counts envelopes by status', async () => {
    seedEnvelope('e1', { status: 'draft' });
    seedEnvelope('e2', { status: 'sent', sent_at: daysAgo(1) });
    seedEnvelope('e3', { status: 'completed', sent_at: daysAgo(3), completed_at: daysAgo(1) });

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.statusCounts.draft).toBe(1);
    expect(metrics.statusCounts.sent).toBe(1);
    expect(metrics.statusCounts.completed).toBe(1);
  });

  it('counts a signer with a viewed timestamp as an opened envelope', async () => {
    seedEnvelope('e1', { status: 'sent', sent_at: daysAgo(1) }, [{ viewed_at: daysAgo(1) }]);
    seedEnvelope('e2', { status: 'sent', sent_at: daysAgo(1) }, [{}]);

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.sent).toBe(2);
    expect(metrics.funnel.opened).toBe(1);
  });

  it('counts a signer past pending as a started envelope', async () => {
    seedEnvelope('e1', { status: 'sent', sent_at: daysAgo(1) }, [{ status: 'signed' }]);
    seedEnvelope('e2', { status: 'sent', sent_at: daysAgo(1) }, [{ status: 'pending' }]);

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.started).toBe(1);
  });

  it('attributes each envelope its own signers rather than a neighbour’s', async () => {
    // e1 has an opened signer, e2 does not. Getting the index wrong would swap
    // them and still produce a plausible-looking funnel.
    seedEnvelope('e1', { status: 'sent', sent_at: daysAgo(10) }, [{ viewed_at: daysAgo(9) }]);
    seedEnvelope('e2', { status: 'sent', sent_at: daysAgo(10) }, [{}]);

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.opened).toBe(1);
    // Only e2 is stuck: sent long ago and never viewed.
    expect(metrics.stuckEnvelopes.map((s) => s.id)).toEqual(['e2']);
  });

  it('reports an envelope sent long ago and never viewed as stuck', async () => {
    seedEnvelope('old-unviewed', { status: 'sent', sent_at: daysAgo(30) }, [{}]);
    seedEnvelope('old-viewed', { status: 'sent', sent_at: daysAgo(30) }, [
      { viewed_at: daysAgo(29) },
    ]);
    seedEnvelope('recent', { status: 'sent', sent_at: daysAgo(1) }, [{}]);

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.stuckEnvelopes.map((s) => s.id)).toEqual(['old-unviewed']);
  });

  it('excludes soft-deleted envelopes and other firms', async () => {
    seedEnvelope('mine', { status: 'sent', sent_at: daysAgo(1) });
    seedEnvelope('deleted', { status: 'sent', sent_at: daysAgo(1), deleted_at: daysAgo(1) });
    seedEnvelope('other-firm', { status: 'sent', sent_at: daysAgo(1), firm_id: 'firm-2' });

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.sent).toBe(1);
  });

  it('handles an envelope with no signers', async () => {
    seedEnvelope('e1', { status: 'sent', sent_at: daysAgo(1) }, []);

    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.opened).toBe(0);
    expect(metrics.funnel.started).toBe(0);
  });

  it('returns an empty shape when the firm has no envelopes', async () => {
    const metrics = await getEsignMetrics('firm-1');

    expect(metrics.funnel.sent).toBe(0);
    expect(metrics.stuckEnvelopes).toEqual([]);
  });
});

describe('getEsignMetrics — read shape', () => {
  it('never reads a signer one at a time', async () => {
    for (let i = 0; i < 12; i++) {
      seedEnvelope(`e${i}`, { status: 'sent', sent_at: daysAgo(2) }, [{}, {}, {}]);
    }

    await getEsignMetrics('firm-1');

    // One prefix scan lists the envelopes; everything else is batched.
    expect(kv.getByPrefix).toHaveBeenCalledTimes(1);
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('adds no round trips as envelopes and signers multiply', async () => {
    seedEnvelope('e0', { status: 'sent', sent_at: daysAgo(2) }, [{}]);
    await getEsignMetrics('firm-1');
    const smallRun = (kv.mget as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    kvStore.clear();
    vi.clearAllMocks();

    for (let i = 0; i < 25; i++) {
      seedEnvelope(`e${i}`, { status: 'sent', sent_at: daysAgo(2) }, [{}, {}, {}, {}]);
    }
    await getEsignMetrics('firm-1');

    expect((kv.mget as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(smallRun);
  });
});

describe('findStuckEnvelopes', () => {
  it('returns envelopes sent past the threshold that nobody has viewed', async () => {
    seedEnvelope('stuck', { status: 'sent', sent_at: daysAgo(20) }, [{}]);
    seedEnvelope('viewed', { status: 'sent', sent_at: daysAgo(20) }, [{ viewed_at: daysAgo(19) }]);
    seedEnvelope('fresh', { status: 'sent', sent_at: daysAgo(1) }, [{}]);
    seedEnvelope('done', { status: 'completed', sent_at: daysAgo(20) }, [{}]);

    const stuck = await findStuckEnvelopes('firm-1');

    expect(stuck.map((s) => s.envelope.id)).toEqual(['stuck']);
    expect(stuck[0].days).toBeGreaterThanOrEqual(19);
  });

  it('keeps each candidate matched to its own signers', async () => {
    // Interleaved so an off-by-one in the batched lookup shows up.
    seedEnvelope('a', { status: 'sent', sent_at: daysAgo(20) }, [{ viewed_at: daysAgo(19) }]);
    seedEnvelope('b', { status: 'sent', sent_at: daysAgo(20) }, [{}]);
    seedEnvelope('c', { status: 'sent', sent_at: daysAgo(20) }, [{ viewed_at: daysAgo(19) }]);
    seedEnvelope('d', { status: 'sent', sent_at: daysAgo(20) }, [{}]);

    const stuck = await findStuckEnvelopes('firm-1');

    expect(stuck.map((s) => s.envelope.id).sort()).toEqual(['b', 'd']);
  });

  it('reads nothing beyond the envelope scan when nothing is old enough', async () => {
    seedEnvelope('fresh', { status: 'sent', sent_at: daysAgo(1) }, [{}]);

    const stuck = await findStuckEnvelopes('firm-1');

    expect(stuck).toEqual([]);
    // No candidates means no signer reads at all.
    expect(kv.mget).not.toHaveBeenCalled();
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('does not read signers one at a time for the candidates it does have', async () => {
    for (let i = 0; i < 10; i++) {
      seedEnvelope(`e${i}`, { status: 'sent', sent_at: daysAgo(20) }, [{}, {}]);
    }

    await findStuckEnvelopes('firm-1');

    expect(kv.get).not.toHaveBeenCalled();
  });
});
