import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientProfile } from '../useClientProfile';
import type { Client } from '../../types';

const mockFetchQuery = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  fetchQuery: mockFetchQuery,
  setQueryData: mockSetQueryData,
  invalidateQueries: mockInvalidateQueries,
};

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUpdateClientProfile = vi.fn();
const mockFetchClientProfile = vi.fn();

vi.mock('../../api', () => ({
  clientApi: {
    updateClientProfile: (...args: unknown[]) => mockUpdateClientProfile(...args),
    fetchClientProfile: (...args: unknown[]) => mockFetchClientProfile(...args),
  },
  getClientProfileQueryOptions: (userId: string) => ({
    queryKey: ['client-profile', userId],
    queryFn: () => mockFetchClientProfile(userId),
  }),
}));

vi.mock('../queryKeys', () => ({
  clientKeys: {
    lists: () => ['clients'],
    detail: (id: string) => ['clients', id],
  },
}));

const MINIMAL_CLIENT: Client = {
  id: 'user-001',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  preferredName: 'Jane',
  createdAt: '2024-01-01T00:00:00Z',
  applicationStatus: 'active',
  deleted: false,
  suspended: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  // fetchQuery resolves to null (no stored profile) → triggers fallback
  mockFetchQuery.mockResolvedValue(null);
});

describe('useClientProfile', () => {
  it('initializes with loading true and no error', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.loading).toBe(true);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.hasChanges).toBe(false);
  });

  it('initializes profileData firstName/lastName from clientData', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.profileData.firstName).toBe('Jane');
    expect(result.current.state.profileData.lastName).toBe('Doe');
    expect(result.current.state.profileData.email).toBe('jane.doe@example.com');
  });

  it('initializes profileData with South African defaults', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.profileData.nationality).toBe('South Africa');
    expect(result.current.state.profileData.idCountry).toBe('South Africa');
    expect(result.current.state.profileData.residentialCountry).toBe('South Africa');
  });

  it('initializes arrays as empty', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.profileData.assets).toEqual([]);
    expect(result.current.state.profileData.liabilities).toEqual([]);
    expect(result.current.state.profileData.familyMembers).toEqual([]);
    expect(result.current.state.profileData.bankAccounts).toEqual([]);
    expect(result.current.state.profileData.employers).toEqual([]);
    expect(result.current.state.profileData.chronicConditions).toEqual([]);
    expect(result.current.state.profileData.identityDocuments).toEqual([]);
  });

  it('initializes edit-mode sets as empty', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.assetsInEditMode.size).toBe(0);
    expect(result.current.state.liabilitiesInEditMode.size).toBe(0);
    expect(result.current.state.familyMembersInEditMode.size).toBe(0);
    expect(result.current.state.bankAccountsInEditMode.size).toBe(0);
  });

  it('initializes delete confirmation states as null/false', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.state.assetToDelete).toBeNull();
    expect(result.current.state.liabilityToDelete).toBeNull();
    expect(result.current.state.bankAccountToDelete).toBeNull();
    expect(result.current.state.familyMemberToDelete).toBeNull();
    expect(result.current.state.proofOfResidenceToDelete).toBe(false);
  });

  it('returns all expected action handlers', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    const { actions } = result.current;
    expect(typeof actions.handleInputChange).toBe('function');
    expect(typeof actions.handleSave).toBe('function');
    expect(typeof actions.handleDiscard).toBe('function');
    expect(typeof actions.addAsset).toBe('function');
    expect(typeof actions.addLiability).toBe('function');
    expect(typeof actions.addFamilyMember).toBe('function');
    expect(typeof actions.addBankAccount).toBe('function');
    expect(typeof actions.addEmployer).toBe('function');
    expect(typeof actions.addChronicCondition).toBe('function');
    expect(typeof actions.addIdentityDocument).toBe('function');
  });

  it('handleInputChange updates a top-level field and marks dirty', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.handleInputChange('firstName', 'Alice');
    });
    expect(result.current.state.profileData.firstName).toBe('Alice');
    expect(result.current.state.hasChanges).toBe(true);
  });

  it('handleInputChange on grossMonthlyIncome auto-calculates annual income', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.handleInputChange('grossMonthlyIncome', 10000);
    });
    expect(result.current.state.profileData.grossMonthlyIncome).toBe(10000);
    expect(result.current.state.profileData.grossAnnualIncome).toBe(120000);
  });

  it('handleInputChange on netMonthlyIncome auto-calculates annual income', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.handleInputChange('netMonthlyIncome', 8000);
    });
    expect(result.current.state.profileData.netAnnualIncome).toBe(96000);
  });

  it('addAsset adds a new asset to the list and marks dirty', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    expect(result.current.state.profileData.assets.length).toBe(1);
    expect(result.current.state.hasChanges).toBe(true);
  });

  it('addAsset puts new asset into edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    const assetId = result.current.state.profileData.assets[0].id;
    expect(result.current.state.assetsInEditMode.has(assetId)).toBe(true);
  });

  it('confirmDeleteAsset sets assetToDelete', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    const assetId = result.current.state.profileData.assets[0].id;
    act(() => {
      result.current.actions.confirmDeleteAsset(assetId);
    });
    expect(result.current.state.assetToDelete).toBe(assetId);
  });

  it('removeAsset removes the confirmed asset', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    const assetId = result.current.state.profileData.assets[0].id;
    act(() => {
      result.current.actions.confirmDeleteAsset(assetId);
    });
    act(() => {
      result.current.actions.removeAsset();
    });
    expect(result.current.state.profileData.assets.length).toBe(0);
    expect(result.current.state.assetToDelete).toBeNull();
  });

  it('editAsset marks asset as in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    const assetId = result.current.state.profileData.assets[0].id;
    act(() => {
      result.current.actions.cancelEditAsset(assetId);
    });
    expect(result.current.state.assetsInEditMode.has(assetId)).toBe(false);
    act(() => {
      result.current.actions.editAsset(assetId);
    });
    expect(result.current.state.assetsInEditMode.has(assetId)).toBe(true);
  });

  it('updateAsset updates a field on the asset', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addAsset();
    });
    const assetId = result.current.state.profileData.assets[0].id;
    act(() => {
      result.current.actions.updateAsset(assetId, { name: 'My House', value: 500000 });
    });
    const updated = result.current.state.profileData.assets.find((a) => a.id === assetId);
    expect(updated?.name).toBe('My House');
    expect(updated?.value).toBe(500000);
  });

  it('addLiability adds a new liability in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addLiability();
    });
    expect(result.current.state.profileData.liabilities.length).toBe(1);
    const id = result.current.state.profileData.liabilities[0].id;
    expect(result.current.state.liabilitiesInEditMode.has(id)).toBe(true);
  });

  it('confirmDeleteLiability then removeLiability clears the item', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addLiability();
    });
    const id = result.current.state.profileData.liabilities[0].id;
    act(() => {
      result.current.actions.confirmDeleteLiability(id);
    });
    act(() => {
      result.current.actions.removeLiability();
    });
    expect(result.current.state.profileData.liabilities.length).toBe(0);
  });

  it('addFamilyMember adds a new family member in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addFamilyMember();
    });
    expect(result.current.state.profileData.familyMembers.length).toBe(1);
    const id = result.current.state.profileData.familyMembers[0].id;
    expect(result.current.state.familyMembersInEditMode.has(id)).toBe(true);
  });

  it('updateFamilyMember updates a field on the member', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addFamilyMember();
    });
    const id = result.current.state.profileData.familyMembers[0].id;
    act(() => {
      result.current.actions.updateFamilyMember(id, { fullName: 'Bob Doe' });
    });
    const member = result.current.state.profileData.familyMembers.find((m) => m.id === id);
    expect(member?.fullName).toBe('Bob Doe');
  });

  it('addBankAccount adds a new bank account in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addBankAccount();
    });
    expect(result.current.state.profileData.bankAccounts.length).toBe(1);
    const id = result.current.state.profileData.bankAccounts[0].id;
    expect(result.current.state.bankAccountsInEditMode.has(id)).toBe(true);
  });

  it('addEmployer adds a new employer in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addEmployer();
    });
    expect(result.current.state.profileData.employers.length).toBe(1);
    const id = result.current.state.profileData.employers[0].id;
    expect(result.current.state.employersInEditMode.has(id)).toBe(true);
  });

  it('addChronicCondition adds a new condition in edit mode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addChronicCondition();
    });
    expect(result.current.state.profileData.chronicConditions.length).toBe(1);
  });

  it('addIdentityDocument adds a new document', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addIdentityDocument('national-id');
    });
    expect(result.current.state.profileData.identityDocuments.length).toBe(1);
    const doc = result.current.state.profileData.identityDocuments[0];
    expect(doc.type).toBe('national-id');
    expect(doc.countryOfIssue).toBe('South Africa');
  });

  it('addIdentityDocument rejects duplicate document type', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addIdentityDocument('passport');
    });
    act(() => {
      result.current.actions.addIdentityDocument('passport');
    });
    expect(result.current.state.profileData.identityDocuments.length).toBe(1);
    expect(toast.error).toHaveBeenCalled();
  });

  it('hasDocumentType returns true for existing document type', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.addIdentityDocument('drivers-license');
    });
    expect(result.current.actions.hasDocumentType('drivers-license')).toBe(true);
    expect(result.current.actions.hasDocumentType('passport')).toBe(false);
  });

  it('getDocumentTypeLabel returns a non-empty label', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.actions.getDocumentTypeLabel('national-id').length).toBeGreaterThan(0);
    expect(result.current.actions.getDocumentTypeLabel('passport').length).toBeGreaterThan(0);
  });

  it('getDocumentTypeIcon returns a non-null icon', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    expect(result.current.actions.getDocumentTypeIcon('national-id')).toBeTruthy();
  });

  it('updateRiskQuestion sets a question score', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.updateRiskQuestion(1, 3);
    });
    expect(result.current.state.profileData.riskAssessment.question1).toBe(3);
  });

  it('assessmentStarted becomes true when all 10 questions answered', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.actions.updateRiskQuestion(i, 2);
      }
    });
    expect(result.current.state.assessmentStarted).toBe(true);
  });

  it('handleSave returns false when client has no id', async () => {
    const noIdClient = { ...MINIMAL_CLIENT, id: '' };
    const { result } = renderHook(() => useClientProfile(noIdClient));
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.actions.handleSave();
    });
    expect(returnValue).toBe(false);
  });

  it('handleSave calls updateClientProfile on success', async () => {
    mockUpdateClientProfile.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.actions.handleSave();
    });
    expect(mockUpdateClientProfile).toHaveBeenCalled();
    expect(returnValue).toBe(true);
  });

  it('handleSave returns false when updateClientProfile throws', async () => {
    mockUpdateClientProfile.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    let returnValue: boolean | undefined;
    await act(async () => {
      returnValue = await result.current.actions.handleSave();
    });
    expect(returnValue).toBe(false);
  });

  it('editSelfEmployed sets selfEmployedInEditMode to true', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.editSelfEmployed();
    });
    expect(result.current.state.selfEmployedInEditMode).toBe(true);
  });

  it('cancelEditSelfEmployed resets selfEmployedInEditMode', () => {
    const { result } = renderHook(() => useClientProfile(MINIMAL_CLIENT));
    act(() => {
      result.current.actions.editSelfEmployed();
    });
    act(() => {
      result.current.actions.cancelEditSelfEmployed();
    });
    expect(result.current.state.selfEmployedInEditMode).toBe(false);
  });

  it('uses profile.personalInformation data from clientData when provided', () => {
    const clientWithProfile: Client = {
      ...MINIMAL_CLIENT,
      profile: {
        personalInformation: {
          title: 'Mrs',
          firstName: 'Clara',
          middleName: 'Anne',
          lastName: 'Smith',
          dateOfBirth: '1990-05-10',
          gender: 'Female',
          nationality: 'South African',
          taxNumber: '123456789',
          maritalStatus: 'married',
          maritalRegime: '',
          grossIncome: 50000,
          netIncome: 40000,
          grossMonthlyIncome: 50000,
          netMonthlyIncome: 40000,
          grossAnnualIncome: 600000,
          netAnnualIncome: 480000,
          email: 'clara@example.com',
          secondaryEmail: '',
          phoneNumber: '0821234567',
          alternativePhone: '',
          preferredContactMethod: 'phone',
          emergencyContactName: '',
          emergencyContactRelationship: '',
          emergencyContactPhone: '',
          emergencyContactEmail: '',
          idCountry: 'South Africa',
          idNumber: '9005100001082',
          passportCountry: '',
          passportNumber: '',
          employmentCountry: '',
          workPermitNumber: '',
          identityDocuments: [],
          residentialAddressLine1: '1 Main St',
          residentialAddressLine2: '',
          residentialSuburb: '',
          residentialCity: 'Cape Town',
          residentialProvince: 'Western Cape',
          residentialPostalCode: '8001',
          residentialCountry: 'South Africa',
          proofOfResidenceUploaded: false,
          workAddressLine1: '',
          workAddressLine2: '',
          workSuburb: '',
          workCity: '',
          workProvince: '',
          workPostalCode: '',
          workCountry: 'South Africa',
          employmentStatus: 'employed',
          employers: [],
          selfEmployedCompanyName: '',
          selfEmployedIndustry: '',
          selfEmployedDescription: '',
          additionalIncomeSources: [],
          height: 165,
          heightUnit: 'cm',
          weight: 60,
          weightUnit: 'kg',
          bloodType: 'A+',
          smokerStatus: false,
          hasChronicConditions: false,
          chronicConditions: [],
          familyMembers: [],
          bankAccounts: [],
          riskAssessment: {
            question1: 0,
            question2: 0,
            question3: 0,
            question4: 0,
            question5: 0,
            question6: 0,
            question7: 0,
            question8: 0,
            question9: 0,
            question10: 0,
            totalScore: 0,
            riskCategory: '',
            dateCompleted: '',
            canRetake: true,
          },
          assets: [],
          liabilities: [],
        },
      },
    };
    const { result } = renderHook(() => useClientProfile(clientWithProfile));
    expect(result.current.state.profileData.firstName).toBe('Clara');
    expect(result.current.state.profileData.maritalStatus).toBe('married');
    expect(result.current.state.profileData.idNumber).toBe('9005100001082');
  });
});
