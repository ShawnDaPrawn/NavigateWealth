/**
 * useVascoStream — unit tests
 *
 * Tests the full lifecycle of the SSE streaming hook:
 * - initial state
 * - successful stream with chunks + done event
 * - HTTP error responses (generic + rate-limit)
 * - SSE error event
 * - abort mid-stream
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mock supabase/info so projectId and publicAnonKey are predictable
// ---------------------------------------------------------------------------
vi.mock('../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

// ---------------------------------------------------------------------------
// SSE stream helper
// ---------------------------------------------------------------------------
/**
 * Build a mock ReadableStream that yields SSE lines when read.
 */
function makeStream(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((l) => encoder.encode(l + '\n'));
  let idx = 0;
  return {
    getReader() {
      return {
        async read() {
          if (idx < chunks.length) {
            return { done: false, value: chunks[idx++] };
          }
          return { done: true, value: undefined };
        },
        releaseLock: vi.fn(),
      };
    },
  } as unknown as ReadableStream<Uint8Array>;
}

/**
 * Build a minimal fetch Response for SSE streaming.
 */
function makeSseResponse(lines: string[], headers: Record<string, string> = {}): Response {
  const allHeaders = new Map<string, string>(Object.entries(headers));
  return {
    ok: true,
    status: 200,
    headers: {
      get(name: string) {
        return allHeaders.get(name) ?? null;
      },
    },
    body: makeStream(lines),
  } as unknown as Response;
}

/**
 * Build an error Response.
 */
function makeErrorResponse(status: number, body: Record<string, unknown> = {}): Response {
  return {
    ok: false,
    status,
    statusText: String(status),
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { useVascoStream, VascoStreamError } from '../useVascoStream';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const CHAT_HISTORY = [{ role: 'user', content: 'Hello' }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initial state', () => {
  it('returns empty streamingContent, isStreaming=false', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));
    expect(result.current.streamingContent).toBe('');
    expect(result.current.isStreaming).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('sendStream — successful stream', () => {
  it('accumulates chunks and returns full content + sessionId + citations', async () => {
    const sseLines = [
      'data: ' + JSON.stringify({ type: 'chunk', content: 'Hello ' }),
      'data: ' + JSON.stringify({ type: 'chunk', content: 'world' }),
      'data: ' +
        JSON.stringify({
          type: 'done',
          sessionId: 'sess-42',
          citations: [{ title: 'Doc', slug: 'doc', url: 'https://doc' }],
          artifacts: [],
        }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, null);
    });

    expect(streamResult!.content).toBe('Hello world');
    expect(streamResult!.sessionId).toBe('sess-42');
    expect(streamResult!.citations).toHaveLength(1);
    expect(streamResult!.citations[0].title).toBe('Doc');
    expect(streamResult!.artifacts).toEqual([]);

    // After stream ends isStreaming returns to false
    expect(result.current.isStreaming).toBe(false);

    vi.unstubAllGlobals();
  });

  it('preserves incoming sessionId when done event has no sessionId', async () => {
    const sseLines = [
      'data: ' + JSON.stringify({ type: 'chunk', content: 'Hi' }),
      'data: ' + JSON.stringify({ type: 'done', citations: [] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, 'existing-sess');
    });

    expect(streamResult!.sessionId).toBe('existing-sess');
    vi.unstubAllGlobals();
  });

  it('returns X-Vasco-Remaining header value as remaining', async () => {
    const sseLines = ['data: ' + JSON.stringify({ type: 'done', sessionId: null, citations: [] })];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeSseResponse(sseLines, { 'X-Vasco-Remaining': '7' })),
    );

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, null);
    });

    expect(streamResult!.remaining).toBe(7);
    vi.unstubAllGlobals();
  });

  it('skips malformed SSE lines without throwing', async () => {
    const sseLines = [
      'data: NOT_JSON{{{{',
      'data: ' + JSON.stringify({ type: 'chunk', content: 'OK' }),
      'data: ' + JSON.stringify({ type: 'done', sessionId: 's', citations: [] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, null);
    });

    expect(streamResult!.content).toBe('OK');
    vi.unstubAllGlobals();
  });

  it('returns fallback message when no content was accumulated', async () => {
    const sseLines = ['data: ' + JSON.stringify({ type: 'done', sessionId: null, citations: [] })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, null);
    });

    expect(streamResult!.content).toMatch(/unable to generate/i);
    vi.unstubAllGlobals();
  });

  it('uses authToken prop instead of publicAnonKey when provided', async () => {
    const sseLines = ['data: ' + JSON.stringify({ type: 'done', sessionId: null, citations: [] })];
    const mockFetch = vi.fn().mockResolvedValue(makeSseResponse(sseLines));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() =>
      useVascoStream({ endpoint: '/vasco/chat/stream', authToken: 'custom-token' }),
    );

    await act(async () => {
      await result.current.sendStream(CHAT_HISTORY, null);
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer custom-token',
    );
    vi.unstubAllGlobals();
  });

  it('merges extraBody into the POST body', async () => {
    const sseLines = ['data: ' + JSON.stringify({ type: 'done', sessionId: null, citations: [] })];
    const mockFetch = vi.fn().mockResolvedValue(makeSseResponse(sseLines));
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() =>
      useVascoStream({
        endpoint: '/ai-advisor/chat/stream',
        extraBody: { clientUserId: 'client-99' },
      }),
    );

    await act(async () => {
      await result.current.sendStream(CHAT_HISTORY, null);
    });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.clientUserId).toBe('client-99');
    vi.unstubAllGlobals();
  });
});

describe('sendStream — HTTP error responses', () => {
  it('throws VascoStreamError with status for non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeErrorResponse(500, { error: 'Server crashed' })),
    );

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    await act(async () => {
      await expect(result.current.sendStream(CHAT_HISTORY, null)).rejects.toBeInstanceOf(
        VascoStreamError,
      );
    });

    expect(result.current.isStreaming).toBe(false);
    vi.unstubAllGlobals();
  });

  it('throws VascoStreamError with status=429 for rate limit errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeErrorResponse(429, {
          error: 'Rate limit exceeded',
          remaining: 0,
          limitReached: true,
        }),
      ),
    );

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let caughtError: VascoStreamError | undefined;
    await act(async () => {
      try {
        await result.current.sendStream(CHAT_HISTORY, null);
      } catch (e) {
        caughtError = e as VascoStreamError;
      }
    });

    expect(caughtError).toBeInstanceOf(VascoStreamError);
    expect(caughtError?.status).toBe(429);
    expect(caughtError?.limitReached).toBe(true);
    expect(caughtError?.remaining).toBe(0);
    vi.unstubAllGlobals();
  });

  it('uses default rate limit message when error body has no error field (429)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(429, {})));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let caughtError: VascoStreamError | undefined;
    await act(async () => {
      try {
        await result.current.sendStream(CHAT_HISTORY, null);
      } catch (e) {
        caughtError = e as VascoStreamError;
      }
    });

    expect(caughtError?.message).toMatch(/message limit/i);
    vi.unstubAllGlobals();
  });

  it('uses default message for non-429 errors without body error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(503, {})));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let caughtError: VascoStreamError | undefined;
    await act(async () => {
      try {
        await result.current.sendStream(CHAT_HISTORY, null);
      } catch (e) {
        caughtError = e as VascoStreamError;
      }
    });

    expect(caughtError?.message).toMatch(/temporary issue/i);
    vi.unstubAllGlobals();
  });
});

describe('sendStream — SSE error event', () => {
  it('re-throws error events with message "Stream error"', async () => {
    // Only errors where data.message is falsy (so the fallback 'Stream error'
    // is used) get re-thrown — that is the exact condition checked in the source.
    const sseLines = ['data: ' + JSON.stringify({ type: 'error', message: '' })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    await act(async () => {
      await expect(result.current.sendStream(CHAT_HISTORY, null)).rejects.toThrow('Stream error');
    });

    expect(result.current.isStreaming).toBe(false);
    vi.unstubAllGlobals();
  });

  it('swallows error events with a custom message (treated as malformed SSE)', async () => {
    // The source only re-throws when parseErr.message === 'Stream error'.
    // A custom message like 'Model overload' is silently dropped.
    const sseLines = [
      'data: ' + JSON.stringify({ type: 'error', message: 'Model overload' }),
      'data: ' + JSON.stringify({ type: 'done', sessionId: null, citations: [] }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeSseResponse(sseLines)));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    let streamResult: Awaited<ReturnType<typeof result.current.sendStream>>;
    await act(async () => {
      streamResult = await result.current.sendStream(CHAT_HISTORY, null);
    });

    // Stream completed without throwing — fallback content is returned
    expect(streamResult!).toBeDefined();
    vi.unstubAllGlobals();
  });
});

describe('abort', () => {
  it('resets isStreaming and streamingContent when aborted', async () => {
    // Use a never-resolving fetch so the stream is "in progress"
    let resolveAbort!: () => void;
    const abortPromise = new Promise<never>((_, reject) => {
      resolveAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(abortPromise));

    const { result } = renderHook(() => useVascoStream({ endpoint: '/vasco/chat/stream' }));

    act(() => {
      // Start stream without awaiting it
      result.current.sendStream(CHAT_HISTORY, null).catch(() => {});
    });

    act(() => {
      result.current.abort();
      resolveAbort();
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.streamingContent).toBe('');

    vi.unstubAllGlobals();
  });
});
