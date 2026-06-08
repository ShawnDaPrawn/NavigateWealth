import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useAgents,
  useAgent,
  useVascoConfig,
  useToggleVasco,
  useAnalyticsSummary,
  useFeedback,
  useHandoffs,
  useUpdateHandoffStatus,
  useRagIndexStatus,
  useTriggerReindex,
} from '../useAIManagement';

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

const mockGetAgents = vi.fn();
const mockGetAgent = vi.fn();
const mockGetVascoConfig = vi.fn();
const mockUpdateVascoConfig = vi.fn();
const mockGetAnalyticsSummary = vi.fn();
const mockGetFeedbackRecent = vi.fn();
const mockGetHandoffs = vi.fn();
const mockUpdateHandoffStatus = vi.fn();
const mockGetRagIndexStatus = vi.fn();
const mockTriggerReindex = vi.fn();

vi.mock('../../api', () => ({
  agentApi: {
    getAgents: (...args: unknown[]) => mockGetAgents(...args),
    getAgent: (...args: unknown[]) => mockGetAgent(...args),
  },
  vascoConfigApi: {
    getConfig: (...args: unknown[]) => mockGetVascoConfig(...args),
    updateConfig: (...args: unknown[]) => mockUpdateVascoConfig(...args),
  },
  analyticsApi: {
    getSummary: (...args: unknown[]) => mockGetAnalyticsSummary(...args),
  },
  feedbackApi: {
    getRecent: (...args: unknown[]) => mockGetFeedbackRecent(...args),
  },
  handoffApi: {
    getAll: (...args: unknown[]) => mockGetHandoffs(...args),
    updateStatus: (...args: unknown[]) => mockUpdateHandoffStatus(...args),
  },
  ragIndexApi: {
    getStatus: (...args: unknown[]) => mockGetRagIndexStatus(...args),
    triggerReindex: (...args: unknown[]) => mockTriggerReindex(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
});

// ============================================================================
// useAgents
// ============================================================================

describe('useAgents', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgents());

    expect(captured.queryKey).toEqual(['ai-management', 'agents']);
  });

  it('queryFn calls agentApi.getAgents', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgents());

    mockGetAgents.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAgents).toHaveBeenCalled();
  });

  it('has a staleTime set', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgents());

    expect(typeof captured.staleTime).toBe('number');
  });
});

// ============================================================================
// useAgent
// ============================================================================

describe('useAgent', () => {
  it('passes correct queryKey with agent id', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgent('agent-1'));

    expect(captured.queryKey).toEqual(['ai-management', 'agent', 'agent-1']);
  });

  it('sets enabled=true when id is non-empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgent('agent-1'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when id is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgent(''));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls agentApi.getAgent with the id', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAgent('agent-1'));

    mockGetAgent.mockResolvedValue({ id: 'agent-1' });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAgent).toHaveBeenCalledWith('agent-1');
  });
});

// ============================================================================
// useVascoConfig
// ============================================================================

describe('useVascoConfig', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useVascoConfig());

    expect(captured.queryKey).toEqual(['ai-management', 'vasco-config']);
  });

  it('queryFn calls vascoConfigApi.getConfig', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useVascoConfig());

    mockGetVascoConfig.mockResolvedValue({ enabled: true });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetVascoConfig).toHaveBeenCalled();
  });
});

// ============================================================================
// useToggleVasco
// ============================================================================

describe('useToggleVasco', () => {
  it('mutationFn calls vascoConfigApi.updateConfig with the enabled flag', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useToggleVasco());

    mockUpdateVascoConfig.mockResolvedValue({ enabled: true });
    await (captured.mutationFn as (enabled: boolean) => Promise<unknown>)(true);

    expect(mockUpdateVascoConfig).toHaveBeenCalledWith(true);
  });

  it('onSuccess invalidates vascoConfig query and shows toast with enabled state', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useToggleVasco());

    (captured.onSuccess as (data: { enabled: boolean }) => void)({ enabled: true });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'vasco-config'],
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('enabled'));
  });

  it('onSuccess shows "disabled" in toast when enabled=false', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useToggleVasco());

    (captured.onSuccess as (data: { enabled: boolean }) => void)({ enabled: false });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('disabled'));
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useToggleVasco());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to update Vasco status');
  });
});

// ============================================================================
// useAnalyticsSummary
// ============================================================================

describe('useAnalyticsSummary', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAnalyticsSummary());

    expect(captured.queryKey).toEqual(['ai-management', 'analytics']);
  });

  it('queryFn calls analyticsApi.getSummary', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useAnalyticsSummary());

    mockGetAnalyticsSummary.mockResolvedValue({});
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetAnalyticsSummary).toHaveBeenCalled();
  });
});

// ============================================================================
// useFeedback
// ============================================================================

describe('useFeedback', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useFeedback());

    expect(captured.queryKey).toEqual(['ai-management', 'feedback']);
  });

  it('queryFn calls feedbackApi.getRecent with default limit 50', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useFeedback());

    mockGetFeedbackRecent.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetFeedbackRecent).toHaveBeenCalledWith(50);
  });

  it('queryFn calls feedbackApi.getRecent with custom limit', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useFeedback(100));

    mockGetFeedbackRecent.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetFeedbackRecent).toHaveBeenCalledWith(100);
  });
});

// ============================================================================
// useHandoffs
// ============================================================================

describe('useHandoffs', () => {
  it('passes queryKey with "all" when no status provided', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useHandoffs());

    expect(captured.queryKey).toEqual(['ai-management', 'handoffs', 'all']);
  });

  it('passes queryKey with specific status when provided', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useHandoffs('pending' as never));

    expect(captured.queryKey).toEqual(['ai-management', 'handoffs', 'pending']);
  });

  it('queryFn calls handoffApi.getAll with the status', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useHandoffs('pending' as never));

    mockGetHandoffs.mockResolvedValue([]);
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetHandoffs).toHaveBeenCalledWith('pending');
  });
});

// ============================================================================
// useUpdateHandoffStatus
// ============================================================================

describe('useUpdateHandoffStatus', () => {
  it('mutationFn calls handoffApi.updateStatus with id and status', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateHandoffStatus());

    mockUpdateHandoffStatus.mockResolvedValue({});
    await (captured.mutationFn as (args: unknown) => Promise<unknown>)({
      id: 'h-1',
      status: 'resolved',
    });

    expect(mockUpdateHandoffStatus).toHaveBeenCalledWith('h-1', 'resolved');
  });

  it('onSuccess invalidates all ai-management queries and shows toast', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateHandoffStatus());

    (captured.onSuccess as () => void)();

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management'],
    });
    expect(toast.success).toHaveBeenCalledWith('Handoff status updated');
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useUpdateHandoffStatus());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to update handoff status');
  });
});

// ============================================================================
// useRagIndexStatus
// ============================================================================

describe('useRagIndexStatus', () => {
  it('passes correct queryKey', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRagIndexStatus());

    expect(captured.queryKey).toEqual(['ai-management', 'rag-index']);
  });

  it('queryFn calls ragIndexApi.getStatus', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRagIndexStatus());

    mockGetRagIndexStatus.mockResolvedValue({ status: 'idle' });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetRagIndexStatus).toHaveBeenCalled();
  });
});

// ============================================================================
// useTriggerReindex
// ============================================================================

describe('useTriggerReindex', () => {
  it('mutationFn calls ragIndexApi.triggerReindex', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useTriggerReindex());

    mockTriggerReindex.mockResolvedValue({
      articlesIndexed: 5,
      totalChunks: 42,
      durationMs: 1200,
    });
    await (captured.mutationFn as () => Promise<unknown>)();

    expect(mockTriggerReindex).toHaveBeenCalled();
  });

  it('onSuccess invalidates ragIndex query and shows toast with article count', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useTriggerReindex());

    (captured.onSuccess as (result: unknown) => void)({
      articlesIndexed: 10,
      totalChunks: 80,
      durationMs: 2500,
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ['ai-management', 'rag-index'],
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('10'));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('80'));
  });

  it('onError shows toast.error', async () => {
    const { toast } = await import('sonner');
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useTriggerReindex());

    (captured.onError as () => void)();

    expect(toast.error).toHaveBeenCalledWith('Failed to trigger re-indexing');
  });
});
