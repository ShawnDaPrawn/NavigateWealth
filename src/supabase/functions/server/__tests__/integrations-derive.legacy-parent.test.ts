import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { recalculateClientTotals } from '../integrations-derive.ts';

const CLIENT = 'client-legacy';

function seedPolicies(policies: unknown[]) {
  kvStore.set(`policies:client:${CLIENT}`, policies);
}

async function totals(): Promise<Record<string, number>> {
  await recalculateClientTotals(CLIENT);
  return kvStore.get(`user_profile:${CLIENT}:client_keys`) as Record<string, number>;
}

describe('recalculateClientTotals — retired parent field ids', () => {
  beforeEach(() => kvStore.clear());

  it('keeps a retirement_planning policy in the retirement totals after its schema was removed', async () => {
    seedPolicies([
      {
        id: 'legacy',
        categoryId: 'retirement_planning',
        data: { ret_3: 500000, ret_6: 3000 },
      },
    ]);

    const result = await totals();

    expect(result.retirement_fund_value_total).toBe(500000);
    expect(result.retirement_total_contribution).toBe(3000);
  });

  it('counts parent field ids that an older portal run wrote onto a pre-retirement policy', async () => {
    seedPolicies([
      {
        id: 'staged',
        categoryId: 'retirement_pre',
        data: { ret_3: 125000, ret_6: 800 },
      },
    ]);

    const result = await totals();

    expect(result.retirement_fund_value_total).toBe(125000);
    expect(result.retirement_total_contribution).toBe(800);
  });

  it('does not double-count when the form has copied a parent id onto the child field', async () => {
    seedPolicies([
      {
        id: 'copied',
        categoryId: 'retirement_pre',
        data: { ret_3: 250000, ret_pre_3: 250000, ret_6: 1500, ret_pre_6: 1500 },
      },
    ]);

    const result = await totals();

    expect(result.retirement_fund_value_total).toBe(250000);
    expect(result.retirement_total_contribution).toBe(1500);
  });

  it('prefers the child field when it differs from the leftover parent id', async () => {
    seedPolicies([
      {
        id: 'edited',
        categoryId: 'retirement_pre',
        data: { ret_3: 100000, ret_pre_3: 400000 },
      },
    ]);

    expect((await totals()).retirement_fund_value_total).toBe(400000);
  });

  it('keeps a legacy investment premium in the contribution total', async () => {
    seedPolicies([
      {
        id: 'legacy-inv',
        categoryId: 'investments',
        data: { inv_6: 2000 },
      },
      {
        id: 'staged-inv',
        categoryId: 'investments_voluntary',
        data: { inv_6: 500 },
      },
    ]);

    expect((await totals()).invest_total_contribution).toBe(2500);
  });

  it('still ignores an archived legacy policy', async () => {
    seedPolicies([
      {
        id: 'archived',
        categoryId: 'retirement_planning',
        archived: true,
        data: { ret_3: 900000 },
      },
    ]);

    expect((await totals()).retirement_fund_value_total).toBe(0);
  });
});
