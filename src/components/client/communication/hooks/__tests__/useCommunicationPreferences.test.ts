/**
 * Tests for useCommunicationPreferences and useUpdatePreferences hooks.
 *
 * Strategy: mock @tanstack/react-query, useAuth, the commApi module, and
 * communicationKeys. Capture options objects to verify configuration and
 * test callbacks directly.
 *
 * NOTE: paths from __tests__/ need one extra ../ compared to the source file.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

const mockUseAuth = vi.fn();

vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockFetchPreferences = vi.fn();
const mockUpdatePreferences = vi.fn();

vi.mock('../../api', () => ({
  fetchPreferences: (...args: unknown[]) => mockFetchPreferences(...args),
  updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
}));

vi.mock('../queryKeys', () => ({
  communicationKeys: {
    preferences: (userId: string | undefined) => ['communications', 'preferences', userId],
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useCommunicationPreferences, useUpdatePreferences } from '../useCommunicationPreferences';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
}

interface MutationOptions {
  mutationFn: (prefs: unknown) => Promise<unknown>;
  onSuccess: () => void;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useCommunicationPreferences — query configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({});
    mockUseMutation.mockReturnValue({});
  });

  it('queryKey uses communicationKeys.preferences with user id', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    expect(captured!.queryKey).toEqual(['communications', 'preferences', 'user-123']);
  });

  it('queryKey uses undefined user id when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    expect(captured!.queryKey).toEqual(['communications', 'preferences', undefined]);
  });

  it('enabled is true when user is present', () => {
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    expect(captured!.enabled).toBe(true);
  });

  it('enabled is false when user is null', () => {
    mockUseAuth.mockReturnValue({ user: null });
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    expect(captured!.enabled).toBe(false);
  });
});

describe('useCommunicationPreferences — queryFn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({});
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
  });

  it('queryFn returns fetched preferences when they exist', async () => {
    const prefs = {
      transactional: { email: true, sms: false },
      marketing: { email: false, sms: false },
      frequency: 'realtime' as const,
    };
    mockFetchPreferences.mockResolvedValue(prefs);
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    const result = await captured!.queryFn();
    expect(result).toBe(prefs);
  });

  it('queryFn falls back to DEFAULT_PREFERENCES when fetchPreferences returns null', async () => {
    mockFetchPreferences.mockResolvedValue(null);
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    const result = (await captured!.queryFn()) as Record<string, unknown>;
    // DEFAULT_PREFERENCES has transactional.email = true
    expect(result).toHaveProperty('transactional');
    expect(result).toHaveProperty('marketing');
    expect(result).toHaveProperty('frequency');
  });

  it('queryFn calls commApi.fetchPreferences', async () => {
    mockFetchPreferences.mockResolvedValue({});
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    renderHook(() => useCommunicationPreferences());
    await captured!.queryFn();
    expect(mockFetchPreferences).toHaveBeenCalledOnce();
  });
});

describe('useUpdatePreferences — mutation configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({});
    mockUseMutation.mockReturnValue({});
    mockUseAuth.mockReturnValue({ user: { id: 'user-123' } });
  });

  it('mutationFn calls commApi.updatePreferences with provided preferences', async () => {
    const prefs = {
      transactional: { email: true, sms: true },
      marketing: { email: false, sms: false },
      frequency: 'daily' as const,
    };
    mockUpdatePreferences.mockResolvedValue(prefs);
    let captured: MutationOptions | undefined;
    mockUseMutation.mockImplementationOnce((opts: unknown) => {
      captured = opts as MutationOptions;
      return {};
    });
    renderHook(() => useUpdatePreferences());
    await captured!.mutationFn(prefs);
    expect(mockUpdatePreferences).toHaveBeenCalledWith(prefs);
  });

  it('onSuccess invalidates preferences query for current user', () => {
    // Set up auth BEFORE registering the mockImplementationOnce so that the
    // hook closure captures the correct user value when the hook runs.
    mockUseAuth.mockReturnValue({ user: { id: 'user-abc' } });
    mockInvalidateQueries.mockClear();
    let captured: MutationOptions | undefined;
    mockUseMutation.mockImplementationOnce((opts: unknown) => {
      captured = opts as MutationOptions;
      return {};
    });
    renderHook(() => useUpdatePreferences());
    captured!.onSuccess();
    // communicationKeys.preferences('user-abc') = ['communications', 'preferences', 'user-abc']
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['communications', 'preferences', 'user-abc'],
    });
  });

  it('onSuccess with null user passes undefined to communicationKeys.preferences', () => {
    mockUseAuth.mockReturnValue({ user: null });
    let captured: MutationOptions | undefined;
    mockUseMutation.mockImplementationOnce((opts: unknown) => {
      captured = opts as MutationOptions;
      return {};
    });
    renderHook(() => useUpdatePreferences());
    captured!.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['communications', 'preferences', undefined],
    });
  });
});
