import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { FNAWizardShell } from '../FNAWizardShell';
import { FNAStepNavigation } from '../FNAStepNavigation';
import { buildFNAWizardSteps } from '../fnaWizardFlow';

const steps = buildFNAWizardSteps();

describe('FNAWizardShell', () => {
  it('titles the dialog "<FNA> — <client>" and marks the current step', () => {
    render(
      <FNAWizardShell
        open
        onClose={vi.fn()}
        fnaType="investment"
        clientName="Jane Client"
        steps={steps}
        currentStep={2}
      >
        <p>body</p>
      </FNAWizardShell>,
    );

    expect(screen.getByRole('heading', { name: 'Investment Needs Analysis — Jane Client' }));
    const current = screen.getByText('System Auto-Calculation').closest('li');
    expect(current?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('shows the loading state instead of the step body', () => {
    render(
      <FNAWizardShell open onClose={vi.fn()} fnaType="estate" steps={steps} currentStep={1} loading>
        <p>body</p>
      </FNAWizardShell>,
    );
    expect(screen.queryByText('body')).toBeNull();
    expect(screen.getByText(/Loading client data/)).toBeTruthy();
  });

  it('shows the publishing overlay while a publish is in flight', () => {
    render(
      <FNAWizardShell
        open
        onClose={vi.fn()}
        fnaType="tax"
        steps={steps}
        currentStep={4}
        isPublishing
      >
        <p>body</p>
      </FNAWizardShell>,
    );
    expect(screen.getByText('Publishing Tax Planning FNA…')).toBeTruthy();
  });
});

describe('FNAStepNavigation', () => {
  it('has no back action on Step 1 and runs the calculation', () => {
    const onNext = vi.fn();
    render(<FNAStepNavigation step={1} onNext={onNext} />);
    expect(screen.queryByText(/Back to/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Run Calculation/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('goes back to the previous step by name', () => {
    const onBack = vi.fn();
    render(<FNAStepNavigation step={3} onBack={onBack} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to Calculation/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Continue to Finalise/ })).toBeTruthy();
  });

  it('publishes from Step 4 and disables everything while busy', () => {
    render(<FNAStepNavigation step={4} onBack={vi.fn()} onNext={vi.fn()} isBusy />);
    expect(
      (screen.getByRole('button', { name: /Publish FNA/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Back to Adjustments/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('lets the client intake relabel the primary action', () => {
    render(<FNAStepNavigation step={1} nextType="submit" nextLabel="Continue to submit" />);
    const button = screen.getByRole('button', { name: /Continue to submit/ }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
  });
});
