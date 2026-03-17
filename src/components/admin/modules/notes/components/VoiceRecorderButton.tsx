/**
 * VoiceRecorderButton — Voice-to-text transcription toolbar widget
 *
 * §7 — Presentation + local UI state only
 * §8 — Design System components
 * §8.4 — Figma Make platform constraints
 *
 * Provides two input methods:
 *   1. Live microphone recording (when browser/iframe permissions allow)
 *   2. Audio file upload fallback (always available)
 *
 * The file upload fallback exists because the app runs inside an iframe
 * in the Figma Make preview environment, which blocks getUserMedia unless
 * the iframe has allow="microphone". See WORKAROUND below.
 *
 * States:
 *   idle        → Mic icon button + upload option
 *   requesting  → Spinner while requesting mic permission
 *   recording   → Pulsing red indicator, elapsed time, stop button
 *   transcribing → Spinner with "Transcribing..." text
 *   result      → Transcribed text preview, Insert / Discard actions
 *   error       → Error message with retry + upload fallback
 *
 * @module notes/components/VoiceRecorderButton
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { useTranscribe } from '../hooks/useTranscribe';
import { MAX_RECORDING_DURATION_MS } from '../constants';
import { Button } from '../../../../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../ui/popover';
import {
  Mic,
  Square,
  Loader2,
  Check,
  X,
  RotateCcw,
  AlertCircle,
  Upload,
  FileAudio,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceRecorderButtonProps {
  /** Called when user confirms insertion of transcribed text */
  onInsertText: (text: string) => void;
  /** Whether the parent editor is in a state that accepts text input */
  disabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Accepted audio file types for upload */
const ACCEPTED_AUDIO_TYPES = '.webm,.wav,.mp3,.mp4,.m4a,.ogg,.flac';

/** Max upload file size: 25MB (OpenAI Whisper limit) */
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

// ============================================================================
// HELPERS
// ============================================================================

/** Format seconds to MM:SS display */
function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Max duration in seconds for display */
const MAX_DURATION_DISPLAY = formatElapsed(MAX_RECORDING_DURATION_MS / 1000);

/** Extract audio format from file name or MIME type */
function extractAudioFormat(file: File): string {
  // Try extension first
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ['webm', 'wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac'].includes(ext)) {
    return ext;
  }
  // Fall back to MIME type
  const mimeMap: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/wave': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/mp4': 'mp4',
    'audio/x-m4a': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  };
  return mimeMap[file.type] || 'webm';
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VoiceRecorderButton({ onInsertText, disabled = false }: VoiceRecorderButtonProps) {
  const recorder = useVoiceRecorder();
  const transcriber = useTranscribe();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Auto-transcribe when recording stops with audio data
  useEffect(() => {
    if (recorder.status === 'stopped' && recorder.audioBlob && !transcriber.isTranscribing) {
      transcriber.transcribe({
        audioBlob: recorder.audioBlob,
        format: recorder.audioFormat,
      });
    }
  }, [recorder.status, recorder.audioBlob, recorder.audioFormat]);

  // ── File upload handler ─────────────────────────────────────────────────
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      recorder.reset();
      transcriber.resetTranscription();
      // We'll show a manual error via the transcriber
      setUploadedFileName(null);
      alert(`File is too large (${formatFileSize(file.size)}). Maximum size is 25MB.`);
      return;
    }

    setUploadedFileName(file.name);
    setShowMenu(false);

    const format = extractAudioFormat(file);
    transcriber.transcribe({
      audioBlob: file,
      format,
    });

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [transcriber, recorder]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleInsert = useCallback(() => {
    if (transcriber.transcriptionResult?.text) {
      onInsertText(transcriber.transcriptionResult.text);
    }
    transcriber.resetTranscription();
    recorder.reset();
    setUploadedFileName(null);
  }, [transcriber.transcriptionResult, onInsertText, transcriber.resetTranscription, recorder.reset]);

  const handleDiscard = useCallback(() => {
    transcriber.resetTranscription();
    recorder.reset();
    setUploadedFileName(null);
  }, [transcriber.resetTranscription, recorder.reset]);

  const handleRetry = useCallback(() => {
    transcriber.resetTranscription();
    recorder.reset();
    setUploadedFileName(null);
  }, [transcriber.resetTranscription, recorder.reset]);

  const handleStartRecording = useCallback(() => {
    setShowMenu(false);
    recorder.startRecording();
  }, [recorder]);

  const handleUploadClick = useCallback(() => {
    setShowMenu(false);
    fileInputRef.current?.click();
  }, []);

  // ── Derived state ───────────────────────────────────────────────────────
  const isRecording = recorder.status === 'recording';
  const isRequesting = recorder.status === 'requesting';
  const isTranscribing = transcriber.isTranscribing;
  const hasResult = !!transcriber.transcriptionResult && !isTranscribing;
  const hasRecorderError = recorder.status === 'error' && !isTranscribing;
  const hasTranscriberError = !!transcriber.transcriptionError && !isTranscribing;
  const hasError = (hasRecorderError || hasTranscriberError) && !hasResult;
  const isIdle = recorder.status === 'idle' && !isTranscribing && !hasResult && !hasError;

  // WORKAROUND: When running inside an iframe without allow="microphone" (e.g. Figma Make preview),
  // getUserMedia throws NotAllowedError immediately without showing the browser permission prompt.
  // We detect this specific case and show a helpful message with the file upload fallback.
  // Proper fix: The embedding iframe would need allow="microphone" attribute.
  // Searchable tag: // WORKAROUND: iframe-microphone-permission
  const isMicPermissionError = recorder.status === 'error' &&
    recorder.errorMessage?.includes('denied');

  const errorMsg = hasTranscriberError
    ? (transcriber.transcriptionError?.message || 'Transcription failed.')
    : (recorder.errorMessage || 'An unexpected error occurred.');

  // ── Hidden file input (always rendered) ─────────────────────────────────
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPTED_AUDIO_TYPES}
      onChange={handleFileUpload}
      className="hidden"
      aria-hidden="true"
    />
  );

  // ── Idle state: popover menu with record + upload options ───────────────
  if (isIdle) {
    return (
      <div className="contents">
        {fileInput}
        <Popover open={showMenu} onOpenChange={setShowMenu}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Voice to text options"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Dictate</span>
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Record or upload audio to transcribe
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent align="start" className="w-56 p-1.5" sideOffset={4}>
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={handleStartRecording}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors text-left"
              >
                <Mic className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium text-xs">Record audio</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Use microphone (max {MAX_DURATION_DISPLAY})
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={handleUploadClick}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 rounded-md transition-colors text-left"
              >
                <Upload className="h-4 w-4 shrink-0" />
                <div>
                  <div className="font-medium text-xs">Upload audio file</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    MP3, WAV, M4A, WebM, OGG, FLAC
                  </div>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // ── Requesting mic permission ───────────────────────────────────────────
  if (isRequesting) {
    return (
      <div className="contents">
        {fileInput}
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 bg-gray-50 rounded-md border border-gray-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500" />
          <span>Requesting microphone...</span>
        </div>
      </div>
    );
  }

  // ── Recording state ─────────────────────────────────────────────────────
  if (isRecording) {
    return (
      <div className="contents">
        {fileInput}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-200 bg-red-50">
          {/* Pulsing red dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>

          <span className="text-xs font-medium text-red-700 tabular-nums min-w-[3ch]">
            {formatElapsed(recorder.elapsedSeconds)}
          </span>

          <button
            type="button"
            onClick={recorder.stopRecording}
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100 rounded transition-colors"
            aria-label="Stop recording"
          >
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </div>
      </div>
    );
  }

  // ── Transcribing state ──────────────────────────────────────────────────
  if (isTranscribing) {
    return (
      <div className="contents">
        {fileInput}
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-purple-700 bg-purple-50 rounded-md border border-purple-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>
            {uploadedFileName
              ? `Transcribing "${uploadedFileName.length > 20 ? uploadedFileName.substring(0, 20) + '...' : uploadedFileName}"...`
              : 'Transcribing audio...'}
          </span>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (hasError) {
    return (
      <div className="contents">
        {fileInput}
        <div className="flex flex-col gap-2 px-3 py-2 rounded-md border border-red-200 bg-red-50 max-w-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-700 truncate" title={errorMsg}>
              {isMicPermissionError
                ? 'Microphone access is blocked in this environment.'
                : errorMsg.length > 80
                  ? `${errorMsg.substring(0, 80)}...`
                  : errorMsg}
            </span>
          </div>

          {/* WORKAROUND: iframe-microphone-permission
              When mic is blocked, prominently offer the upload fallback */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
            >
              <Upload className="h-3 w-3" />
              Upload audio file instead
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {isMicPermissionError && (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Live recording requires microphone permissions which may be unavailable in embedded previews.
              Record audio using your device's voice recorder app, then upload the file.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Result state: preview transcribed text ──────────────────────────────
  if (hasResult) {
    const text = transcriber.transcriptionResult?.text || '';
    const warning = transcriber.transcriptionResult?.warning;
    const isEmpty = !text.trim();

    if (isEmpty) {
      return (
        <div className="contents">
          {fileInput}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-200 bg-amber-50 max-w-md">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-xs text-amber-700">
              {warning || 'No speech detected. Try again or upload a clearer recording.'}
            </span>
            <button
              type="button"
              onClick={handleUploadClick}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-100 rounded transition-colors shrink-0"
              aria-label="Upload audio file"
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 rounded transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="contents">
        {fileInput}
        <div className="flex items-start gap-2 w-full">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-md border border-purple-200 bg-purple-50/50">
            <div className="flex items-center gap-1.5 mb-1">
              <FileAudio className="h-3 w-3 text-purple-500" />
              <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wide">
                Transcription
              </span>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-3" title={text}>
              {text}
            </p>
            {warning && (
              <p className="text-[10px] text-amber-600 mt-1">{warning}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleInsert}
              className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
            >
              <Check className="h-3 w-3 mr-1" />
              Insert
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              className="h-7 px-2 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback — should be unreachable
  return <div className="contents">{fileInput}</div>;
}
