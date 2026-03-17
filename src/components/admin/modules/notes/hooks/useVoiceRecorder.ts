/**
 * useVoiceRecorder — MediaRecorder hook for audio capture
 *
 * §6 — Hooks encapsulate browser API interaction
 * §11.1 — Local UI state only (recording lifecycle)
 *
 * Manages the full recording lifecycle: permission → recording → blob output.
 * Cleans up media streams on unmount to prevent microphone leaks.
 *
 * @module notes/hooks/useVoiceRecorder
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { MAX_RECORDING_DURATION_MS, RECORDING_TICK_MS } from '../constants';

// ============================================================================
// TYPES
// ============================================================================

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error';

export interface VoiceRecorderState {
  /** Current recorder status */
  status: RecorderStatus;
  /** Elapsed recording time in seconds */
  elapsedSeconds: number;
  /** Captured audio blob (available after stop) */
  audioBlob: Blob | null;
  /** Audio format of the captured blob */
  audioFormat: string;
  /** Error message if status is 'error' */
  errorMessage: string | null;
}

export interface VoiceRecorderControls {
  /** Request mic permission and start recording */
  startRecording: () => Promise<void>;
  /** Stop the current recording */
  stopRecording: () => void;
  /** Reset to idle state, discarding any captured audio */
  reset: () => void;
}

export type UseVoiceRecorderReturn = VoiceRecorderState & VoiceRecorderControls;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determine the best supported audio MIME type for MediaRecorder.
 * Prefers webm/opus (small files, Whisper-compatible), falls back to wav.
 */
function getSupportedMimeType(): { mimeType: string; format: string } {
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', format: 'webm' },
    { mimeType: 'audio/webm', format: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', format: 'ogg' },
    { mimeType: 'audio/mp4', format: 'mp4' },
    { mimeType: 'audio/wav', format: 'wav' },
  ];

  for (const candidate of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  // Fallback — let the browser choose
  return { mimeType: '', format: 'webm' };
}

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFormat, setAudioFormat] = useState('webm');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cleanup helper ──────────────────────────────────────────────────────
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
      }
    };
  }, [cleanupStream]);

  // ── Start recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('error');
      setErrorMessage('Your browser does not support audio recording. Please use a modern browser.');
      return;
    }

    setStatus('requesting');
    setErrorMessage(null);
    setAudioBlob(null);
    chunksRef.current = [];
    setElapsedSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Whisper optimal sample rate
        },
      });
      streamRef.current = stream;

      const { mimeType, format } = getSupportedMimeType();
      setAudioFormat(format);

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setStatus('stopped');
        cleanupStream();
      };

      recorder.onerror = () => {
        setStatus('error');
        setErrorMessage('Recording failed unexpectedly. Please try again.');
        cleanupStream();
      };

      // Start recording with 250ms timeslice for chunked data
      recorder.start(250);
      setStatus('recording');

      // Elapsed time ticker
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, RECORDING_TICK_MS);

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_DURATION_MS);
    } catch (err) {
      setStatus('error');
      cleanupStream();

      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setErrorMessage(
            'Microphone access was denied. Please allow microphone access in your browser settings and try again.'
          );
        } else if (err.name === 'NotFoundError') {
          setErrorMessage('No microphone detected. Please connect a microphone and try again.');
        } else {
          setErrorMessage(`Microphone error: ${err.message}`);
        }
      } else {
        setErrorMessage('An unexpected error occurred while starting the recording.');
      }
    }
  }, [cleanupStream]);

  // ── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Reset to idle ───────────────────────────────────────────────────────
  const reset = useCallback(() => {
    cleanupStream();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setStatus('idle');
    setElapsedSeconds(0);
    setAudioBlob(null);
    setAudioFormat('webm');
    setErrorMessage(null);
  }, [cleanupStream]);

  return {
    status,
    elapsedSeconds,
    audioBlob,
    audioFormat,
    errorMessage,
    startRecording,
    stopRecording,
    reset,
  };
}
