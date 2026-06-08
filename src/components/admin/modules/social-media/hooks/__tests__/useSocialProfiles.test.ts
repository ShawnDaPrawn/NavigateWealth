import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocialProfiles } from '../useSocialProfiles';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = vi.fn();
const mockQueryClient = { invalidateQueries: mockInvalidateQueries };

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockProfilesApiGetAll = vi.fn();
const mockProfilesApiConnect = vi.fn();
const mockProfilesApiDisconnect = vi.fn();
const mockProfilesApiUpdate = vi.fn();
const mockProfilesApiSync = vi.fn();
const mockProfilesApiDelete = vi.fn();

vi.mock('../../api', () => ({
  profilesApi: {
    getAll: (...args: unknown[]) => mockProfilesApiGetAll(...args),
    connect: (...args: unknown[]) => mockProfilesApiConnect(...args),
    disconnect: (...args: unknown[]) => mockProfilesApiDisconnect(...args),
    update: (...args: unknown[]) => mockProfilesApiUpdate(...args),
    sync: (...args: unknown[]) => mockProfilesApiSync(...args),
    delete: (...args: unknown[]) => mockProfilesApiDelete(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  socialMediaKeys: {
    profiles: {
      all: ['social-media', 'profiles'],
      lists: () => ['social-media', 'profiles', 'list'],
      detail: (id: string) => ['social-media', 'profiles', 'detail', id],
    },
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  id: 'prof-001',
  platform: 'x' as const,
  isConnected: true,
  username: 'testuser',
};

const MOCK_DISCONNECTED_PROFILE = {
  id: 'prof-002',
  platform: 'instagram' as const,
  isConnected: false,
  username: 'testuser2',
};

function makeQueryResult(data: unknown = [], loading = false, error: Error | null = null) {
  return {
    data,
    isLoading: loading,
    isError: error !== null,
    error,
    isFetching: false,
  };
}

function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([MOCK_PROFILE, MOCK_DISCONNECTED_PROFILE]));
  mockUseMutation.mockReturnValue(makeMutationResult());
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSocialProfiles', () => {
  describe('initialization', () => {
    it('returns profiles from query result', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.profiles).toEqual([MOCK_PROFILE, MOCK_DISCONNECTED_PROFILE]);
    });

    it('returns empty profiles when query has no data', () => {
      mockUseQuery.mockReturnValue(makeQueryResult(undefined));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.profiles).toEqual([]);
    });

    it('reflects loading state from query', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([], true));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.loading).toBe(true);
    });

    it('reflects loading state as false when not loading', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.loading).toBe(false);
    });

    it('reflects loading true when a mutation is pending', () => {
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult({ isPending: true })) // connectMutation
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.loading).toBe(true);
    });

    it('returns null error when query succeeds', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.error).toBeNull();
    });

    it('returns error message when query fails with Error instance', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([], false, new Error('Network error')));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.error).toBe('Network error');
    });

    it('returns fallback error message when query error is not an Error instance', () => {
      mockUseQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: true,
        error: 'string error',
        isFetching: false,
      });
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.error).toBe('Failed to fetch profiles');
    });
  });

  describe('connectedProfiles (derived state)', () => {
    it('returns only connected profiles', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.connectedProfiles).toEqual([MOCK_PROFILE]);
    });

    it('returns empty array when no profiles are connected', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([MOCK_DISCONNECTED_PROFILE]));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.connectedProfiles).toEqual([]);
    });

    it('returns all profiles when all are connected', () => {
      const allConnected = [
        { ...MOCK_PROFILE, id: 'a' },
        { ...MOCK_PROFILE, id: 'b' },
      ];
      mockUseQuery.mockReturnValue(makeQueryResult(allConnected));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.connectedProfiles).toHaveLength(2);
    });
  });

  describe('getProfileById', () => {
    it('returns the matching profile', () => {
      const { result } = renderHook(() => useSocialProfiles());
      const profile = result.current.getProfileById('prof-001');
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('returns undefined when profile is not found', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.getProfileById('x-999')).toBeUndefined();
    });
  });

  describe('getProfilesByPlatform', () => {
    it('returns profiles matching the given platform', () => {
      const { result } = renderHook(() => useSocialProfiles());
      const profiles = result.current.getProfilesByPlatform('x');
      expect(profiles).toHaveLength(1);
      expect(profiles[0].id).toBe('prof-001');
    });

    it('returns empty array when no profiles match the platform', () => {
      const { result } = renderHook(() => useSocialProfiles());
      const profiles = result.current.getProfilesByPlatform('linkedin' as never);
      expect(profiles).toEqual([]);
    });
  });

  describe('isConnected', () => {
    it('returns true when a connected profile exists for the platform', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.isConnected('x')).toBe(true);
    });

    it('returns false when a profile for the platform is not connected', () => {
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.isConnected('instagram')).toBe(false);
    });

    it('returns false when there are no profiles at all', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([]));
      const { result } = renderHook(() => useSocialProfiles());
      expect(result.current.isConnected('x')).toBe(false);
    });
  });

  describe('fetchProfiles', () => {
    it('calls queryClient.invalidateQueries', async () => {
      const { result } = renderHook(() => useSocialProfiles());
      await act(async () => {
        await result.current.fetchProfiles();
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ['social-media', 'profiles', 'list'],
      });
    });
  });

  describe('connectProfile wrapper', () => {
    it('returns the new profile on success', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(MOCK_PROFILE);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // connectMutation
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const data = { platform: 'x', accessToken: 'tok' };
      const profile = await result.current.connectProfile(data as never);
      expect(mockMutateAsync).toHaveBeenCalledWith(data);
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('returns null when the mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Connect failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const profile = await result.current.connectProfile({ platform: 'x' } as never);
      expect(profile).toBeNull();
    });
  });

  describe('disconnectProfile wrapper', () => {
    it('returns true on success', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // disconnectMutation
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.disconnectProfile('prof-001');
      expect(ok).toBe(true);
      expect(mockMutateAsync).toHaveBeenCalledWith('prof-001');
    });

    it('returns false when the mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Disconnect failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.disconnectProfile('prof-001');
      expect(ok).toBe(false);
    });
  });

  describe('updateProfile wrapper', () => {
    it('returns true on success', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(MOCK_PROFILE);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult()) // disconnectMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // updateMutation
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.updateProfile('prof-001', { username: 'newname' } as never);
      expect(ok).toBe(true);
      expect(mockMutateAsync).toHaveBeenCalledWith({
        profileId: 'prof-001',
        data: { username: 'newname' },
      });
    });

    it('returns false when the mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Update failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult()) // disconnectMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.updateProfile('prof-001', {} as never);
      expect(ok).toBe(false);
    });
  });

  describe('syncProfile wrapper', () => {
    it('returns true on success', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(MOCK_PROFILE);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult()) // disconnectMutation
        .mockReturnValueOnce(makeMutationResult()) // updateMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })) // syncMutation
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.syncProfile('prof-001');
      expect(ok).toBe(true);
      expect(mockMutateAsync).toHaveBeenCalledWith('prof-001');
    });

    it('returns false when the mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Sync failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }))
        .mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.syncProfile('prof-001');
      expect(ok).toBe(false);
    });
  });

  describe('deleteProfile wrapper', () => {
    it('returns true on success', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult()) // connectMutation
        .mockReturnValueOnce(makeMutationResult()) // disconnectMutation
        .mockReturnValueOnce(makeMutationResult()) // updateMutation
        .mockReturnValueOnce(makeMutationResult()) // syncMutation
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync })); // deleteMutation
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.deleteProfile('prof-001');
      expect(ok).toBe(true);
      expect(mockMutateAsync).toHaveBeenCalledWith('prof-001');
    });

    it('returns false when the mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Delete failed'));
      mockUseMutation
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult())
        .mockReturnValueOnce(makeMutationResult({ mutateAsync: mockMutateAsync }));
      const { result } = renderHook(() => useSocialProfiles());
      const ok = await result.current.deleteProfile('prof-001');
      expect(ok).toBe(false);
    });
  });

  describe('queryFn extraction', () => {
    it('queryFn resolves profiles from API', async () => {
      mockProfilesApiGetAll.mockResolvedValue({
        success: true,
        data: [MOCK_PROFILE],
      });
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([MOCK_PROFILE]);
      });
      renderHook(() => useSocialProfiles());
      const config = capturedConfig.mock.calls[0][0];
      const data = await config.queryFn();
      expect(data).toEqual([MOCK_PROFILE]);
    });

    it('queryFn throws when API returns success=false', async () => {
      mockProfilesApiGetAll.mockResolvedValue({
        success: false,
        error: 'Profiles fetch failed',
      });
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useSocialProfiles());
      const config = capturedConfig.mock.calls[0][0];
      await expect(config.queryFn()).rejects.toThrow('Profiles fetch failed');
    });

    it('queryFn throws with default message when API returns no error string', async () => {
      mockProfilesApiGetAll.mockResolvedValue({ success: false });
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useSocialProfiles());
      const config = capturedConfig.mock.calls[0][0];
      await expect(config.queryFn()).rejects.toThrow('Failed to fetch profiles');
    });

    it('queryFn is disabled when fetchOnMount is false', () => {
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useSocialProfiles({ fetchOnMount: false }));
      const config = capturedConfig.mock.calls[0][0];
      expect(config.enabled).toBe(false);
    });
  });

  describe('mutationFn extraction', () => {
    it('connectMutation mutationFn calls profilesApi.connect', async () => {
      mockProfilesApiConnect.mockResolvedValue({ success: true, data: MOCK_PROFILE });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const connectConfig = capturedMutations[0] as {
        mutationFn: (d: unknown) => Promise<unknown>;
      };
      const profile = await connectConfig.mutationFn({ platform: 'x', accessToken: 'tok' });
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('connectMutation mutationFn throws when API returns error', async () => {
      mockProfilesApiConnect.mockResolvedValue({ success: false, error: 'Connect error' });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const connectConfig = capturedMutations[0] as {
        mutationFn: (d: unknown) => Promise<unknown>;
      };
      await expect(connectConfig.mutationFn({ platform: 'x' })).rejects.toThrow('Connect error');
    });

    it('disconnectMutation mutationFn calls profilesApi.disconnect', async () => {
      mockProfilesApiDisconnect.mockResolvedValue({ success: true });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const disconnectConfig = capturedMutations[1] as {
        mutationFn: (id: string) => Promise<void>;
      };
      await expect(disconnectConfig.mutationFn('prof-001')).resolves.toBeUndefined();
    });

    it('disconnectMutation mutationFn throws when API returns error', async () => {
      mockProfilesApiDisconnect.mockResolvedValue({ success: false, error: 'Disconnect error' });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const disconnectConfig = capturedMutations[1] as {
        mutationFn: (id: string) => Promise<void>;
      };
      await expect(disconnectConfig.mutationFn('prof-001')).rejects.toThrow('Disconnect error');
    });

    it('updateMutation mutationFn calls profilesApi.update', async () => {
      mockProfilesApiUpdate.mockResolvedValue({ success: true, data: MOCK_PROFILE });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const updateConfig = capturedMutations[2] as {
        mutationFn: (d: { profileId: string; data: unknown }) => Promise<unknown>;
      };
      const profile = await updateConfig.mutationFn({
        profileId: 'prof-001',
        data: { username: 'new' },
      });
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('syncMutation mutationFn calls profilesApi.sync', async () => {
      mockProfilesApiSync.mockResolvedValue({ success: true, data: MOCK_PROFILE });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const syncConfig = capturedMutations[3] as {
        mutationFn: (id: string) => Promise<unknown>;
      };
      const profile = await syncConfig.mutationFn('prof-001');
      expect(profile).toEqual(MOCK_PROFILE);
    });

    it('deleteMutation mutationFn calls profilesApi.delete', async () => {
      mockProfilesApiDelete.mockResolvedValue({ success: true });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const deleteConfig = capturedMutations[4] as {
        mutationFn: (id: string) => Promise<void>;
      };
      await expect(deleteConfig.mutationFn('prof-001')).resolves.toBeUndefined();
    });
  });

  describe('mutation onSuccess callbacks', () => {
    it('connectMutation onSuccess invalidates profiles and shows toast', async () => {
      const { toast } = await import('sonner');
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const connectConfig = capturedMutations[0] as {
        onSuccess: (data: unknown, variables: { platform: string }) => void;
      };
      connectConfig.onSuccess(MOCK_PROFILE, { platform: 'x' });
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('twitter profile connected successfully');
    });

    it('disconnectMutation onSuccess invalidates profiles and shows toast', async () => {
      const { toast } = await import('sonner');
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const disconnectConfig = capturedMutations[1] as {
        onSuccess: () => void;
      };
      disconnectConfig.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Profile disconnected successfully');
    });

    it('connectMutation onError shows error toast', async () => {
      const { toast } = await import('sonner');
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const connectConfig = capturedMutations[0] as {
        onError: (err: unknown) => void;
      };
      connectConfig.onError(new Error('Auth failed'));
      expect(toast.error).toHaveBeenCalledWith('Auth failed');
    });

    it('deleteMutation onSuccess invalidates profiles and shows toast', async () => {
      const { toast } = await import('sonner');
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialProfiles());
      const deleteConfig = capturedMutations[4] as {
        onSuccess: () => void;
      };
      deleteConfig.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Profile deleted successfully');
    });
  });
});
