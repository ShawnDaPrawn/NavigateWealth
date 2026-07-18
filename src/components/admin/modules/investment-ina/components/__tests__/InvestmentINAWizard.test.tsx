/**
 * InvestmentINAWizard — Render / Characterization Test (Phase 4)
 * ==============================================================
 *
 * Locks the dialog title and the "Client Overview" step label for this
 * 944-line Phase 6 decomposition target.
 *
 * InvestmentINAApiService, InvestmentINACalculationService, and useFormPrefill
 * are mocked so no real HTTP calls or complex calculation services run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils';

const { autoPopulateInputsMock, startPrefillMock } = vi.hoisted(() => ({
  autoPopulateInputsMock: vi.fn(),
  startPrefillMock: vi.fn(),
}));

vi.mock('@/components/admin/modules/investment-ina/api', () => ({
  InvestmentINAApiService: {
    autoPopulateInputs: autoPopulateInputsMock,
    calculateINA: vi.fn().mockResolvedValue({}),
    saveSession: vi.fn().mockResolvedValue({ id: 'session-1' }),
  },
}));

vi.mock(
  '@/components/admin/modules/investment-ina/services/investmentINACalculationService',
  () => ({
    InvestmentINACalculationService: { validateGoal: vi.fn().mockReturnValue(true) },
  }),
);

vi.mock('@/components/admin/modules/form-prefill/useFormPrefill', () => ({
  useFormPrefill: () => ({ PrefillUI: null, startPrefill: startPrefillMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { InvestmentINAWizard } from '../InvestmentINAWizard';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  autoPopulateInputsMock.mockResolvedValue({});
  startPrefillMock.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InvestmentINAWizard', () => {
  it('shows the wizard dialog title when open', async () => {
    render(<InvestmentINAWizard open={true} onClose={noop} clientId="c-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Investment Needs Analysis/i)).toBeTruthy();
    });
  });

  it('shows the "Client Overview" step label when open', async () => {
    render(<InvestmentINAWizard open={true} onClose={noop} clientId="c-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('Client Overview').length).toBeGreaterThan(0);
    });
  });

  it('starts the launched review prefill path instead of legacy auto-populate', async () => {
    render(<InvestmentINAWizard open={true} onClose={noop} clientId="c-1" />);

    await waitFor(() => expect(startPrefillMock).toHaveBeenCalledTimes(1));
    expect(autoPopulateInputsMock).not.toHaveBeenCalled();
  });
});
