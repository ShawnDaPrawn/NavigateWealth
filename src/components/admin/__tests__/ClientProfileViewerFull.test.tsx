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
import { render, screen } from '@/test/utils';

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

const actionsStub: Record<string, ReturnType<typeof vi.fn>> = {};

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
      grossIncomeDisplay: '',
      netIncomeDisplay: '',
      assetDisplayValues: {},
      liabilityDisplayValues: {},
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

const noop = vi.fn();
const minimalClient = { id: 'c-1', name: 'Test Client' };

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockReturnValue(new Promise(() => {}));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ClientProfileViewerFull', () => {
  it('renders without throwing', () => {
    const { container } = render(<ClientProfileViewerFull clientData={minimalClient as never} />);
    expect(container).toBeTruthy();
  });

  it('shows the "Personal Info" section nav tab', () => {
    render(<ClientProfileViewerFull clientData={minimalClient as never} />);
    expect(screen.getByText('Personal Info')).toBeTruthy();
  });

  it('shows the "Contact Details" section nav tab', () => {
    render(<ClientProfileViewerFull clientData={minimalClient as never} />);
    expect(screen.getByText('Contact Details')).toBeTruthy();
  });
});
