import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { act } from 'react';
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
  {
    id: 'c-sipho',
    firstName: 'Sipho',
    lastName: 'Dlamini',
    email: 'sipho@example.com',
    createdAt: '2026-06-01T10:00:00Z',
    applicationStatus: 'approved',
    accountStatus: 'suspended',
    suspended: true,
  },
] as unknown as Client[];

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: vi.fn() } }));
const list = vi.hoisted(() => ({
  error: null as Error | null,
  retry: (() => undefined) as () => void,
}));
vi.mock('../hooks/useClientList', () => ({
  useClientList: () =>
    list.error
      ? { clients: [], loading: false, error: list.error, refetch: vi.fn(), retry: list.retry }
      : { clients, loading: false, error: null, refetch: vi.fn(), retry: vi.fn() },
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));
const nav = vi.hoisted(() => ({
  pending: null as null | { type: 'client'; id: string },
  clear: () => {
    nav.pending = null;
  },
}));
vi.mock('../../../layout/AdminNavigationContext', () => ({
  useAdminNavigation: () => ({
    pendingSelection: nav.pending,
    clearPendingSelection: () => nav.clear(),
  }),
}));
vi.mock('../../../../shared/unsaved-changes', () => ({
  useOptionalUnsavedChangesRegistry: () => null,
}));
vi.mock('@/shared/fna-intake/hooks/useFnaBatchStatus', () => ({
  useInvalidateFnaBatchStatus: () => vi.fn(),
}));
vi.mock('../components/groups/ClientGroupsTab', () => ({
  ClientGroupsTab: (props: { onOpenGroup: (id: string) => void }) => (
    <div>
      group list
      <button onClick={() => props.onOpenGroup('g-1')}>Edit group one</button>
    </div>
  ),
}));
vi.mock('../components/groups/GroupEditorRoute', () => ({
  GroupEditorRoute: (props: { groupId: string; onClose: () => void }) => (
    <div>
      <h1>Group {props.groupId}</h1>
      <button onClick={props.onClose}>Groups</button>
    </div>
  ),
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
vi.mock('../components/AddClientPage', () => ({
  AddClientPage: (props: {
    view: string;
    onViewChange: (v: string) => void;
    onClose: () => void;
  }) => (
    <div>
      <h1>Add client</h1>
      <output data-testid="add-view">{props.view}</output>
      <button onClick={() => props.onViewChange('bulk')}>Bulk import</button>
      <button onClick={props.onClose}>Personal clients</button>
    </div>
  ),
}));
vi.mock('../components/ClientFieldRepository', () => ({
  ClientFieldRepository: (props: { open: boolean }) =>
    props.open ? <div>field repository</div> : null,
}));
vi.mock('../components/IntakeWizardHandoff', () => ({ IntakeWizardHandoff: () => null }));

import { ClientManagementModule } from '../ClientManagementModule';
import { BreadcrumbContext, type Crumb } from '../../../layout/page';

afterEach(() => cleanup());

let goTo: (url: string) => void = () => undefined;
function Location() {
  const navigate = useNavigate();
  goTo = (url) => navigate(url);
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
    await waitFor(() => screen.getByText('group list'));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&tab=groups');
  });

  it('opens a group as a page with its own address, and returns to Groups', async () => {
    renderAt('/admin?module=clients&tab=groups');
    fireEvent.click(await screen.findByRole('button', { name: 'Edit group one' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Group g-1' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&tab=groups&group=g-1');
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }));
    await waitFor(() => screen.getByText('group list'));
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
    await screen.findByText('This client could not be opened');
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
    fireEvent.click(screen.getByRole('button', { name: 'Back to clients' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Client Management' })).toBeDefined();
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

  it('opens a client picked in global search while another client is open', async () => {
    renderAt('/admin?module=clients&client=c-elsa');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Elsa van Wyk' }));
    // Global search sets the pending selection and switches module, which
    // clears ?client= in the same update.
    act(() => {
      nav.pending = { type: 'client', id: 'c-faizel' };
      goTo('/admin?module=clients');
    });
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Faizel Khan' }));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=clients&client=c-faizel'),
    );
  });

  it('filters the table from a stat card, kept in the address and synced with the chip', async () => {
    renderAt();
    const suspendedCard = screen.getByRole('button', { name: /^Suspended/ });
    fireEvent.click(suspendedCard);
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=clients&account=suspended'),
    );
    expect(suspendedCard.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Sipho Dlamini')).toBeDefined();
    expect(screen.queryByText('Elsa van Wyk')).toBeNull();
    expect(screen.getByRole('button', { name: 'Account: Suspended' })).toBeDefined();

    // Clicking the active card again clears the filter.
    fireEvent.click(suspendedCard);
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?module=clients'));
    expect(screen.getByText('Elsa van Wyk')).toBeDefined();
  });

  it('restores filters and search from the address', () => {
    renderAt('/admin?module=clients&account=active&q=faiz');
    expect(screen.getByText('Faizel Khan')).toBeDefined();
    expect(screen.queryByText('Elsa van Wyk')).toBeNull();
    expect(screen.queryByText('Sipho Dlamini')).toBeNull();
    expect(screen.getByRole('button', { name: /^Active/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(screen.getByText('Elsa van Wyk')).toBeDefined();
  });

  it('opens Add client as a page with its view in the address; Back returns to the list', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add client' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Add client' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients&add=single');
    fireEvent.click(screen.getByRole('button', { name: 'Bulk import' }));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=clients&add=bulk'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Personal clients' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Client Management' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=clients');
  });

  it('opens bulk import from the more menu', async () => {
    renderAt();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Bulk import clients' }));
    await waitFor(() => expect(screen.getByTestId('add-view').textContent).toBe('bulk'));
  });

  it('sets the top-bar breadcrumb for the tab, Add client and a group', async () => {
    let trail: Crumb[] = [];
    const setTrail = (t: Crumb[]) => {
      trail = t;
    };
    render(
      <BreadcrumbContext.Provider value={{ trail, setTrail }}>
        <MemoryRouter initialEntries={['/admin?module=clients']}>
          <ClientManagementModule />
          <Location />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    await waitFor(() => expect(trail.map((c) => c.label)).toEqual(['Personal clients']));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Groups' }));
    await waitFor(() => expect(trail.map((c) => c.label)).toEqual(['Groups']));
    act(() => goTo('/admin?module=clients&add=single'));
    await waitFor(() =>
      expect(trail.map((c) => c.label)).toEqual(['Personal clients', 'Add client']),
    );
  });

  it('shows an error, not an empty book, when the client list fails to load', () => {
    const retry = vi.fn();
    list.error = new Error('400 Bad Request');
    list.retry = retry;
    try {
      renderAt();
      expect(screen.getByText("Couldn't load clients")).toBeDefined();
      expect(screen.queryByText(/No clients/)).toBeNull();
      expect(screen.queryByText('All clients')).toBeNull();
      // Header and tabs stay.
      expect(screen.getByRole('heading', { level: 1, name: 'Client Management' })).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Groups' })).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(retry).toHaveBeenCalled();
    } finally {
      list.error = null;
    }
  });

  it('says no clients match the filters, with Clear filters', () => {
    renderAt('/admin?module=clients&q=zzzz');
    expect(screen.getByText('No clients match your filters')).toBeDefined();
  });
});
