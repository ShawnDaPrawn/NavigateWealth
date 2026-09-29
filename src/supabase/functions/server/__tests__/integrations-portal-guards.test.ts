import { describe, expect, it } from 'vitest';
import {
  categoryMatches,
  inferPortalRowCategoryId,
  isPortalAutomationCategory,
} from '../integrations-portal-guards.ts';

const RA_ROW = { 'Policy number': 'RA123', 'Product type': 'Retirement Annuity' };

describe('inferPortalRowCategoryId', () => {
  it.each(['investments_voluntary', 'investments_guaranteed', 'retirement_planning'])(
    'files a Retirement Annuity row from a %s job under Pre-Retirement',
    (jobCategoryId) => {
      expect(inferPortalRowCategoryId(RA_ROW, jobCategoryId)).toBe('retirement_pre');
    },
  );

  // stage-items rows are stamped with their queued policy's category, and
  // buildSyncRun rejects a row whose stamp differs from the run it lands in.
  it.each(['retirement_pre', 'retirement_post', 'retirement_post_fixed'])(
    'keeps an explicit %s category on a Retirement Annuity row',
    (categoryId) => {
      expect(inferPortalRowCategoryId(RA_ROW, categoryId)).toBe(categoryId);
    },
  );

  it('never answers the Retirement Planning heading, which has no product schema', () => {
    const row = { Product: 'Allan Gray Retirement Annuity Fund' };
    expect(inferPortalRowCategoryId(row, 'investments_voluntary')).not.toBe('retirement_planning');
    expect(inferPortalRowCategoryId(row, 'retirement_planning')).not.toBe('retirement_planning');
  });

  it('keeps the job category for a row with no Retirement Annuity marker', () => {
    const row = { 'Policy number': 'UT9', 'Product type': 'Unit Trust' };
    expect(inferPortalRowCategoryId(row, 'investments_voluntary')).toBe('investments_voluntary');
  });
});

describe('Post-Retirement (Fixed Annuity)', () => {
  it('is a portal-automation product in its own right', () => {
    expect(isPortalAutomationCategory('retirement_post_fixed')).toBe(true);
  });

  it('sits under the Retirement Planning heading', () => {
    expect(categoryMatches('retirement_planning', 'retirement_post_fixed')).toBe(true);
  });

  it('is not the same product as the living annuity', () => {
    expect(categoryMatches('retirement_post', 'retirement_post_fixed')).toBe(false);
  });
});
