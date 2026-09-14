/**
 * The shell is the reason the flow reads as one flow: it owns the header, the
 * progress rail and the action bar for every step. These tests pin the parts a
 * step depends on — that its actions are rendered where the user expects them,
 * that a busy action cannot be fired twice, and that the rail says which step
 * is current — since a step supplies content only and cannot compensate.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';
import { ArrowRight } from 'lucide-react';

import { EsignWizardShell } from '../EsignWizardShell';

describe('EsignWizardShell', () => {
  it('renders the step heading, description and content', () => {
    render(
      <EsignWizardShell step="upload" title="Add Documents" description="Upload the PDFs.">
        <p>step body</p>
      </EsignWizardShell>,
    );

    expect(screen.getByRole('heading', { name: 'Add Documents' })).toBeTruthy();
    expect(screen.getByText('Upload the PDFs.')).toBeTruthy();
    expect(screen.getByText('step body')).toBeTruthy();
  });

  it('marks the current step on the rail and counts it in the top bar', () => {
    render(
      <EsignWizardShell step="recipients" title="Add Recipients">
        <p>body</p>
      </EsignWizardShell>,
    );

    const rail = screen.getByTestId('esign-wizard-stepper');
    const states = Array.from(rail.querySelectorAll('li')).map((li) => li.dataset.state);
    expect(states).toEqual(['complete', 'current', 'upcoming']);

    expect(rail.querySelector('[aria-current="step"]')?.getAttribute('data-step')).toBe(
      'recipients',
    );
    // The compact rail repeats the count for phone widths; the top bar's copy
    // is the one shown on a laptop, so assert on that one specifically.
    expect(screen.getByTestId('esign-wizard-step-count').textContent).toBe('Step 2 of 3');
  });

  it('fires back, secondary and primary actions', () => {
    const back = vi.fn();
    const secondary = vi.fn();
    const primary = vi.fn();

    render(
      <EsignWizardShell
        step="recipients"
        title="Add Recipients"
        backAction={{ label: 'Back', onClick: back }}
        secondaryAction={{ label: 'Send now (express)', onClick: secondary }}
        primaryAction={{ label: 'Next: Prepare Fields', onClick: primary, icon: ArrowRight }}
      >
        <p>body</p>
      </EsignWizardShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    fireEvent.click(screen.getByRole('button', { name: /send now \(express\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /next: prepare fields/i }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(primary).toHaveBeenCalledTimes(1);
  });

  it('explains a blocked step instead of letting the primary action be clicked', () => {
    const primary = vi.fn();

    render(
      <EsignWizardShell
        step="upload"
        title="Add Documents"
        footerHint="Add at least one PDF to continue."
        primaryAction={{ label: 'Next: Add Recipients', onClick: primary, disabled: true }}
      >
        <p>body</p>
      </EsignWizardShell>,
    );

    expect(screen.getByText('Add at least one PDF to continue.')).toBeTruthy();
    const button = screen.getByRole('button', { name: /next: add recipients/i });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(primary).not.toHaveBeenCalled();
  });

  it('swaps a busy action for its busy label and blocks a second click', () => {
    const primary = vi.fn();

    render(
      <EsignWizardShell
        step="recipients"
        title="Add Recipients"
        primaryAction={{
          label: 'Next: Prepare Fields',
          onClick: primary,
          busy: true,
          busyLabel: 'Creating envelope…',
        }}
      >
        <p>body</p>
      </EsignWizardShell>,
    );

    const button = screen.getByRole('button', { name: /creating envelope/i });
    expect(button.hasAttribute('disabled')).toBe(true);
    fireEvent.click(button);
    expect(primary).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /next: prepare fields/i })).toBeNull();
  });

  it('shows the exit control and the context chip only when given', () => {
    const exit = vi.fn();
    const { rerender } = render(
      <EsignWizardShell
        step="upload"
        title="Add Documents"
        contextLabel="Retirement annuity"
        onExit={exit}
      >
        <p>body</p>
      </EsignWizardShell>,
    );

    expect(screen.getByText('Retirement annuity')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /exit/i }));
    expect(exit).toHaveBeenCalledTimes(1);

    rerender(
      <EsignWizardShell step="upload" title="Add Documents">
        <p>body</p>
      </EsignWizardShell>,
    );
    expect(screen.queryByRole('button', { name: /exit/i })).toBeNull();
    expect(screen.queryByText('Retirement annuity')).toBeNull();
  });

  it('drops the footer entirely when a step declares no actions', () => {
    const { container } = render(
      <EsignWizardShell step="prepare" title="Place fields">
        <p>body</p>
      </EsignWizardShell>,
    );

    expect(container.querySelector('footer')).toBeNull();
  });

  it('sticks its chrome to the edges in the inline layout used by the client drawer', () => {
    const { container, rerender } = render(
      <EsignWizardShell step="upload" title="Add Documents" layout="inline">
        <p>body</p>
      </EsignWizardShell>,
    );
    expect(container.querySelector('header')?.className).toContain('sticky');

    rerender(
      <EsignWizardShell step="upload" title="Add Documents">
        <p>body</p>
      </EsignWizardShell>,
    );
    expect(container.querySelector('header')?.className).not.toContain('sticky');
  });
});
