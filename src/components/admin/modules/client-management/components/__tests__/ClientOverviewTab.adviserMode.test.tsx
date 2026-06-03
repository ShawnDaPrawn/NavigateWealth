/**
 * ClientOverviewTab — Adviser-Mode Characterization Test (Phase 4)
 * ================================================================
 *
 * Locks adviser-mode rendering for the 2,944-line ClientOverviewTab before the
 * Phase 6 decomposition. Covers the Risk pillar card (absent from the
 * client-mode characterization batch) and the full five-pillar set.
 *
 * PillarCard renders `pillar.title`; derivePillars assigns:
 *   'Risk' | 'Medical Aid' | 'Retirement' | 'Investments' | 'Estate'
 * Mock setup mirrors ClientOverviewTab.clientMode.test.tsx exactly.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientOverviewTab } from '@/components/admin/modules/client-management/components/ClientOverviewTab';
import type { Client } from '@/components/admin/modules/client-management/types';

vi.mock('@/shared/fna-intake/hooks/useFnaBatchStatus', () => ({
  useFnaBatchStatus: vi.fn(() => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('@/utils/auth/profileService', () => ({
  getClientProfileQueryOptions: (clientId: string) => ({
    queryKey: ['client-profile', clientId],
    queryFn: async () => null,
  }),
}));

const mockClient: Client = {
  id: 'client-1',
  firstName: 'Test',
  lastName: 'Client',
  email: 'test@example.com',
  accountStatus: 'approved',
  preferredName: 'Test',
  createdAt: '2024-01-01T00:00:00.000Z',
  applicationStatus: 'approved',
  accountType: 'personal',
  deleted: false,
  suspended: false,
};

function renderAdviser() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ policies: [], logs: [] }),
  }) as typeof fetch;

  return render(
    <QueryClientProvider client={qc}>
      <ClientOverviewTab client={mockClient} mode="adviser" />
    </QueryClientProvider>,
  );
}

describe('ClientOverviewTab adviser mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing and shows the Portfolio Summary accordion header', async () => {
    renderAdviser();
    await waitFor(() => {
      expect(screen.getAllByText('Portfolio Summary').length).toBeGreaterThan(0);
    });
  });

  it('shows the Financial Reviews intake section', async () => {
    renderAdviser();
    await waitFor(() => {
      expect(screen.getByText('Financial Reviews')).toBeTruthy();
    });
  });

  it('renders all five pillar cards including the Risk pillar', async () => {
    renderAdviser();
    // derivePillars title values: 'Risk', 'Medical Aid', 'Retirement',
    // 'Investments', 'Estate'. The client-mode batch only checked the last four.
    await waitFor(() => {
      expect(screen.getAllByText('Risk').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Medical Aid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Retirement').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Investments').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Estate').length).toBeGreaterThan(0);
  });

  it('does not show the client welcome greeting in adviser mode', async () => {
    renderAdviser();
    await waitFor(() => {
      expect(screen.getAllByText('Financial Reviews').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(/welcome back/i).length).toBe(0);
  });

  it('hides client-only accordion labels in adviser mode', async () => {
    renderAdviser();
    await waitFor(() => {
      expect(screen.getAllByText('Portfolio Summary').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText('My Policies').length).toBe(0);
    expect(screen.queryAllByText('My Net Worth').length).toBe(0);
  });
});
