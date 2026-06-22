import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceFnaPanel } from '@/components/portal/ServiceFnaPanel';
import { useFnaBatchStatus } from '@/shared/fna-intake/hooks/useFnaBatchStatus';

vi.mock('@/shared/fna-intake/hooks/useFnaBatchStatus', () => ({
  useFnaBatchStatus: vi.fn(),
}));

vi.mock('@/components/client/ClientFNAView', () => ({
  ClientFNAView: () => <div data-testid="published-fna-view">Published results</div>,
}));

const defaultBatchStatus = {
  data: [{ key: 'risk', status: 'not_started' as const, data: null }],
  error: null,
  isLoading: false,
  refetch: vi.fn(),
} as unknown as ReturnType<typeof useFnaBatchStatus>;

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
    vi.mocked(useFnaBatchStatus).mockReturnValue(defaultBatchStatus);
  });

  it('renders the launched intake start action', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /start your needs analysis/i })).toBeTruthy();
    expect(screen.getByText(/complete your risk discovery/i)).toBeTruthy();
  });

  it('preserves published-result routing through the launched hub', () => {
    vi.mocked(useFnaBatchStatus).mockReturnValue({
      ...defaultBatchStatus,
      data: [{ key: 'risk', status: 'published', data: null }],
    } as unknown as ReturnType<typeof useFnaBatchStatus>);

    renderPanel();
    expect(screen.getByTestId('published-fna-view')).toBeTruthy();
  });
});
