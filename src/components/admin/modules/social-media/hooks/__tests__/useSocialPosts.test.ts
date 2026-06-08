import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSocialPosts } from '../useSocialPosts';

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

const mockPostsApiGetAll = vi.fn();
const mockPostsApiCreate = vi.fn();
const mockPostsApiUpdate = vi.fn();
const mockPostsApiDelete = vi.fn();
const mockPostsApiSchedule = vi.fn();
const mockPostsApiPublish = vi.fn();
const mockPostsApiDuplicate = vi.fn();
const mockPostsApiCancelSchedule = vi.fn();
const mockPostsApiGetByDateRange = vi.fn();

vi.mock('../../api', () => ({
  postsApi: {
    getAll: (...args: unknown[]) => mockPostsApiGetAll(...args),
    create: (...args: unknown[]) => mockPostsApiCreate(...args),
    update: (...args: unknown[]) => mockPostsApiUpdate(...args),
    delete: (...args: unknown[]) => mockPostsApiDelete(...args),
    schedule: (...args: unknown[]) => mockPostsApiSchedule(...args),
    publish: (...args: unknown[]) => mockPostsApiPublish(...args),
    duplicate: (...args: unknown[]) => mockPostsApiDuplicate(...args),
    cancelSchedule: (...args: unknown[]) => mockPostsApiCancelSchedule(...args),
    getByDateRange: (...args: unknown[]) => mockPostsApiGetByDateRange(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  socialMediaKeys: {
    posts: {
      all: ['social-media', 'posts'],
      list: (filters: unknown) => ['social-media', 'posts', 'list', filters],
    },
  },
}));

const MOCK_POST = {
  id: 'p-001',
  content: 'Hello social media',
  status: 'draft' as const,
  createdAt: '2025-01-01',
};

function makeQueryResult(data: unknown = [], loading = false) {
  return { data, isLoading: loading, isError: false, error: null, isFetching: false };
}

function makeMutationResult() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue(makeQueryResult([MOCK_POST]));
  mockUseMutation.mockReturnValue(makeMutationResult());
});

describe('useSocialPosts', () => {
  describe('initialization', () => {
    it('returns posts from query result', () => {
      const { result } = renderHook(() => useSocialPosts());
      expect(result.current.posts).toEqual([MOCK_POST]);
    });

    it('returns empty posts when query has no data', () => {
      mockUseQuery.mockReturnValue(makeQueryResult(undefined));
      const { result } = renderHook(() => useSocialPosts());
      expect(result.current.posts).toEqual([]);
    });

    it('reflects loading state from query', () => {
      mockUseQuery.mockReturnValue(makeQueryResult([], true));
      const { result } = renderHook(() => useSocialPosts());
      expect(result.current.loading).toBe(true);
    });

    it('initializes with empty filters by default', () => {
      const { result } = renderHook(() => useSocialPosts());
      expect(result.current.filters).toEqual({});
    });

    it('initializes with provided initialFilters', () => {
      const { result } = renderHook(() =>
        useSocialPosts({ initialFilters: { status: 'published' } }),
      );
      expect(result.current.filters).toEqual({ status: 'published' });
    });
  });

  describe('setFilters', () => {
    it('updates filters state', () => {
      const { result } = renderHook(() => useSocialPosts());
      act(() => {
        result.current.setFilters({ status: 'draft' });
      });
      expect(result.current.filters).toEqual({ status: 'draft' });
    });
  });

  describe('clearFilters', () => {
    it('resets filters to empty object', () => {
      const { result } = renderHook(() =>
        useSocialPosts({ initialFilters: { status: 'published' } }),
      );
      act(() => {
        result.current.clearFilters();
      });
      expect(result.current.filters).toEqual({});
    });
  });

  describe('getPostById', () => {
    it('returns matching post', () => {
      const { result } = renderHook(() => useSocialPosts());
      const post = result.current.getPostById('p-001');
      expect(post).toEqual(MOCK_POST);
    });

    it('returns undefined for non-existent post', () => {
      const { result } = renderHook(() => useSocialPosts());
      expect(result.current.getPostById('x-999')).toBeUndefined();
    });
  });

  describe('getPostsByStatus', () => {
    it('returns posts matching status', () => {
      const { result } = renderHook(() => useSocialPosts());
      const drafts = result.current.getPostsByStatus('draft');
      expect(drafts).toHaveLength(1);
      expect(drafts[0].id).toBe('p-001');
    });

    it('returns empty array when no posts match status', () => {
      const { result } = renderHook(() => useSocialPosts());
      const published = result.current.getPostsByStatus('published');
      expect(published).toHaveLength(0);
    });
  });

  describe('createPost', () => {
    it('calls mutateAsync from create mutation', async () => {
      const mockMutateAsync = vi.fn().mockResolvedValue(MOCK_POST);
      mockUseMutation.mockReturnValueOnce({
        ...makeMutationResult(),
        mutateAsync: mockMutateAsync,
      });
      // Other mutations use default mock
      mockUseMutation.mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialPosts());
      const post = await result.current.createPost({ content: 'New post' } as never);
      expect(mockMutateAsync).toHaveBeenCalledWith({ content: 'New post' });
      expect(post).toEqual(MOCK_POST);
    });

    it('returns null when mutation throws', async () => {
      const mockMutateAsync = vi.fn().mockRejectedValue(new Error('Create failed'));
      mockUseMutation.mockReturnValueOnce({
        ...makeMutationResult(),
        mutateAsync: mockMutateAsync,
      });
      mockUseMutation.mockReturnValue(makeMutationResult());
      const { result } = renderHook(() => useSocialPosts());
      const post = await result.current.createPost({ content: 'New post' } as never);
      expect(post).toBeNull();
    });
  });

  describe('mutation functions via mutationFn extraction', () => {
    it('postsQuery queryFn resolves posts from API', async () => {
      mockPostsApiGetAll.mockResolvedValue({ success: true, data: [MOCK_POST] });
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([MOCK_POST]);
      });
      renderHook(() => useSocialPosts());
      const config = capturedConfig.mock.calls[0][0];
      const data = await config.queryFn();
      expect(data).toEqual([MOCK_POST]);
    });

    it('postsQuery queryFn throws when API returns error', async () => {
      mockPostsApiGetAll.mockResolvedValue({ success: false, error: 'Fetch failed' });
      const capturedConfig = vi.fn();
      mockUseQuery.mockImplementation((config) => {
        capturedConfig(config);
        return makeQueryResult([]);
      });
      renderHook(() => useSocialPosts());
      const config = capturedConfig.mock.calls[0][0];
      await expect(config.queryFn()).rejects.toThrow('Fetch failed');
    });

    it('createMutation mutationFn calls postsApi.create', async () => {
      mockPostsApiCreate.mockResolvedValue({ success: true, data: MOCK_POST });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialPosts());
      const createConfig = capturedMutations[0] as { mutationFn: (d: unknown) => Promise<unknown> };
      const result = await createConfig.mutationFn({ content: 'Test' });
      expect(result).toEqual(MOCK_POST);
    });

    it('deleteMutation mutationFn calls postsApi.delete', async () => {
      mockPostsApiDelete.mockResolvedValue({ success: true });
      const capturedMutations: unknown[] = [];
      mockUseMutation.mockImplementation((config) => {
        capturedMutations.push(config);
        return makeMutationResult();
      });
      renderHook(() => useSocialPosts());
      const deleteConfig = capturedMutations[2] as { mutationFn: (id: string) => Promise<void> };
      await expect(deleteConfig.mutationFn('p-001')).resolves.toBeUndefined();
    });
  });

  describe('getPostsByDateRange', () => {
    it('calls postsApi.getByDateRange and returns posts', async () => {
      mockPostsApiGetByDateRange.mockResolvedValue({ success: true, data: [MOCK_POST] });
      const { result } = renderHook(() => useSocialPosts());
      const start = new Date('2025-01-01');
      const end = new Date('2025-01-31');
      const posts = await result.current.getPostsByDateRange(start, end);
      expect(posts).toEqual([MOCK_POST]);
    });

    it('returns empty array when date range API returns no data', async () => {
      mockPostsApiGetByDateRange.mockResolvedValue({ success: false });
      const { result } = renderHook(() => useSocialPosts());
      const posts = await result.current.getPostsByDateRange(new Date(), new Date());
      expect(posts).toEqual([]);
    });
  });
});
