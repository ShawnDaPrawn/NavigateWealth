/**
 * DocumentMappingTab — Render / Characterization Test (Phase 4)
 * ==============================================================
 *
 * Locks the "Terminology mappings" card title, and the Extraction / Renewal
 * alerts views (the renewal scanner is its own view, kept in the address).
 *
 * useProviders is mocked to avoid React Query context requirements.
 * global.fetch is mocked so fetchTerminologies resolves quickly and exits
 * the loading gate (isLoading starts as true until fetch completes).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';

vi.mock('@/components/admin/modules/product-management/hooks/useProviders', () => ({
  useProviders: () => ({ providers: [], isLoading: false }),
}));

vi.mock(
  '@/components/admin/modules/product-management/components/ExtractionQualityDashboard',
  () => ({
    ExtractionQualityDashboard: () => null,
  }),
);

vi.mock('@/components/admin/modules/product-management/components/RenewalAlertScanner', () => ({
  RenewalAlertScanner: () => <div>Renewal scanner stub</div>,
}));

vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { DocumentMappingTab } from '../DocumentMappingTab';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ terminologies: [] }),
  } as Response);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderTab(initial = '/') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <DocumentMappingTab />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('DocumentMappingTab', () => {
  it('shows the "Terminology mappings" card title after loading', async () => {
    renderTab();

    await waitFor(() => {
      expect(screen.getByText('Terminology mappings')).toBeTruthy();
    });
    expect(screen.queryByText('Renewal scanner stub')).toBeNull();
  });

  it('opens Renewal alerts as its own view, kept in the address', async () => {
    renderTab();
    await waitFor(() => expect(screen.getByText('Terminology mappings')).toBeTruthy());

    const trigger = screen.getByRole('tab', { name: 'Renewal alerts' });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByText('Renewal scanner stub')).toBeTruthy());
    expect(screen.getByTestId('location').textContent).toContain('docai=renewals');
  });

  it('lands on Renewal alerts from a pasted link', async () => {
    renderTab('/?docai=renewals');
    await waitFor(() => expect(screen.getByText('Renewal scanner stub')).toBeTruthy());
  });

  it('shows the error state when the mappings fail to load', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
    } as Response);
    renderTab();
    expect(await screen.findByText('Unable to load terminology mappings')).toBeTruthy();
    expect(screen.queryByText('Terminology mappings')).toBeNull();
  });
});
