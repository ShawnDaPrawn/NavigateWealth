/**
 * RoAModuleContractManager — Render / Characterization Test (Phase 4)
 * ==================================================================
 *
 * Locks the baseline render contract of RoAModuleContractManager (1,382 lines —
 * a Phase 6 decomposition target) so a regression during the eventual
 * extraction fails CI.
 *
 * Contract pinned here (the three top-level render branches):
 *   • non-super-admin users get the shared no-access state
 *     (RoA module contracts are system-level configuration);
 *   • while the contracts hook is loading, the skeleton renders;
 *   • once loaded, the contracts list (with New) and the editor (Save draft,
 *     Publish, Archive, segmented sections in the address) render, and the
 *     data hook is queried with { includeArchived }.
 *
 * useRoAModuleContracts is fully mocked, so the component needs no
 * QueryClientProvider; useAuth and sonner are stubbed. With an empty contracts
 * array the component falls back to FALLBACK_ROA_MODULE_CONTRACTS (real data),
 * so the loaded branch renders without a hand-built fixture.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { ReactElement } from 'react';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

const render = (ui: ReactElement, initial = '/') =>
  rtlRender(
    <MemoryRouter initialEntries={[initial]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>,
  );

vi.mock('@/components/admin/modules/advice-engine/hooks', () => ({
  useRoAModuleContracts: vi.fn(),
}));

vi.mock('@/components/auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { RoAModuleContractManager } from '../RoAModuleContractManager';
import { useRoAModuleContracts } from '@/components/admin/modules/advice-engine/hooks';
import { useAuth } from '@/components/auth/AuthContext';

const mockedUseContracts = vi.mocked(useRoAModuleContracts);
const mockedUseAuth = vi.mocked(useAuth);

type HookReturn = ReturnType<typeof useRoAModuleContracts>;

function hookValue(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    contracts: [],
    schemaFormat: undefined,
    isLoading: false,
    error: null,
    saveContract: vi.fn(),
    publishContract: vi.fn(),
    archiveContract: vi.fn(),
    isSaving: false,
    ...overrides,
  } as unknown as HookReturn;
}

function setAuthRole(role: string) {
  mockedUseAuth.mockReturnValue({ user: { role } } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuthRole('super_admin');
  mockedUseContracts.mockReturnValue(hookValue());
});

describe('RoAModuleContractManager', () => {
  it('shows the no-access state for non-super-admin users', () => {
    setAuthRole('admin');
    render(<RoAModuleContractManager />);
    expect(screen.getByText(/You don.t have access to RoA contracts/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('renders the loading skeleton while contracts are loading', () => {
    mockedUseContracts.mockReturnValue(hookValue({ isLoading: true }));
    const { container } = render(<RoAModuleContractManager />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('renders the contracts list and editor, and queries the hook with includeArchived', async () => {
    render(<RoAModuleContractManager />);

    expect(screen.getByRole('button', { name: /^New$/ })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Save draft/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'Contract editor' })).toBeTruthy();
    // The open contract is kept in the address.
    expect(screen.getByTestId('location').textContent).toContain('contract=');

    expect(mockedUseContracts).toHaveBeenCalledWith({ includeArchived: true });
  });

  it('keeps the editor section in the address', async () => {
    render(<RoAModuleContractManager />);
    const trigger = await screen.findByRole('tab', { name: 'JSON' });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toContain('contractTab=json'),
    );
  });

  it('asks before archiving a contract', async () => {
    const archiveContract = vi.fn().mockResolvedValue({ id: 'x' });
    mockedUseContracts.mockReturnValue(hookValue({ archiveContract }));
    render(<RoAModuleContractManager />);
    fireEvent.click(await screen.findByRole('button', { name: /^Archive$/ }));
    expect(await screen.findByText('Archive contract?')).toBeTruthy();
    expect(archiveContract).not.toHaveBeenCalled();
  });

  it('shows "Unable to load RoA contracts" on a failed load, not the fallback contracts', () => {
    const refetch = vi.fn();
    mockedUseContracts.mockReturnValue(
      hookValue({ error: new Error('Request failed (400)'), refetch } as never),
    );
    render(<RoAModuleContractManager />);
    expect(screen.getByText('Unable to load RoA contracts')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save draft/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(refetch).toHaveBeenCalled();
  });
});
