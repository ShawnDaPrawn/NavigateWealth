/**
 * LockedModule: the module header on every state (no access, gate, unlocked),
 * the Banking · Accounts · Trading tabs kept in the address, and an open
 * cluster taking over the page.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';

const perms = vi.hoisted(() => ({ isSuperAdmin: true, isLoading: false }));
vi.mock('../../personnel', () => ({ useCurrentUserPermissions: () => perms }));
vi.mock('../access', () => ({
  getLockoutRemaining: () => 0,
  verifyAccessCode: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../treasury/TreasuryManagerPanel', () => ({
  TreasuryManagerPanel: () => <p>treasury-panel</p>,
}));
vi.mock('../issuing/IssuingCardsPanel', () => ({
  IssuingCardsPanel: (props: { onNewCardholder: () => void }) => (
    <button onClick={props.onNewCardholder}>cards-panel new cardholder</button>
  ),
}));
const createCardholder = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
vi.mock('../issuing/hooks/useIssuing', () => ({ useCreateCardholder: () => createCardholder }));
vi.mock('../refund-clusters/AccountsPanel', () => ({
  AccountsPanel: () => <p>accounts-panel</p>,
}));

import { LockedModule } from '../LockedModule';
import { BreadcrumbContext } from '../../../layout/page/breadcrumbContext';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderModule(url = '/admin?module=locked') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <LockedModule />
      <Search />
    </MemoryRouter>,
  );
}

async function unlock() {
  fireEvent.change(screen.getByLabelText('Access code'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  await waitFor(() => expect(screen.getByText('treasury-panel')).toBeDefined());
}

beforeEach(() => {
  perms.isSuperAdmin = true;
  perms.isLoading = false;
});

describe('LockedModule', () => {
  it('shows the Locked heading and the access gate before unlocking', () => {
    renderModule();
    expect(screen.getByRole('heading', { level: 1, name: 'Locked' })).toBeDefined();
    expect(screen.getByText('Restricted area')).toBeDefined();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows the Locked heading and no access to anyone but a super admin', () => {
    perms.isSuperAdmin = false;
    renderModule();
    expect(screen.getByRole('heading', { level: 1, name: 'Locked' })).toBeDefined();
    expect(screen.getByText("You don't have access to Locked")).toBeDefined();
    expect(screen.queryByLabelText('Access code')).toBeNull();
  });

  it('once unlocked, keeps the tab in the address and leaves Trading off', async () => {
    renderModule();
    await unlock();
    expect(screen.getByRole('tab', { name: /Trading/ }).hasAttribute('disabled')).toBe(true);

    const accounts = screen.getByRole('tab', { name: 'Accounts' });
    fireEvent.mouseDown(accounts);
    fireEvent.click(accounts);
    expect(screen.getByText('accounts-panel')).toBeDefined();
    expect(screen.getByTestId('search').textContent).toContain('tab=accounts');
  });

  it('opens on the tab named in the address after unlocking', async () => {
    renderModule('/admin?module=locked&tab=accounts');
    fireEvent.change(screen.getByLabelText('Access code'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('accounts-panel')).toBeDefined());
  });

  it('steps the header and tabs aside while a cluster is open', async () => {
    renderModule('/admin?module=locked&tab=accounts&cluster=c1');
    fireEvent.change(screen.getByLabelText('Access code'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(screen.getByText('accounts-panel')).toBeDefined());
    expect(screen.queryByRole('heading', { level: 1, name: 'Locked' })).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('opens New cardholder as a page with its own address, and validates before creating', async () => {
    renderModule();
    await unlock();
    fireEvent.click(screen.getByRole('button', { name: 'cards-panel new cardholder' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New cardholder' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('search').textContent).toContain('cardholder=new');

    fireEvent.click(screen.getByRole('button', { name: 'Create cardholder' }));
    expect(screen.getByText('Fix 4 fields to create the cardholder.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Name'));
    expect(createCardholder.mutate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Karoo Ridge' } });
    fireEvent.change(screen.getByLabelText('Address line 1'), { target: { value: '1 Main' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Austin' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '78701' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create cardholder' }));
    expect(createCardholder.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Karoo Ridge', type: 'company' }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Back to banking' }));
    await waitFor(() => screen.getByText('treasury-panel'));
    expect(screen.getByTestId('search').textContent).not.toContain('cardholder');
  });

  it('sets the top-bar breadcrumb for the gate and the Banking tab', async () => {
    const setTrail = vi.fn();
    render(
      <BreadcrumbContext.Provider value={{ trail: [], setTrail }}>
        <MemoryRouter initialEntries={['/admin?module=locked']}>
          <LockedModule />
        </MemoryRouter>
      </BreadcrumbContext.Provider>,
    );
    expect(setTrail).toHaveBeenLastCalledWith([{ label: 'Restricted area' }]);
    await unlock();
    await waitFor(() => expect(setTrail).toHaveBeenLastCalledWith([{ label: 'Banking' }]));
  });
});
