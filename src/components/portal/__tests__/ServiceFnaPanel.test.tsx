import { describe, expect, it, vi, beforeEach } from 'vitest';
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

vi.mock('@/shared/fna-intake/fna-intake-labels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/fna-intake/fna-intake-labels')>();
  return {
    ...actual,
    isFnaIntakeFeatureEnabled: vi.fn(() => true),
  };
});

vi.mock('@/components/client/ClientFNAView', () => ({
  ClientFNAView: () => <div data-testid="legacy-fna-view">Legacy view</div>,
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pre-screen start action when intake is enabled', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /start your needs analysis/i })).toBeTruthy();
    expect(screen.getByText(/complete your risk discovery/i)).toBeTruthy();
  });

  it('renders legacy view when intake flag is disabled', async () => {
    const labels = await import('@/shared/fna-intake/fna-intake-labels');
    vi.mocked(labels.isFnaIntakeFeatureEnabled).mockReturnValue(false);

    renderPanel();
    expect(screen.getByTestId('legacy-fna-view')).toBeTruthy();
  });
});
