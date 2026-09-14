/**
 * The gate between "I clicked Exit" and losing an upload. Its three ways out
 * have to stay distinct: saving must not discard, discarding must not save,
 * and neither must fire twice while a save is in flight.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

import { ExitWizardDialog } from '../ExitWizardDialog';

function setup(over: Partial<React.ComponentProps<typeof ExitWizardDialog>> = {}) {
  const onSaveDraft = vi.fn();
  const onDiscard = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ExitWizardDialog
      open
      onOpenChange={onOpenChange}
      onSaveDraft={onSaveDraft}
      onDiscard={onDiscard}
      canSaveDraft
      {...over}
    />,
  );
  return { onSaveDraft, onDiscard, onOpenChange };
}

describe('ExitWizardDialog', () => {
  it('offers keep editing, discard and save as draft', () => {
    setup();
    expect(screen.getByRole('button', { name: /keep editing/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save as draft/i })).toBeTruthy();
  });

  it('saves the draft without discarding it', () => {
    const { onSaveDraft, onDiscard } = setup();
    fireEvent.click(screen.getByRole('button', { name: /save as draft/i }));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('discards without saving', () => {
    const { onSaveDraft, onDiscard } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onSaveDraft).not.toHaveBeenCalled();
  });

  it('hides save as draft, and says why, when there is no document to save', () => {
    setup({ canSaveDraft: false });
    expect(screen.queryByRole('button', { name: /save as draft/i })).toBeNull();
    expect(screen.getByText(/nothing has been uploaded yet/i)).toBeTruthy();
  });

  it('locks every action while the save is in flight', () => {
    const { onSaveDraft, onDiscard } = setup({ saving: true });
    const save = screen.getByRole('button', { name: /saving draft/i });
    const discard = screen.getByRole('button', { name: /^discard$/i });

    expect(save.hasAttribute('disabled')).toBe(true);
    expect(discard.hasAttribute('disabled')).toBe(true);
    fireEvent.click(save);
    fireEvent.click(discard);
    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('tells the template builder it is saving a template draft', () => {
    setup({ isTemplateBuilder: true });
    expect(screen.getByText(/this template is not saved yet/i)).toBeTruthy();
  });
});
