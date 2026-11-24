import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ComplianceDeclarationsCard,
  ComplianceReviewCard,
  EmployerBenefitsFields,
  EmployerBenefitsSummary,
  PlanningSection,
  PostalAddressFields,
  SmokingAlcoholFields,
} from '..';
import {
  defaultProfileExtensionFields,
  emptyPlanningProfile,
  emptyEmployerBenefits,
} from '../../../../shared/client-profile';
import {
  emptyComplianceDeclarations,
  emptyComplianceReview,
  type ComplianceDeclarations,
} from '../../../../shared/compliance';

describe('ComplianceDeclarationsCard', () => {
  const renderCard = (
    value: ComplianceDeclarations = emptyComplianceDeclarations(),
    props: Partial<Parameters<typeof ComplianceDeclarationsCard>[0]> = {},
  ) => {
    const onChange = vi.fn();
    render(
      <ComplianceDeclarationsCard value={value} onChange={onChange} audience="client" {...props} />,
    );
    return onChange;
  };

  it('counts what is outstanding and will not confirm an incomplete record', () => {
    renderCard();
    expect(screen.getByText('8 outstanding')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /confirm these are accurate/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('records a PEP answer and clears the details on "no"', () => {
    const onChange = renderCard({
      ...emptyComplianceDeclarations(),
      isPep: 'yes',
      pepPosition: 'Mayor',
    });
    expect(screen.getByLabelText('Position held')).toBeTruthy();
    fireEvent.click(document.getElementById('isPep-no')!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ isPep: 'no', pepPosition: '', pepCategory: '' }),
    );
  });

  it("adds South Africa from the application's answer with the profile's tax number", () => {
    const onChange = renderCard(undefined, {
      applicationSaysSaTaxResident: true,
      saTaxNumber: '0123456789',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add South Africa' }));
    const next = onChange.mock.calls[0][0] as ComplianceDeclarations;
    expect(next.taxResidencies).toHaveLength(1);
    expect(next.taxResidencies[0]).toMatchObject({
      country: 'South Africa',
      taxNumber: '0123456789',
    });
  });

  it('time-stamps a consent and shows consent already given elsewhere', () => {
    const onChange = renderCard(undefined, {
      legacyConsent: [
        { key: 'marketing', status: 'granted', recordedAt: '', source: 'application' },
      ],
    });
    expect(screen.getByText(/Given on the application/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('radio', { name: 'I agree' })[0]);
    const next = onChange.mock.calls[0][0] as ComplianceDeclarations;
    expect(next.consents.dataProcessing.status).toBe('granted');
    expect(next.consents.dataProcessing.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("speaks about the client, not to them, in the adviser's view", () => {
    render(
      <ComplianceDeclarationsCard
        value={emptyComplianceDeclarations()}
        onChange={vi.fn()}
        audience="adviser"
      />,
    );
    expect(screen.getByText('Is the client a politically exposed person?')).toBeTruthy();
    expect(screen.queryByText('Are you a politically exposed person?')).toBeNull();
  });
});

describe('ComplianceReviewCard', () => {
  it('shows what needs attention and suggests the next review from the rating', () => {
    const onChange = vi.fn();
    render(
      <ComplianceReviewCard
        value={{ ...emptyComplianceReview(), riskRating: 'high', lastKycReviewDate: '2026-11-24' }}
        onChange={onChange}
        declarations={{ ...emptyComplianceDeclarations(), isPep: 'yes' }}
      />,
    );
    expect(screen.getByText(/PEP exposure declared — enhanced due diligence/)).toBeTruthy();
    expect(screen.getByText('Sanctions screening not recorded.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Use 2027-11-24/ }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ nextKycReviewDate: '2027-11-24' }),
    );
  });
});

describe('PlanningSection', () => {
  const renderSection = (props: Partial<Parameters<typeof PlanningSection>[0]> = {}) => {
    const onPlanningChange = vi.fn();
    render(
      <PlanningSection
        planning={emptyPlanningProfile()}
        onPlanningChange={onPlanningChange}
        audience="client"
        {...props}
      />,
    );
    return { onPlanningChange };
  };

  it('shows the goals from the application and keeps no goals list of its own', () => {
    renderSection({ applicationGoals: 'Retire early' });
    expect(screen.getByText('Retire early')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add goal/i })).toBeNull();
  });

  it('points the adviser to Goals on the Investments tab', () => {
    renderSection({ audience: 'adviser' });
    expect(
      screen.getByText('Investment goals are captured in Goals on the Investments tab'),
    ).toBeTruthy();
    expect(screen.getByText('No goals were noted on the application.')).toBeTruthy();
  });

  it('records capacity for loss and works out the years to retirement', () => {
    const { onPlanningChange } = renderSection({
      planning: { ...emptyPlanningProfile(), plannedRetirementAge: 200 },
      dateOfBirth: '1990-01-01',
      monthlyIncome: 30000,
    });
    expect(screen.getByText(/years from now/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /It would delay my plans/ }));
    expect(onPlanningChange).toHaveBeenCalledWith(
      expect.objectContaining({ capacityForLoss: 'medium' }),
    );
  });
});

describe('PostalAddressFields', () => {
  it('hides the fields while the residential address applies', () => {
    const onChange = vi.fn();
    render(<PostalAddressFields value={defaultProfileExtensionFields()} onChange={onChange} />);
    expect(screen.queryByLabelText('Address line 1 / PO Box')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Same as residential address' }));
    expect(onChange).toHaveBeenCalledWith('postalSameAsResidential', false);
  });

  it('edits a separate postal address', () => {
    const onChange = vi.fn();
    render(
      <PostalAddressFields
        value={{ ...defaultProfileExtensionFields(), postalSameAsResidential: false }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Address line 1 / PO Box'), {
      target: { value: 'PO Box 7' },
    });
    expect(onChange).toHaveBeenCalledWith('postalAddressLine1', 'PO Box 7');
  });
});

describe('SmokingAlcoholFields', () => {
  it('asks for the year a former smoker stopped, digits only', () => {
    const onChange = vi.fn();
    render(
      <SmokingAlcoholFields
        value={{
          smokerStatus: false,
          formerSmoker: true,
          quitSmokingYear: '',
          alcoholConsumption: '',
        }}
        onChange={onChange}
        audience="client"
      />,
    );
    expect(screen.getByText('Former smoker')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Year stopped'), { target: { value: '20a19' } });
    expect(onChange).toHaveBeenCalledWith('quitSmokingYear', '2019');
  });

  it('does not ask for a quit year from a current smoker', () => {
    render(
      <SmokingAlcoholFields
        value={{
          smokerStatus: true,
          formerSmoker: false,
          quitSmokingYear: '',
          alcoholConsumption: '',
        }}
        onChange={vi.fn()}
        audience="adviser"
      />,
    );
    expect(screen.getByText('Current smoker')).toBeTruthy();
    expect(screen.queryByLabelText('Year stopped')).toBeNull();
    expect(screen.getByText('Alcohol consumption')).toBeTruthy();
  });
});

describe('employer benefits', () => {
  it('summarises recorded benefits and shows nothing when none are recorded', () => {
    const { container, rerender } = render(<EmployerBenefitsSummary value={undefined} />);
    expect(container.textContent).toBe('');
    rerender(
      <EmployerBenefitsSummary
        value={{ ...emptyEmployerBenefits(), retirementFund: 'pension', medicalAidSubsidy: 'yes' }}
      />,
    );
    expect(screen.getByText('Pension fund')).toBeTruthy();
    expect(screen.getByText('Medical aid subsidy')).toBeTruthy();
  });

  it('renders every benefit field for editing', () => {
    render(<EmployerBenefitsFields idPrefix="e1" value={undefined} onChange={vi.fn()} />);
    for (const label of [
      'Retirement fund',
      'Medical aid subsidy',
      'Group life cover',
      'Group disability (lump sum)',
      'Group income protection (per month)',
      'Group severe illness cover',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });
});
