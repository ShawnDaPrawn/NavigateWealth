/**
 * ComplianceTab — the client's compliance record (declarations and the firm's
 * review), kept on the profile. Replaced the Honeycomb/Beeswax checks on
 * 2026-11-24.
 *
 * Mocks:
 *   • @/utils/api — captures the save.
 *   • the client-management api — serves the stored profile record.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within, renderWithQueryClient } from '@/test/utils';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { UnsavedChangesRegistryProvider } from '@/components/shared/unsaved-changes/UnsavedChangesRegistry';
import type { Client } from '@/components/admin/modules/client-management/types';

const { mockApiPost, mockProfile } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
  mockProfile: vi.fn(),
}));

vi.mock('@/utils/api', () => ({
  api: { get: vi.fn(), post: mockApiPost, patch: vi.fn(), delete: vi.fn() },
  APIError: class APIError extends Error {},
}));

vi.mock('@/components/admin/modules/client-management/api', () => ({
  getClientProfileQueryOptions: (clientId: string) => ({
    queryKey: ['client-profile', clientId],
    queryFn: () => mockProfile(clientId),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

import { ComplianceTab } from '../ComplianceTab';

const selectedClient: Client = {
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

function renderCompliance(url = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <UnsavedChangesRegistryProvider>
            <ComplianceTab selectedClient={selectedClient} />
          </UnsavedChangesRegistryProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  return { router, ...renderWithQueryClient(<RouterProvider router={router} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
  // A record saved before the compliance record existed.
  mockProfile.mockResolvedValue({ firstName: 'Test', lastName: 'Client' });
  mockApiPost.mockResolvedValue({ success: true });
});

describe('ComplianceTab', () => {
  it('opens on the overview with what needs attention', async () => {
    renderCompliance();
    const card = await screen.findByRole('region', { name: 'Compliance overview' });
    expect(within(card).getByText('Client risk rating not set.')).toBeTruthy();
    expect(within(card).getByText('Sanctions screening not recorded.')).toBeTruthy();
    expect(within(card).getByText('8 still to answer')).toBeTruthy();
  });

  it('has no Honeycomb registration gate or checks', async () => {
    renderCompliance();
    await screen.findByRole('region', { name: 'Compliance overview' });
    expect(screen.queryByText('Registration required')).toBeNull();
    expect(screen.queryByText(/Beeswax/)).toBeNull();
  });

  it('keeps the open section in the address', async () => {
    const { router } = renderCompliance();
    const rail = await screen.findByRole('navigation', { name: 'Compliance sections' });
    fireEvent.click(within(rail).getByRole('button', { name: 'Compliance review' }));
    await waitFor(() => expect(router.state.location.search).toBe('?ksec=review'));
    expect(await screen.findByRole('region', { name: 'Compliance review' })).toBeTruthy();
  });

  it('shows what the client declared', async () => {
    mockProfile.mockResolvedValue({
      complianceDeclarations: {
        schemaVersion: 1,
        isPep: 'no',
        taxResidencies: [{ id: 't', country: 'South Africa', taxNumber: '0123456789' }],
      },
    });
    renderCompliance('/?ksec=declarations');
    const card = await screen.findByRole('region', { name: 'Client declarations' });
    expect(within(card).getByText('South Africa')).toBeTruthy();
    expect(within(card).getByText('0123456789')).toBeTruthy();
  });

  it('saves the review alone, merged over the stored record', async () => {
    renderCompliance('/?ksec=review');
    const card = await screen.findByRole('region', { name: 'Compliance review' });
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));

    fireEvent.change(await screen.findByLabelText('Last review'), {
      target: { value: '2026-11-24' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockApiPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/profile/personal-info');
    expect(body.key).toBe('user_profile:client-1:personal_info');
    expect(body.mode).toBe('merge');
    expect(Object.keys(body.data as object)).toEqual(['complianceReview']);
    expect(
      (body.data as { complianceReview: { lastKycReviewDate: string } }).complianceReview
        .lastKycReviewDate,
    ).toBe('2026-11-24');
  });

  it('shows an error when the record cannot be loaded', async () => {
    mockProfile.mockRejectedValue(new Error('503'));
    renderCompliance();
    expect(await screen.findByText("Couldn't load compliance", {}, { timeout: 5000 })).toBeTruthy();
  });
});
