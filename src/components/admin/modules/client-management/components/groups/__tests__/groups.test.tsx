import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ClientGroup } from '../../../../communication/types';

const api = vi.hoisted(() => ({
  getGroups: vi.fn(),
  getClients: vi.fn(),
  getProviders: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
  recalculateGroupMemberships: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('../../../../communication', () => ({ communicationApi: api }));
vi.mock('../../../../communication/components/groups/FilterBuilder', () => ({
  FilterBuilder: () => <div>filter rules</div>,
}));
vi.mock('../../../../communication/components/groups/ManualSelection', () => ({
  ManualSelection: (props: { selectedIds: string[] }) => (
    <div>manual selection: {props.selectedIds.length}</div>
  ),
}));

import { ClientGroupsTab } from '../ClientGroupsTab';
import { GroupEditorRoute } from '../GroupEditorRoute';

const groups: ClientGroup[] = [
  {
    id: 'g-hnw',
    name: 'High net worth individuals',
    description: 'Investment value above R10m',
    type: 'custom',
    clientIds: [],
    filterConfig: { netWorthFilters: [{ min: 10_000_000 }] },
    clientCount: 14,
    updatedAt: '2026-11-02T10:00:00Z',
  },
  {
    id: 'g-vip',
    name: 'Newsletter VIP list',
    type: 'custom',
    clientIds: ['c1', 'c2'],
    externalContacts: [{ email: 'a@example.com', name: 'A' }],
    clientCount: 22,
    updatedAt: '2026-10-15T10:00:00Z',
  },
] as unknown as ClientGroup[];

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function wrap(ui: ReactNode, url = '/admin?module=clients&tab=groups') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        {ui}
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getGroups.mockResolvedValue(groups);
  api.getClients.mockResolvedValue([]);
  api.getProviders.mockResolvedValue([]);
});
afterEach(() => cleanup());

describe('Groups tab', () => {
  it('lists groups with type and members; Edit opens the editor', async () => {
    const onOpenGroup = vi.fn();
    wrap(<ClientGroupsTab onOpenGroup={onOpenGroup} />);
    await screen.findByText('High net worth individuals');
    expect(screen.getAllByText('Dynamic filters').length).toBeGreaterThan(0);
    expect(screen.getByText('Hand-picked, plus 1 external contacts')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Newsletter VIP list' }));
    expect(onOpenGroup).toHaveBeenCalledWith('g-vip');
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(onOpenGroup).toHaveBeenCalledWith('new');
  });

  it('keeps the search in the address and says when nothing matches', async () => {
    wrap(<ClientGroupsTab onOpenGroup={vi.fn()} />);
    await screen.findByText('High net worth individuals');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search groups' }), {
      target: { value: 'zzz' },
    });
    await screen.findByText('No groups match');
    expect(screen.getByTestId('search').textContent).toContain('gq=zzz');
  });

  it('shows the empty state with Create group when there are no groups', async () => {
    api.getGroups.mockResolvedValue([]);
    const onOpenGroup = vi.fn();
    wrap(<ClientGroupsTab onOpenGroup={onOpenGroup} />);
    await screen.findByText('No groups yet');
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(onOpenGroup).toHaveBeenCalledWith('new');
  });

  it('recalculates members with a toast', async () => {
    api.recalculateGroupMemberships.mockResolvedValue({ success: true, message: '' });
    wrap(<ClientGroupsTab onOpenGroup={vi.fn()} />);
    await screen.findByText('High net worth individuals');
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate members' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Group memberships updated'));
  });
});

describe('Group editor page', () => {
  it('requires a name before saving a new group', async () => {
    const onClose = vi.fn();
    wrap(<GroupEditorRoute groupId="new" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    expect(await screen.findByText('Fix 1 field to save the group')).toBeDefined();
    expect(screen.getByText('Give the group a name')).toBeDefined();
    expect(api.createGroup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Gold tier' } });
    api.createGroup.mockResolvedValue({});
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    await waitFor(() => expect(api.createGroup).toHaveBeenCalled());
    expect(api.createGroup.mock.calls[0][0]).toMatchObject({ name: 'Gold tier', type: 'custom' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Group created'));
    expect(onClose).toHaveBeenCalled();
  });

  it('edits an existing group, with the member view in the address', async () => {
    api.updateGroup.mockResolvedValue({});
    const onClose = vi.fn();
    wrap(<GroupEditorRoute groupId="g-vip" onClose={onClose} />);
    await screen.findByRole('heading', { level: 1, name: 'Newsletter VIP list' });
    expect(screen.getByText(/Manual group · 22 members/)).toBeDefined();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Manual selection · 2' }));
    await screen.findByText('manual selection: 2');
    expect(screen.getByTestId('search').textContent).toContain('gview=manual');

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'External contacts · 1' }));
    fireEvent.change(await screen.findByLabelText('Contact 1 email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    expect(await screen.findByText('Enter a valid email address')).toBeDefined();
    expect(api.updateGroup).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Contact 1 email'), {
      target: { value: 'b@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save group' }));
    await waitFor(() => expect(api.updateGroup).toHaveBeenCalled());
    expect(api.updateGroup.mock.calls[0][0]).toBe('g-vip');
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Group updated'));
  });

  it('deletes from the ⋯ menu after a confirmation', async () => {
    api.deleteGroup.mockResolvedValue(undefined);
    const onClose = vi.fn();
    wrap(<GroupEditorRoute groupId="g-hnw" onClose={onClose} />);
    await screen.findByRole('heading', { level: 1, name: 'High net worth individuals' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete group/ }));
    expect(await screen.findByText('Delete group?')).toBeDefined();
    expect(api.deleteGroup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(api.deleteGroup).toHaveBeenCalledWith('g-hnw'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Group deleted'));
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when the group in the address does not exist', async () => {
    wrap(<GroupEditorRoute groupId="missing" onClose={vi.fn()} />);
    expect(await screen.findByText('This group could not be opened')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to groups' })).toBeDefined();
  });
});
