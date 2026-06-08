/**
 * Tests for notes mutation hooks.
 *
 * Strategy: mock @tanstack/react-query's `useMutation` and `useQueryClient` so
 * we can inspect the options object passed in without needing a QueryClientProvider
 * or a live network.  Each test extracts mutationFn / onSuccess / onError from
 * the captured options and calls them directly.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: (...args: unknown[]) => mockInvalidateQueries(...args),
};

vi.mock('@tanstack/react-query', () => ({
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockQueryClient,
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// noteKeys re-export shim points at utils/queryKeys — mock the shim path
vi.mock('../queryKeys', () => ({
  noteKeys: {
    all: ['notes'],
    lists: () => ['notes', 'list'],
    list: (id: string) => ['notes', 'list', id],
    details: () => ['notes', 'detail'],
    detail: (id: string) => ['notes', 'detail', id],
    clientNotes: (id: string) => ['notes', 'client', id],
  },
}));

vi.mock('../../../../../../utils/queryKeys', () => ({
  tasksKeys: { all: ['tasks'] },
}));

vi.mock('../../api', () => ({
  NotesAPI: {
    createNote: (...args: unknown[]) => mockCreateNote(...args),
    updateNote: (...args: unknown[]) => mockUpdateNote(...args),
    deleteNote: (...args: unknown[]) => mockDeleteNote(...args),
    convertToTask: (...args: unknown[]) => mockConvertToTask(...args),
  },
}));

// ── Mock fn references (defined after vi.mock to avoid hoisting issues) ───────

const mockUseMutation = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockConvertToTask = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import {
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useConvertNoteToTask,
} from '../useNoteMutations';
import { noteKeys } from '../queryKeys';
import { tasksKeys } from '../../../../../../utils/queryKeys';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Captures the options object passed to useMutation and returns it. */
function captureOptions<T = unknown>(): {
  mutationFn: (input: T) => Promise<unknown>;
  onSuccess: (data: unknown, variables: T) => void;
  onError: (error: Error) => void;
} {
  let captured: ReturnType<typeof captureOptions<T>> | undefined;
  mockUseMutation.mockImplementationOnce((opts: typeof captured) => {
    captured = opts as typeof captured;
    return {}; // the hook returns the useMutation result; we don't need it here
  });
  return captured!;
}

/** Minimal Note shape returned by mutations */
const NOTE = {
  id: 'note-1',
  personnelId: 'p-1',
  clientId: 'c-1',
  title: 'Test',
  content: '',
  tags: [],
  color: 'default' as const,
  isPinned: false,
  isArchived: false,
  personnelName: 'Tester',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCreateNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls NotesAPI.createNote in mutationFn', async () => {
    mockCreateNote.mockResolvedValue(NOTE);
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useCreateNote();

    expect(opts).toBeDefined();
    const input = { title: 'T', personnelId: 'p-1', personnelName: 'X' };
    await opts!.mutationFn(input);
    expect(mockCreateNote).toHaveBeenCalledWith(input);
  });

  it('onSuccess invalidates personnel list and toasts success', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useCreateNote();

    const variables = { title: 'T', personnelId: 'p-1', personnelName: 'X' };
    opts!.onSuccess(NOTE, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.list('p-1') });
    expect(mockToastSuccess).toHaveBeenCalledWith('Note created');
  });

  it('onSuccess also invalidates clientNotes when clientId is present', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useCreateNote();

    const variables = { title: 'T', personnelId: 'p-1', personnelName: 'X', clientId: 'c-1' };
    opts!.onSuccess(NOTE, variables);

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.clientNotes('c-1') });
  });

  it('onSuccess does NOT invalidate clientNotes when clientId is absent', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useCreateNote();

    const variables = { title: 'T', personnelId: 'p-1', personnelName: 'X' };
    opts!.onSuccess(NOTE, variables);

    const calls = mockInvalidateQueries.mock.calls.map((c) => JSON.stringify(c));
    const hasClientCall = calls.some((s) => s.includes('client'));
    expect(hasClientCall).toBe(false);
  });

  it('onError calls toast.error with the error message', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useCreateNote();

    opts!.onError(new Error('network down'));
    expect(mockToastError).toHaveBeenCalledWith('Failed to create note', {
      description: 'network down',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useUpdateNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls NotesAPI.updateNote in mutationFn', async () => {
    mockUpdateNote.mockResolvedValue(NOTE);
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useUpdateNote();

    const input = { id: 'note-1', title: 'Updated' };
    await opts!.mutationFn(input);
    expect(mockUpdateNote).toHaveBeenCalledWith(input);
  });

  it('onSuccess invalidates list, detail, clientNotes, and all', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useUpdateNote();

    opts!.onSuccess(NOTE, { id: 'note-1' });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.list('p-1') });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.detail('note-1') });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.clientNotes('c-1') });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.all });
  });

  it('onSuccess does NOT call clientNotes invalidation when clientId is null', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useUpdateNote();

    const noteWithoutClient = { ...NOTE, clientId: null };
    opts!.onSuccess(noteWithoutClient, { id: 'note-1' });

    const calls = mockInvalidateQueries.mock.calls.map((c) => JSON.stringify(c));
    const hasClientCall = calls.some((s) => s.includes('"client"'));
    expect(hasClientCall).toBe(false);
  });

  it('onError calls toast.error with the error message', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useUpdateNote();

    opts!.onError(new Error('server error'));
    expect(mockToastError).toHaveBeenCalledWith('Failed to update note', {
      description: 'server error',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useDeleteNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls NotesAPI.deleteNote in mutationFn', async () => {
    mockDeleteNote.mockResolvedValue(undefined);
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useDeleteNote();

    await opts!.mutationFn('note-42');
    expect(mockDeleteNote).toHaveBeenCalledWith('note-42');
  });

  it('onSuccess invalidates all notes and toasts success', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useDeleteNote();

    opts!.onSuccess(undefined, 'note-42');
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.all });
    expect(mockToastSuccess).toHaveBeenCalledWith('Note deleted');
  });

  it('onError calls toast.error with the error message', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useDeleteNote();

    opts!.onError(new Error('delete failed'));
    expect(mockToastError).toHaveBeenCalledWith('Failed to delete note', {
      description: 'delete failed',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useConvertNoteToTask', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls NotesAPI.convertToTask in mutationFn', async () => {
    mockConvertToTask.mockResolvedValue({ taskId: 't-1', note: NOTE });
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useConvertNoteToTask();

    await opts!.mutationFn('note-7');
    expect(mockConvertToTask).toHaveBeenCalledWith('note-7');
  });

  it('onSuccess invalidates all notes, all tasks, and toasts success', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useConvertNoteToTask();

    opts!.onSuccess({ taskId: 't-1', note: NOTE }, 'note-7');

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: noteKeys.all });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: tasksKeys.all });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Note converted to task',
      expect.objectContaining({ description: expect.any(String) }),
    );
  });

  it('onError calls toast.error with the error message', () => {
    let opts: ReturnType<typeof captureOptions> | undefined;
    mockUseMutation.mockImplementationOnce((o: unknown) => {
      opts = o as typeof opts;
      return {};
    });

    useConvertNoteToTask();

    opts!.onError(new Error('conversion failed'));
    expect(mockToastError).toHaveBeenCalledWith('Failed to convert note', {
      description: 'conversion failed',
    });
  });
});
