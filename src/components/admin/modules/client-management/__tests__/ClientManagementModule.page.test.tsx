import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { Client } from '../types';

const clients = [
  {
    id: 'c-elsa',
    firstName: 'Elsa',
    lastName: 'van Wyk',
    email: 'elsa@example.com',
    createdAt: '2026-04-14T10:00:00Z',
    applicationStatus: 'approved',
    accountStatus: 'active',
  },
  {
    id: 'c-faizel',
    firstName: 'Faizel',
    lastName: 'Khan',
    email: 'faizel@example.com',
    createdAt: '2026-05-01T10:00:00Z',
    applicationStatus: 'approved',
    accountStatus: 'active',
  },
] as unknown as Client[];

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));
vi.mock('../hooks/useClientList', () => ({
  useClientList: () => ({ clients, loading: false, refetch: vi.fn() }),
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));
vi.mock('../../../layout/AdminNavigationContext', () => ({
  useAdminNavigation: () => ({ pendingSelection: null, clearPendingSelection: vi.fn() }),
}));
vi.mock('../../../../shared/unsaved-changes', () => ({
  useOptionalUnsavedChangesRegistry: () => null,
}));
vi.mock('@/shared/fna-intake/hooks/useFnaBatchStatus', () => ({
  useInvalidateFnaBatchStatus: () => vi.fn(),
}));
vi.mock('../../communication', () => ({
  CustomGroupManager: () => <div>group manager</div>,
}));
vi.mock('../components/ClientDrawer', () => ({
  ClientDrawer: (props: { client: Client; onOpenChange: (open: boolean) => void }) => (
    <div>
      <h1>
        {props.client.firstName} {props.client.lastName}
      </h1>
      <button onClick={() => props.onOpenChange(false)}>Personal clients</button>
    </div>
  ),
}));
vi.mock('../components/FNAIntakeQueue', () => ({ FNAIntakeQueue: () => null }));
vi.mock('../components/AddClientDialog', () => ({ AddClientDialog: () => null }));
vi.mock('../components/ClientFieldRepository', () => ({
  ClientFieldRepository: (props: { open: boolean }) =>
    props.open ? <div>field repository</div> : null,
}));
vi.mock('../components/IntakeWizardHandoff', () => ({ IntakeWizardHandoff: () => null }));

import { ClientManagementModule } from '../ClientManagementModule';

afterEach(() => cleanup());

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin?module=clients') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ClientManagementModule />
      <Location />
    </MemoryRouter>,
  );
}

describe('Client Management page', () => {
  it('shows the header, figures and personal clients', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Client Management' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add client' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDefined();
    expect(screen.getByText('All clients')).toBeDefined();
    expect(screen.getByText('Elsa van Wyk')).toBeDefined();
  });

  it('shows Groups as a tab kept in the address', async () => {
    renderAt();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Groups' }));
    await waitFor(() => screen.getByText('group manager'));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&tab=groups');
  });

  it('opens a client as a page with its own address, and returns to the list', async () => {
    renderAt();
    fireEvent.click(screen.getByText('Faizel Khan'));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Faizel Khan' }));
    expect(screen.queryByRole('heading', { name: 'Client Management' })).toBeNull();
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&client=c-faizel');

    fireEvent.click(screen.getByRole('button', { name: 'Personal clients' }));
    await waitFor(() => screen.getByRole('heading', { name: 'Client Management' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('opens the client named in the address', async () => {
    renderAt('/admin?module=clients&client=c-elsa');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Elsa van Wyk' }));
  });

  it('says so when the client in the address is not in the list', async () => {
    renderAt('/admin?module=clients&client=nobody');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Client not found'));
    expect(screen.getByRole('heading', { level: 1, name: 'Client Management' })).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('keeps the field repository under the more menu', async () => {
    renderAt();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Field repository' }));
    await waitFor(() => screen.getByText('field repository'));
  });
});
