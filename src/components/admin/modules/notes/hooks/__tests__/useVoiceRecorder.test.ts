/**
 * Tests for useVoiceRecorder hook
 *
 * Covers: initial state, recording lifecycle, permission errors,
 * MediaRecorder events, cleanup, and reset.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVoiceRecorder } from '../useVoiceRecorder';

// ============================================================================
// MOCKS
// ============================================================================

const mockStop = vi.fn();
const mockStart = vi.fn();
let capturedOnStop: (() => void) | null = null;
let capturedOnDataAvailable: ((e: { data: Blob }) => void) | null = null;
let capturedOnError: (() => void) | null = null;
let mockRecorderState: 'inactive' | 'recording' = 'inactive';

class MockMediaRecorder {
  state: string = mockRecorderState;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
    this.state = 'inactive';
  }

  start(_timeslice?: number) {
    this.state = 'recording';
    mockStart();
  }

  stop() {
    this.state = 'inactive';
    mockStop();
    // Capture refs so tests can trigger events
    capturedOnStop = this.onstop;
    capturedOnDataAvailable = this.ondataavailable;
    capturedOnError = this.onerror;
    if (this.onstop) this.onstop();
  }

  static isTypeSupported(_type: string) {
    return true;
  }
}

// Store so we can capture event handlers after construction
const mediaRecorderInstances: MockMediaRecorder[] = [];

const originalMediaRecorder = globalThis.MediaRecorder;

const mockGetUserMedia = vi.fn();
const mockTrackStop = vi.fn();

function makeMockStream() {
  return {
    getTracks: () => [{ stop: (..._args: unknown[]) => mockTrackStop(..._args) }],
  } as unknown as MediaStream;
}

beforeEach(() => {
  vi.clearAllMocks();
  mediaRecorderInstances.length = 0;
  capturedOnStop = null;
  capturedOnDataAvailable = null;
  capturedOnError = null;

  // Override MediaRecorder with our mock that stores instance
  const OrigMock = MockMediaRecorder;
  const CapturingMock = class extends OrigMock {
    constructor(stream: MediaStream, options?: MediaRecorderOptions) {
      super(stream, options);
      mediaRecorderInstances.push(this);
    }
  };
  // @ts-expect-error - intentional mock override
  globalThis.MediaRecorder = CapturingMock;
  // @ts-expect-error - static method
  globalThis.MediaRecorder.isTypeSupported = (_type: string) => true;

  mockGetUserMedia.mockResolvedValue(makeMockStream());
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: { getUserMedia: (...args: unknown[]) => mockGetUserMedia(...args) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  globalThis.MediaRecorder = originalMediaRecorder;
});

// ============================================================================
// TESTS
// ============================================================================

describe('useVoiceRecorder — initial state', () => {
  it('returns idle status on mount', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.status).toBe('idle');
  });

  it('returns zero elapsed seconds on mount', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('returns null audioBlob on mount', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.audioBlob).toBeNull();
  });

  it('returns "webm" as default audioFormat', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.audioFormat).toBe('webm');
  });

  it('returns null errorMessage on mount', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(result.current.errorMessage).toBeNull();
  });

  it('exposes startRecording, stopRecording, and reset functions', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(typeof result.current.startRecording).toBe('function');
    expect(typeof result.current.stopRecording).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });
});

describe('useVoiceRecorder — startRecording', () => {
  it('transitions through requesting → recording', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('recording');
  });

  it('calls getUserMedia with audio constraints', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 16000,
      }),
    });
  });

  it('starts the MediaRecorder after getting stream', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockStart).toHaveBeenCalled();
  });

  it('resets elapsed seconds to 0 when starting', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('clears audioBlob when starting a new recording', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.audioBlob).toBeNull();
  });

  it('sets status to error when browser has no mediaDevices', async () => {
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/browser does not support/i);
  });

  it('sets status to error and message on NotAllowedError', async () => {
    const err = new DOMException('Permission denied', 'NotAllowedError');
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/microphone access was denied/i);
  });

  it('sets status to error and message on NotFoundError', async () => {
    const err = new DOMException('Device not found', 'NotFoundError');
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/no microphone detected/i);
  });

  it('sets a generic DOMException error message for other DOMException names', async () => {
    const err = new DOMException('Something else', 'AbortError');
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/microphone error/i);
  });

  it('sets a generic error message for non-DOMException errors', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('unknown'));

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/unexpected error/i);
  });
});

describe('useVoiceRecorder — stopRecording', () => {
  it('transitions from recording to stopped via onstop event', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    // stopRecording triggers the mock which fires onstop synchronously
    act(() => {
      result.current.stopRecording();
    });

    expect(result.current.status).toBe('stopped');
  });

  it('produces an audioBlob after stopping', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      // Simulate data available before stop
      const instance = mediaRecorderInstances[0];
      if (instance?.ondataavailable) {
        instance.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
      }
      result.current.stopRecording();
    });

    expect(result.current.audioBlob).toBeInstanceOf(Blob);
  });

  it('does nothing when not recording', () => {
    const { result } = renderHook(() => useVoiceRecorder());
    // Should not throw when no recorder is active
    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.status).toBe('idle');
  });
});

describe('useVoiceRecorder — reset', () => {
  it('resets all state back to defaults', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.stopRecording();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedSeconds).toBe(0);
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.audioFormat).toBe('webm');
    expect(result.current.errorMessage).toBeNull();
  });

  it('can reset from error state', async () => {
    mockGetUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.errorMessage).toBeNull();
  });
});

describe('useVoiceRecorder — MediaRecorder onerror', () => {
  it('sets status to error when MediaRecorder fires onerror', async () => {
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      const instance = mediaRecorderInstances[0];
      if (instance?.onerror) instance.onerror();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorMessage).toMatch(/recording failed/i);
  });
});
