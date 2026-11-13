import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClientSummary, Personnel } from '../../../types';
import { TabCompliance, UploadComplianceDocumentDialog } from '../TabCompliance';
import { ReassignClientsDialog, TabClientBook } from '../TabClientBook';

afterEach(cleanup);

const staff = {
  id: 'p-1',
  firstName: 'Ruan',
  lastName: 'Steyn',
  email: 'ruan@example.com',
  role: 'adviser',
  status: 'active',
} as Personnel;

const clients: ClientSummary[] = [
  { id: 'c-1', name: 'Thabo Mahlangu', email: 't@example.com', status: 'approved' },
  { id: 'c-2', name: 'Annelie de Villiers', email: 'a@example.com', status: 'pending' },
] as ClientSummary[];

describe('switched-off staff actions (no endpoint yet)', () => {
  it('shows Upload and Bulk reassign disabled with a Soon tag', () => {
    render(<TabCompliance selectedPersonnel={staff} />);
    const upload = screen.getByRole('button', { name: /Upload/ }) as HTMLButtonElement;
    expect(upload.disabled).toBe(true);
    expect(upload.textContent).toContain('Soon');
    cleanup();

    render(<TabClientBook clients={clients} loading={false} />);
    const reassign = screen.getByRole('button', { name: /Bulk reassign/ }) as HTMLButtonElement;
    expect(reassign.disabled).toBe(true);
    expect(reassign.textContent).toContain('Soon');
  });

  it('upload dialog checks the name and file before uploading', () => {
    const onUpload = vi.fn();
    render(<UploadComplianceDocumentDialog open onOpenChange={vi.fn()} onUpload={onUpload} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.getByText('Enter a name for the document')).toBeDefined();
    expect(screen.getByText('Choose a file')).toBeDefined();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('reassign dialog needs a target and counts the selected clients', () => {
    const onReassign = vi.fn();
    render(
      <ReassignClientsDialog
        open
        onOpenChange={vi.fn()}
        clients={clients}
        candidates={[staff]}
        onReassign={onReassign}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reassign 2 clients' }));
    expect(screen.getByRole('alert').textContent).toBe('Choose who the clients move to');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Thabo Mahlangu' }));
    expect(screen.getByRole('button', { name: 'Reassign 1 client' })).toBeDefined();
    expect(onReassign).not.toHaveBeenCalled();
  });
});
