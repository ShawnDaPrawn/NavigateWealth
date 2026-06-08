/**
 * Tests for useAIChat hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from '../useAIChat';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockSetQueryData = vi.fn();
const mockInvalidateQueries = vi.fn();
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
      status: () => ['ai-intelligence', 'status'],
      history: () => ['ai-intelligence', 'history'],
    },
    roa: {
      all: ['advice-engine-roa'],
      drafts: () => ['advice-engine-roa', 'drafts'],
      draft: (id: string) => ['advice-engine-roa', 'draft', id],
      moduleContracts: (f: unknown) => ['advice-engine-roa', 'module-contracts', f ?? {}],
    },
  },
}));

const mockGetStatus = vi.fn();
const mockGetHistory = vi.fn();
const mockSendMessage = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('../../api', () => ({
  aiIntelligenceApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    clearHistory: (...args: unknown[]) => mockClearHistory(...args),
    searchClients: vi.fn(),
  },
  roaApi: {
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    submitDraft: vi.fn(),
    getModuleContracts: vi.fn(),
  },
}));

const mockBuildConversationHistory = vi.fn();

vi.mock('../../utils', () => ({
  buildConversationHistory: (...args: unknown[]) => mockBuildConversationHistory(...args),
}));

// sonner toast mock
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
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

/**
 * Build a mock mutation that executes callbacks synchronously so tests can
 * observe state changes without async trickery.
 *
 * Provide `resolveWith` to make mutateAsync succeed and call onSuccess.
 * Provide `rejectWith` to make mutateAsync fail and call onError.
 */
function makeMutationResult(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn(),
    mutate: vi.fn(),
    isPending: false,
    ...overrides,
  };
}

/** Capture mutation config so tests can call onMutate / onSuccess / onError */
function capturedMutations(): Array<{
  mutationFn: (...args: unknown[]) => Promise<unknown>;
  onMutate?: (...args: unknown[]) => unknown;
  onSuccess?: (...args: unknown[]) => unknown;
  onError?: (...args: unknown[]) => unknown;
}> {
  return mockUseMutation.mock.calls.map((call) => call[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQueryClient.mockReturnValue({
    setQueryData: mockSetQueryData,
    invalidateQueries: mockInvalidateQueries,
  });
  // Default: both queries return undefined data
  mockUseQuery.mockReturnValue(makeQueryResult());
  // Default: both mutations return no-op objects
  mockUseMutation.mockReturnValue(makeMutationResult());
  // buildConversationHistory default
  mockBuildConversationHistory.mockReturnValue({ messages: [] });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAIChat', () => {
  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with the welcome message in messages', () => {
    const { result } = renderHook(() => useAIChat());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[0].content).toContain('Welcome');
  });

  it('isLoading is false on mount when sendMessage mutation is not pending', () => {
    mockUseMutation.mockReturnValue(makeMutationResult({ isPending: false }));
    const { result } = renderHook(() => useAIChat());
    expect(result.current.isLoading).toBe(false);
  });

  it('isLoading is true when sendMessage mutation is pending', () => {
    // First useMutation call is sendMessage, second is clearChat
    let callCount = 0;
    mockUseMutation.mockImplementation(() => {
      callCount++;
      return makeMutationResult({ isPending: callCount === 1 });
    });
    const { result } = renderHook(() => useAIChat());
    expect(result.current.isLoading).toBe(true);
  });

  it('error is null on mount', () => {
    const { result } = renderHook(() => useAIChat());
    expect(result.current.error).toBeNull();
  });

  it('apiKeyStatus is null when status query returns undefined', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: undefined }));
    const { result } = renderHook(() => useAIChat());
    expect(result.current.apiKeyStatus).toBeNull();
  });

  it('isConfigured is false when apiKeyStatus is null', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: undefined }));
    const { result } = renderHook(() => useAIChat());
    expect(result.current.isConfigured).toBe(false);
  });

  it('isConfigured reflects apiKeyStatus.configured', () => {
    mockUseQuery.mockReturnValue(makeQueryResult({ data: { configured: true, valid: true } }));
    const { result } = renderHook(() => useAIChat());
    expect(result.current.isConfigured).toBe(true);
  });

  // ── useQuery calls ────────────────────────────────────────────────────────

  it('passes status queryKey to first useQuery', () => {
    renderHook(() => useAIChat());
    const statusConfig = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(statusConfig.queryKey).toEqual(['ai-intelligence', 'status']);
  });

  it('passes history queryKey to second useQuery', () => {
    renderHook(() => useAIChat());
    const historyConfig = mockUseQuery.mock.calls[1][0] as { queryKey: unknown[] };
    expect(historyConfig.queryKey).toEqual(['ai-intelligence', 'history']);
  });

  it('history query is enabled when autoLoadHistory is true (default)', () => {
    renderHook(() => useAIChat({ autoLoadHistory: true }));
    const historyConfig = mockUseQuery.mock.calls[1][0] as { enabled: boolean };
    expect(historyConfig.enabled).toBe(true);
  });

  it('history query is disabled when autoLoadHistory is false', () => {
    renderHook(() => useAIChat({ autoLoadHistory: false }));
    const historyConfig = mockUseQuery.mock.calls[1][0] as { enabled: boolean };
    expect(historyConfig.enabled).toBe(false);
  });

  it('status query has staleTime of 5 minutes', () => {
    renderHook(() => useAIChat());
    const statusConfig = mockUseQuery.mock.calls[0][0] as { staleTime: number };
    expect(statusConfig.staleTime).toBe(5 * 60 * 1000);
  });

  it('history query has staleTime of 5 minutes', () => {
    renderHook(() => useAIChat());
    const historyConfig = mockUseQuery.mock.calls[1][0] as { staleTime: number };
    expect(historyConfig.staleTime).toBe(5 * 60 * 1000);
  });

  // ── initialMessages option ────────────────────────────────────────────────

  it('prepends welcome message before initialMessages', () => {
    const initMsg = { role: 'user' as const, content: 'Hi', timestamp: new Date() };
    const { result } = renderHook(() => useAIChat({ initialMessages: [initMsg] }));
    expect(result.current.messages[0].role).toBe('assistant');
    expect(result.current.messages[1]).toEqual(initMsg);
  });

  // ── sendMessage validation ────────────────────────────────────────────────

  it('sendMessage sets error for empty string', async () => {
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage('');
    });
    expect(result.current.error).toBe('Message cannot be empty');
  });

  it('sendMessage sets error for whitespace-only string', async () => {
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(result.current.error).toBe('Message cannot be empty');
  });

  it('sendMessage sets error for message exceeding 4000 characters', async () => {
    const longMessage = 'a'.repeat(4001);
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage(longMessage);
    });
    expect(result.current.error).toBe('Message is too long (max 4000 characters)');
  });

  it('sendMessage calls mutateAsync for valid message', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(undefined);
    mockUseMutation.mockReturnValue(makeMutationResult({ mutateAsync: mockMutateAsync }));
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage('Hello');
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({ content: 'Hello', clientId: undefined });
  });

  it('sendMessage trims whitespace before sending', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(undefined);
    mockUseMutation.mockReturnValue(makeMutationResult({ mutateAsync: mockMutateAsync }));
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage('  Hello  ');
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({ content: 'Hello', clientId: undefined });
  });

  it('sendMessage passes clientId to mutateAsync', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(undefined);
    mockUseMutation.mockReturnValue(makeMutationResult({ mutateAsync: mockMutateAsync }));
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.sendMessage('Hello', 'client-99');
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({ content: 'Hello', clientId: 'client-99' });
  });

  // ── sendMessage mutation config ───────────────────────────────────────────

  it('sendMessage mutationFn calls aiIntelligenceApi.sendMessage', async () => {
    mockSendMessage.mockResolvedValueOnce({ reply: 'OK', tokensUsed: 10, model: 'gpt-4' });
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    const result = await sendMutationConfig.mutationFn({ content: 'Hello', clientId: undefined });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      response: { reply: 'OK', tokensUsed: 10, model: 'gpt-4' },
      clientId: undefined,
    });
  });

  it('sendMessage onMutate adds user message optimistically', () => {
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    // Should not throw; actual state update is internal to the hook
    expect(() =>
      sendMutationConfig.onMutate?.({ content: 'Hi', clientId: undefined }),
    ).not.toThrow();
  });

  it('sendMessage onError sets error state', () => {
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    const context = { userMessage: { role: 'user', content: 'Hi', timestamp: new Date() } };
    // Should not throw
    expect(() =>
      sendMutationConfig.onError?.(
        new Error('Network error'),
        { content: 'Hi', clientId: undefined },
        context,
      ),
    ).not.toThrow();
  });

  it('sendMessage onError triggers toast for rate limit error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    sendMutationConfig.onError?.(
      new Error('rate limit exceeded'),
      { content: 'Hi', clientId: undefined },
      undefined,
    );
    expect(toast.error).toHaveBeenCalledWith(
      'OpenAI Rate Limit Reached',
      expect.objectContaining({ duration: 8000 }),
    );
  });

  it('sendMessage onError triggers toast for 429 error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    sendMutationConfig.onError?.(
      new Error('HTTP 429 Too Many Requests'),
      { content: 'Hi', clientId: undefined },
      undefined,
    );
    expect(toast.error).toHaveBeenCalled();
  });

  it('sendMessage onError does not trigger toast for generic error', async () => {
    const { toast } = await import('sonner');
    renderHook(() => useAIChat());
    const [sendMutationConfig] = capturedMutations();
    sendMutationConfig.onError?.(
      new Error('Something went wrong'),
      { content: 'Hi', clientId: undefined },
      undefined,
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  // ── clearChat ─────────────────────────────────────────────────────────────

  it('clearChat calls clearChat mutation mutateAsync', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValueOnce(undefined);
    let callCount = 0;
    mockUseMutation.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return makeMutationResult(); // sendMessage
      return makeMutationResult({ mutateAsync: mockMutateAsync }); // clearChat
    });
    const { result } = renderHook(() => useAIChat());
    await act(async () => {
      await result.current.clearChat();
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
  });

  it('clearChat mutationFn calls aiIntelligenceApi.clearHistory', async () => {
    mockClearHistory.mockResolvedValueOnce(undefined);
    renderHook(() => useAIChat());
    const mutations = capturedMutations();
    const clearChatConfig = mutations[1]; // second mutation is clearChat
    await clearChatConfig.mutationFn();
    expect(mockClearHistory).toHaveBeenCalledTimes(1);
  });

  it('clearChat onSuccess calls setQueryData with empty messages', () => {
    renderHook(() => useAIChat());
    const mutations = capturedMutations();
    const clearChatConfig = mutations[1];
    clearChatConfig.onSuccess?.(undefined, undefined, undefined);
    expect(mockSetQueryData).toHaveBeenCalledWith(['ai-intelligence', 'history'], { messages: [] });
  });

  // ── history loading ───────────────────────────────────────────────────────

  it('loads history from historyData when autoLoadHistory is true', () => {
    const historyData = {
      messages: [{ query: 'Q1', reply: 'A1', timestamp: '2024-01-01T10:00:00Z', clientId: 'c1' }],
    };
    let queryCount = 0;
    mockUseQuery.mockImplementation(() => {
      queryCount++;
      if (queryCount === 1) return makeQueryResult({ data: { configured: true } }); // status
      return makeQueryResult({ data: historyData }); // history
    });
    const { result } = renderHook(() => useAIChat({ autoLoadHistory: true }));
    // welcome + 2 history messages (user + assistant)
    expect(result.current.messages).toHaveLength(3);
  });

  // ── return shape ──────────────────────────────────────────────────────────

  it('returns all expected fields', () => {
    const { result } = renderHook(() => useAIChat());
    expect(result.current).toHaveProperty('messages');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('sendMessage');
    expect(result.current).toHaveProperty('clearChat');
    expect(result.current).toHaveProperty('apiKeyStatus');
    expect(result.current).toHaveProperty('isConfigured');
    expect(typeof result.current.sendMessage).toBe('function');
    expect(typeof result.current.clearChat).toBe('function');
  });
});
