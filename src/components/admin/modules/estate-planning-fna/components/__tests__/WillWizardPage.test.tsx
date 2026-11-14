/**
 * The last-will and living-will wizards are full pages, not pop-ups:
 * "‹ Will management", the will's title, Save & exit in the header.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WillWizardPage } from '../WillWizardPage';

describe('WillWizardPage', () => {
  it('renders as a page with a back link and header action', () => {
    const onClose = vi.fn();
    render(
      <WillWizardPage
        open
        title="Draft Last Will & Testament"
        description="Elsa van Wyk · draft"
        onClose={onClose}
        headerActions={<button>Save &amp; exit</button>}
      >
        <p>Personal details</p>
      </WillWizardPage>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Draft Last Will & Testament' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save & exit' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Will management/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <WillWizardPage open={false} title="x" onClose={vi.fn()}>
        <p>body</p>
      </WillWizardPage>,
    );
    expect(container.textContent).toBe('');
  });
});
