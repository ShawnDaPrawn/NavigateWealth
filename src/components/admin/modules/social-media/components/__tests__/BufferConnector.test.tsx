import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

vi.mock('../../hooks/useBuffer', () => ({
  useBuffer: () => ({
    status: { configured: false, connected: false, canDisconnect: false },
    statusLoading: false,
    channels: [],
    posts: [],
    connect: vi.fn(),
    isConnecting: false,
    disconnect: vi.fn(),
    isDisconnecting: false,
    createPost: vi.fn(),
    isCreating: false,
    refresh: vi.fn(),
  }),
}));

import { BufferConnector } from '../BufferConnector';

describe('BufferConnector', () => {
  it('renders the disconnected Buffer card', () => {
    render(<BufferConnector />, { wrapper });
    expect(screen.getByText('Buffer Integration')).toBeTruthy();
    expect(screen.getByText('Not Connected')).toBeTruthy();
    expect(screen.getByLabelText('Buffer API key')).toBeTruthy();
  });
});
