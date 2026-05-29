import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceFnaPanel } from '@/components/portal/ServiceFnaPanel';

vi.mock('@/shared/fna-intake/hooks/useFnaBatchStatus', () => ({
  useFnaBatchStatus: vi.fn(() => ({
    data: [{ key: 'risk', status: 'not_started', data: null }],
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ServiceFnaPanel
        clientId="client-1"
        fnaType="risk"
        title="Risk Planning FNA"
        description="Complete your risk discovery"
      />
    </QueryClientProvider>,
  );
}

describe('ServiceFnaPanel', () => {
  it('renders pre-screen start action through the launched intake hub', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /start your needs analysis/i })).toBeTruthy();
    expect(screen.getByText(/complete your risk discovery/i)).toBeTruthy();
  });
});
