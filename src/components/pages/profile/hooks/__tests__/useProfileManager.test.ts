import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfileManager } from '../useProfileManager';

const mockGetSession = vi.fn();
const mockApiGet = vi.fn();
const mockApiPut = vi.fn();

vi.mock('../../../../utils/auth/authService', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('../../../../utils/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
}));

vi.mock('../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/errorUtils', () => ({
  getUserErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'Unknown error'),
  isAbortError: (err: unknown) => err instanceof DOMException && err.name === 'AbortError',
}));

const mockUpdateUser = vi.fn();
const DEFAULT_INPUT = {
  userEmail: 'test@example.com',
  userFirstName: 'Alice',
  userLastName: 'Smith',
  updateUser: mockUpdateUser,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Return no session by default → loading finishes without network calls
  mockGetSession.mockResolvedValue(null);
});

describe('useProfileManager', () => {
  it('starts with initialLoading true then resolves', async () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.initialLoading).toBe(true);
  });

  it('initializes profileData with email from input', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.profileData.email).toBe('test@example.com');
  });

  it('initializes with empty arrays for entities', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.profileData.assets).toEqual([]);
    expect(result.current.profileData.liabilities).toEqual([]);
    expect(result.current.profileData.familyMembers).toEqual([]);
    expect(result.current.profileData.bankAccounts).toEqual([]);
    expect(result.current.profileData.employers).toEqual([]);
    expect(result.current.profileData.chronicConditions).toEqual([]);
    expect(result.current.profileData.identityDocuments).toEqual([]);
  });

  it('initializes saving/loading as false', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.saveSuccess).toBe(false);
  });

  it('handleInputChange updates a field', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.handleInputChange('firstName', 'Bob');
    });
    expect(result.current.profileData.firstName).toBe('Bob');
  });

  it('handleInputChange resets saveSuccess', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.setSaveSuccess(true);
    });
    act(() => {
      result.current.handleInputChange('firstName', 'Carol');
    });
    expect(result.current.saveSuccess).toBe(false);
  });

  it('addAsset adds an asset and places it in edit mode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addAsset();
    });
    expect(result.current.profileData.assets.length).toBe(1);
    const id = result.current.profileData.assets[0].id;
    expect(result.current.assetsInEditMode.has(id)).toBe(true);
  });

  it('updateAsset updates a field on the asset', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addAsset();
    });
    const id = result.current.profileData.assets[0].id;
    act(() => {
      result.current.updateAsset(id, { name: 'Car', value: 200000 });
    });
    const updated = result.current.profileData.assets.find((a) => a.id === id);
    expect(updated?.name).toBe('Car');
  });

  it('confirmDeleteAsset then removeAsset removes the item', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addAsset();
    });
    const id = result.current.profileData.assets[0].id;
    act(() => {
      result.current.confirmDeleteAsset(id);
    });
    act(() => {
      result.current.removeAsset(id);
    });
    expect(result.current.profileData.assets.length).toBe(0);
  });

  it('addLiability adds a liability in edit mode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addLiability();
    });
    expect(result.current.profileData.liabilities.length).toBe(1);
    const id = result.current.profileData.liabilities[0].id;
    expect(result.current.liabilitiesInEditMode.has(id)).toBe(true);
  });

  it('addFamilyMember adds a family member in edit mode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addFamilyMember();
    });
    expect(result.current.profileData.familyMembers.length).toBe(1);
    const id = result.current.profileData.familyMembers[0].id;
    expect(result.current.familyMembersInEditMode.has(id)).toBe(true);
  });

  it('updateFamilyMember updates a family member field', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addFamilyMember();
    });
    const id = result.current.profileData.familyMembers[0].id;
    act(() => {
      result.current.updateFamilyMember(id, { fullName: 'John Doe', relationship: 'Spouse' });
    });
    const member = result.current.profileData.familyMembers.find((m) => m.id === id);
    expect(member?.fullName).toBe('John Doe');
  });

  it('addBankAccount adds a bank account in edit mode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addBankAccount();
    });
    expect(result.current.profileData.bankAccounts.length).toBe(1);
    const id = result.current.profileData.bankAccounts[0].id;
    expect(result.current.bankAccountsInEditMode.has(id)).toBe(true);
  });

  it('addEmployer adds an employer in edit mode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addEmployer();
    });
    expect(result.current.profileData.employers.length).toBe(1);
    const id = result.current.profileData.employers[0].id;
    expect(result.current.employersInEditMode.has(id)).toBe(true);
  });

  it('addChronicCondition adds a condition', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addChronicCondition();
    });
    expect(result.current.profileData.chronicConditions.length).toBe(1);
  });

  it('addIdentityDocument adds a new identity document', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addIdentityDocument('national-id');
    });
    expect(result.current.profileData.identityDocuments.length).toBe(1);
    expect(result.current.profileData.identityDocuments[0].type).toBe('national-id');
  });

  it('hasDocumentType returns true for existing type', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.addIdentityDocument('passport');
    });
    expect(result.current.hasDocumentType('passport')).toBe(true);
    expect(result.current.hasDocumentType('national-id')).toBe(false);
  });

  it('getDocumentTypeLabel returns a non-empty string', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.getDocumentTypeLabel('passport').length).toBeGreaterThan(0);
  });

  it('getDocumentTypeIcon returns an object with icon and color', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    const iconInfo = result.current.getDocumentTypeIcon('national-id');
    expect(iconInfo).toBeDefined();
    expect(iconInfo.icon).toBeDefined();
    expect(typeof iconInfo.color).toBe('string');
  });

  it('updateRiskQuestion sets question score', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.updateRiskQuestion(1, 4);
    });
    expect(result.current.profileData.riskAssessment.question1).toBe(4);
  });

  it('assessmentStarted becomes true when all 10 questions answered', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      for (let i = 1; i <= 10; i++) {
        result.current.updateRiskQuestion(i, 3);
      }
    });
    expect(result.current.assessmentStarted).toBe(true);
  });

  it('allQuestionsAnswered returns false when no questions answered', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.allQuestionsAnswered()).toBe(false);
  });

  it('editSelfEmployed sets selfEmployedInEditMode true', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.editSelfEmployed();
    });
    expect(result.current.selfEmployedInEditMode).toBe(true);
  });

  it('cancelEditSelfEmployed resets selfEmployedInEditMode', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.editSelfEmployed();
    });
    act(() => {
      result.current.cancelEditSelfEmployed();
    });
    expect(result.current.selfEmployedInEditMode).toBe(false);
  });

  it('handleSave returns false when netIncome exceeds grossIncome', async () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.handleInputChange('grossIncome', 1000);
      result.current.handleInputChange('netIncome', 2000);
    });
    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleSave();
    });
    expect(returned).toBe(false);
    expect(result.current.incomeValidationError.length).toBeGreaterThan(0);
  });

  it('handleSave returns false when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    let returned: boolean | undefined;
    await act(async () => {
      returned = await result.current.handleSave();
    });
    expect(returned).toBe(false);
  });

  it('isDirty is false initially', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(result.current.isDirty).toBe(false);
  });

  it('totalAssets and totalLiabilities are numbers', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    expect(typeof result.current.totalAssets).toBe('number');
    expect(typeof result.current.totalLiabilities).toBe('number');
    expect(typeof result.current.netWorth).toBe('number');
  });

  it('resetRiskAssessment resets all question scores', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.updateRiskQuestion(1, 5);
      result.current.updateRiskQuestion(2, 3);
    });
    act(() => {
      result.current.resetRiskAssessment();
    });
    expect(result.current.profileData.riskAssessment.question1).toBe(0);
    expect(result.current.profileData.riskAssessment.question2).toBe(0);
  });

  it('auto-enables selfEmployedInEditMode when switching to self-employed with empty fields', () => {
    const { result } = renderHook(() => useProfileManager(DEFAULT_INPUT));
    act(() => {
      result.current.handleInputChange('employmentStatus', 'self-employed');
      result.current.handleInputChange('selfEmployedIndustry', '');
      result.current.handleInputChange('selfEmployedDescription', '');
    });
    expect(result.current.selfEmployedInEditMode).toBe(true);
  });
});
