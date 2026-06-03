/**
 * ResourcesModule — Render / Characterization Test (Phase 4)
 * ===========================================================
 *
 * Locks the mount contract and the "Resource Center" heading for this
 * 1,149-line Phase 6 decomposition target.
 *
 * useResources and useCurrentUserPermissions are mocked to avoid React Query
 * context requirements. useSearchParams (react-router) is mocked to avoid
 * a Router context. Lazy-loaded sub-components never mount in this test.
 * renderWithQueryClient is still required for direct useQueryClient usage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, renderWithQueryClient } from '@/test/utils';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock('@/components/admin/modules/resources/hooks/useResources', () => ({
  useResources: () => ({
    forms: [],
    filteredForms: [],
    categories: [],
    clientTypes: [],
    loading: false,
    error: null,
    filters: {},
    createResource: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    duplicateResource: vi.fn(),
    updateFilters: vi.fn(),
    resetFilters: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/admin/modules/personnel/hooks/usePermissions', () => ({
  useCurrentUserPermissions: () => ({
    canDo: vi.fn().mockReturnValue(true),
    data: { modules: [] },
    isLoading: false,
  }),
}));

vi.mock('@/utils/api', () => ({
  api: { get: vi.fn().mockResolvedValue([]), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ResourcesModule } from '../ResourcesModule';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ResourcesModule', () => {
  it('renders without throwing and shows the Resource Center heading', async () => {
    renderWithQueryClient(<ResourcesModule />);

    await waitFor(() => {
      expect(screen.getByText('Resource Center')).toBeTruthy();
    });
  });
});
