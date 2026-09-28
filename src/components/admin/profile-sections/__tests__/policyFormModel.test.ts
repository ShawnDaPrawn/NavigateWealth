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
