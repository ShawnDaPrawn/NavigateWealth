/**
 * Step 2 result cards render both calculation shapes: the 3.0.0 capital needs
 * breakdown, and records calculated by the 2.x income-multiple engine, which
 * have none of the fields added in 3.0.0.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/utils';
import { LifeCoverResult } from '../step2/LifeCoverResult';
import { DisabilityCoverResult } from '../step2/DisabilityCoverResult';
import { calculateDisabilityCover, calculateLifeCover } from '../../utils';
import type { DisabilityCoverCalculation, LifeCoverCalculation } from '../../types';

const OLD_LIFE: LifeCoverCalculation = {
  immediateCapital: { outstandingDebt: 100, funeralFinalExpenses: 100, estateCosts: 0, total: 200 },
  incomeReplacementCapital: { netAnnualIncome: 600_000, incomeMultiple: 14, total: 8_400_000 },
  educationCapital: { perDependant: [], total: 0 },
  grossNeed: 8_400_200,
  existingCover: { personal: 0, group: 0, total: 0 },
  netShortfall: 8_400_200,
  assumptions: ['Income multiple: 14×'],
  riskNotes: [],
};

const OLD_DISABILITY: DisabilityCoverCalculation = {
  capitalisedIncomeLoss: { netAnnualIncome: 600_000, disabilityMultiple: 6, total: 3_600_000 },
  additionalDisabilityCosts: {
    homeModifications: 0,
    vehicleAdaptation: 0,
    medicalEquipment: 0,
    onceOffCareCosts: 0,
    total: 0,
  },
  grossNeed: 3_600_000,
  existingCover: { personal: 0, group: 0, total: 0 },
  netShortfall: 3_600_000,
  assumptions: [],
  riskNotes: [],
};

const NEW_INPUT = {
  grossMonthlyIncome: 80_000,
  grossAnnualIncome: 960_000,
  netMonthlyIncome: 50_000,
  netAnnualIncome: 600_000,
  incomeEscalationAssumption: 6,
  currentAge: 40,
  retirementAge: 65,
  employmentType: 'employed' as const,
  dependants: [
    { id: 'd1', relationship: 'Child', dependencyTerm: 12, monthlyEducationCost: 4_000 },
  ],
  totalOutstandingDebts: 0,
  totalCurrentAssets: 0,
  totalEstateValue: 0,
  combinedHouseholdIncome: 80_000,
  clientIncomePercentage: 100,
  totalHouseholdMonthlyExpenditure: 0,
  liquidAssetsAvailable: 250_000,
  existingCover: {
    life: { personal: 0, group: 0 },
    disability: { personal: 0, group: 0 },
    severeIllness: { personal: 0, group: 0 },
    incomeProtection: {
      temporary: { personal: 0, group: 0 },
      permanent: { personal: 10_000, group: 0 },
    },
  },
  incomeProtectionSettings: {
    temporary: { benefitPeriod: '12-months' as const },
    permanent: { escalation: 'cpi-linked' as const },
  },
};

describe('LifeCoverResult', () => {
  it('renders a 2.x income-multiple record', () => {
    render(<LifeCoverResult calculation={OLD_LIFE} />);
    expect(screen.getByText('Income Multiple')).toBeTruthy();
    expect(screen.getByText('14×')).toBeTruthy();
    expect(screen.queryByText('Total Capital Need')).toBeNull();
  });

  it('renders the 3.0.0 capital needs breakdown', () => {
    render(<LifeCoverResult calculation={calculateLifeCover(NEW_INPUT)} />);
    expect(screen.getByText('Share of net income')).toBeTruthy();
    expect(screen.getByText('12 years')).toBeTruthy();
    expect(screen.getByText('Total Capital Need')).toBeTruthy();
    expect(screen.getByText('Less Liquid Assets Available')).toBeTruthy();
  });
});

describe('DisabilityCoverResult', () => {
  it('renders a 2.x multiple record', () => {
    render(<DisabilityCoverResult calculation={OLD_DISABILITY} />);
    expect(screen.getByText(/Capitalised Income Loss \(6×\)/)).toBeTruthy();
  });

  it('shows the permanent income protection offset', () => {
    render(<DisabilityCoverResult calculation={calculateDisabilityCover(NEW_INPUT)} />);
    expect(
      screen.getByText('Less Existing Permanent Income Protection (capitalised)'),
    ).toBeTruthy();
  });
});
