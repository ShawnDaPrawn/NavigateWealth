/**
 * Tests for useTranscribe hook
 *
 * Covers: initial state, successful transcription, API errors,
 * empty audio blob handling, and reset.
 *
 * Strategy: vi.stubGlobal('FileReader', …) so the module picks up our mock,
 * then we wait for the reader to be instantiated before driving it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';

// ============================================================================
// MOCKS (must be declared before the import of the module under test,
//        because vi.mock is hoisted and vi.stubGlobal runs at eval time)
// ============================================================================

const mockTranscribe = vi.fn();

vi.mock('../../api', () => ({
  NotesAPI: {
    transcribe: (...args: unknown[]) => mockTranscribe(...args),
  },
}));

// ---------------------------------------------------------------------------
// FileReader mock
// ---------------------------------------------------------------------------
// We store captures in a module-level array so each test's reader is isolated.
// The mock's readAsDataURL does NOT call onloadend automatically; tests drive it.

type MockReaderInstance = {
  result: string | null;
  onloadend: (() => void) | null;
  onerror: (() => void) | null;
};

const readerInstances: MockReaderInstance[] = [];

class MockFileReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(_blob: Blob) {
    // Register this instance — tests will fire onloadend / onerror manually
    readerInstances.push(this);
  }
}

vi.stubGlobal('FileReader', MockFileReader);

// ---------------------------------------------------------------------------
// Import the hook AFTER stubs are set up
// ---------------------------------------------------------------------------
import { useTranscribe } from '../useTranscribe';

// ============================================================================
// HELPERS
// ============================================================================

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

function makeBlob(content = 'audio-data') {
  return new Blob([content], { type: 'audio/webm' });
}

/**
 * Wait until a FileReader instance has been captured (i.e. readAsDataURL was
 * called inside the mutationFn), then fire onloadend with the provided data URI.
 */
async function driveReader(dataUri: string) {
  await waitFor(() => expect(readerInstances.length).toBeGreaterThan(0));
  const reader = readerInstances[readerInstances.length - 1];
  await act(async () => {
    reader.result = dataUri;
    reader.onloadend?.();
  });
}

/**
 * Wait for a reader instance then fire onerror.
 */
async function driveReaderError() {
  await waitFor(() => expect(readerInstances.length).toBeGreaterThan(0));
  const reader = readerInstances[readerInstances.length - 1];
  await act(async () => {
    reader.onerror?.();
  });
}

/**
 * Wait for a reader instance then fire onloadend with null result.
 */
async function driveReaderNullResult() {
  await waitFor(() => expect(readerInstances.length).toBeGreaterThan(0));
  const reader = readerInstances[readerInstances.length - 1];
  await act(async () => {
    reader.result = null;
    reader.onloadend?.();
  });
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  readerInstances.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useTranscribe — initial state', () => {
  it('isTranscribing is false on mount', () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });
    expect(result.current.isTranscribing).toBe(false);
  });

  it('transcriptionResult is null on mount', () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });
    expect(result.current.transcriptionResult).toBeNull();
  });

  it('transcriptionError is null on mount', () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });
    expect(result.current.transcriptionError).toBeNull();
  });

  it('exposes transcribe, transcribeAsync, isTranscribing, transcriptionResult, transcriptionError, resetTranscription', () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });
    expect(typeof result.current.transcribe).toBe('function');
    expect(typeof result.current.transcribeAsync).toBe('function');
    expect(typeof result.current.resetTranscription).toBe('function');
  });
});

describe('useTranscribe — successful transcription', () => {
  it('calls NotesAPI.transcribe with base64 audio, format, and language', async () => {
    mockTranscribe.mockResolvedValue({ text: 'Hello world', duration: 5 });

    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribeAsync({
        audioBlob: makeBlob(),
        format: 'webm',
        language: 'en',
      });
    });

    await driveReader('data:audio/webm;base64,dGVzdA==');

    await waitFor(() => expect(mockTranscribe).toHaveBeenCalled());
    expect(mockTranscribe).toHaveBeenCalledWith('dGVzdA==', 'webm', 'en');
  });

  it('sets transcriptionResult on success', async () => {
    const transcribeResult = { text: 'Portfolio review', duration: 10 };
    mockTranscribe.mockResolvedValue(transcribeResult);

    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribeAsync({ audioBlob: makeBlob(), format: 'webm' });
    });

    await driveReader('data:audio/webm;base64,dGVzdA==');

    await waitFor(() => expect(result.current.transcriptionResult).not.toBeNull());
    expect(result.current.transcriptionResult).toEqual(transcribeResult);
    expect(result.current.isTranscribing).toBe(false);
  });

  it('passes undefined language when not provided', async () => {
    mockTranscribe.mockResolvedValue({ text: 'Test' });

    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribeAsync({ audioBlob: makeBlob(), format: 'ogg' });
    });

    await driveReader('data:audio/ogg;base64,dGVzdA==');

    await waitFor(() => expect(mockTranscribe).toHaveBeenCalled());
    expect(mockTranscribe).toHaveBeenCalledWith('dGVzdA==', 'ogg', undefined);
  });
});

describe('useTranscribe — error handling', () => {
  it('sets transcriptionError when NotesAPI.transcribe rejects', async () => {
    mockTranscribe.mockRejectedValue(new Error('Service unavailable'));

    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    // Use transcribe (fire-and-forget) to avoid unhandled rejection warnings
    act(() => {
      result.current.transcribe({ audioBlob: makeBlob(), format: 'webm' });
    });

    await driveReader('data:audio/webm;base64,dGVzdA==');

    await waitFor(() => expect(result.current.transcriptionError).not.toBeNull());
    expect(result.current.transcriptionError?.message).toBe('Service unavailable');
    expect(result.current.transcriptionResult).toBeNull();
  });

  it('throws when the audio blob produces empty base64', async () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribe({ audioBlob: makeBlob(), format: 'webm' });
    });

    // "data:audio/webm;base64," — empty payload after the comma
    await driveReader('data:audio/webm;base64,');

    await waitFor(() => expect(result.current.transcriptionError).not.toBeNull());
    expect(result.current.transcriptionError?.message).toMatch(/empty/i);
    expect(mockTranscribe).not.toHaveBeenCalled();
  });

  it('sets transcriptionError when FileReader fires onerror', async () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribe({ audioBlob: makeBlob(), format: 'webm' });
    });

    await driveReaderError();

    await waitFor(() => expect(result.current.transcriptionError).not.toBeNull());
    expect(result.current.transcriptionError?.message).toMatch(/failed to read/i);
  });

  it('sets transcriptionError when FileReader result is not a string', async () => {
    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribe({ audioBlob: makeBlob(), format: 'webm' });
    });

    await driveReaderNullResult();

    await waitFor(() => expect(result.current.transcriptionError).not.toBeNull());
    expect(result.current.transcriptionError?.message).toMatch(/failed to read audio data/i);
  });
});

describe('useTranscribe — resetTranscription', () => {
  it('clears transcriptionResult after reset', async () => {
    mockTranscribe.mockResolvedValue({ text: 'Done' });

    const { result } = renderHook(() => useTranscribe(), { wrapper: makeWrapper() });

    act(() => {
      result.current.transcribeAsync({ audioBlob: makeBlob(), format: 'webm' });
    });

    await driveReader('data:audio/webm;base64,dGVzdA==');

    await waitFor(() => expect(result.current.transcriptionResult).not.toBeNull());

    await act(async () => {
      result.current.resetTranscription();
    });

    await waitFor(() => expect(result.current.transcriptionResult).toBeNull());
    expect(result.current.transcriptionError).toBeNull();
  });
});
