/**
 * Tests for useChatHistory hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatHistory } from '../useChatHistory';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSetQueryData = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: (...args: unknown[]) => mockUseQueryClient(...args),
}));

vi.mock('../queryKeys', () => ({
  adviceEngineKeys: {
    ai: {
      all: ['ai-intelligence'],
      history: () => ['ai-intelligence', 'history'],
      status: () => ['ai-intelligence', 'status'],
    },
    roa: {
      all: ['advice-engine-roa'],
      drafts: () => ['advice-engine-roa', 'drafts'],
      draft: (id: string) => ['advice-engine-roa', 'draft', id],
      moduleContracts: (f: unknown) => ['advice-engine-roa', 'module-contracts', f ?? {}],
    },
  },
}));

const mockGetHistory = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('../../api', () => ({
  aiIntelligenceApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    clearHistory: (...args: unknown[]) => mockClearHistory(...args),
    getStatus: vi.fn(),
    sendMessage: vi.fn(),
    searchClients: vi.fn(),
  },
  roaApi: {
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    submitDraft: vi.fn(),
    getModuleContracts: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

function makeHistoryData(
  msgs: Array<{ query: string; reply: string; timestamp: string; clientId?: string }> = [],
) {
  return { messages: msgs };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQueryClient.mockReturnValue({ setQueryData: mockSetQueryData });
  mockUseQuery.mockReturnValue(makeQueryResult());
  mockUseMutation.mockReturnValue(makeMutationResult());
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChatHistory', () => {
  // ── Query key ─────────────────────────────────────────────────────────────

  it('passes the correct queryKey to useQuery', () => {
    renderHook(() => useChatHistory());
    const config = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(config.queryKey).toEqual(['ai-intelligence', 'history']);
  });

  it('does not set an enabled flag (always enabled)', () => {
    renderHook(() => useChatHistory());
    const config = mockUseQuery.mock.calls[0][0] as Record<string, unknown>;
    // enabled is either undefined (default true) or explicitly true
    expect(config.enabled === undefined || config.enabled === true).toBe(true);
  });

  it('sets staleTime to 5 minutes', () => {
    renderHook(() => useChatHistory());
    const config = mockUseQuery.mock.calls[0][0] as { staleTime: number };
    expect(config.staleTime).toBe(5 * 60 * 1000);
  });

  // ── queryFn ───────────────────────────────────────────────────────────────

  it('queryFn calls aiIntelligenceApi.getHistory', async () => {
    mockGetHistory.mockResolvedValueOnce(makeHistoryData());
    renderHook(() => useChatHistory());
    const config = mockUseQuery.mock.calls[0][0] as { queryFn: () => Promise<unknown> };
    await config.queryFn();
    expect(mockGetHistory).toHaveBeenCalledTimes(1);
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('returns empty history when data is undefined', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: undefined }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.history).toEqual([]);
  });

  it('returns isLoading false when query is not loading', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ isLoading: false }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.isLoading).toBe(false);
  });

  it('returns isLoading true when query is loading', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ isLoading: true }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns error null when there is no query error', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ error: null }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.error).toBeNull();
  });

  it('returns string error when query has an error', () => {
    const err = new Error('fetch failed');
    mockUseQuery.mockReturnValue(makeQueryResult({ error: err }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.error).toBe(String(err));
  });

  // ── hasLoaded ─────────────────────────────────────────────────────────────

  it('hasLoaded is false when data is undefined', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: undefined }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.hasLoaded).toBe(false);
  });

  it('hasLoaded is true when data is defined (even empty)', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: makeHistoryData([]) }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.hasLoaded).toBe(true);
  });

  // ── history parsing ───────────────────────────────────────────────────────

  it('parses history messages into user/assistant pairs', () => {
    const historyData = makeHistoryData([
      { query: 'Hello', reply: 'Hi there', timestamp: '2024-01-01T10:00:00Z' },
    ]);
    mockUseQuery.mockReturnValue(makeQueryResult({ data: historyData }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].role).toBe('user');
    expect(result.current.history[0].content).toBe('Hello');
    expect(result.current.history[1].role).toBe('assistant');
    expect(result.current.history[1].content).toBe('Hi there');
  });

  it('preserves clientId in parsed messages', () => {
    const historyData = makeHistoryData([
      { query: 'Q', reply: 'A', timestamp: '2024-01-01T10:00:00Z', clientId: 'client-42' },
    ]);
    mockUseQuery.mockReturnValue(makeQueryResult({ data: historyData }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.history[0].clientId).toBe('client-42');
    expect(result.current.history[1].clientId).toBe('client-42');
  });

  it('parses multiple history entries into correct number of messages', () => {
    const historyData = makeHistoryData([
      { query: 'Q1', reply: 'A1', timestamp: '2024-01-01T10:00:00Z' },
      { query: 'Q2', reply: 'A2', timestamp: '2024-01-01T10:01:00Z' },
      { query: 'Q3', reply: 'A3', timestamp: '2024-01-01T10:02:00Z' },
    ]);
    mockUseQuery.mockReturnValue(makeQueryResult({ data: historyData }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.history).toHaveLength(6);
  });

  it('converts timestamp strings to Date objects', () => {
    const ts = '2024-06-15T12:30:00Z';
    const historyData = makeHistoryData([{ query: 'Q', reply: 'A', timestamp: ts }]);
    mockUseQuery.mockReturnValue(makeQueryResult({ data: historyData }));
    const { result } = renderHook(() => useChatHistory());
    expect(result.current.history[0].timestamp).toBeInstanceOf(Date);
    expect(result.current.history[0].timestamp.toISOString()).toBe(new Date(ts).toISOString());
  });

  // ── loadHistory ───────────────────────────────────────────────────────────

  it('loadHistory calls refetch', async () => {
    const mockRefetch = vi.fn().mockResolvedValueOnce({ data: undefined });
    mockUseQuery.mockReturnValue(makeQueryResult({ refetch: mockRefetch }));
    const { result } = renderHook(() => useChatHistory());
    await act(async () => {
      await result.current.loadHistory();
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // ── clearHistory ──────────────────────────────────────────────────────────

  it('clearHistory calls mutation mutateAsync', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(undefined);
    mockUseMutation.mockReturnValue(makeMutationResult({ mutateAsync: mockMutateAsync }));
    const { result } = renderHook(() => useChatHistory());
    await act(async () => {
      await result.current.clearHistory();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('clearHistory mutation fn calls aiIntelligenceApi.clearHistory', async () => {
    mockClearHistory.mockResolvedValueOnce(undefined);
    renderHook(() => useChatHistory());
    const mutationConfig = mockUseMutation.mock.calls[0][0] as {
      mutationFn: () => Promise<void>;
      onSuccess: () => void;
    };
    await mutationConfig.mutationFn();
    expect(mockClearHistory).toHaveBeenCalledTimes(1);
  });

  it('clearHistory mutation onSuccess calls setQueryData with empty messages', () => {
    renderHook(() => useChatHistory());
    const mutationConfig = mockUseMutation.mock.calls[0][0] as {
      onSuccess: () => void;
    };
    mutationConfig.onSuccess();
    expect(mockSetQueryData).toHaveBeenCalledWith(['ai-intelligence', 'history'], { messages: [] });
  });
});
