/**
 * InvestmentINAWizard — runs the shared four-step FNA flow.
 *
 * The API and the review prefill are mocked so no HTTP calls run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

const { autoPopulateInputsMock, calculateINAMock, startPrefillMock } = vi.hoisted(() => ({
  autoPopulateInputsMock: vi.fn(),
  calculateINAMock: vi.fn(),
  startPrefillMock: vi.fn(),
}));

vi.mock('@/components/admin/modules/investment-ina/api', () => ({
  InvestmentINAApiService: {
    autoPopulateInputs: autoPopulateInputsMock,
    calculateINA: calculateINAMock,
    saveSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  },
}));

vi.mock('@/components/admin/modules/form-prefill/useFormPrefill', () => ({
  useFormPrefill: () => ({ PrefillUI: null, startPrefill: startPrefillMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { InvestmentINAWizard } from '../InvestmentINAWizard';

const noop = vi.fn();

const results = {
  portfolioSummary: {
    totalGoals: 1,
    totalRequiredCapital: 100000,
    totalProjectedCapital: 80000,
    totalFundingGap: 20000,
    totalAdditionalMonthlyRequired: 500,
    goalsOnTrack: 0,
    goalsUnderfunded: 1,
    goalsOverfunded: 0,
    overallPortfolioHealth: 'needs-attention',
  },
  goalResults: [],
  recommendations: [],
  economicAssumptions: { inflationRate: 0.06, realReturnsByProfile: {} },
  calculatedAt: '2026-09-28T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  autoPopulateInputsMock.mockResolvedValue({
    currentAge: 44,
    discretionaryInvestments: [
      {
        id: 'inv-1',
        productName: 'Unit trust',
        provider: 'Allan Gray',
        currentValue: 250000,
        monthlyContribution: 2000,
        isDiscretionary: true,
      },
    ],
    totalDiscretionaryCapitalCurrent: 250000,
    totalDiscretionaryMonthlyContributions: 2000,
  });
  calculateINAMock.mockResolvedValue(results);
  startPrefillMock.mockResolvedValue(undefined);
});

describe('InvestmentINAWizard', () => {
  it('uses the shared wizard title and four-step stepper', async () => {
    render(<InvestmentINAWizard open onClose={noop} clientId="c-1" clientName="Jane" />);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Investment Needs Analysis — Jane' })),
    );
    expect(screen.getByText('Information Gathering')).toBeTruthy();
    expect(screen.getByText('System Auto-Calculation')).toBeTruthy();
    expect(screen.getByText('Adviser Manual Adjustment')).toBeTruthy();
    expect(screen.getByText('Finalise & Publish')).toBeTruthy();
  });

  it('gathers information on Step 1, starting with the client overview', async () => {
    render(<InvestmentINAWizard open onClose={noop} clientId="c-1" />);

    await waitFor(() => expect(screen.getAllByText('Client Overview').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: /Run Calculation/ })).toBeTruthy();
  });

  it('takes client values only through the review prefill, and only records from auto-populate', async () => {
    render(<InvestmentINAWizard open onClose={noop} clientId="c-1" />);

    await waitFor(() => expect(startPrefillMock).toHaveBeenCalledTimes(1));
    expect(autoPopulateInputsMock).toHaveBeenCalledWith('c-1');
    // currentAge came back from auto-populate but is a client key: it must
    // wait for the adviser's review rather than being applied silently.
    expect((screen.getByLabelText('Current Age *') as HTMLInputElement).value).toBe('');
  });

  it('opens on Step 2 with the calculation run for an accepted intake', async () => {
    render(
      <InvestmentINAWizard
        open
        onClose={noop}
        clientId="c-1"
        startAtStep={2}
        intakePrefill={{ currentAge: 40, clientRiskProfile: 'balanced' }}
      />,
    );

    await waitFor(() => expect(screen.getByText('System Calculation')).toBeTruthy());
    expect(calculateINAMock).toHaveBeenCalledWith(
      'c-1',
      expect.objectContaining({ currentAge: 40, totalDiscretionaryCapitalCurrent: 250000 }),
    );
    expect(startPrefillMock).not.toHaveBeenCalled();
  });
});
