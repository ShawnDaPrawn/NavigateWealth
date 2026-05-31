/**
 * RoAModuleContractManager — Render / Characterization Test (Phase 4)
 * ==================================================================
 *
 * Locks the baseline render contract of RoAModuleContractManager (1,382 lines —
 * a Phase 6 decomposition target) so a regression during the eventual
 * extraction fails CI.
 *
 * Contract pinned here (the three top-level render branches):
 *   • non-super-admin users get the "Super admin access required" guard
 *     (RoA module contracts are system-level configuration);
 *   • while the contracts hook is loading, the skeleton renders (no header);
 *   • once loaded, the "RoA Module Contracts" workspace renders with its
 *     primary actions, and the data hook is queried with { includeArchived }.
 *
 * useRoAModuleContracts is fully mocked, so the component needs no
 * QueryClientProvider; useAuth and sonner are stubbed. With an empty contracts
 * array the component falls back to FALLBACK_ROA_MODULE_CONTRACTS (real data),
 * so the loaded branch renders without a hand-built fixture.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  it('shows the super-admin access guard for non-super-admin users', () => {
    setAuthRole('admin');
    render(<RoAModuleContractManager />);
    expect(screen.getByText('Super admin access required')).toBeTruthy();
    expect(screen.queryByText('RoA Module Contracts')).toBeNull();
  });

  it('renders the loading skeleton while contracts are loading', () => {
    mockedUseContracts.mockReturnValue(hookValue({ isLoading: true }));
    const { container } = render(<RoAModuleContractManager />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(screen.queryByText('RoA Module Contracts')).toBeNull();
  });

  it('renders the contracts workspace and queries the hook with includeArchived', () => {
    render(<RoAModuleContractManager />);

    expect(screen.getByText('RoA Module Contracts')).toBeTruthy();
    expect(
      screen.getByText(
        'Configure the module schemas advisers use when drafting Records of Advice.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('New Contract')).toBeTruthy();

    expect(mockedUseContracts).toHaveBeenCalledWith({ includeArchived: true });
  });
});
