import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEMAS } from '../default-schemas';
import { normalizePolicyDataForStructure, type ProductField } from '../policyFormModel';

const preRetirementFields = DEFAULT_SCHEMAS.retirement_pre.fields as ProductField[];

describe('normalizePolicyDataForStructure — retired Retirement Planning field ids', () => {
  // Retirement Planning is only a heading now and has no schema, but policies
  // captured under it still carry its field ids. Their values must still land
  // on the matching Pre-Retirement fields.
  it('carries the old parent-schema values onto the Pre-Retirement fields', () => {
    const normalized = normalizePolicyDataForStructure(
      { ret_2: 'Retirement Annuity', ret_3: 250000, ret_6: 1500 },
      preRetirementFields,
    );

    expect(normalized.ret_pre_2).toBe('Retirement Annuity');
    expect(normalized.ret_pre_3).toBe(250000);
    expect(normalized.ret_pre_6).toBe(1500);
  });

  it('does not overwrite a Pre-Retirement value that is already set', () => {
    const normalized = normalizePolicyDataForStructure(
      { ret_3: 250000, ret_pre_3: 300000 },
      preRetirementFields,
    );

    expect(normalized.ret_pre_3).toBe(300000);
  });
});

describe('normalizePolicyDataForStructure — retired Investments field ids', () => {
  const voluntaryFields = DEFAULT_SCHEMAS.investments_voluntary.fields as ProductField[];

  // Investments is only a heading now too; a portal run staged under it wrote
  // its inv_* ids onto a Voluntary Investments policy.
  it('carries the old parent-schema values onto the Voluntary Investments fields', () => {
    const normalized = normalizePolicyDataForStructure(
      {
        inv_2: 'Unit Trust',
        inv_3: 120000,
        inv_4: 180000,
        inv_5: '2035-01-01',
        inv_6: 2000,
        inv_8: 9,
        inv_9: 5,
      },
      voluntaryFields,
    );

    expect(normalized.inv_vol_2).toBe('Unit Trust');
    expect(normalized.inv_vol_3).toBe(120000);
    expect(normalized.inv_vol_4).toBe(180000);
    expect(normalized.inv_vol_5).toBe('2035-01-01');
    expect(normalized.inv_vol_6).toBe(2000);
    expect(normalized.inv_vol_8).toBe(9);
    expect(normalized.inv_vol_9).toBe(5);
  });
});
