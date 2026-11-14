/**
 * Provider form — a centred dialog; an empty name is caught before saving with
 * the form-error banner and fix-it text; editing offers "Delete…".
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProviderFormDialog } from '../ProviderFormDialog';

describe('ProviderFormDialog', () => {
  it('blocks saving without a name and says how to fix it', () => {
    const onSave = vi.fn();
    render(<ProviderFormDialog isOpen onClose={vi.fn()} onSave={onSave} isSaving={false} />);

    expect(screen.getByRole('heading', { name: 'Add provider' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add provider' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Fix 1 field to add the provider.')).toBeTruthy();
    expect(screen.getByText('Enter the provider name')).toBeTruthy();
    const input = screen.getByLabelText('Provider name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
  });

  it('offers Delete… when editing', () => {
    const onDelete = vi.fn();
    render(
      <ProviderFormDialog
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        onDelete={onDelete}
        initialData={{ name: 'BrightRock', description: '', categoryIds: [], logo: '' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Edit provider' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete…' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
