/**
 * integrations-sync-engine.ts — A Lock Holds For Every Source
 * ===========================================================
 *
 * `lockedFields` is how an adviser says "I checked this value against the
 * statement; do not let an automated source move it". The engine used to honour
 * that for spreadsheet uploads and ignore it for portal runs, so the next
 * portal sweep silently overwrote exactly the values someone had deliberately
 * pinned — the one case where the lock most needed to hold.
 *
 * This suite pins the rule in both places it has to hold: when a run is STAGED
 * (a locked field must not become a proposed change) and when a run is
 * PUBLISHED (a locked field must not be written even if a diff reached the
 * row). Both are checked with source 'portal', which is the case that was wrong.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kvStore } from './helpers/contract-harness.ts';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

vi.mock('../integrations-derive.ts', () => ({
  recalculateClientTotals: vi.fn(async () => undefined),
}));

const { buildSyncRun, publishSyncRun } = await import('../integrations-sync-engine.ts');

const CLIENT = '11111111-2222-4333-8444-555555555555';
const PROVIDER = 'allan-gray';
const CATEGORY = 'retirement_pre';

const fields = [
  { id: 'policy_number', name: 'Policy Number', type: 'text' },
  { id: 'current_value', name: 'Current Value', type: 'currency' },
];

/** One policy whose current value the adviser has locked. */
function seedPolicy(lockedFields: string[]) {
  kvStore.set(`policies:client:${CLIENT}`, [
    {
      id: 'pol-1',
      clientId: CLIENT,
      providerId: PROVIDER,
      categoryId: CATEGORY,
      archived: false,
      lockedFields,
      data: { policy_number: 'AG-1', current_value: 100 },
    },
  ]);
}

const fieldBindings = [
  {
    targetFieldId: 'policy_number',
    columnName: 'Policy Number',
    targetFieldName: 'Policy Number',
  },
  {
    targetFieldId: 'current_value',
    columnName: 'Current Value',
    targetFieldName: 'Current Value',
  },
];

/** A portal run proposing a NEW current value for that policy. */
const buildPortalRun = () =>
  buildSyncRun({
    provider: { id: PROVIDER, name: 'Allan Gray' },
    providerId: PROVIDER,
    categoryId: CATEGORY,
    fileName: 'portal-run',
    source: 'portal',
    rawRows: [{ 'Policy Number': 'AG-1', 'Current Value': 250 }],
    fieldMapping: { 'Policy Number': 'policy_number', 'Current Value': 'current_value' },
    fieldBindings,
    settings: {},
  } as Parameters<typeof buildSyncRun>[0]);

beforeEach(() => {
  kvStore.clear();
  vi.clearAllMocks();
  // The engine reads the category schema from KV, so the fixture controls which
  // field is the policy number rather than inheriting a default.
  kvStore.set(`config:schema:${CATEGORY}`, { categoryId: CATEGORY, fields });
});

describe('locked fields — staging', () => {
  it('does not propose a change to a locked field on a portal run', async () => {
    seedPolicy(['current_value']);
    const run = await buildPortalRun();

    const row = run.rows[0];
    expect(row.diffs.map((diff) => diff.fieldId)).not.toContain('current_value');
  });

  it('says why, rather than dropping the value silently', async () => {
    seedPolicy(['current_value']);
    const run = await buildPortalRun();

    expect(run.rows[0].warnings.join(' ')).toContain('locked');
  });

  it('still proposes a change when nothing is locked', async () => {
    seedPolicy([]);
    const run = await buildPortalRun();

    expect(run.rows[0].diffs.map((diff) => diff.fieldId)).toContain('current_value');
  });
});

describe('locked fields — publishing', () => {
  it('leaves the stored value untouched when the field is locked', async () => {
    seedPolicy([]);
    const run = await buildPortalRun();
    expect(run.rows[0].diffs.length).toBeGreaterThan(0);

    // Lock it AFTER staging: the publish step is the last line of defence, and
    // an adviser can lock a value while a run is sitting in review.
    seedPolicy(['current_value']);
    await publishSyncRun({ ...run, source: 'portal' }, { rowIds: [run.rows[0].id] });

    const stored = kvStore.get(`policies:client:${CLIENT}`) as Array<{
      data: Record<string, unknown>;
    }>;
    expect(stored[0].data.current_value).toBe(100);
  });

  it('marks the row skipped rather than reporting a successful publish', async () => {
    seedPolicy([]);
    const run = await buildPortalRun();
    seedPolicy(['current_value']);

    const published = await publishSyncRun(
      { ...run, source: 'portal' },
      {
        rowIds: [run.rows[0].id],
      },
    );

    expect(published.rows[0].publishStatus).toBe('skipped');
  });

  it('writes the value when it is not locked', async () => {
    seedPolicy([]);
    const run = await buildPortalRun();
    await publishSyncRun({ ...run, source: 'portal' }, { rowIds: [run.rows[0].id] });

    const stored = kvStore.get(`policies:client:${CLIENT}`) as Array<{
      data: Record<string, unknown>;
    }>;
    expect(stored[0].data.current_value).toBe(250);
  });
});
