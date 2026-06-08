/**
 * Tests for portfolio hooks: usePortfolioSummary, useBookMeeting, useUploadDocument.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
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

const mockFetchPortfolioSummary = vi.fn();
const mockBookMeeting = vi.fn();
const mockUploadDocument = vi.fn();

vi.mock('../api', () => ({
  fetchPortfolioSummary: (...args: unknown[]) => mockFetchPortfolioSummary(...args),
  bookMeeting: (...args: unknown[]) => mockBookMeeting(...args),
  uploadDocument: (...args: unknown[]) => mockUploadDocument(...args),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { usePortfolioSummary, useBookMeeting, useUploadDocument, portfolioKeys } from '../hooks';

// ── Helpers ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
  mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

// ── portfolioKeys ─────────────────────────────────────────────────────────────

describe('portfolioKeys', () => {
  it('all is ["portfolio"]', () => {
    expect(portfolioKeys.all).toEqual(['portfolio']);
  });

  it('summary includes clientId', () => {
    expect(portfolioKeys.summary('client-1')).toEqual(['portfolio', 'summary', 'client-1']);
  });
});

// ── usePortfolioSummary ───────────────────────────────────────────────────────

describe('usePortfolioSummary', () => {
  it('is disabled when clientId is undefined', () => {
    let capturedEnabled: boolean | undefined;
    mockUseQuery.mockImplementation((opts: { enabled?: boolean }) => {
      capturedEnabled = opts.enabled;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => usePortfolioSummary(undefined));
    expect(capturedEnabled).toBe(false);
  });

  it('is enabled when clientId is provided', () => {
    let capturedEnabled: boolean | undefined;
    mockUseQuery.mockImplementation((opts: { enabled?: boolean }) => {
      capturedEnabled = opts.enabled;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => usePortfolioSummary('client-1'));
    expect(capturedEnabled).toBe(true);
  });

  it('uses the correct queryKey', () => {
    let capturedKey: unknown;
    mockUseQuery.mockImplementation((opts: { queryKey: unknown }) => {
      capturedKey = opts.queryKey;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => usePortfolioSummary('client-abc'));
    expect(capturedKey).toEqual(['portfolio', 'summary', 'client-abc']);
  });

  it('uses staleTime of 5 minutes', () => {
    let capturedStaleTime: unknown;
    mockUseQuery.mockImplementation((opts: { staleTime: unknown }) => {
      capturedStaleTime = opts.staleTime;
      return { data: undefined, isLoading: false };
    });

    renderHook(() => usePortfolioSummary('x'));
    expect(capturedStaleTime).toBe(5 * 60 * 1000);
  });

  it('queryFn calls fetchPortfolioSummary', async () => {
    let capturedQueryFn: (() => unknown) | undefined;
    mockUseQuery.mockImplementation((opts: { queryFn?: () => unknown }) => {
      capturedQueryFn = opts.queryFn;
      return { data: undefined, isLoading: false };
    });
    mockFetchPortfolioSummary.mockResolvedValue({ items: [] });

    renderHook(() => usePortfolioSummary('client-1'));
    await capturedQueryFn!();
    expect(mockFetchPortfolioSummary).toHaveBeenCalledWith('client-1');
  });
});

// ── useBookMeeting ────────────────────────────────────────────────────────────

describe('useBookMeeting', () => {
  it('mutationFn calls bookMeeting', async () => {
    let capturedMutationFn: ((input: unknown) => unknown) | undefined;
    mockUseMutation.mockImplementation((opts: { mutationFn?: (input: unknown) => unknown }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutateAsync: vi.fn(), isPending: false };
    });
    mockBookMeeting.mockResolvedValue({ success: true });

    renderHook(() => useBookMeeting());
    await capturedMutationFn!({ date: '2026-01-01' });
    expect(mockBookMeeting).toHaveBeenCalledWith({ date: '2026-01-01' });
  });

  it('onSuccess invalidates portfolio queries', () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockUseMutation.mockImplementation((opts: { onSuccess?: () => void }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useBookMeeting());
    capturedOnSuccess!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: portfolioKeys.all }),
    );
  });
});

// ── useUploadDocument ─────────────────────────────────────────────────────────

describe('useUploadDocument', () => {
  it('mutationFn calls uploadDocument', async () => {
    let capturedMutationFn: ((input: unknown) => unknown) | undefined;
    mockUseMutation.mockImplementation((opts: { mutationFn?: (input: unknown) => unknown }) => {
      capturedMutationFn = opts.mutationFn;
      return { mutateAsync: vi.fn(), isPending: false };
    });
    mockUploadDocument.mockResolvedValue({ success: true });

    renderHook(() => useUploadDocument());
    await capturedMutationFn!({ file: 'test.pdf' });
    expect(mockUploadDocument).toHaveBeenCalledWith({ file: 'test.pdf' });
  });

  it('onSuccess invalidates portfolio queries', () => {
    let capturedOnSuccess: (() => void) | undefined;
    mockUseMutation.mockImplementation((opts: { onSuccess?: () => void }) => {
      capturedOnSuccess = opts.onSuccess;
      return { mutateAsync: vi.fn(), isPending: false };
    });

    renderHook(() => useUploadDocument());
    capturedOnSuccess!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: portfolioKeys.all }),
    );
  });
});
