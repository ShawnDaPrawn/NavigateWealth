import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import { getPolicyNumberForPolicy } from '../integrations-field-utils.ts';
import type { KvPolicy } from '../integrations-types.ts';

function prePolicy(data: Record<string, unknown>): KvPolicy {
  return { id: 'p1', clientId: 'c1', categoryId: 'retirement_pre', data } as unknown as KvPolicy;
}

describe('getPolicyNumberForPolicy — retired Retirement Planning field id', () => {
  beforeEach(() => kvStore.clear());

  // Policies staged through the old parent schema may hold their number only
  // in its `ret_1` field; they must still match once rows stage under
  // Pre-Retirement.
  it('reads a Pre-Retirement policy number held only in the legacy ret_1 field', async () => {
    expect(await getPolicyNumberForPolicy(prePolicy({ ret_1: 'RA-001' }), [])).toBe('RA-001');
  });

  it('prefers the Pre-Retirement policy-number field when both are set', async () => {
    const policy = prePolicy({ ret_1: 'OLD-1', ret_pre_1: 'RA-002' });
    expect(await getPolicyNumberForPolicy(policy, [])).toBe('RA-002');
  });
});
