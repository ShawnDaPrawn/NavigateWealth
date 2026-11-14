import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SignerFormData } from '../../../types';

vi.mock('../../RecipientsManager', () => ({
  RecipientsManager: ({
    signers,
    onChange,
  }: {
    signers: SignerFormData[];
    onChange: (next: SignerFormData[]) => void;
  }) => (
    <div>
      <p>{signers.length} recipients</p>
      <button onClick={() => onChange([...signers, { name: 'Grace Louw' } as SignerFormData])}>
        add one
      </button>
    </div>
  ),
}));

import { RecipientsPage } from '../RecipientsPage';

const signers = [{ name: 'Elsa van Wyk' } as SignerFormData];

describe('RecipientsPage', () => {
  it('is a page with its own heading and a way back to the fields', () => {
    render(<RecipientsPage signers={signers} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Recipients' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to fields' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('goes straight back when nothing changed', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<RecipientsPage signers={signers} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves the changes once on the way back', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<RecipientsPage signers={signers} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText('add one'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to fields' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toHaveLength(2);
  });

  it('stays open with the changes when the save fails', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<RecipientsPage signers={signers} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText('add one'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('2 recipients')).toBeTruthy();
  });
});
