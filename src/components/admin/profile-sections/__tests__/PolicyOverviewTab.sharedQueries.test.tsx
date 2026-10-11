/**
 * Policies tab — one shared, fresh read for all seven sections.
 *
 * Each section used to fetch its schema, sub-schemas, policies, goals and FNA
 * one after another, uncached: up to five Edge Function round trips per
 * section before it could draw, and seven policy requests for data the server
 * reads from one row. Pinned here: all sections share ONE policies request and
 * ONE schema request, each section shows only its own category's policies,
 * and a saved change reaches the screen when the client's policies are
 * invalidated (which every policy write in the app now does).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '@/test/utils';

const mockGet = vi.fn();
vi.mock('@/utils/api', () => ({
  api: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('../fna-config', () => ({
  hasFNASupport: () => false,
  getFNAConfig: () => null,
}));

import { PolicyOverviewTab } from '../PolicyOverviewTab';
import { invalidateClientPolicies } from '@/shared/api/clientPolicies';

const SCHEMAS = {
  schemas: {
    risk_planning: { fields: [{ id: 'cover', name: 'Life Cover', type: 'text' }] },
    medical_aid: { fields: [{ id: 'scheme', name: 'Scheme', type: 'text' }] },
  },
};

let riskCover = 'Cover A';

function respond(url: string) {
  if (url === '/integrations/schemas/batch') return Promise.resolve(SCHEMAS);
  if (url.startsWith('/integrations/policies?')) {
    return Promise.resolve({
      policies: [
        { id: 'p-risk', categoryId: 'risk_planning', data: { cover: riskCover } },
        { id: 'p-med', categoryId: 'medical_aid', data: { scheme: 'Scheme B' } },
      ],
    });
  }
  return Promise.reject(new Error(`unexpected request ${url}`));
}

beforeEach(() => {
  riskCover = 'Cover A';
  mockGet.mockReset();
  mockGet.mockImplementation(respond);
});

describe('PolicyOverviewTab shared queries', () => {
  it('makes one policies request and one schema request for all seven sections', async () => {
    render(
      <QueryClientProvider client={makeTestQueryClient()}>
        <PolicyOverviewTab clientId="client-1" variant="embedded" />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Cover A')).toBeTruthy();
    expect(screen.getByText('Scheme B')).toBeTruthy();

    const urls = mockGet.mock.calls.map((call) => call[0] as string);
    expect(urls.filter((url) => url.startsWith('/integrations/policies?'))).toEqual([
      '/integrations/policies?clientId=client-1',
    ]);
    expect(urls.filter((url) => url === '/integrations/schemas/batch')).toHaveLength(1);
    // No per-category schema or per-section policy requests any more.
    expect(urls.some((url) => url.includes('categoryId='))).toBe(false);
  });

  it('shows the saved value once the client is invalidated', async () => {
    const queryClient = makeTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <PolicyOverviewTab clientId="client-1" variant="embedded" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Cover A')).toBeTruthy();

    riskCover = 'Cover B';
    await act(async () => {
      await invalidateClientPolicies(queryClient, 'client-1');
    });

    await waitFor(() => expect(screen.getByText('Cover B')).toBeTruthy());
    expect(screen.queryByText('Cover A')).toBeNull();
  });
});
