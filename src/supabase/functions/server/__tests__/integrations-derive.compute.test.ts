/**
 * computeClientTotals raises what recalculateClientTotals swallows.
 *
 * The client totals refresh worker must not report a failed recalculation as
 * done, so it uses the arithmetic on its own, which raises. The app's own
 * paths keep calling recalculateClientTotals, which still logs and swallows:
 * a failed recalculation there must not fail the policy save it follows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import * as kv from '../kv_store.tsx';
import { kvStore } from './helpers/contract-harness.ts';
import { computeClientTotals, recalculateClientTotals } from '../integrations-derive.ts';

const CLIENT = 'client-1';
const POLICIES = [
  { id: 'a', categoryId: 'retirement_pre', data: { ret_pre_3: '1000.5' } },
  { id: 'b', categoryId: 'retirement_pre', data: { ret_pre_3: '99.5' } },
  { id: 'c', categoryId: 'retirement_pre', archived: true, data: { ret_pre_3: '5000' } },
];

beforeEach(() => {
  kvStore.clear();
  vi.mocked(kv.get).mockClear();
  vi.mocked(kv.set).mockClear();
});

describe('computeClientTotals', () => {
  it('totals the policies it is given, reading nothing but the schemas', async () => {
    const totals = await computeClientTotals(POLICIES);
    expect(totals.retirement_fund_value_total).toBe(1100);
    expect(totals.risk_life_cover_total).toBe(0);
    for (const [key] of vi.mocked(kv.get).mock.calls) expect(key).toMatch(/^config:schema:/);
    expect(vi.mocked(kv.set)).not.toHaveBeenCalled();
  });

  it('gives zero totals for no policies', async () => {
    expect((await computeClientTotals([])).retirement_fund_value_total).toBe(0);
  });

  it('raises when a schema cannot be read', async () => {
    vi.mocked(kv.get).mockRejectedValueOnce(new Error('KV read timed out'));
    await expect(computeClientTotals(POLICIES)).rejects.toThrow('KV read timed out');
  });

  it('raises when the policies are not a list', async () => {
    await expect(computeClientTotals({ not: 'a list' })).rejects.toThrow(
      'the policies are not a list',
    );
    await expect(computeClientTotals(null)).rejects.toThrow('the policies are not a list');
  });
});

describe('recalculateClientTotals is unchanged for the app', () => {
  it('stores the same totals', async () => {
    kvStore.set(`policies:client:${CLIENT}`, POLICIES);
    await recalculateClientTotals(CLIENT);
    expect(kvStore.get(`user_profile:${CLIENT}:client_keys`)).toEqual(
      await computeClientTotals(POLICIES),
    );
  });

  it('still logs and swallows a failure, storing nothing', async () => {
    // The policies read succeeds; the first schema read fails.
    vi.mocked(kv.get)
      .mockResolvedValueOnce(POLICIES)
      .mockRejectedValueOnce(new Error('KV read timed out'));
    await expect(recalculateClientTotals(CLIENT)).resolves.toBeUndefined();
    expect(vi.mocked(kv.set)).not.toHaveBeenCalled();
    expect(kvStore.has(`user_profile:${CLIENT}:client_keys`)).toBe(false);
  });
});
