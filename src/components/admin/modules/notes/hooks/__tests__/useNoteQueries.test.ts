/**
 * Tests for notes query hooks.
 *
 * Strategy: mock @tanstack/react-query's `useQuery` so we can inspect the
 * options object (queryKey, queryFn, enabled, staleTime) without needing a
 * QueryClientProvider or live network.  Each test calls useQuery, grabs the
 * captured options, and asserts on them.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

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

vi.mock('../../api', () => ({
  NotesAPI: {
    getNotes: (...args: unknown[]) => mockGetNotes(...args),
    getClientNotes: (...args: unknown[]) => mockGetClientNotes(...args),
    getNote: (...args: unknown[]) => mockGetNote(...args),
  },
}));

vi.mock('../../constants', () => ({
  NOTES_STALE_TIME: 120_000,
}));

// ── Mock fn references ────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockGetNotes = vi.fn();
const mockGetClientNotes = vi.fn();
const mockGetNote = vi.fn();

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { useNotes, useClientNotes, useNote } from '../useNoteQueries';
import { noteKeys } from '../queryKeys';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<unknown>;
  enabled: boolean;
  staleTime: number;
}

/** Invokes the hook under test, captures and returns the options useQuery received. */
function captureQueryOptions(invoke: () => void): QueryOptions {
  let captured: QueryOptions | undefined;
  mockUseQuery.mockImplementationOnce((opts: unknown) => {
    captured = opts as QueryOptions;
    return {};
  });
  invoke();
  return captured!;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNotes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useNotes('p-1'));
    expect(opts.queryKey).toEqual(noteKeys.list('p-1'));
  });

  it('uses empty-string fallback in queryKey when personnelId is undefined', () => {
    const opts = captureQueryOptions(() => useNotes(undefined));
    expect(opts.queryKey).toEqual(noteKeys.list(''));
  });

  it('is enabled when personnelId is provided', () => {
    const opts = captureQueryOptions(() => useNotes('p-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when personnelId is undefined', () => {
    const opts = captureQueryOptions(() => useNotes(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when personnelId is empty string', () => {
    const opts = captureQueryOptions(() => useNotes(''));
    expect(opts.enabled).toBe(false);
  });

  it('passes NOTES_STALE_TIME as staleTime', () => {
    const opts = captureQueryOptions(() => useNotes('p-1'));
    expect(opts.staleTime).toBe(120_000);
  });

  it('queryFn calls NotesAPI.getNotes with the personnelId', async () => {
    mockGetNotes.mockResolvedValue([]);
    const opts = captureQueryOptions(() => useNotes('p-1'));
    await opts.queryFn();
    expect(mockGetNotes).toHaveBeenCalledWith('p-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useClientNotes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useClientNotes('c-1'));
    expect(opts.queryKey).toEqual(noteKeys.clientNotes('c-1'));
  });

  it('uses empty-string fallback in queryKey when clientId is undefined', () => {
    const opts = captureQueryOptions(() => useClientNotes(undefined));
    expect(opts.queryKey).toEqual(noteKeys.clientNotes(''));
  });

  it('is enabled when clientId is provided', () => {
    const opts = captureQueryOptions(() => useClientNotes('c-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when clientId is undefined', () => {
    const opts = captureQueryOptions(() => useClientNotes(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when clientId is empty string', () => {
    const opts = captureQueryOptions(() => useClientNotes(''));
    expect(opts.enabled).toBe(false);
  });

  it('passes NOTES_STALE_TIME as staleTime', () => {
    const opts = captureQueryOptions(() => useClientNotes('c-1'));
    expect(opts.staleTime).toBe(120_000);
  });

  it('queryFn calls NotesAPI.getClientNotes with the clientId', async () => {
    mockGetClientNotes.mockResolvedValue([]);
    const opts = captureQueryOptions(() => useClientNotes('c-1'));
    await opts.queryFn();
    expect(mockGetClientNotes).toHaveBeenCalledWith('c-1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useNote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes the correct queryKey', () => {
    const opts = captureQueryOptions(() => useNote('note-1'));
    expect(opts.queryKey).toEqual(noteKeys.detail('note-1'));
  });

  it('uses empty-string fallback in queryKey when noteId is undefined', () => {
    const opts = captureQueryOptions(() => useNote(undefined));
    expect(opts.queryKey).toEqual(noteKeys.detail(''));
  });

  it('is enabled when noteId is provided', () => {
    const opts = captureQueryOptions(() => useNote('note-1'));
    expect(opts.enabled).toBe(true);
  });

  it('is disabled when noteId is undefined', () => {
    const opts = captureQueryOptions(() => useNote(undefined));
    expect(opts.enabled).toBe(false);
  });

  it('is disabled when noteId is empty string', () => {
    const opts = captureQueryOptions(() => useNote(''));
    expect(opts.enabled).toBe(false);
  });

  it('passes NOTES_STALE_TIME as staleTime', () => {
    const opts = captureQueryOptions(() => useNote('note-1'));
    expect(opts.staleTime).toBe(120_000);
  });

  it('queryFn calls NotesAPI.getNote with the noteId', async () => {
    mockGetNote.mockResolvedValue({ id: 'note-1' });
    const opts = captureQueryOptions(() => useNote('note-1'));
    await opts.queryFn();
    expect(mockGetNote).toHaveBeenCalledWith('note-1');
  });
});
