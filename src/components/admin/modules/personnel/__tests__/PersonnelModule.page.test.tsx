import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { act } from 'react';
import type { Personnel } from '../types';
import { BreadcrumbContext } from '../../../layout/page/breadcrumbContext';

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
const me = vi.hoisted(() => ({
  isSuperAdmin: false,
  permissions: undefined as undefined | { personnelId: string },
}));
vi.mock('../hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({
    canDo: () => true,
    isSuperAdmin: me.isSuperAdmin,
    permissions: me.permissions,
    isLoading: false,
  }),
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
vi.mock('../components/SuperAdminProfileCard', () => ({
  SuperAdminProfileCard: () => <section>admin profile card</section>,
}));
vi.mock('../components/drawer/TabProfile', () => ({
  PROFILE_FORM_ID: 'personnel-profile-form',
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
  me.isSuperAdmin = false;
  me.permissions = undefined;
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
    expect(
      screen.getByText('Manage staff access, compliance and commission structures.'),
    ).toBeDefined();
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

  it('keeps the open tab in the address and opens a pasted link on that tab', async () => {
    renderAt('/admin?module=personnel&person=p-naledi');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Client book' }));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe(
        '?module=personnel&person=p-naledi&personTab=clients',
      ),
    );
    cleanup();

    renderAt('/admin?module=personnel&person=p-naledi&personTab=clients');
    await waitFor(() => screen.getByText('client book'));
    // Back to the list drops the tab with the staff member.
    fireEvent.click(screen.getByRole('button', { name: 'Back to personnel' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?module=personnel'));
  });

  it('shows Save in the page header on the Profile tab', async () => {
    renderAt('/admin?module=personnel&person=p-naledi');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.getAttribute('form')).toBe('personnel-profile-form');
    // Nothing changed yet.
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('filters the list from the stat tiles, and the active tile clears it again', async () => {
    renderAt();
    const tile = screen.getByText('Suspended', { selector: 'p' }).closest('button')!;
    fireEvent.click(tile);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Naledi Khumalo' })).toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Ruan Steyn' })).toBeDefined();
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel&status=suspended');
    expect(tile.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(tile);
    await waitFor(() => screen.getByRole('button', { name: 'Naledi Khumalo' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel');
  });

  it('filters by status with the segmented control and reads it from the address', async () => {
    renderAt('/admin?module=personnel&status=active');
    expect(screen.getByRole('button', { name: 'Naledi Khumalo' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ruan Steyn' })).toBeNull();
    const status = screen.getByRole('tablist', { name: 'Status' });
    expect(status).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'All' }));
    await waitFor(() => screen.getByRole('button', { name: 'Ruan Steyn' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel');
  });

  it('shows the admin profile for ?profile=me and keeps the header toggle in the address', async () => {
    me.isSuperAdmin = true;
    me.permissions = { personnelId: 'p-owner' };
    renderAt('/admin?module=personnel&profile=me');
    expect(screen.getByText('admin profile card')).toBeDefined();
    const toggle = screen.getByRole('button', { name: /Admin profile/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle);
    await waitFor(() => expect(screen.queryByText('admin profile card')).toBeNull());
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel');

    fireEvent.click(screen.getByRole('button', { name: /Admin profile/ }));
    await waitFor(() => screen.getByText('admin profile card'));
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel&profile=me');
  });

  it('opens your own staff page for ?profile=me when you are not the super admin', async () => {
    me.permissions = { personnelId: 'p-naledi' };
    renderAt('/admin?module=personnel&profile=me');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Naledi Khumalo' }));
    expect(screen.queryByText('admin profile card')).toBeNull();
    expect(screen.getByTestId('search').textContent).toBe('?module=personnel&person=p-naledi');
  });

  it('sets the top-bar breadcrumb to the staff member and tab', async () => {
    const setTrail = vi.fn();
    render(
      <BreadcrumbContext.Provider value={{ trail: [], setTrail }}>
        <MemoryRouter
          initialEntries={['/admin?module=personnel&person=p-naledi&personTab=clients']}
        >
          <PersonnelModule />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    await waitFor(() =>
      expect(setTrail).toHaveBeenLastCalledWith([
        expect.objectContaining({ label: 'Naledi Khumalo' }),
        { label: 'Client book' },
      ]),
    );
  });
});
