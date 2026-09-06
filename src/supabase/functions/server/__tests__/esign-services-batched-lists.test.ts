/**
 * E-Signature list enrichment — batched reads.
 *
 * `getAllEnvelopes` backs the E-Signature module's landing view and
 * `getClientEnvelopes` the signing history on a client's profile. Both used to
 * hydrate each row on its own: the envelope's signer-id list, then each signer,
 * then its document, then its audit index, then each audit event — one
 * `kv.get` per row read, each opening its own Postgres client, and in
 * `getAllEnvelopes` three of those legs ran in series. Opening the module
 * therefore cost O(envelopes x signers) reads.
 *
 * These tests pin the READ SHAPE alongside the payload, because the payload is
 * what a refactor preserves by accident and the shape is what it loses: a
 * future edit that puts a per-envelope `kv.get` back would return byte-identical
 * envelopes and pass every other assertion in this file.
 *
 * Run: npx vitest run src/supabase/functions/server/__tests__/esign-services-batched-lists.test.ts
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
vi.mock('../esign-postgres-repo.ts', () => ({
  esignPgRepo: {
    insertAudit: vi.fn(async () => undefined),
    upsertEnvelope: vi.fn(async () => undefined),
    upsertSigner: vi.fn(async () => undefined),
  },
}));
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({}),
}));

const { kvStore } = await import('./helpers/contract-harness.ts');
const kv = await import('../kv_store.tsx');
const { getAllEnvelopes, getClientEnvelopes } = await import('../esign-services.tsx');

/**
 * Seed one envelope with `signerCount` signers, a document and `auditCount`
 * audit events, wired up through the index rows the real writers create.
 */
function seedEnvelope(
  id: string,
  opts: { signerCount?: number; auditCount?: number; fieldCount?: number; status?: string } = {},
) {
  const { signerCount = 2, auditCount = 12, fieldCount = 2, status = 'sent' } = opts;

  kvStore.set(`esign:envelope:${id}`, {
    id,
    status,
    document_id: `doc-${id}`,
    created_at: `2026-01-${String((Number(id.replace(/\D/g, '')) % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
    updated_at: '2026-02-01T00:00:00.000Z',
  });
  kvStore.set(`esign:document:doc-${id}`, { id: `doc-${id}`, name: `${id}.pdf` });

  const signerIds = Array.from({ length: signerCount }, (_, i) => `${id}-signer-${i}`);
  kvStore.set(`esign:envelope:${id}:signers`, signerIds);
  signerIds.forEach((sid, i) => {
    kvStore.set(`esign:signer:${sid}`, {
      id: sid,
      name: `Signer ${i}`,
      email: `${sid}@example.com`,
      status: i === 0 ? 'signed' : 'pending',
      role: 'signer',
      requires_otp: false,
    });
  });

  const fieldIds = Array.from({ length: fieldCount }, (_, i) => `${id}-field-${i}`);
  kvStore.set(`esign:envelope:${id}:fields`, fieldIds);
  fieldIds.forEach((fid) => kvStore.set(`esign:field:${fid}`, { id: fid }));

  const auditIds = Array.from({ length: auditCount }, (_, i) => `${id}-audit-${i}`);
  kvStore.set(`esign:envelope:${id}:audit`, auditIds);
  auditIds.forEach((aid, i) => kvStore.set(`esign:audit:${aid}`, { id: aid, seq: i }));

  return { signerIds, fieldIds, auditIds };
}

/** Link `envelopeIds` to a client, the way the client-scoped list reads them. */
function seedClientLink(clientId: string, envelopeIds: string[]) {
  kvStore.set(`esign:client:${clientId}:envelopes`, envelopeIds);
}

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
});

describe('getAllEnvelopes — payload', () => {
  it('returns each envelope with its own signers, document and recent audit events', async () => {
    seedEnvelope('e1', { signerCount: 2, auditCount: 12 });

    const [envelope] = await getAllEnvelopes();

    expect(envelope.id).toBe('e1');
    expect((envelope.document as { name: string }).name).toBe('e1.pdf');
    expect((envelope.signers as unknown[]).length).toBe(2);
    expect(envelope.totalSigners).toBe(2);
    expect(envelope.signedCount).toBe(1);
    // Only the last 10 audit events are displayed.
    expect((envelope.audit_events as unknown[]).length).toBe(10);
    expect(((envelope.audit_events as { id: string }[])[0] as { id: string }).id).toBe(
      'e1-audit-2',
    );
  });

  it('projects recipients from the signers', async () => {
    seedEnvelope('e1', { signerCount: 1 });

    const [envelope] = await getAllEnvelopes();

    expect(envelope.recipients).toEqual([
      {
        id: 'e1-signer-0',
        name: 'Signer 0',
        email: 'e1-signer-0@example.com',
        status: 'signed',
        role: 'signer',
        signed_at: undefined,
        otp_required: false,
      },
    ]);
  });

  it('does not mix one envelope’s signers into another', async () => {
    seedEnvelope('e1', { signerCount: 1 });
    seedEnvelope('e2', { signerCount: 3 });

    const byId = new Map((await getAllEnvelopes()).map((e) => [e.id as string, e]));

    expect((byId.get('e1')!.signers as { id: string }[]).map((s) => s.id)).toEqual(['e1-signer-0']);
    expect((byId.get('e2')!.signers as { id: string }[]).map((s) => s.id)).toEqual([
      'e2-signer-0',
      'e2-signer-1',
      'e2-signer-2',
    ]);
  });

  it('tolerates an envelope with no signers, document or audit trail', async () => {
    seedEnvelope('e1', { signerCount: 0, auditCount: 0, fieldCount: 0 });
    kvStore.delete('esign:document:doc-e1');

    const [envelope] = await getAllEnvelopes();

    expect(envelope.signers).toEqual([]);
    expect(envelope.audit_events).toEqual([]);
    expect(envelope.document).toBeNull();
    expect(envelope.totalSigners).toBe(0);
  });

  it('filters by status when one is given', async () => {
    seedEnvelope('e1', { status: 'sent' });
    seedEnvelope('e2', { status: 'completed' });

    const results = await getAllEnvelopes('completed');

    expect(results.map((e) => e.id)).toEqual(['e2']);
  });

  it('hides soft-deleted envelopes', async () => {
    seedEnvelope('e1');
    seedEnvelope('e2');
    kvStore.set('esign:envelope:e2', {
      ...(kvStore.get('esign:envelope:e2') as Record<string, unknown>),
      deleted_at: '2026-03-01T00:00:00.000Z',
    });

    expect((await getAllEnvelopes()).map((e) => e.id)).toEqual(['e1']);
  });
});

describe('getAllEnvelopes — read shape', () => {
  it('reads no row one at a time: enrichment goes through batched reads', async () => {
    seedEnvelope('e1');
    seedEnvelope('e2');
    seedEnvelope('e3');

    await getAllEnvelopes();

    // The single prefix scan that lists envelopes is the only non-batched read.
    expect(kv.getByPrefix).toHaveBeenCalledTimes(1);
    expect(kv.get).not.toHaveBeenCalled();
  });

  it('round trips scale with batches of rows, not with the length of the list', async () => {
    // Five logical reads — signer index, audit index, signers, documents,
    // audit events — each chunked at KV_BATCH_SIZE. 40 envelopes of 2 signers
    // and 10 displayed audit events is 560 rows, which the per-envelope shape
    // read as 40 x (3 serial legs + 13 individual gets).
    for (let i = 0; i < 40; i++) seedEnvelope(`env${i}`);

    await getAllEnvelopes();

    const mgetCalls = (kv.mget as unknown as { mock: { calls: [string[]][] } }).mock.calls;
    const rowsRead = mgetCalls.reduce((n, [keys]) => n + keys.length, 0);

    expect(kv.get).not.toHaveBeenCalled();
    expect(rowsRead).toBeGreaterThan(500);
    // Comfortably fewer round trips than envelopes, let alone rows.
    expect(mgetCalls.length).toBeLessThan(10);
  });

  it('adds no round trips when envelopes carry more signers', async () => {
    for (let i = 0; i < 5; i++) seedEnvelope(`env${i}`, { signerCount: 1 });
    await getAllEnvelopes();
    const callsWithOneSigner = (kv.mget as unknown as { mock: { calls: unknown[] } }).mock.calls
      .length;

    kvStore.clear();
    vi.clearAllMocks();

    for (let i = 0; i < 5; i++) seedEnvelope(`env${i}`, { signerCount: 8 });
    await getAllEnvelopes();

    expect((kv.mget as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      callsWithOneSigner,
    );
  });

  it('reads a shared document once, not once per envelope that points at it', async () => {
    seedEnvelope('e1');
    seedEnvelope('e2');
    // Both envelopes now reference the same document row.
    kvStore.set('esign:envelope:e2', {
      ...(kvStore.get('esign:envelope:e2') as Record<string, unknown>),
      document_id: 'doc-e1',
    });

    await getAllEnvelopes();

    const documentKeys = (kv.mget as unknown as { mock: { calls: [string[]][] } }).mock.calls
      .flatMap(([keys]) => keys)
      .filter((k) => k.startsWith('esign:document:'));
    expect(documentKeys).toEqual(['esign:document:doc-e1']);
  });
});

describe('getClientEnvelopes — payload', () => {
  it('returns the client’s envelopes with signers, fields and recent audit events', async () => {
    seedEnvelope('e1', { signerCount: 2, fieldCount: 3, auditCount: 9 });
    seedClientLink('client-1', ['e1']);

    const [envelope] = await getClientEnvelopes('client-1');

    expect(envelope.id).toBe('e1');
    expect((envelope.signers as unknown[]).length).toBe(2);
    expect((envelope.fields as unknown[]).length).toBe(3);
    // The client view shows the last 5 events.
    expect((envelope.audit_events as unknown[]).length).toBe(5);
    expect(envelope.signedCount).toBe(1);
  });

  it('keeps each envelope’s fields to itself', async () => {
    seedEnvelope('e1', { fieldCount: 1 });
    seedEnvelope('e2', { fieldCount: 4 });
    seedClientLink('client-1', ['e1', 'e2']);

    const byId = new Map((await getClientEnvelopes('client-1')).map((e) => [e.id as string, e]));

    expect((byId.get('e1')!.fields as unknown[]).length).toBe(1);
    expect((byId.get('e2')!.fields as unknown[]).length).toBe(4);
  });

  it('drops a linked envelope whose row is gone', async () => {
    seedEnvelope('e1');
    seedClientLink('client-1', ['e1', 'missing']);

    expect((await getClientEnvelopes('client-1')).map((e) => e.id)).toEqual(['e1']);
  });

  it('hides soft-deleted envelopes from the client view', async () => {
    seedEnvelope('e1');
    kvStore.set('esign:envelope:e1', {
      ...(kvStore.get('esign:envelope:e1') as Record<string, unknown>),
      deleted_at: '2026-03-01T00:00:00.000Z',
    });
    seedClientLink('client-1', ['e1']);

    expect(await getClientEnvelopes('client-1')).toEqual([]);
  });

  it('ignores non-string junk in a field index', async () => {
    seedEnvelope('e1', { fieldCount: 1 });
    kvStore.set('esign:envelope:e1:fields', ['e1-field-0', null, 42, { id: 'nope' }]);
    seedClientLink('client-1', ['e1']);

    const [envelope] = await getClientEnvelopes('client-1');

    expect((envelope.fields as { id: string }[]).map((f) => f.id)).toEqual(['e1-field-0']);
  });
});

describe('getClientEnvelopes — read shape', () => {
  it('hydrates through batched reads rather than per envelope', async () => {
    seedEnvelope('e1');
    seedEnvelope('e2');
    seedEnvelope('e3');
    seedClientLink('client-1', ['e1', 'e2', 'e3']);

    await getClientEnvelopes('client-1');

    // Only the two link-index lookups read a single key at a time.
    const singleReads = (kv.get as unknown as { mock: { calls: [string][] } }).mock.calls.map(
      ([key]) => key,
    );
    expect(
      singleReads.every(
        (k) => k.startsWith('esign:client:') || k.startsWith('esign:signer-email:'),
      ),
    ).toBe(true);
  });

  it('round trips scale with batches of rows, not with the number of linked envelopes', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 40; i++) {
      seedEnvelope(`env${i}`);
      ids.push(`env${i}`);
    }
    seedClientLink('client-1', ids);

    await getClientEnvelopes('client-1');

    const mgetCalls = (kv.mget as unknown as { mock: { calls: [string[]][] } }).mock.calls;
    expect(mgetCalls.length).toBeLessThan(10);
    // Only the two link-index lookups read one key at a time.
    expect(
      (kv.get as unknown as { mock: { calls: unknown[] } }).mock.calls.length,
    ).toBeLessThanOrEqual(2);
  });
});
