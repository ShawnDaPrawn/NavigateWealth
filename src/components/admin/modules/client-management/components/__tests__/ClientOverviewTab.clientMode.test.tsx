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

function renderOverview(mode: 'client' | 'adviser' = 'client') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ policies: [], logs: [] }),
  }) as typeof fetch;

  return render(
    <QueryClientProvider client={client}>
      <ClientOverviewTab client={mockClient} mode={mode} />
    </QueryClientProvider>,
  );
}

describe('ClientOverviewTab client mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show Financial Reviews intake section on the client home overview', async () => {
    renderOverview('client');

    await waitFor(() => {
      expect(screen.queryByText('My Financial Reviews')).toBeNull();
    });
  });

  it('still shows Financial Reviews for adviser mode', async () => {
    renderOverview('adviser');

    await waitFor(() => {
      expect(screen.getByText('Financial Reviews')).toBeTruthy();
    });
  });
});
