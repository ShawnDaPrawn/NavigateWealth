import { describe, expect, it } from 'vitest';
import { inferPortalRowCategoryId } from '../integrations-portal-guards.ts';

describe('inferPortalRowCategoryId', () => {
  it.each(['investments_voluntary', 'retirement_pre', 'retirement_post'])(
    'files a Retirement Annuity row from a %s job under Pre-Retirement',
    (jobCategoryId) => {
      const row = { 'Policy number': 'RA123', 'Product type': 'Retirement Annuity' };
      expect(inferPortalRowCategoryId(row, jobCategoryId)).toBe('retirement_pre');
    },
  );

  it('never answers the Retirement Planning heading, which has no product schema', () => {
    const row = { Product: 'Allan Gray Retirement Annuity Fund' };
    expect(inferPortalRowCategoryId(row, 'investments_voluntary')).not.toBe('retirement_planning');
  });

  it('keeps the job category for a row with no Retirement Annuity marker', () => {
    const row = { 'Policy number': 'UT9', 'Product type': 'Unit Trust' };
    expect(inferPortalRowCategoryId(row, 'investments_voluntary')).toBe('investments_voluntary');
  });
});
