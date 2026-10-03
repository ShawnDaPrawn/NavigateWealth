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

  it('ignores non-positive values, non-numeric values, and policies with no data', async () => {
    // A negative or blank premium must not shrink the profile. `Number(value) || 0`
    // turns junk into zero, and only a value above zero is added.
    const totals = await computeClientTotals([
      { id: 'a', categoryId: 'retirement_pre', data: { ret_pre_3: 200 } },
      { id: 'b', categoryId: 'retirement_pre', data: { ret_pre_3: -50 } },
      { id: 'c', categoryId: 'retirement_pre', data: { ret_pre_3: 0 } },
      { id: 'd', categoryId: 'retirement_pre', data: { ret_pre_3: 'not-a-number' } },
      { id: 'e', categoryId: 'retirement_pre', data: { ret_pre_3: '10.5' } },
      { id: 'f', categoryId: 'retirement_pre' },
    ]);

    expect(totals.retirement_fund_value_total).toBe(210.5);
  });

  it('counts a value only in its own category', async () => {
    // Field ids are not globally unique in a payload an agent can write. A
    // retirement value sitting on a risk policy, or life cover on a retirement
    // policy, must not move the other total.
    const totals = await computeClientTotals([
      {
        id: 'risk',
        categoryId: 'risk_planning',
        data: { rp_2: 1000, ret_pre_3: 5000 },
      },
      {
        id: 'retired',
        categoryId: 'retirement_pre',
        data: { ret_pre_3: 200, rp_2: 9000 },
      },
      {
        id: 'archived-risk',
        categoryId: 'risk_planning',
        archived: true,
        data: { rp_2: 8000 },
      },
    ]);

    expect(totals.risk_life_cover_total).toBe(1000);
    expect(totals.retirement_fund_value_total).toBe(200);
  });

  it('sums every employee-benefit contribution and leaves cover amounts out', async () => {
    const totals = await computeClientTotals([
      { id: 'group', categoryId: 'employee_benefits', data: { eb_5: 100, eb_4: 1_000_000 } },
      { id: 'risk', categoryId: 'employee_benefits_risk', data: { eb_risk_7: 40 } },
      {
        id: 'fund',
        categoryId: 'employee_benefits_retirement',
        data: { eb_ret_5: 25, eb_ret_6: 35 },
      },
      {
        id: 'archived',
        categoryId: 'employee_benefits',
        archived: true,
        data: { eb_5: 999 },
      },
    ]);

    expect(totals.eb_total_premium).toBe(200);
  });

  it('uses a stored schema instead of the default, and a blank schema contributes nothing', async () => {
    // Once a category has a stored schema, the default field ids no longer
    // apply. Falling back would add `rp_2` below. A stored schema with no
    // fields is not "missing": it must not be replaced by the default either.
    kvStore.set('config:schema:risk_planning', {
      fields: [
        { id: 'custom_cover', name: 'Cover', type: 'currency', keyId: 'risk_life_cover' },
        { id: 'rp_2', name: 'Old id, no longer a total', type: 'currency' },
      ],
    });
    kvStore.set('config:schema:retirement_pre', {});

    const totals = await computeClientTotals([
      {
        id: 'risk',
        categoryId: 'risk_planning',
        data: { custom_cover: '250', rp_2: 9000 },
      },
      { id: 'retired', categoryId: 'retirement_pre', data: { ret_pre_3: 4000 } },
    ]);

    expect(totals.risk_life_cover_total).toBe(250);
    expect(totals.retirement_fund_value_total).toBe(0);
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
