/**
 * Tests for submissions hooks.
 *
 * Strategy: mock @tanstack/react-query entirely and the API layer so we can
 * assert on queryKey, mutationFn, staleTime, onMutate/onError/onSettled
 * callback behaviour, and the derived state returned by useSubmissions.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCancelQueries = vi.fn().mockResolvedValue(undefined);
const mockGetQueryData = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

const mockQueryClient = {
  cancelQueries: (...args: unknown[]) => mockCancelQueries(...args),
  getQueryData: (...args: unknown[]) => mockGetQueryData(...args),
  setQueryData: (...args: unknown[]) => mockSetQueryData(...args),
  invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
};

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('react', async () => {
  const actual = await import('react');
  return {
    ...actual,
    useCallback: (fn: unknown) => fn,
  };
});

vi.mock('../../api', () => ({
  submissionsApi: {
    list: (...args: unknown[]) => mockApiList(...args),
    update: (...args: unknown[]) => mockApiUpdate(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
    countNew: (...args: unknown[]) => mockApiCountNew(...args),
  },
}));

vi.mock('../queryKeys', () => ({
  submissionsKeys: {
    all: ['submissions'],
    lists: () => ['submissions', 'list'],
    list: (filters?: Record<string, unknown>) => ['submissions', 'list', filters ?? {}],
    countNew: () => ['submissions', 'count', 'new'],
  },
}));

vi.mock('../../../../../../utils/queryKeys', () => ({
  pendingCountsKeys: {
    all: ['pendingCounts'],
  },
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockApiList = vi.fn();
const mockApiUpdate = vi.fn();
const mockApiDelete = vi.fn();
const mockApiCountNew = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useSubmissions, useSubmissionNewCount } from '../useSubmissions';
import { submissionsKeys } from '../queryKeys';
import { pendingCountsKeys } from '../../../../../../utils/queryKeys';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: (...args: unknown[]) => Promise<unknown>;
  staleTime?: number;
  refetchInterval?: number | false;
}

interface MutationOptions {
  mutationFn: (...args: unknown[]) => Promise<unknown>;
  onMutate?: (vars: unknown) => Promise<unknown>;
  onError?: (err: unknown, vars: unknown, ctx: unknown) => void;
  onSettled?: () => void;
  onSuccess?: () => void;
}

// ── useSubmissions — query config ─────────────────────────────────────────────

describe('useSubmissions — query config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('passes submissions list queryKey', () => {
    let capturedQuery: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      capturedQuery = opts as QueryOptions;
      return { data: [], isLoading: false, error: null };
    });
    useSubmissions();
    expect(capturedQuery!.queryKey).toEqual(
      submissionsKeys.list(undefined as unknown as Record<string, unknown>),
    );
  });

  it('passes staleTime of 2 minutes', () => {
    let capturedQuery: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      capturedQuery = opts as QueryOptions;
      return { data: [], isLoading: false, error: null };
    });
    useSubmissions();
    expect(capturedQuery!.staleTime).toBe(2 * 60 * 1000);
  });

  it('queryFn calls submissionsApi.list with filters', async () => {
    const filters = { type: 'quote' as const };
    mockApiList.mockResolvedValue([]);
    let capturedQuery: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      capturedQuery = opts as QueryOptions;
      return { data: [], isLoading: false, error: null };
    });
    useSubmissions(filters);
    await capturedQuery!.queryFn();
    expect(mockApiList).toHaveBeenCalledWith(filters);
  });
});

// ── useSubmissions — returned state ───────────────────────────────────────────

describe('useSubmissions — returned state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('submissions defaults to [] when data is undefined', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, error: null });
    const result = useSubmissions();
    expect(result.submissions).toEqual([]);
  });

  it('submissions contains data when query returns data', () => {
    const data = [{ id: 's-1' }];
    mockUseQuery.mockReturnValue({ data, isLoading: false, error: null });
    const result = useSubmissions();
    expect(result.submissions).toEqual(data);
  });

  it('isLoading reflects query loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const result = useSubmissions();
    expect(result.isLoading).toBe(true);
  });

  it('error is null when no error exists', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    const result = useSubmissions();
    expect(result.error).toBeNull();
  });

  it('error extracts message from Error instance', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('fetch failed'),
    });
    const result = useSubmissions();
    expect(result.error).toBe('fetch failed');
  });
});

// ── useSubmissions — updateMutation ───────────────────────────────────────────

describe('useSubmissions — updateMutation', () => {
  let updateOpts: MutationOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    let callCount = 0;
    mockUseMutation.mockImplementation((o: unknown) => {
      callCount++;
      if (callCount === 1) updateOpts = o as MutationOptions;
      return { mutateAsync: (o as MutationOptions).mutationFn, isPending: false };
    });
    useSubmissions();
  });

  it('mutationFn calls submissionsApi.update with id and input', async () => {
    mockApiUpdate.mockResolvedValue({ id: 's-1', status: 'reviewed' });
    await updateOpts.mutationFn({ id: 's-1', input: { status: 'reviewed' } });
    expect(mockApiUpdate).toHaveBeenCalledWith('s-1', { status: 'reviewed' });
  });

  it('onMutate cancels queries for submissions lists', async () => {
    mockGetQueryData.mockReturnValue([{ id: 's-1' }]);
    await updateOpts.onMutate!({ id: 's-1', input: { status: 'reviewed' } });
    expect(mockCancelQueries).toHaveBeenCalledWith({ queryKey: submissionsKeys.lists() });
  });

  it('onError rolls back to previous submissions snapshot', () => {
    const previousSubmissions = [{ id: 's-1', status: 'new' }];
    const queryKey = submissionsKeys.list({});
    updateOpts.onError!(new Error('fail'), {}, { previousSubmissions, queryKey });
    expect(mockSetQueryData).toHaveBeenCalledWith(queryKey, previousSubmissions);
  });

  it('onSettled invalidates submissions lists', async () => {
    await updateOpts.onSettled!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: submissionsKeys.lists() });
  });

  it('onSettled invalidates submissions countNew', async () => {
    await updateOpts.onSettled!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: submissionsKeys.countNew() });
  });

  it('onSettled invalidates pendingCounts', async () => {
    await updateOpts.onSettled!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: pendingCountsKeys.all });
  });
});

// ── useSubmissions — deleteMutation ───────────────────────────────────────────

describe('useSubmissions — deleteMutation', () => {
  let deleteOpts: MutationOptions;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    let callCount = 0;
    mockUseMutation.mockImplementation((o: unknown) => {
      callCount++;
      if (callCount === 2) deleteOpts = o as MutationOptions;
      return { mutateAsync: (o as MutationOptions).mutationFn, isPending: false };
    });
    useSubmissions();
  });

  it('mutationFn calls submissionsApi.delete with id', async () => {
    mockApiDelete.mockResolvedValue(undefined);
    await deleteOpts.mutationFn('s-1');
    expect(mockApiDelete).toHaveBeenCalledWith('s-1');
  });

  it('onSuccess invalidates submissions lists', () => {
    deleteOpts.onSuccess!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: submissionsKeys.lists() });
  });

  it('onSuccess invalidates countNew', () => {
    deleteOpts.onSuccess!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: submissionsKeys.countNew() });
  });

  it('onSuccess invalidates pendingCounts', () => {
    deleteOpts.onSuccess!();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: pendingCountsKeys.all });
  });
});

// ── useSubmissionNewCount ─────────────────────────────────────────────────────

describe('useSubmissionNewCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    useSubmissionNewCount();
    expect(captured!.queryKey).toEqual(submissionsKeys.countNew());
  });

  it('passes staleTime of 60 000ms', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    useSubmissionNewCount();
    expect(captured!.staleTime).toBe(60_000);
  });

  it('passes refetchInterval of 60 000ms', () => {
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    useSubmissionNewCount();
    expect(captured!.refetchInterval).toBe(60_000);
  });

  it('queryFn calls submissionsApi.countNew', async () => {
    mockApiCountNew.mockResolvedValue(3);
    let captured: QueryOptions | undefined;
    mockUseQuery.mockImplementationOnce((opts: unknown) => {
      captured = opts as QueryOptions;
      return {};
    });
    useSubmissionNewCount();
    await captured!.queryFn();
    expect(mockApiCountNew).toHaveBeenCalledOnce();
  });
});
