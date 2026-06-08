/**
 * Tests for useSummariseNote hook
 *
 * Covers: initial state, successful summarisation (invalidates cache + toast),
 * error handling (toast.error), and API call verification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useSummariseNote } from '../useSummariseNote';

// ============================================================================
// MOCKS
// ============================================================================

const mockSummariseNote = vi.fn();

vi.mock('../../api', () => ({
  NotesAPI: {
    summariseNote: (...args: unknown[]) => mockSummariseNote(...args),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockInvalidateQueries = vi.fn();

vi.mock('../queryKeys', () => ({
  noteKeys: {
    all: ['notes'] as const,
    lists: () => ['notes', 'list'] as const,
    list: (id: string) => ['notes', 'list', id] as const,
    details: () => ['notes', 'detail'] as const,
    detail: (id: string) => ['notes', 'detail', id] as const,
    clientNotes: (clientId: string) => ['notes', 'client', clientId] as const,
  },
}));

// ============================================================================
// WRAPPER
// ============================================================================

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  // Spy on the actual invalidateQueries so we can assert it was called
  vi.spyOn(qc, 'invalidateQueries').mockImplementation(
    (...args: unknown[]) => mockInvalidateQueries(...args) as Promise<void>,
  );
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const MOCK_NOTE = {
  id: 'note-001',
  title: 'Meeting Notes',
  content: 'Original content',
  personnelId: 'per-001',
  personnelName: 'Adviser A',
  tags: [],
  color: 'default' as const,
  isPinned: false,
  isArchived: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useSummariseNote — initial state', () => {
  it('is not pending on mount', () => {
    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });
    expect(result.current.isPending).toBe(false);
  });

  it('has no data on mount', () => {
    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });
    expect(result.current.data).toBeUndefined();
  });

  it('has no error on mount', () => {
    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });
    expect(result.current.error).toBeNull();
  });

  it('exposes a mutate function', () => {
    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutate).toBe('function');
  });

  it('exposes a mutateAsync function', () => {
    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });
    expect(typeof result.current.mutateAsync).toBe('function');
  });
});

describe('useSummariseNote — successful summarisation', () => {
  it('calls NotesAPI.summariseNote with the given note ID', async () => {
    mockSummariseNote.mockResolvedValue({ summary: 'Key points', note: MOCK_NOTE });

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSummariseNote).toHaveBeenCalledWith('note-001');
  });

  it('sets data to the API response on success', async () => {
    const apiResponse = { summary: 'Key points', note: MOCK_NOTE };
    mockSummariseNote.mockResolvedValue(apiResponse);

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual(apiResponse);
  });

  it('calls toast.success on success', async () => {
    mockSummariseNote.mockResolvedValue({ summary: 'Summary', note: MOCK_NOTE });

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Note summarised',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('invalidates the notes query cache on success', async () => {
    mockSummariseNote.mockResolvedValue({ summary: 'Summary', note: MOCK_NOTE });

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(mockInvalidateQueries).toHaveBeenCalled());

    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['notes']) }),
    );
  });

  it('isPending is true while mutation is in-flight', async () => {
    let resolveFn!: (v: unknown) => void;
    mockSummariseNote.mockReturnValue(
      new Promise((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    act(() => {
      resolveFn({ summary: 'done', note: MOCK_NOTE });
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});

describe('useSummariseNote — error handling', () => {
  it('calls toast.error on failure', async () => {
    mockSummariseNote.mockRejectedValue(new Error('AI unavailable'));

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());

    expect(mockToastError).toHaveBeenCalledWith(
      'Failed to summarise note',
      expect.objectContaining({ description: 'AI unavailable' }),
    );
  });

  it('exposes the error object on failure', async () => {
    mockSummariseNote.mockRejectedValue(new Error('Service down'));

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('Service down');
  });

  it('does not call toast.success on failure', async () => {
    mockSummariseNote.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('does not invalidate cache on failure', async () => {
    mockSummariseNote.mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useSummariseNote(), { wrapper: makeWrapper() });

    act(() => {
      result.current.mutate('note-001');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });
});
