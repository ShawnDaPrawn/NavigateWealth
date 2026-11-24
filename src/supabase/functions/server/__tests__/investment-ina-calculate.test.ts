/**
 * The Edge Function's INA calculation is the shared engine
 * (src/shared/fna-calculations/investment.ts) — the stored results and the
 * engine's own tests describe the same numbers.
 */
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const { calculateInvestmentINA, INACalculationError } =
  await import('../investment-ina-calculations.ts');

const NOW = new Date('2026-11-24T00:00:00Z');

const inputs = {
  clientRiskProfile: 'conservative',
  expectedRealReturns: { conservative: 0, balanced: 0.05 },
  longTermInflationRate: 0.06,
  discretionaryInvestments: [{ id: 'a', productName: 'Fund', currentValue: 100_000 }],
  goals: [
    {
      id: 'g1',
      goalName: 'House',
      goalAmountToday: 200_000,
      targetYear: 2028,
      targetDate: '2028-11-24',
      useClientRiskProfile: true,
      linkedInvestmentIds: ['a'],
      currentContributionToGoal: 1000,
    },
    {
      id: 'g2',
      goalName: 'Car',
      goalAmountToday: 50_000,
      targetYear: 2028,
      targetDate: '2028-11-24',
      useClientRiskProfile: true,
      linkedInvestmentIds: ['a'],
    },
  ],
};

describe('calculateInvestmentINA (server entry point)', () => {
  it('projects at a 0% real return without NaN and splits a shared investment', () => {
    const results = calculateInvestmentINA(inputs, NOW);
    const [house, car] = results.goalResults;
    // House: 50,000 (half of the fund) + 1,000 × 24 = 74,000 of 200,000
    expect(house.projectedCapital.totalProjectedCapital).toBe(74_000);
    // Gap 126,000 over 24 months at 0% = 5,250 a month
    expect(house.requiredContributions.requiredAdditionalMonthly).toBe(5250);
    // Car: the other half, 50,000 = fully funded
    expect(car.projectedCapital.totalProjectedCapital).toBe(50_000);
    expect(car.goalStatus).toBe('on-track');
  });

  it('throws INACalculationError for inputs it cannot calculate', () => {
    expect(() => calculateInvestmentINA({ ...inputs, clientRiskProfile: 'growth' }, NOW)).toThrow(
      INACalculationError,
    );
  });
});
