/**
 * ClientProfileViewerFull — Render / Characterization Test (Phase 4)
 * ===================================================================
 *
 * Locks the mount contract and the always-visible "Personal Info" section
 * navigation tab for this 1,052-line Phase 6 decomposition target.
 *
 * useClientProfile is mocked to avoid its complex state machinery. api is
 * mocked to prevent real HTTP calls during policy-assets fetch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@/test/utils';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { UnsavedChangesRegistryProvider } from '@/components/shared/unsaved-changes/UnsavedChangesRegistry';

const { mockApiGet } = vi.hoisted(() => ({ mockApiGet: vi.fn() }));

vi.mock('@/utils/api', () => ({
  api: { get: mockApiGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const profileData = {
  title: '',
  firstName: 'Test',
  middleName: '',
  lastName: 'Client',
  dateOfBirth: '',
  idNumber: '',
  idType: 'sa_id',
  gender: '',
  maritalStatus: '',
  nationality: '',
  occupation: '',
  employer: '',
  incomeSource: '',
  grossMonthlyIncome: 0,
  netMonthlyIncome: 0,
  taxNumber: '',
  email: '',
  phone: '',
  mobile: '',
  alternativeEmail: '',
  linkedIn: '',
  physicalAddress: null,
  postalAddress: null,
  riskProfile: null,
  assets: [],
  liabilities: [],
  familyMembers: [],
  bankAccounts: [],
  employers: [],
  chronicConditions: [],
  identityDocuments: [],
  proofOfResidence: null,
  proofOfBank: null,
};

vi.mock('@/components/admin/modules/client-management/hooks/useClientProfile', () => ({
  useClientProfile: () => ({
    state: {
      profileData,
      loading: false,
      error: null,
      saving: false,
      hasChanges: false,
      assetsInEditMode: new Set(),
      liabilitiesInEditMode: new Set(),
      familyMembersInEditMode: new Set(),
      bankAccountsInEditMode: new Set(),
      employersInEditMode: new Set(),
      chronicConditionsInEditMode: new Set(),
      identityDocsInEditMode: new Set(),
      selfEmployedInEditMode: false,
      proofOfResidenceInEditMode: false,
      assetToDelete: null,
      liabilityToDelete: null,
      bankAccountToDelete: null,
      familyMemberToDelete: null,
      chronicConditionToDelete: null,
      employerToDelete: null,
      identityDocToDelete: null,
      proofOfResidenceToDelete: null,
      proofOfBankToDelete: null,
      assessmentStarted: false,
      incomeValidationError: null,
    },
    actions: new Proxy(
      {},
      {
        get: () => vi.fn(),
      },
    ),
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ClientProfileViewerFull } from '../ClientProfileViewerFull';

const minimalClient = { id: 'c-1', name: 'Test Client' };

function renderClientProfileViewer(url = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <UnsavedChangesRegistryProvider>
            <ClientProfileViewerFull clientData={minimalClient as never} />
          </UnsavedChangesRegistryProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockResolvedValue({ policies: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClientProfileViewerFull', () => {
  it('mounts and shows the core profile section nav tabs', async () => {
    const { container } = renderClientProfileViewer();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Personal info' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Contact details' })).toBeTruthy();
    });

    expect(container).toBeTruthy();
  }, 30000);

  it('shows the section card in view mode, with Edit swapping in the form', async () => {
    renderClientProfileViewer();
    const card = await screen.findByRole('region', { name: 'Personal info' });
    expect(within(card).getByText('First name')).toBeTruthy();
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Personal info' })).toBeNull();
  }, 30000);

  it('keeps the open section in the address', async () => {
    const { router } = renderClientProfileViewer('/?psec=contact');
    expect(await screen.findByRole('region', { name: 'Contact details' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Address' }));
    await waitFor(() => expect(router.state.location.search).toBe('?psec=address'));
  }, 30000);
});
