import { describe, expect, it } from 'vitest';
import type { IntegrationSyncRun, SyncDiff } from '../integrations-core-types.ts';
import type { PortalJobPolicyItem } from '../integrations-portal-types.ts';
import {
  categoryMatches,
  getPortalAutomationCategoryError,
  inferPortalRowCategoryId,
  isPortalAutomationCategory,
  portalArtifactsMatchCategory,
  recordHasRetirementAnnuityMarker,
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

describe('recordHasRetirementAnnuityMarker', () => {
  it.each([
    'Retirement-Annuity',
    'RETIREMENT_ANNUITY',
    'retirement/annuity',
    'Retirement   Annuity',
  ])('folds punctuation and case in %s', (product) => {
    expect(recordHasRetirementAnnuityMarker({ Product: product })).toBe(true);
  });

  it('joins a marker split across the column name and the cell', () => {
    expect(recordHasRetirementAnnuityMarker({ Retirement: 'Annuity' })).toBe(true);
  });

  it('treats the plural product name as a retirement annuity', () => {
    expect(recordHasRetirementAnnuityMarker({ Product: 'Retirement annuities' })).toBe(true);
  });

  it('keeps a zero-width character from hiding the product name', () => {
    expect(recordHasRetirementAnnuityMarker({ Product: 'Retirement\u200BAnnuity' })).toBe(true);
  });

  it.each([
    'Retirement plan',
    'Life annuity',
    'Annual retirement contribution',
    'RetirementAnnuity',
  ])('does not treat %s as a retirement annuity', (product) => {
    expect(recordHasRetirementAnnuityMarker({ Product: product })).toBe(false);
  });

  it('does not read a marker buried in a nested object', () => {
    expect(recordHasRetirementAnnuityMarker({ details: { Product: 'Retirement Annuity' } })).toBe(
      false,
    );
  });

  it('ignores an empty or missing record', () => {
    expect(recordHasRetirementAnnuityMarker(undefined)).toBe(false);
    expect(recordHasRetirementAnnuityMarker({})).toBe(false);
    expect(recordHasRetirementAnnuityMarker({ premium: 0, active: false })).toBe(false);
  });
});

function stagedRun(
  rows: Array<{
    rawData?: Record<string, unknown>;
    mappedData?: Record<string, unknown>;
    diffs?: Array<Pick<SyncDiff, 'fieldName' | 'oldValue' | 'newValue'>>;
  }>,
): IntegrationSyncRun {
  return {
    rows: rows.map((row) => ({
      rawData: row.rawData ?? {},
      mappedData: row.mappedData ?? {},
      diffs: (row.diffs ?? []).map((diff) => ({
        fieldId: 'product',
        fieldName: diff.fieldName,
        oldValue: diff.oldValue,
        newValue: diff.newValue,
      })),
    })),
  } as IntegrationSyncRun;
}

function queueItem(
  data: Pick<PortalJobPolicyItem, 'rawData' | 'extractedData'>,
): PortalJobPolicyItem {
  return data as PortalJobPolicyItem;
}

describe('portalArtifactsMatchCategory', () => {
  it('files a hyphenated retirement annuity under Pre-Retirement', () => {
    expect(
      inferPortalRowCategoryId({ Product: 'Retirement-Annuity' }, 'investments_voluntary'),
    ).toBe('retirement_pre');
  });

  it.each(['investments', 'investments_voluntary', 'investments_guaranteed'] as const)(
    'refuses %s when the only marker is outside the raw portal row',
    (categoryId) => {
      const mappedOnly = stagedRun([
        { rawData: { code: 'UT9' }, mappedData: { product: 'Retirement-Annuity' } },
      ]);
      const diffOnly = stagedRun([
        {
          rawData: { col_a: '123' },
          diffs: [{ fieldName: 'Product type', oldValue: '', newValue: 'Retirement Annuity Fund' }],
        },
      ]);
      const extractedOnly = [queueItem({ extractedData: { plan: 'Retirement Annuity' } })];

      expect(portalArtifactsMatchCategory(categoryId, { stagedRun: mappedOnly })).toBe(false);
      expect(portalArtifactsMatchCategory(categoryId, { stagedRun: diffOnly })).toBe(false);
      expect(portalArtifactsMatchCategory(categoryId, { items: extractedOnly })).toBe(false);
    },
  );

  it('refuses the whole investments run when one row is a retirement annuity', () => {
    const run = stagedRun([
      { rawData: { Product: 'Unit Trust' } },
      { rawData: { Product: 'Retirement Annuity' } },
    ]);
    expect(portalArtifactsMatchCategory('investments_voluntary', { stagedRun: run })).toBe(false);
  });

  it('allows an investments run whose product names only look similar', () => {
    const run = stagedRun([
      {
        rawData: {
          Product: 'Retirement plan',
          Rider: 'Life annuity',
          Note: 'Annual retirement contribution',
        },
      },
    ]);
    expect(portalArtifactsMatchCategory('investments_voluntary', { stagedRun: run })).toBe(true);
  });

  it.each(['retirement_pre', 'retirement_post_fixed', 'risk_planning'])(
    'does not apply the investments guard to %s',
    (categoryId) => {
      const run = stagedRun([{ rawData: { Product: 'Retirement Annuity' } }]);
      expect(portalArtifactsMatchCategory(categoryId, { stagedRun: run })).toBe(true);
    },
  );

  it('allows an investments publish when nothing was staged and the queue is not a list', () => {
    expect(portalArtifactsMatchCategory('investments_voluntary', {})).toBe(true);
    expect(
      portalArtifactsMatchCategory('investments_guaranteed', {
        stagedRun: null,
        items: null,
      }),
    ).toBe(true);
  });
});

describe('getPortalAutomationCategoryError', () => {
  it('names every retirement product when the parent heading is selected', () => {
    const error = getPortalAutomationCategoryError('retirement_planning');
    expect(error).toMatch(/Pre-Retirement/);
    expect(error).toMatch(/Living Annuity/);
    expect(error).toMatch(/Fixed Annuity/);
  });

  it('names both investment products when the parent heading is selected', () => {
    const error = getPortalAutomationCategoryError('investments');
    expect(error).toMatch(/Voluntary Investments/);
    expect(error).toMatch(/Guaranteed Investments/);
  });

  it.each([
    'risk_planning',
    'medical_aid',
    'retirement_pre',
    'retirement_post',
    'retirement_post_fixed',
    'investments_voluntary',
    'investments_guaranteed',
    'employee_benefits',
    'employee_benefits_risk',
    'employee_benefits_retirement',
    'tax_planning',
    'estate_planning',
  ])('allows a portal job for %s', (categoryId) => {
    expect(getPortalAutomationCategoryError(categoryId)).toBeNull();
  });

  it('refuses an unknown id, including one that only differs by case', () => {
    expect(getPortalAutomationCategoryError('not_a_category')).toMatch(/supported category/i);
    expect(getPortalAutomationCategoryError('Retirement_Pre')).not.toBeNull();
    expect(getPortalAutomationCategoryError('')).not.toBeNull();
  });
});
