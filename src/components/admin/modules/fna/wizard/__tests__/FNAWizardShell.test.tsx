import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { FNAWizardShell } from '../FNAWizardShell';
import { FNAStepNavigation } from '../FNAStepNavigation';
import { buildFNAWizardSteps } from '../fnaWizardFlow';
import { BreadcrumbContext } from '@/components/admin/layout/page';

const steps = buildFNAWizardSteps();

describe('FNAWizardShell', () => {
  it('is a page: FNA title, "<client> · Draft", back link, and the current step marked', () => {
    const onClose = vi.fn();
    render(
      <FNAWizardShell
        open
        onClose={onClose}
        fnaType="investment"
        clientName="Jane Client"
        steps={steps}
        currentStep={2}
      >
        <p>body</p>
      </FNAWizardShell>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Investment Needs Analysis' }),
    ).toBeTruthy();
    expect(screen.getByText('Jane Client · Draft')).toBeTruthy();
    // Not a pop-up any more.
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Investments/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    const current = screen.getByText('System auto-calculation').closest('li');
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

describe('FNAWizardShell — breadcrumb', () => {
  it('extends the client page breadcrumb with the FNA and step, and restores it on close', () => {
    const setTrail = vi.fn();
    const base = [{ label: 'Elsa van Wyk' }, { label: 'Policies' }, { label: 'Risk planning' }];
    const { unmount } = render(
      <BreadcrumbContext.Provider value={{ trail: base, setTrail }}>
        <FNAWizardShell open onClose={vi.fn()} fnaType="risk" steps={steps} currentStep={1}>
          <p>body</p>
        </FNAWizardShell>
      </BreadcrumbContext.Provider>,
    );
    const last = setTrail.mock.calls.at(-1)?.[0] as Array<{ label: string }>;
    expect(last.map((c) => c.label)).toEqual([
      'Elsa van Wyk',
      'Policies',
      'Risk planning',
      'Risk Planning FNA',
      'Information gathering',
    ]);
    unmount();
    expect(setTrail.mock.calls.at(-1)?.[0]).toEqual(base);
  });
});

describe('FNAStepNavigation', () => {
  it('has no back action on Step 1 and runs the calculation', () => {
    const onNext = vi.fn();
    render(<FNAStepNavigation step={1} onNext={onNext} />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Next: System auto-calculation/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('goes back to the previous step by name', () => {
    const onBack = vi.fn();
    render(<FNAStepNavigation step={3} onBack={onBack} onNext={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Next: Finalise & publish/ })).toBeTruthy();
  });

  it('publishes from Step 4 and disables everything while busy', () => {
    render(<FNAStepNavigation step={4} onBack={vi.fn()} onNext={vi.fn()} isBusy />);
    expect(
      (screen.getByRole('button', { name: /Publish FNA/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: /^Back$/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('lets the client intake relabel the primary action', () => {
    render(<FNAStepNavigation step={1} nextType="submit" nextLabel="Continue to submit" />);
    const button = screen.getByRole('button', { name: /Continue to submit/ }) as HTMLButtonElement;
    expect(button.type).toBe('submit');
  });
});
