import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useKBEntries,
  useKBStats,
  useKBEntry,
  useCreateKBEntry,
  useUpdateKBEntry,
  useDeleteKBEntry,
} from '../useKnowledgeBase';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetAll = vi.fn();
const mockGetStats = vi.fn();
const mockGetEntry = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('../../api', () => ({
  kbApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getEntry: (...args: unknown[]) => mockGetEntry(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
});

// ============================================================================
// useKBEntries
// ============================================================================

describe('useKBEntries', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntries());

    expect(captured.queryKey).toEqual(['ai-management', 'kb-entries']);
  });

  it('queryFn calls kbApi.getAll', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntries());

    mockGetAll.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAll).toHaveBeenCalled();
  });

  it('has a staleTime set', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntries());

    expect(typeof captured.staleTime).toBe('number');
    expect(captured.staleTime as number).toBeGreaterThan(0);
  });
});

// ============================================================================
// useKBStats
// ============================================================================

describe('useKBStats', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBStats());

    expect(captured.queryKey).toEqual(['ai-management', 'kb-stats']);
  });

  it('queryFn calls kbApi.getStats', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBStats());

    mockGetStats.mockResolvedValue({ total: 5 });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetStats).toHaveBeenCalled();
  });
});

// ============================================================================
// useKBEntry
// ============================================================================

describe('useKBEntry', () => {
  it('passes correct queryKey with id', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntry('kb-123'));

    expect(captured.queryKey).toEqual(['ai-management', 'kb-entry', 'kb-123']);
  });

  it('sets enabled=true when id is non-empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntry('kb-123'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when id is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntry(''));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls kbApi.getEntry with the id', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useKBEntry('kb-123'));

    mockGetEntry.mockResolvedValue({ id: 'kb-123', title: 'Test' });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetEntry).toHaveBeenCalledWith('kb-123');
  });
});

// ============================================================================
// useCreateKBEntry
// ============================================================================

describe('useCreateKBEntry', () => {
  it('mutationFn calls kbApi.create with input', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    const input = { title: 'New Entry', content: 'Content' };
    mockCreate.mockResolvedValue({ id: 'kb-1', title: 'New Entry' });
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)(input);

    expect(mockCreate).toHaveBeenCalledWith(input);
  });

  it('onSuccess invalidates kbEntries and kbStats queries', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-new', title: 'New Entry', status: 'active' },
      index: { indexed: true, chunkCount: 1 },
    });

    // A live entry was written into Vasco's index, so its status must refresh too.
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'rag-index'],
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-entries'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-stats'],
    });
  });

  it('onSuccess shows toast with entry title', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-1', title: 'My Entry', status: 'active' },
      index: { indexed: true, chunkCount: 1 },
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('My Entry'));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Vasco can use it now'));
  });

  it('onSuccess warns when a live entry could not be indexed for Vasco', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-1', title: 'My Entry', status: 'active' },
      index: { indexed: false, chunkCount: 0, error: 'Embedding generation failed: 503' },
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be added'));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('503'));
  });

  it('onSuccess says plainly that a draft is not used by Vasco', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-1', title: 'Draft Entry', status: 'draft' },
      index: { indexed: false, chunkCount: 0 },
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('draft'));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('will not use it'));
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useCreateKBEntry());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to create knowledge base entry');
  });
});

// ============================================================================
// useUpdateKBEntry
// ============================================================================

describe('useUpdateKBEntry', () => {
  it('mutationFn calls kbApi.update with id and input', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateKBEntry());

    const args = { id: 'kb-1', input: { title: 'Updated', content: 'New content' } };
    mockUpdate.mockResolvedValue({ id: 'kb-1', title: 'Updated' });
    await (captured.mutationFn as (args: unknown) => Promise<unknown>)(args);

    expect(mockUpdate).toHaveBeenCalledWith('kb-1', args.input);
  });

  it('onSuccess invalidates kbEntries, kbStats, and specific kbEntry queries', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-1', title: 'Updated', status: 'active' },
      index: { indexed: true, chunkCount: 1 },
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-entries'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-stats'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-entry', 'kb-1'],
    });
  });

  it('onSuccess shows toast with entry title', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateKBEntry());

    (captured.onSuccess as (result: unknown) => void)({
      entry: { id: 'kb-1', title: 'Updated Entry', status: 'active' },
      index: { indexed: true, chunkCount: 1 },
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Updated Entry'));
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateKBEntry());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to update knowledge base entry');
  });
});

// ============================================================================
// useDeleteKBEntry
// ============================================================================

describe('useDeleteKBEntry', () => {
  it('mutationFn calls kbApi.remove with id', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDeleteKBEntry());

    mockRemove.mockResolvedValue(undefined);
    await (captured.mutationFn as (id: string) => Promise<unknown>)('kb-1');

    expect(mockRemove).toHaveBeenCalledWith('kb-1');
  });

  it('onSuccess invalidates kbEntries and kbStats queries', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDeleteKBEntry());

    (captured.onSuccess as () => void)();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-entries'],
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'kb-stats'],
    });
  });

  it('onSuccess shows success toast', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDeleteKBEntry());

    (captured.onSuccess as () => void)();

    expect(toast.success).toHaveBeenCalledWith('Entry deleted');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useDeleteKBEntry());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to delete knowledge base entry');
  });
});
