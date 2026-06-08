import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePromptBundle,
  useSaveDraftPrompt,
  usePublishPrompt,
  useRollbackPrompt,
  useSeedPrompt,
} from '../usePromptStudio';

// ============================================================================
// MOCKS
// ============================================================================

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

const mockGetBundle = vi.fn();
const mockSaveDraft = vi.fn();
const mockPublish = vi.fn();
const mockRollback = vi.fn();
const mockSeedIfMissing = vi.fn();

vi.mock('../../api', () => ({
  promptApi: {
    getBundle: (...args: unknown[]) => mockGetBundle(...args),
    saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
    publish: (...args: unknown[]) => mockPublish(...args),
    rollback: (...args: unknown[]) => mockRollback(...args),
    seedIfMissing: (...args: unknown[]) => mockSeedIfMissing(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQuery.mockReturnValue({});
  mockUseMutation.mockReturnValue({});
});

// ============================================================================
// usePromptBundle
// ============================================================================

describe('usePromptBundle', () => {
  it('passes correct queryKey with agentId and context', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePromptBundle('agent-1', 'initial'));

    expect(captured.queryKey).toEqual(['ai-management', 'prompt-bundle', 'agent-1', 'initial']);
  });

  it('sets enabled=true when both agentId and context are present', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePromptBundle('agent-1', 'initial'));

    expect(captured.enabled).toBe(true);
  });

  it('sets enabled=false when agentId is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePromptBundle('', 'initial'));

    expect(captured.enabled).toBe(false);
  });

  it('sets enabled=false when context is empty', () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePromptBundle('agent-1', '' as never));

    expect(captured.enabled).toBe(false);
  });

  it('queryFn calls promptApi.getBundle with agentId and context', async () => {
    let captured: Record<string, unknown> = {};
    mockUseQuery.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePromptBundle('agent-1', 'initial'));

    mockGetBundle.mockResolvedValue({ active: null, draft: null, versions: [] });
    await (captured.queryFn as () => Promise<unknown>)();

    expect(mockGetBundle).toHaveBeenCalledWith('agent-1', 'initial');
  });
});

// ============================================================================
// useSaveDraftPrompt
// ============================================================================

describe('useSaveDraftPrompt', () => {
  it('mutationFn calls promptApi.saveDraft with agentId, context, and prompt', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useSaveDraftPrompt());

    mockSaveDraft.mockResolvedValue(undefined);
    const input = { agentId: 'agent-1', context: 'initial' as const, prompt: 'Hello' };
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)(input);

    expect(mockSaveDraft).toHaveBeenCalledWith('agent-1', 'initial', 'Hello');
  });

  it('mutationFn returns { success: true }', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useSaveDraftPrompt());

    mockSaveDraft.mockResolvedValue(undefined);
    const result = await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
      prompt: 'Hello',
    });

    expect(result).toEqual({ success: true });
  });
});

// ============================================================================
// usePublishPrompt
// ============================================================================

describe('usePublishPrompt', () => {
  it('mutationFn calls promptApi.publish with agentId and context', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePublishPrompt());

    const mockVersion = { id: 'v-1', prompt: 'Hello', agentId: 'agent-1' };
    mockPublish.mockResolvedValue(mockVersion);
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
    });

    expect(mockPublish).toHaveBeenCalledWith('agent-1', 'initial');
  });

  it('mutationFn returns { version }', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => usePublishPrompt());

    const mockVersion = { id: 'v-1' };
    mockPublish.mockResolvedValue(mockVersion);
    const result = await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
    });

    expect(result).toEqual({ version: mockVersion });
  });
});

// ============================================================================
// useRollbackPrompt
// ============================================================================

describe('useRollbackPrompt', () => {
  it('mutationFn calls promptApi.rollback with agentId, context, and versionId', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRollbackPrompt());

    mockRollback.mockResolvedValue({ id: 'v-2' });
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
      versionId: 'v-2',
    });

    expect(mockRollback).toHaveBeenCalledWith('agent-1', 'initial', 'v-2');
  });

  it('mutationFn returns { version }', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useRollbackPrompt());

    const mockVersion = { id: 'v-2' };
    mockRollback.mockResolvedValue(mockVersion);
    const result = await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
      versionId: 'v-2',
    });

    expect(result).toEqual({ version: mockVersion });
  });
});

// ============================================================================
// useSeedPrompt
// ============================================================================

describe('useSeedPrompt', () => {
  it('mutationFn calls promptApi.seedIfMissing with agentId, context, and seedPrompt', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useSeedPrompt());

    const bundle = { active: null, draft: 'Seed', versions: [] };
    mockSeedIfMissing.mockResolvedValue(bundle);
    await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
      seedPrompt: 'Seed',
    });

    expect(mockSeedIfMissing).toHaveBeenCalledWith('agent-1', 'initial', 'Seed');
  });

  it('mutationFn returns the bundle from seedIfMissing', async () => {
    let captured: Record<string, unknown> = {};
    mockUseMutation.mockImplementationOnce((opts: Record<string, unknown>) => {
      captured = opts;
      return {};
    });

    renderHook(() => useSeedPrompt());

    const bundle = { active: null, draft: 'Seed', versions: [] };
    mockSeedIfMissing.mockResolvedValue(bundle);
    const result = await (captured.mutationFn as (input: unknown) => Promise<unknown>)({
      agentId: 'agent-1',
      context: 'initial',
      seedPrompt: 'Seed',
    });

    expect(result).toBe(bundle);
  });
});
