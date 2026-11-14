/**
 * A failed load is an error, never an empty state: with the API failing,
 * Product Management's screens show "Unable to load …" with Try again (which
 * refetches), not "No providers configured" or default data.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const api = vi.hoisted(() => ({
  fetchProviders: vi.fn(),
  fetchSchema: vi.fn(),
  fetchIntegrationProviders: vi.fn(),
  fetchPortalConnections: vi.fn(),
}));

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>();
  return {
    ...actual,
    productManagementApi: new Proxy(actual.productManagementApi, {
      get: (target, key: string) =>
        key in api ? api[key as keyof typeof api] : target[key as keyof typeof target],
    }),
  };
});

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  }),
}));

import { ProviderManagementTab } from '../ProviderManagementTab';
import { IntegrationsTab } from '../IntegrationsTab';
import { useProductSchema } from '../hooks/useProductSchema';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Product Management — failed loads', () => {
  it('Providers: shows the error state, not "No providers configured", and retries', async () => {
    api.fetchProviders.mockRejectedValue(new Error('Request failed (400)'));
    render(<ProviderManagementTab />, { wrapper });

    expect(await screen.findByText('Unable to load providers')).toBeTruthy();
    expect(screen.queryByText('No providers configured')).toBeNull();

    api.fetchProviders.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('No providers configured')).toBeTruthy();
  });

  it('Providers: a successful empty response still shows the empty state', async () => {
    api.fetchProviders.mockResolvedValue([]);
    render(<ProviderManagementTab />, { wrapper });
    expect(await screen.findByText('No providers configured')).toBeTruthy();
    expect(screen.queryByText('Unable to load providers')).toBeNull();
  });

  it('Product structure: a failed schema load is an error, not the default schema', async () => {
    api.fetchSchema.mockRejectedValue(new Error('Request failed (400)'));
    const { result } = renderHook(() => useProductSchema('risk_planning' as never), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.currentFields).toEqual([]);

    api.fetchSchema.mockResolvedValue(null);
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.currentFields.length).toBeGreaterThan(0);
  });

  it('Integrations: shows the error state, not "No providers configured"', async () => {
    api.fetchIntegrationProviders.mockRejectedValue(new Error('Request failed (400)'));
    api.fetchPortalConnections.mockResolvedValue([]);
    render(<IntegrationsTab />, { wrapper });

    expect(await screen.findByText('Unable to load integrations')).toBeTruthy();
    expect(screen.queryByText('No providers configured')).toBeNull();
  });
});
