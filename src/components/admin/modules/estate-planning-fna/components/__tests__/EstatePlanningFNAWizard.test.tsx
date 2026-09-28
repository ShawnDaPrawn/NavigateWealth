/**
 * EstatePlanningFNAWizard — runs the shared four-step FNA flow.
 *
 * The API and the review prefill are mocked so no HTTP calls run; the
 * estate calculation itself is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';

const { autoPopulateInputsMock, saveSessionMock, startPrefillMock } = vi.hoisted(() => ({
  autoPopulateInputsMock: vi.fn(),
  saveSessionMock: vi.fn(),
  startPrefillMock: vi.fn(),
}));

vi.mock('@/components/admin/modules/estate-planning-fna/api', () => ({
  EstatePlanningAPI: {
    autoPopulateInputs: autoPopulateInputsMock,
    saveSession: saveSessionMock,
  },
}));

vi.mock('@/components/admin/modules/form-prefill/useFormPrefill', () => ({
  useFormPrefill: () => ({ PrefillUI: null, startPrefill: startPrefillMock }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { EstatePlanningFNAWizard } from '../EstatePlanningFNAWizard';
import {
  buildDefaultEstateInputs,
  mergeEstateInputs,
  normalizeEstateIntake,
} from '../estateWizardInputs';

const noop = vi.fn();

const asset = {
  id: 'a-1',
  type: 'property',
  subType: 'primary_residence',
  description: 'Home',
  currentValue: 4_000_000,
  ownership: 'sole',
  ownershipPercentage: 100,
  location: 'south_africa',
  liquidity: 'illiquid',
  includeInEstate: true,
  purchasePrice: 2_000_000,
  unrealisedGain: 2_000_000,
  bondedAmount: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  autoPopulateInputsMock.mockResolvedValue({
    familyInfo: { fullName: 'Should Not Apply', age: 61 },
    assets: [asset],
    liabilities: [],
    lifePolicies: [],
    dependants: [],
  });
  saveSessionMock.mockResolvedValue({ id: 'estate-1' });
  startPrefillMock.mockResolvedValue(undefined);
});

describe('EstatePlanningFNAWizard', () => {
  it('uses the shared wizard title and four-step stepper', async () => {
    render(<EstatePlanningFNAWizard open onClose={noop} clientId="c-1" clientName="Sam" />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Estate Planning FNA — Sam' })));
    expect(screen.getByText('Adviser Manual Adjustment')).toBeTruthy();
  });

  it('loads estate records, but client values only through the review prefill', async () => {
    render(<EstatePlanningFNAWizard open onClose={noop} clientId="c-1" />);

    await waitFor(() => expect(startPrefillMock).toHaveBeenCalledTimes(1));
    expect(autoPopulateInputsMock).toHaveBeenCalledWith('c-1');
    expect((screen.getByLabelText('Full Name *') as HTMLInputElement).value).toBe('');
  });

  it('runs all four steps and publishes with the adviser override recorded', async () => {
    const onFNAComplete = vi.fn();
    const onClose = vi.fn();
    render(
      <EstatePlanningFNAWizard
        open
        onClose={onClose}
        onFNAComplete={onFNAComplete}
        clientId="c-1"
        startAtStep={2}
        intakePrefill={{ familyInfo: { fullName: 'Sam Client', age: 60 } }}
      />,
    );

    // Opens on Step 2 with the calculation run.
    await waitFor(() => expect(screen.getByText('System Calculation')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Continue to Adjustments/ }));

    // Step 3: override the funeral costs; a reason is mandatory.
    fireEvent.change(screen.getByLabelText('Funeral costs'), { target: { value: '80000' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Finalise/ }));
    expect(screen.getByText(/Give a reason of at least/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Reason for adjustment/), {
      target: { value: 'Family has a larger funeral planned' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Finalise/ }));

    // Step 4: publish.
    await waitFor(() => expect(screen.getByText('Final Analysis')).toBeTruthy());
    expect(screen.getByText('Funeral costs: R80 000')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Publish FNA/ }));

    await waitFor(() => expect(onFNAComplete).toHaveBeenCalledWith('estate-1'));
    const [, savedInputs, , status] = saveSessionMock.mock.calls[0];
    expect(status).toBe('published');
    expect(savedInputs.assumptions.funeralCostsEstimate).toBe(80000);
    expect(savedInputs.adviserAdjustments).toMatchObject({
      overrides: { funeralCostsEstimate: 80000 },
      systemValues: { funeralCostsEstimate: 50000 },
      reason: 'Family has a larger funeral planned',
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('mergeEstateInputs', () => {
  it('keeps nested defaults when a partial object is merged', () => {
    const merged = mergeEstateInputs(buildDefaultEstateInputs(), {
      willInfo: { hasValidWill: 'yes' },
    });
    expect(merged.willInfo.hasValidWill).toBe('yes');
    expect(merged.willInfo.executorNominated).toBe('unknown');
    expect(merged.assumptions.executorFeePercentage).toBe(3.5);
  });
});

describe('accepted client intake', () => {
  // What the client estate intake saves, after the queue has added the review
  // matches the adviser applied at accept as dotted keys.
  const clientIntake = {
    willInfo: { hasValidWill: 'no' },
    familyInfo: { maritalStatus: 'married_in_community' },
    'familyInfo.fullName': 'Sam Client',
    'familyInfo.age': 58,
    assets: [
      { id: 'r1', description: 'House', value: 2_000_000 },
      { id: 'r2', description: '', value: 0 },
    ],
    liabilities: [{ id: 'r3', description: 'Bond', value: '500000' }],
  };

  it('calculates from the client’s own rows when the client has no records', async () => {
    autoPopulateInputsMock.mockResolvedValue({ assets: [], liabilities: [], lifePolicies: [] });
    render(
      <EstatePlanningFNAWizard
        open
        onClose={noop}
        clientId="c-1"
        startAtStep={2}
        intakePrefill={clientIntake}
      />,
    );

    await waitFor(() => expect(screen.getByText('System Calculation')).toBeTruthy());
    // The R2m house counts in the gross estate; the R500k bond is a real number, not NaN.
    expect(screen.getAllByText('R2 000 000').length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Continue to Adjustments/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continue to Finalise/ }));
    await waitFor(() => expect(screen.getByText('Final Analysis')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Publish FNA/ }));

    await waitFor(() => expect(saveSessionMock).toHaveBeenCalled());
    const [, saved] = saveSessionMock.mock.calls[0];
    expect(saved.familyInfo).toMatchObject({
      fullName: 'Sam Client',
      age: 58,
      maritalStatus: 'married_cop',
    });
    expect(saved).not.toHaveProperty(['familyInfo.fullName']);
    expect(saved.assets).toEqual([
      expect.objectContaining({ description: 'House', currentValue: 2_000_000, type: 'personal' }),
    ]);
    expect(saved.liabilities).toEqual([
      expect.objectContaining({ description: 'Bond', outstandingBalance: 500_000, type: 'other' }),
    ]);
  });

  it('uses the adviser’s records over the client’s rough rows, so nothing counts twice', async () => {
    render(
      <EstatePlanningFNAWizard
        open
        onClose={noop}
        clientId="c-1"
        startAtStep={2}
        intakePrefill={clientIntake}
      />,
    );

    await waitFor(() => expect(screen.getByText('System Calculation')).toBeTruthy());
    // Records hold the R4m home; the intake's R2m "House" row is not added to it.
    expect(screen.getAllByText('R4 000 000').length).toBeGreaterThan(0);
    expect(screen.queryByText('R6 000 000')).toBeNull();
  });
});

describe('normalizeEstateIntake', () => {
  it('leaves rows already in the calculation’s shape untouched', () => {
    const normalized = normalizeEstateIntake({ assets: [asset] });
    expect(normalized.assets).toEqual([asset]);
  });

  it('keeps an Estate Planning marital status and drops an unknown one', () => {
    expect(normalizeEstateIntake({ familyInfo: { maritalStatus: 'widowed' } }).familyInfo).toEqual({
      maritalStatus: 'widowed',
    });
    expect(
      normalizeEstateIntake({ familyInfo: { maritalStatus: 'it is complicated' } }).familyInfo,
    ).toEqual({});
  });

  it('returns nothing for no intake', () => {
    expect(normalizeEstateIntake(undefined)).toEqual({});
  });
});
