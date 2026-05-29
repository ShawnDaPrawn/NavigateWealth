import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FNAResultsView } from '@/components/admin/modules/fna/FNAResultsView';
import type { FNASession } from '@/components/admin/modules/fna/types';

/**
 * Characterization test locking the FNAResultsView summary cards to the correct
 * risk-breakdown fields (required -> finalRecommendedNeed, gap -> shortfallSurplus,
 * existing -> the existing* field). Previously the component read non-existent
 * field names and rendered R0.00 for required/gap.
 */
describe('FNAResultsView summary cards (characterization)', () => {
  const breakdown = (over: Record<string, number>) => ({
    calculatedNeed: 0,
    finalRecommendedNeed: 0,
    shortfallSurplus: 0,
    ...over,
  });

  it('shows finalRecommendedNeed as "required" and shortfallSurplus as "gap"', () => {
    const fna = {
      status: 'draft',
      createdAt: '2026-01-01T00:00:00Z',
      inputs: {},
      results: {
        lifeCover: breakdown({ existingLifeCover: 200000, finalRecommendedNeed: 1000000, shortfallSurplus: 800000 }),
        severeIllness: breakdown({ existingSevereIllnessCover: 0, finalRecommendedNeed: 500000, shortfallSurplus: 450000 }),
        capitalDisability: breakdown({ existingDisabilityCover: 0, finalRecommendedNeed: 700000, shortfallSurplus: 650000 }),
        incomeProtection: breakdown({ existingIP: 0, monthlyRequired: 0, finalRecommendedNeed: 30000, shortfallSurplus: 25000 }),
      },
    } as unknown as FNASession;

    render(<FNAResultsView fna={fna} />);

    expect(screen.getByText('Life Cover')).toBeTruthy();
    // Unique to the summary card (the still-untyped detail breakdown renders R0.00 here):
    expect(screen.getByText('R1,000,000.00')).toBeTruthy(); // life-cover required = finalRecommendedNeed
    expect(screen.getByText('R800,000.00')).toBeTruthy();   // life-cover gap = shortfallSurplus
    expect(screen.getByText('R500,000.00')).toBeTruthy();   // severe-illness required
  });
});
