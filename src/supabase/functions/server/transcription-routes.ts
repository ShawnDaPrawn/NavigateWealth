/**
 * ****************************************************************************
 * TRANSCRIPTION ROUTES
 * ****************************************************************************
 *
 * VERSION: 1.0.0
 *
 * Voice-to-text transcription using OpenAI Whisper API.
 * Accepts base64-encoded audio from the frontend, forwards to Whisper,
 * and returns the transcribed text.
 *
 * §4.2 — Thin route handler delegating to service logic
 * §3.2 — Three-tier: Frontend -> Server -> External API (OpenAI)
 * §12.2 — All routes require admin authentication
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import { requireAdmin } from "./auth-mw.ts";

const app = new Hono();
const log = createModuleLogger('transcription');

// All transcription routes require admin authentication
app.use('*', requireAdmin);

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum audio payload size (10MB base64 ~ ~7.5MB raw audio) */
const MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024;

/** Supported audio MIME type suffixes for Whisper */
const SUPPORTED_FORMATS = ['webm', 'wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac'] as const;
type AudioFormat = typeof SUPPORTED_FORMATS[number];

/** MIME type mapping for FormData file construction */
const FORMAT_MIME_MAP: Record<AudioFormat, string> = {
  webm: 'audio/webm',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

// ============================================================================
// SERVICE LOGIC
// ============================================================================

interface TranscribeInput {
  audio: string;       // base64-encoded audio data
  format: AudioFormat; // audio format
  language?: string;   // optional BCP-47 language hint (e.g. 'en', 'af')
}

interface TranscribeResult {
  text: string;
  duration?: number;
}

async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  // Decode base64 audio to binary
  const binaryString = atob(input.audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  log.info('Transcription request', {
    format: input.format,
    audioSizeBytes: bytes.length,
    language: input.language || 'auto-detect',
  });

  // Construct FormData for OpenAI Whisper API
  const mimeType = FORMAT_MIME_MAP[input.format] || 'audio/webm';
  const file = new File([bytes], `recording.${input.format}`, { type: mimeType });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');

  if (input.language) {
    formData.append('language', input.language);
  }

  // Call OpenAI Whisper API
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error('OpenAI Whisper API error', {
      status: response.status,
      body: errorBody.substring(0, 500),
    });
    throw new Error(`Whisper API returned ${response.status}: ${errorBody.substring(0, 200)}`);
  }

  const result = await response.json();

  log.info('Transcription complete', {
    textLength: result.text?.length || 0,
    duration: result.duration,
    language: result.language,
  });

  return {
    text: result.text || '',
    duration: result.duration,
  };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /transcription/transcribe
 * Accepts base64-encoded audio, returns transcribed text.
 *
 * Request body:
 *   { audio: string, format: AudioFormat, language?: string }
 *
 * Response:
 *   { success: true, text: string, duration?: number }
 */
app.post('/transcribe', asyncHandler(async (c) => {
  const body = await c.req.json();

  // Validate required fields
  if (!body.audio || typeof body.audio !== 'string') {
    return c.json({ success: false, error: 'Missing or invalid audio data' }, 400);
  }

  if (!body.format || !SUPPORTED_FORMATS.includes(body.format)) {
    return c.json({
      success: false,
      error: `Unsupported audio format. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
    }, 400);
  }

  // Check payload size
  if (body.audio.length > MAX_AUDIO_SIZE_BYTES) {
    return c.json({
      success: false,
      error: 'Audio payload too large. Maximum size is 10MB.',
    }, 413);
  }

  const result = await transcribeAudio({
    audio: body.audio,
    format: body.format as AudioFormat,
    language: body.language,
  });

  if (!result.text.trim()) {
    return c.json({
      success: true,
      text: '',
      warning: 'No speech detected in the audio. Please try again, speaking clearly.',
    });
  }

  return c.json({
    success: true,
    text: result.text,
    duration: result.duration,
  });
}));

export default app;
