import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { act } from 'react';
import type { Personnel } from '../types';

const personnel = [
  {
    id: 'p-naledi',
    name: 'Naledi Khumalo',
    firstName: 'Naledi',
    lastName: 'Khumalo',
    email: 'naledi@example.com',
    role: 'adviser',
    phone: '',
    status: 'active',
  },
  {
    id: 'p-ruan',
    name: 'Ruan Steyn',
    firstName: 'Ruan',
    lastName: 'Steyn',
    email: 'ruan@example.com',
    role: 'paraplanner',
    phone: '',
    status: 'suspended',
  },
] as unknown as Personnel[];

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn(), info: vi.fn() },
}));

const clientsQuery = vi.hoisted(() =>
  vi.fn((_id: string, _enabled: boolean) => ({ data: [], isLoading: false })),
);
vi.mock('../hooks', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn() });
  return {
    usePersonnel: () => ({ data: personnel, isLoading: false }),
    useSuperAdmin: () => ({ data: null, isLoading: false }),
    usePersonnelClients: (id: string, enabled: boolean) => clientsQuery(id, enabled),
    useInvitePersonnel: mutation,
    useCreatePersonnelAccount: mutation,
    useUpdatePersonnel: mutation,
    useUpdateSuperAdmin: mutation,
  };
});
vi.mock('../hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true, isSuperAdmin: false }),
}));

const nav = vi.hoisted(() => ({
  pending: null as null | { type: 'personnel'; id: string },
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

vi.mock('../components/PersonnelTable', () => ({
  PersonnelTable: (props: { data: Personnel[]; onRowClick: (p: Personnel) => void }) => (
    <ul>
      {props.data.map((p) => (
        <li key={p.id}>
          <button onClick={() => props.onRowClick(p)}>
            {p.firstName} {p.lastName}
          </button>
        </li>
      ))}
    </ul>
  ),
}));
vi.mock('../components/InviteUserDialog', () => ({
  InviteUserDialog: (props: { open: boolean }) =>
    props.open ? <div role="dialog">invite dialog</div> : null,
}));
vi.mock('../components/SuperAdminProfileCard', () => ({ SuperAdminProfileCard: () => null }));
vi.mock('../components/drawer/TabProfile', () => ({
  TabProfile: (props: { selectedPersonnel: Personnel }) => (
    <div>profile of {props.selectedPersonnel.firstName}</div>
  ),
}));
vi.mock('../components/drawer/TabPermissions', () => ({ TabPermissions: () => null }));
vi.mock('../components/drawer/TabCompliance', () => ({ TabCompliance: () => null }));
vi.mock('../components/drawer/TabCommission', () => ({ TabCommission: () => null }));
vi.mock('../components/drawer/TabClientBook', () => ({
  TabClientBook: () => <div>client book</div>,
}));

import { PersonnelModule } from '../PersonnelModule';

afterEach(() => {
  cleanup();
  toastError.mockClear();
  clientsQuery.mockClear();
});

let goTo: (url: string) => void = () => undefined;
function Location() {
  const navigate = useNavigate();
  goTo = (url) => navigate(url);
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin?module=personnel') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <PersonnelModule />
      <Location />
    </MemoryRouter>,
  );
}

describe('Personnel page', () => {
  it('shows the header, figures and staff list', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Personnel' })).toBeDefined();
    expect(screen.getByText('Staff access, compliance and commission structures.')).toBeDefined();
    expect(screen.getByText('Total personnel')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Naledi Khumalo' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Invite user' }));
    expect(screen.getByRole('dialog').textContent).toBe('invite dialog');
  });

  it('opens a staff member as a page, not a side panel, and Back returns to the list', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Ruan Steyn' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Ruan Steyn' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Personnel' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Client book' })).toBeDefined();
    expect(screen.getByText('profile of Ruan')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel&person=p-ruan');

    fireEvent.click(screen.getByRole('button', { name: 'Back to personnel' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Personnel' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel');
  });

  it('loads the client book only when its tab is open', async () => {
    renderAt('/admin?module=personnel&person=p-naledi');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    expect(clientsQuery).not.toHaveBeenCalledWith('p-naledi', true);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Client book' }));
    await waitFor(() => screen.getByText('client book'));
    expect(clientsQuery).toHaveBeenLastCalledWith('p-naledi', true);
  });

  it('opens the staff member named in the address', async () => {
    renderAt('/admin?module=personnel&person=p-naledi');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    expect(screen.getByRole('button', { name: 'Back to personnel' })).toBeDefined();
  });

  it('says so when the staff member in the address is not in the list', async () => {
    renderAt('/admin?module=personnel&person=nobody');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Staff member not found'));
    expect(screen.getByRole('heading', { level: 1, name: 'Personnel' })).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel');
  });

  it('opens a staff member picked in global search while another is open', async () => {
    renderAt('/admin?module=personnel&person=p-naledi');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Client book' }));
    await waitFor(() => screen.getByText('client book'));
    // Global search sets the pending selection and switches module, which
    // clears ?person= in the same update.
    act(() => {
      nav.pending = { type: 'personnel', id: 'p-ruan' };
      goTo('/admin?module=personnel');
    });
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Ruan Steyn' }));
    // The new staff member opens on Profile.
    expect(screen.getByText('profile of Ruan')).toBeDefined();
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=personnel&person=p-ruan'),
    );
  });
});
