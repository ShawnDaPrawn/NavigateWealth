/**
 * ResourcesModule — Render / Characterization Test (Phase 4)
 * ===========================================================
 *
 * Locks the mount contract and the "Resources" page heading (the sidebar label) for this
 * 1,149-line Phase 6 decomposition target.
 *
 * useResources and useCurrentUserPermissions are mocked to avoid React Query
 * context requirements. The module keeps its tab, open tool and open builder
 * in the address, so it renders inside a MemoryRouter.
 * renderWithQueryClient is still required for direct useQueryClient usage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, renderWithQueryClient } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';

const formsFixture = [
  {
    id: 'form-1',
    name: 'Client consent form',
    category: 'Forms',
    description: 'POPIA and FAIS consents',
    version: '1.0',
    lastUpdated: '1/1/2026',
    downloads: 0,
    size: 'Dynamic',
    isPopular: false,
    fields: [],
    clientTypes: ['Universal'],
    renderer: 'dynamic',
    blocks: [],
    status: 'published',
  },
];

vi.mock('@/components/admin/modules/resources/hooks/useResources', () => ({
  useResources: () => ({
    forms: formsFixture,
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

vi.mock('@/components/admin/modules/resources/builder/FormBuilder', () => ({
  FormBuilder: ({ mode, onBack }: { mode: string; onBack: () => void }) => (
    <div>
      <p>Builder stub: {mode}</p>
      <button onClick={onBack}>Leave builder</button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderModule(initial = '/') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[initial]}>
      <ResourcesModule />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('ResourcesModule', () => {
  it('renders without throwing and shows the Resources heading', async () => {
    renderModule();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Resources' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Compose letter/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Build new form/ })).toBeTruthy();
  });

  it('opens the form builder as a page in the address, and Back returns to the list', async () => {
    renderModule();
    fireEvent.click(screen.getByRole('button', { name: /Build new form/ }));

    expect(await screen.findByText('Builder stub: form')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toContain('build=form');

    fireEvent.click(screen.getByRole('button', { name: 'Leave builder' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Resources' })).toBeTruthy(),
    );
    expect(screen.getByTestId('location').textContent).not.toContain('build=');
  });

  it('opens an existing form in the builder from a pasted link', async () => {
    renderModule('/?build=form-1');
    expect(await screen.findByText('Builder stub: form')).toBeTruthy();
  });

  it('says so when the linked form template does not exist', async () => {
    renderModule('/?build=missing');
    expect(await screen.findByText('Form template not found')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Back to Resources/ }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Resources' })).toBeTruthy(),
    );
  });
});
