/**
 * Tests for useOnboarding hook.
 *
 * The hook manages a 5-step onboarding wizard:
 *  - loads from server on mount
 *  - debounced server save on field change
 *  - step navigation (next / back)
 *  - field updates
 *  - submission
 *
 * We mock every external dependency so no network calls go out.
 *
 * NOTE on mock paths: vi.mock paths are resolved relative to the test file.
 * This test is in hooks/__tests__/, one level deeper than the source.
 * - AuthContext is at src/components/auth/AuthContext  →  ../../../../auth/AuthContext
 * - applicationService is at src/utils/services/applicationService
 *   →  ../../../../../utils/services/applicationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../useOnboarding';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockCompleteApplication = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockGetApplication = vi.fn();
const mockSaveApplicationProgress = vi.fn();
const mockSubmitApplication = vi.fn();

vi.mock('../../../../../utils/services/applicationService', () => ({
  getApplication: (...args: unknown[]) => mockGetApplication(...args),
  saveApplicationProgress: (...args: unknown[]) => mockSaveApplicationProgress(...args),
  submitApplication: (...args: unknown[]) => mockSubmitApplication(...args),
}));

vi.mock('../../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

vi.mock('../../../../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_USER = {
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
};

function setupDefaultAuth(user = DEFAULT_USER) {
  mockUseAuth.mockReturnValue({
    user,
    completeApplication: mockCompleteApplication,
  });
}

/**
 * Build minimal valid step-1 data so goToNextStep succeeds validation.
 * SA ID number '9001015009087' passes the 13-digit check.
 */
function makeValidStep1() {
  return {
    title: 'Mr',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    nationality: 'South African',
    idType: 'sa_id' as const,
    idNumber: '9001015009087',
    maritalStatus: 'Single',
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultAuth();
  // Default: no application on server — fast resolve
  mockGetApplication.mockResolvedValue({ success: false });
  mockSaveApplicationProgress.mockResolvedValue({ success: true });
  mockSubmitApplication.mockResolvedValue({ success: true });
  mockCompleteApplication.mockResolvedValue(undefined);
  vi.stubGlobal('scrollTo', vi.fn());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useOnboarding — initial state', () => {
  it('starts at step 1', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe(1);
  });

  it('has 5 total steps', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.totalSteps).toBe(5);
  });

  it('starts with isLoading false', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.isLoading).toBe(false);
  });

  it('starts with empty validationErrors', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.validationErrors).toEqual([]);
  });

  it('starts with saveStatus idle', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.saveStatus).toBe('idle');
  });

  it('starts with lastSavedAt null', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('starts with applicationId null', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.applicationId).toBeNull();
  });

  it('has correct progress at step 1 (20%)', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.progress).toBe(20); // 1/5 * 100
  });

  it('defaults to client mode', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.mode).toBe('client');
  });
});

describe('useOnboarding — load from server', () => {
  it('sets isInitialLoad to true during fetch, then false after', async () => {
    let resolveGet!: (v: unknown) => void;
    mockGetApplication.mockReturnValueOnce(new Promise((res) => (resolveGet = res)));

    const { result } = renderHook(() => useOnboarding());

    // isInitialLoad is immediately true on mount when userId is present
    expect(result.current.isInitialLoad).toBe(true);

    await act(async () => {
      resolveGet({ success: false });
    });

    expect(result.current.isInitialLoad).toBe(false);
  });

  it('populates data and step from server response', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          firstName: 'Jane',
          lastName: 'Doe',
          currentStep: 3,
        },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.data.firstName).toBe('Jane');
    expect(result.current.currentStep).toBe(3);
    expect(result.current.applicationId).toBe('app-1');
  });

  it('uses heuristic step when currentStep is absent but emailAddress present', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-2',
        application_data: {
          firstName: 'Bob',
          lastName: 'Jones',
          emailAddress: 'bob@example.com',
          cellphoneNumber: '0821234567',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    // Has emailAddress + cellphone → heuristic gives step 3
    expect(result.current.currentStep).toBe(3);
  });

  it('sets isInitialLoad false when no user is present', async () => {
    setupDefaultAuth({ ...DEFAULT_USER, id: undefined as unknown as string });
    mockUseAuth.mockReturnValue({ user: null, completeApplication: mockCompleteApplication });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.isInitialLoad).toBe(false);
    expect(mockGetApplication).not.toHaveBeenCalled();
  });

  it('calls getApplication with the user id', async () => {
    const { result: _r } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(mockGetApplication).toHaveBeenCalledWith(DEFAULT_USER.id);
  });

  it('pre-fills name/email from user when no app data exists on server', async () => {
    mockGetApplication.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.data.firstName).toBe('Alice');
    expect(result.current.data.lastName).toBe('Smith');
    expect(result.current.data.emailAddress).toBe('alice@example.com');
  });

  it('uses heuristic step 2 when firstName/lastName present but no email', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-3',
        application_data: {
          firstName: 'Sue',
          lastName: 'Lee',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.currentStep).toBe(2);
  });
});

describe('useOnboarding — updateData', () => {
  it('updates a field in data', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    act(() => {
      result.current.updateData('firstName', 'Robert');
    });

    expect(result.current.data.firstName).toBe('Robert');
  });

  it('clears validationErrors on update', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    // Trigger validation errors by attempting to advance with empty required fields
    await act(async () => {
      await result.current.goToNextStep();
    });
    expect(result.current.validationErrors.length).toBeGreaterThan(0);

    act(() => {
      result.current.updateData('firstName', 'Alice');
    });
    expect(result.current.validationErrors).toEqual([]);
  });

  it('can update an array field', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    act(() => {
      result.current.updateData('accountReasons', ['Investment Management', 'Tax Planning']);
    });

    expect(result.current.data.accountReasons).toEqual(['Investment Management', 'Tax Planning']);
  });
});

describe('useOnboarding — goToNextStep', () => {
  it('does NOT advance when validation fails (step 1 with empty required fields)', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    await act(async () => {
      await result.current.goToNextStep();
    });

    expect(result.current.currentStep).toBe(1);
    expect(result.current.validationErrors.length).toBeGreaterThan(0);
  });

  it('advances to step 2 when step-1 data is valid', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    const valid = makeValidStep1();
    act(() => {
      Object.entries(valid).forEach(([k, v]) => {
        result.current.updateData(k as keyof typeof valid, v as never);
      });
    });

    await act(async () => {
      await result.current.goToNextStep();
    });

    expect(result.current.currentStep).toBe(2);
    expect(result.current.validationErrors).toEqual([]);
  });

  it('calls saveApplicationProgress on valid next-step', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    // Clear any calls from the initial load phase
    mockSaveApplicationProgress.mockClear();

    const valid = makeValidStep1();
    act(() => {
      Object.entries(valid).forEach(([k, v]) => {
        result.current.updateData(k as keyof typeof valid, v as never);
      });
    });

    await act(async () => {
      await result.current.goToNextStep();
    });

    expect(mockSaveApplicationProgress).toHaveBeenCalled();
  });

  it('does not advance beyond step 5', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding({ mode: 'admin', targetUserId: 'target-1' }));
    await act(async () => {});

    expect(result.current.currentStep).toBe(5);

    // Step 5 validation will pass → but we shouldn't go to step 6
    await act(async () => {
      await result.current.goToNextStep();
    });

    expect(result.current.currentStep).toBe(5);
  });
});

describe('useOnboarding — goToPreviousStep', () => {
  it('does not go below step 1', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    await act(async () => {
      await result.current.goToPreviousStep();
    });

    expect(result.current.currentStep).toBe(1);
  });

  it('goes back from step 2 to step 1', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 2, firstName: 'Alice', lastName: 'Smith' },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});
    expect(result.current.currentStep).toBe(2);

    await act(async () => {
      await result.current.goToPreviousStep();
    });

    expect(result.current.currentStep).toBe(1);
  });

  it('clears validationErrors on back navigation', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 2, firstName: 'Alice', lastName: 'Smith' },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    // Trigger validation errors
    await act(async () => {
      await result.current.goToNextStep();
    });
    expect(result.current.validationErrors.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.goToPreviousStep();
    });

    expect(result.current.validationErrors).toEqual([]);
  });

  it('calls saveApplicationProgress on back navigation', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 2, firstName: 'Alice', lastName: 'Smith' },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    mockSaveApplicationProgress.mockClear();

    await act(async () => {
      await result.current.goToPreviousStep();
    });

    expect(mockSaveApplicationProgress).toHaveBeenCalled();
  });
});

describe('useOnboarding — submit', () => {
  it('returns { success: false } when step validation fails (empty step-1 fields)', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    expect(returned).toEqual({ success: false });
    expect(mockSubmitApplication).not.toHaveBeenCalled();
  });

  it('calls submitApplication when step 5 is valid', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    expect(mockSubmitApplication).toHaveBeenCalled();
    expect(returned).toEqual({ success: true });
  });

  it('calls completeApplication after successful submission in client mode', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding({ mode: 'client' }));
    await act(async () => {});

    await act(async () => {
      await result.current.submit();
    });

    expect(mockCompleteApplication).toHaveBeenCalledWith({
      accountStatus: 'submitted_for_review',
    });
  });

  it('does NOT call completeApplication in admin mode', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });

    const { result } = renderHook(() => useOnboarding({ mode: 'admin', targetUserId: 'target-1' }));
    await act(async () => {});

    await act(async () => {
      await result.current.submit();
    });

    expect(mockCompleteApplication).not.toHaveBeenCalled();
  });

  it('returns { success: false, error } when submitApplication returns failure', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });
    mockSubmitApplication.mockResolvedValueOnce({
      success: false,
      error: 'Server error',
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submit();
    });

    // submitApplication returns { success: false } → hook throws, sets validationErrors
    expect((returned as { success: boolean }).success).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading false even when submitApplication throws', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });
    mockSubmitApplication.mockRejectedValueOnce(new Error('Network failure'));

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('stores error message in validationErrors on failure', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: {
          currentStep: 5,
          firstName: 'John',
          middleName: '',
          lastName: 'Doe',
          termsAccepted: true,
          popiaConsent: true,
          disclosureAcknowledged: true,
          faisAcknowledged: true,
          signatureFullName: 'John Doe',
        },
      },
    });
    mockSubmitApplication.mockRejectedValueOnce(new Error('Duplicate application'));

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.validationErrors).toContain('Duplicate application');
  });
});

describe('useOnboarding — saveNow', () => {
  it('calls saveApplicationProgress after initial load completes', async () => {
    mockGetApplication.mockResolvedValueOnce({ success: false });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {}); // Let initial load finish

    // Mutate data so the dedup check doesn't skip the save
    act(() => {
      result.current.updateData('firstName', 'NewName');
    });

    // Reset call count
    mockSaveApplicationProgress.mockClear();

    await act(async () => {
      await result.current.saveNow();
    });

    expect(mockSaveApplicationProgress).toHaveBeenCalled();
  });
});

describe('useOnboarding — admin mode', () => {
  it('uses targetUserId as the effective user', async () => {
    const { result: _r } = renderHook(() =>
      useOnboarding({ mode: 'admin', targetUserId: 'target-user-99' }),
    );
    await act(async () => {});

    expect(mockGetApplication).toHaveBeenCalledWith('target-user-99');
  });

  it('reports mode as admin', async () => {
    const { result } = renderHook(() =>
      useOnboarding({ mode: 'admin', targetUserId: 'target-user-99' }),
    );
    expect(result.current.mode).toBe('admin');
  });
});

describe('useOnboarding — saveStatus transitions', () => {
  it('sets saveStatus to saved after a successful saveNow', async () => {
    mockGetApplication.mockResolvedValueOnce({ success: false });
    mockSaveApplicationProgress.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {}); // initial load

    // Mutate so dedup allows the save
    act(() => {
      result.current.updateData('firstName', 'TriggerSave');
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
  });

  it('sets saveStatus to error on save failure', async () => {
    mockGetApplication.mockResolvedValueOnce({ success: false });
    mockSaveApplicationProgress.mockResolvedValueOnce({ success: false, error: 'DB error' });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {}); // initial load

    // Mutate so dedup allows the save
    act(() => {
      result.current.updateData('firstName', 'TriggerSave');
    });

    await act(async () => {
      await result.current.saveNow();
    });

    expect(result.current.saveStatus).toBe('error');
  });
});

describe('useOnboarding — progress calculation', () => {
  it('returns 40 at step 2', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 2 },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.progress).toBe(40);
  });

  it('returns 100 at step 5', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 5 },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.progress).toBe(100);
  });

  it('returns 60 at step 3', async () => {
    mockGetApplication.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'app-1',
        application_data: { currentStep: 3 },
      },
    });

    const { result } = renderHook(() => useOnboarding());
    await act(async () => {});

    expect(result.current.progress).toBe(60);
  });
});
