import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import type { AdminModule, PendingCounts } from '../types';

const navigate = vi.fn();
const logout = vi.fn();

vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Erica', role: 'super_admin' }, logout }),
}));
vi.mock('../../modules/personnel/shell', () => ({
  useCurrentUserPermissions: () => ({ can: () => true }),
}));
vi.mock('../../moduleLoaders', () => ({ preloadAdminModule: vi.fn() }));
vi.mock('../../../../hooks/usePWAInstall', () => ({
  usePWAInstall: () => ({ installApp: vi.fn(), isInstalling: false, showInstallOption: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../layout/Logo', () => ({ Logo: () => <img alt="Navigate Wealth" /> }));

import { Sidebar } from '../Sidebar';
import { formatRole } from '../config';

function renderSidebar(
  props: Partial<{
    activeModule: AdminModule;
    pendingCounts: PendingCounts;
    collapsed: boolean;
    mobileOpen: boolean;
  }> = {},
) {
  const onModuleChange = vi.fn();
  const setCollapsed = vi.fn();
  const setMobileOpen = vi.fn();
  const utils = render(
    <Sidebar
      activeModule={props.activeModule ?? 'dashboard'}
      onModuleChange={onModuleChange}
      pendingCounts={props.pendingCounts ?? {}}
      collapsed={props.collapsed ?? false}
      setCollapsed={setCollapsed}
      mobileOpen={props.mobileOpen ?? false}
      setMobileOpen={setMobileOpen}
    />,
  );
  return { ...utils, onModuleChange, setCollapsed, setMobileOpen };
}

const desktopNav = () => screen.getByRole('complementary', { name: 'Admin navigation' });

describe('admin Sidebar', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it('shows Dashboard, the five groups and Locked in the footer', () => {
    renderSidebar();
    const nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'Dashboard' })).toBeDefined();
    for (const group of ['Work', 'Clients', 'Advice', 'Marketing', 'Practice']) {
      expect(nav.getByRole('button', { name: group })).toBeDefined();
    }
    expect(nav.getByRole('button', { name: 'Locked' })).toBeDefined();
  });

  it('marks the open module and switches module on click', () => {
    const { onModuleChange } = renderSidebar({ activeModule: 'esign' });
    const nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'E-Signature' }).getAttribute('aria-current')).toBe(
      'page',
    );
    fireEvent.click(nav.getByRole('button', { name: 'To-Do' }));
    expect(onModuleChange).toHaveBeenCalledWith('tasks');
  });

  it('shows waiting counts, and an amber dot when their group is closed', () => {
    renderSidebar({ pendingCounts: { submissions: { count: 4 } } });
    const nav = within(desktopNav());
    expect(nav.getByText('4')).toBeDefined();

    const work = nav.getByRole('button', { name: 'Work' });
    expect(work.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(work);
    expect(work.getAttribute('aria-expanded')).toBe('false');
    expect(nav.queryByRole('button', { name: 'To-Do' })).toBeNull();
    expect(nav.getByRole('img', { name: 'Items waiting' })).toBeDefined();
  });

  it('shows the To-Do count grey: it is a backlog, not a new arrival', () => {
    renderSidebar({ pendingCounts: { tasks: { count: 4 } } });
    const nav = within(desktopNav());
    const badge = nav.getByText('4');
    expect(badge.className).not.toContain('amber');
    fireEvent.click(nav.getByRole('button', { name: 'Work' }));
    expect(nav.queryByRole('img', { name: 'Items waiting' })).toBeNull();
  });

  it('remembers closed groups across renders', () => {
    renderSidebar();
    fireEvent.click(within(desktopNav()).getByRole('button', { name: 'Marketing' }));
    cleanup();
    renderSidebar();
    expect(
      within(desktopNav()).getByRole('button', { name: 'Marketing' }).getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('collapses to a rail with labelled icons', () => {
    const { setCollapsed } = renderSidebar({
      collapsed: true,
      pendingCounts: { tasks: { count: 120 } },
    });
    const nav = within(desktopNav());
    expect(nav.getByRole('button', { name: 'To-Do, 120 pending' })).toBeDefined();
    expect(nav.getByText('99+')).toBeDefined();
    fireEvent.click(nav.getByRole('button', { name: 'Expand sidebar' }));
    expect(setCollapsed).toHaveBeenCalledWith(false);
  });

  it('opens as a drawer on small screens and closes after choosing a module', () => {
    const { setMobileOpen, onModuleChange } = renderSidebar({ mobileOpen: true });
    const drawer = within(screen.getByRole('dialog', { name: 'Navigation menu' }));
    fireEvent.click(drawer.getByRole('button', { name: 'Notes' }));
    expect(onModuleChange).toHaveBeenCalledWith('notes');
    expect(setMobileOpen).toHaveBeenCalledWith(false);
    fireEvent.click(drawer.getByRole('button', { name: 'Close navigation menu' }));
    expect(setMobileOpen).toHaveBeenCalledTimes(2);
  });

  it('shows the role in words', () => {
    expect(formatRole('super_admin')).toBe('Super admin');
    expect(formatRole('compliance-officer')).toBe('Compliance officer');
    expect(formatRole(undefined)).toBe('Administrator');
    renderSidebar();
    expect(within(desktopNav()).getByText('Super admin')).toBeDefined();
  });
});
