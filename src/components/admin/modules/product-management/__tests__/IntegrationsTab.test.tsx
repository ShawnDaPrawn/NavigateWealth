/**
 * IntegrationsTab — Render / Characterization Test (Phase 4)
 * ===========================================================
 *
 * Locks the mount contract and the "No Providers Configured" empty state
 * (visible when providers=[] and not loading) for this 991-line Phase 6 target.
 *
 * All sub-tabs, product-management API, and heavy integrations sub-components
 * are mocked to avoid React Query context issues and complex render trees.
 * renderWithQueryClient is required (direct useQueryClient/useQuery usage).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithQueryClient } from '@/test/utils';

const mutStub = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
});

vi.mock('@/components/admin/modules/product-management/api', () => ({
  productManagementApi: {
    fetchProviders: vi.fn().mockResolvedValue([]),
    getIntegrationStats: vi.fn().mockResolvedValue({}),
    getServerConfig: vi.fn().mockResolvedValue({}),
    processFile: vi.fn(),
    publishRun: vi.fn(),
    downloadTemplate: vi.fn(),
    createPortalJob: vi.fn(),
    refreshPortalJob: vi.fn(),
    submitPortalOtp: vi.fn(),
    retryPortalJobItem: vi.fn(),
    applyPortalFlow: vi.fn(),
    savePortalFlow: vi.fn(),
    resetPortalFlow: vi.fn(),
    savePortalCredentials: vi.fn(),
    saveConfig: vi.fn(),
  },
}));

vi.mock('@/components/admin/modules/product-management/hooks/useProductSchema', () => ({
  useProductSchema: () => ({ currentFields: [], isLoading: false }),
}));

vi.mock('@/components/admin/modules/product-management/integrations/ProviderList', () => ({
  ProviderList: () => null,
}));

vi.mock('@/components/admin/modules/product-management/integrations/IntegrationHeader', () => ({
  IntegrationHeader: () => null,
}));

vi.mock('@/components/admin/modules/product-management/integrations/UploadTab', () => ({
  UploadTab: () => null,
}));

vi.mock('@/components/admin/modules/product-management/integrations/MappingTab', () => ({
  MappingTab: () => null,
}));

vi.mock('@/components/admin/modules/product-management/integrations/PortalAutomationTab', () => ({
  PortalAutomationTab: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { IntegrationsTab } from '../IntegrationsTab';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IntegrationsTab', () => {
  it('renders without throwing', () => {
    const { container } = renderWithQueryClient(<IntegrationsTab />);
    expect(container).toBeTruthy();
  });

  it('shows the "No Providers Configured" empty state when providers list is empty', async () => {
    renderWithQueryClient(<IntegrationsTab />);

    await waitFor(() => {
      expect(screen.getByText('No Providers Configured')).toBeTruthy();
    });
  });
});
