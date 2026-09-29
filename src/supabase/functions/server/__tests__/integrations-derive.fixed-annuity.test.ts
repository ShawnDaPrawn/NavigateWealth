import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { recalculateClientTotals } from '../integrations-derive.ts';

const CLIENT = 'client-1';

function seedPolicies(policies: unknown[]) {
  kvStore.set(`policies:client:${CLIENT}`, policies);
}

async function totals(): Promise<Record<string, number>> {
  await recalculateClientTotals(CLIENT);
  return kvStore.get(`user_profile:${CLIENT}:client_keys`) as Record<string, number>;
}

describe('recalculateClientTotals — Post-Retirement (Fixed Annuity)', () => {
  beforeEach(() => kvStore.clear());

  it('totals fixed-annuity income on its own and into post-retirement income', async () => {
    // Default schemas: ret_post_fixed_4 carries post_retirement_fixed_annuity_income.
    seedPolicies([
      { id: 'a', categoryId: 'retirement_post_fixed', data: { ret_post_fixed_4: 8000 } },
      { id: 'b', categoryId: 'retirement_post_fixed', data: { ret_post_fixed_4: 2000 } },
    ]);

    const result = await totals();

    expect(result.post_retirement_fixed_annuity_income_total).toBe(10000);
    expect(result.post_retirement_income_total).toBe(10000);
  });

  it('ignores archived fixed annuities', async () => {
    seedPolicies([
      { id: 'a', categoryId: 'retirement_post_fixed', data: { ret_post_fixed_4: 8000 } },
      {
        id: 'b',
        categoryId: 'retirement_post_fixed',
        archived: true,
        data: { ret_post_fixed_4: 5000 },
      },
    ]);

    expect((await totals()).post_retirement_fixed_annuity_income_total).toBe(8000);
  });

  it('does not count a fixed annuity towards post-retirement capital', async () => {
    // A fixed annuity holds no capital the client owns; its purchase price is
    // spent, so it must not inflate the capital total.
    seedPolicies([
      {
        id: 'a',
        categoryId: 'retirement_post_fixed',
        data: { ret_post_fixed_3: 1500000, ret_post_fixed_4: 9000 },
      },
    ]);

    expect((await totals()).post_retirement_capital_total).toBe(0);
  });
});
