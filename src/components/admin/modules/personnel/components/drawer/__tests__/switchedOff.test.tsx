import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ClientSummary, Personnel } from '../../../types';
const perms = vi.hoisted(() => ({ isSuperAdmin: true }));
const reassign = vi.hoisted(() => vi.fn());
vi.mock('../../../hooks', () => ({
  usePersonnel: () => ({
    data: [
      { id: 'p-1', firstName: 'Ruan', lastName: 'Steyn', status: 'active', role: 'adviser' },
      { id: 'p-2', firstName: 'Priya', lastName: 'Naidoo', status: 'active', role: 'adviser' },
    ],
  }),
  useReassignPersonnelClients: () => ({ mutate: reassign, isPending: false }),
  useUploadPersonnelDocument: () => ({ mutate: upload, isPending: false }),
}));
vi.mock('../../../hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({ isSuperAdmin: perms.isSuperAdmin, canDo: () => true }),
}));
const upload = vi.hoisted(() => vi.fn());

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

describe('staff documents and client book actions', () => {
  it('uploads a compliance document from the Upload dialog', () => {
    render(<TabCompliance selectedPersonnel={staff} />);
    fireEvent.click(screen.getByRole('button', { name: /Upload/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Upload compliance document');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'RE5 certificate' } });
    const file = new File(['%PDF'], 're5.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [file] } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Upload' }).at(-1)!);
    expect(upload).toHaveBeenCalledWith(
      { personnelId: 'p-1', file, name: 'RE5 certificate', type: 'qualification' },
      expect.any(Object),
    );
  });

  it('lets the super admin open Bulk reassign; others do not see it', () => {
    render(<TabClientBook personnelId="p-1" clients={clients} loading={false} />);
    const button = screen.getByRole('button', { name: 'Bulk reassign' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(screen.getByRole('dialog').textContent).toContain('Bulk reassign clients');
    expect(screen.getByRole('button', { name: 'Reassign 2 clients' })).toBeDefined();
    cleanup();

    perms.isSuperAdmin = false;
    render(<TabClientBook personnelId="p-1" clients={clients} loading={false} />);
    expect(screen.queryByRole('button', { name: 'Bulk reassign' })).toBeNull();
    perms.isSuperAdmin = true;
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
