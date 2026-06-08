/**
 * useSocialMediaAI — unit tests
 *
 * Tests the React Query hook for AI social media content generation.
 * Mocks @tanstack/react-query, socialMediaAIApi, socialMediaKeys, and sonner.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock socialMediaAIApi
// ---------------------------------------------------------------------------
const mockGeneratePostText = vi.fn();
const mockGenerateImage = vi.fn();
const mockGenerateBundle = vi.fn();
const mockGetStatus = vi.fn();
const mockGetHistory = vi.fn();
const mockGetImageHistory = vi.fn();

vi.mock('../../api', () => ({
  socialMediaAIApi: {
    generatePostText: (...args: unknown[]) => mockGeneratePostText(...args),
    generateImage: (...args: unknown[]) => mockGenerateImage(...args),
    generateBundle: (...args: unknown[]) => mockGenerateBundle(...args),
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    getImageHistory: (...args: unknown[]) => mockGetImageHistory(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock socialMediaKeys
// ---------------------------------------------------------------------------
vi.mock('../queryKeys', () => ({
  socialMediaKeys: {
    ai: {
      all: ['social-media', 'ai'],
      status: () => ['social-media', 'ai', 'status'],
      history: () => ['social-media', 'ai', 'history', 20],
      imageHistory: () => ['social-media', 'ai', 'image-history', 20],
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query
// ---------------------------------------------------------------------------
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({
    invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useSocialMediaAI } from '../useSocialMediaAI';

// ---------------------------------------------------------------------------
// Default mock implementations
// ---------------------------------------------------------------------------
function setupDefaultMocks() {
  // useMutation returns a mutation object
  mockUseMutation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    data: undefined,
    reset: vi.fn(),
  });

  // useQuery returns a query object
  mockUseQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSocialMediaAI — hook shape', () => {
  it('returns all expected fields', () => {
    const { result } = renderHook(() => useSocialMediaAI());
    const hook = result.current;

    // Text generation
    expect(typeof hook.generatePostText).toBe('function');
    expect(typeof hook.isGenerating).toBe('boolean');
    expect(hook.generationResult).toBeNull();
    expect(hook.generationError).toBeNull();
    expect(typeof hook.resetGeneration).toBe('function');

    // Image generation
    expect(typeof hook.generateImage).toBe('function');
    expect(typeof hook.isGeneratingImage).toBe('boolean');
    expect(hook.imageResult).toBeNull();
    expect(hook.imageError).toBeNull();
    expect(typeof hook.resetImageGeneration).toBe('function');

    // Bundle generation
    expect(typeof hook.generateBundle).toBe('function');
    expect(typeof hook.isGeneratingBundle).toBe('boolean');
    expect(hook.bundleResult).toBeNull();
    expect(hook.bundleError).toBeNull();
    expect(typeof hook.resetBundle).toBe('function');

    // Status
    expect(typeof hook.isConfigured).toBe('boolean');
    expect(typeof hook.statusLoading).toBe('boolean');

    // History
    expect(Array.isArray(hook.history)).toBe(true);
    expect(typeof hook.historyLoading).toBe('boolean');

    // Image history
    expect(Array.isArray(hook.imageHistory)).toBe(true);
    expect(typeof hook.imageHistoryLoading).toBe('boolean');
  });
});

describe('useSocialMediaAI — mutation setup', () => {
  it('calls useMutation three times (text, image, bundle)', () => {
    renderHook(() => useSocialMediaAI());
    expect(mockUseMutation).toHaveBeenCalledTimes(3);
  });

  it('calls useQuery three times (status, history, imageHistory)', () => {
    renderHook(() => useSocialMediaAI());
    expect(mockUseQuery).toHaveBeenCalledTimes(3);
  });

  it('text mutation mutationFn calls socialMediaAIApi.generatePostText', async () => {
    renderHook(() => useSocialMediaAI());

    // Extract the config passed to the first useMutation call
    const textMutationConfig = mockUseMutation.mock.calls[0][0] as {
      mutationFn: (input: unknown) => Promise<unknown>;
    };
    const input = { platform: 'linkedin', topic: 'AI' };
    mockGeneratePostText.mockResolvedValueOnce({ success: true, data: { text: 'Hello' } });

    await textMutationConfig.mutationFn(input);
    expect(mockGeneratePostText).toHaveBeenCalledWith(input);
  });

  it('image mutation mutationFn calls socialMediaAIApi.generateImage', async () => {
    renderHook(() => useSocialMediaAI());

    const imageMutationConfig = mockUseMutation.mock.calls[1][0] as {
      mutationFn: (input: unknown) => Promise<unknown>;
    };
    const input = { prompt: 'a sunset' };
    mockGenerateImage.mockResolvedValueOnce({ success: true, data: { imageUrl: 'http://img' } });

    await imageMutationConfig.mutationFn(input);
    expect(mockGenerateImage).toHaveBeenCalledWith(input);
  });

  it('bundle mutation mutationFn calls socialMediaAIApi.generateBundle', async () => {
    renderHook(() => useSocialMediaAI());

    const bundleMutationConfig = mockUseMutation.mock.calls[2][0] as {
      mutationFn: (input: unknown) => Promise<unknown>;
    };
    const input = { topic: 'Finance', platform: 'twitter' };
    mockGenerateBundle.mockResolvedValueOnce({ success: true, data: {} });

    await bundleMutationConfig.mutationFn(input);
    expect(mockGenerateBundle).toHaveBeenCalledWith(input);
  });
});

describe('useSocialMediaAI — mutation onSuccess callbacks', () => {
  it('text onSuccess shows toast.success and invalidates queries when response.success=true', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[0][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: true });

    expect(mockToastSuccess).toHaveBeenCalledWith('AI content generated successfully');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('text onSuccess shows toast.error when response.success=false', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[0][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: false, error: 'Bad request' });

    expect(mockToastError).toHaveBeenCalledWith('Bad request');
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it('text onSuccess uses fallback error message when error field is missing', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[0][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: false });

    expect(mockToastError).toHaveBeenCalledWith('Failed to generate content');
  });

  it('text onError shows formatted toast.error', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[0][0] as {
      onError: (error: Error) => void;
    };
    config.onError(new Error('timeout'));

    expect(mockToastError).toHaveBeenCalledWith('AI generation failed: timeout');
  });

  it('image onSuccess shows toast.success and invalidates queries when success=true', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[1][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: true });

    expect(mockToastSuccess).toHaveBeenCalledWith('AI image generated successfully');
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('image onSuccess shows toast.error when success=false', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[1][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: false, error: 'Image generation failed' });

    expect(mockToastError).toHaveBeenCalledWith('Image generation failed');
  });

  it('image onError shows formatted toast.error', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[1][0] as {
      onError: (error: Error) => void;
    };
    config.onError(new Error('quota exceeded'));

    expect(mockToastError).toHaveBeenCalledWith('Image generation failed: quota exceeded');
  });

  it('bundle onSuccess shows toast.success and invalidates queries when success=true', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[2][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: true });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Content bundle generated successfully (text + image)',
    );
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it('bundle onSuccess shows toast.error when success=false', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[2][0] as {
      onSuccess: (response: unknown) => void;
    };
    config.onSuccess({ success: false, error: 'Bundle error' });

    expect(mockToastError).toHaveBeenCalledWith('Bundle error');
  });

  it('bundle onError shows formatted toast.error', () => {
    renderHook(() => useSocialMediaAI());

    const config = mockUseMutation.mock.calls[2][0] as {
      onError: (error: Error) => void;
    };
    config.onError(new Error('server error'));

    expect(mockToastError).toHaveBeenCalledWith('Bundle generation failed: server error');
  });
});

describe('useSocialMediaAI — query setup', () => {
  it('status query uses the correct queryKey and calls socialMediaAIApi.getStatus', async () => {
    renderHook(() => useSocialMediaAI());

    const statusQueryConfig = mockUseQuery.mock.calls[0][0] as {
      queryKey: unknown;
      queryFn: () => Promise<unknown>;
      staleTime: number;
    };

    expect(statusQueryConfig.queryKey).toEqual(['social-media', 'ai', 'status']);
    expect(statusQueryConfig.staleTime).toBe(5 * 60 * 1000);

    mockGetStatus.mockResolvedValueOnce({ success: true, data: { configured: true } });
    await statusQueryConfig.queryFn();
    expect(mockGetStatus).toHaveBeenCalled();
  });

  it('history query uses the correct queryKey and calls socialMediaAIApi.getHistory', async () => {
    renderHook(() => useSocialMediaAI());

    const historyQueryConfig = mockUseQuery.mock.calls[1][0] as {
      queryKey: unknown;
      queryFn: () => Promise<unknown>;
      staleTime: number;
    };

    expect(historyQueryConfig.queryKey).toEqual(['social-media', 'ai', 'history', 20]);
    expect(historyQueryConfig.staleTime).toBe(30 * 1000);

    mockGetHistory.mockResolvedValueOnce({ success: true, data: [] });
    await historyQueryConfig.queryFn();
    expect(mockGetHistory).toHaveBeenCalled();
  });

  it('imageHistory query uses the correct queryKey and calls socialMediaAIApi.getImageHistory', async () => {
    renderHook(() => useSocialMediaAI());

    const imageHistoryQueryConfig = mockUseQuery.mock.calls[2][0] as {
      queryKey: unknown;
      queryFn: () => Promise<unknown>;
      staleTime: number;
    };

    expect(imageHistoryQueryConfig.queryKey).toEqual(['social-media', 'ai', 'image-history', 20]);
    expect(imageHistoryQueryConfig.staleTime).toBe(30 * 1000);

    mockGetImageHistory.mockResolvedValueOnce({ success: true, data: [] });
    await imageHistoryQueryConfig.queryFn();
    expect(mockGetImageHistory).toHaveBeenCalled();
  });
});

describe('useSocialMediaAI — derived values from query data', () => {
  it('isConfigured is false when statusQuery has no data', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.isConfigured).toBe(false);
  });

  it('isConfigured reflects statusQuery.data.data.configured', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { data: { configured: true } }, isLoading: false })
      .mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.isConfigured).toBe(true);
  });

  it('history falls back to empty array when historyQuery data is undefined', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: false }) // status
      .mockReturnValueOnce({ data: undefined, isLoading: false }) // history
      .mockReturnValueOnce({ data: undefined, isLoading: false }); // imageHistory

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.history).toEqual([]);
  });

  it('imageHistory falls back to empty array when imageHistoryQuery data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.imageHistory).toEqual([]);
  });

  it('statusLoading reflects query.isLoading', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: undefined, isLoading: true })
      .mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.statusLoading).toBe(true);
  });
});

describe('useSocialMediaAI — derived values from mutation data', () => {
  it('generationResult is the data when mutation succeeded', () => {
    const textData = { text: 'Generated text', platform: 'linkedin' };
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: { success: true, data: textData },
        reset: vi.fn(),
      })
      .mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.generationResult).toEqual(textData);
  });

  it('generationResult is null when mutation data has success=false', () => {
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: { success: false, error: 'Failed' },
        reset: vi.fn(),
      })
      .mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.generationResult).toBeNull();
  });

  it('generationError is populated when mutation has error', () => {
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: { success: false, error: 'Content error' },
        reset: vi.fn(),
      })
      .mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.generationError).toBe('Content error');
  });

  it('isGenerating reflects text mutation isPending', () => {
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: true,
        data: undefined,
        reset: vi.fn(),
      })
      .mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.isGenerating).toBe(true);
  });

  it('isGeneratingImage reflects image mutation isPending', () => {
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      })
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: true,
        data: undefined,
        reset: vi.fn(),
      })
      .mockReturnValue({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.isGeneratingImage).toBe(true);
  });

  it('isGeneratingBundle reflects bundle mutation isPending', () => {
    mockUseMutation
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      })
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: false,
        data: undefined,
        reset: vi.fn(),
      })
      .mockReturnValueOnce({
        mutateAsync: vi.fn(),
        isPending: true,
        data: undefined,
        reset: vi.fn(),
      });

    const { result } = renderHook(() => useSocialMediaAI());
    expect(result.current.isGeneratingBundle).toBe(true);
  });
});
