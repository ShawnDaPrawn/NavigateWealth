/**
 * ai-model-config.ts — centralized OpenAI model configuration + a shared
 * Responses API helper used across the server AI services.
 *
 * Single source of truth for the OpenAI model id. The primary model is
 * env-overridable (OPENAI_MODEL) so the exact GPT-5 family identifier can be
 * corrected without a code change; gpt-4o is retained as a resilient fallback.
 *
 * GPT-5-family models are served through the Responses API: they use
 * `max_output_tokens` (not `max_tokens`) and do not accept a custom
 * `temperature`. This module encapsulates those differences and falls back to
 * the Chat Completions API on the fallback model when the Responses call fails.
 *
 * NOTE: the exact OpenAI model id ("gpt-5.4") should be verified against the
 * account's available models — override with the OPENAI_MODEL env var if the
 * published identifier differs.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const log = createModuleLogger('ai-model-config');

/** Read an env var safely in both Deno (edge) and Node (test) runtimes. */
function readEnv(name: string): string | undefined {
  try {
    if (typeof Deno !== 'undefined' && Deno.env) return Deno.env.get(name)?.trim() || undefined;
  } catch {
    // Deno global not available (e.g. Node/Vitest) — fall through.
  }
  return undefined;
}

/** Primary model used for new AI features (env-overridable). */
export const OPENAI_PRIMARY_MODEL = readEnv('OPENAI_MODEL') || 'gpt-5.4';

/** Resilient fallback model served through Chat Completions. */
export const OPENAI_FALLBACK_MODEL = readEnv('OPENAI_FALLBACK_MODEL') || 'gpt-4o';

/**
 * GPT-5 family (and the o-series reasoning models) are served through the
 * Responses API and reject a custom `temperature`, using `max_output_tokens`
 * instead of `max_tokens`.
 */
export function isResponsesOnlyModel(model: string): boolean {
  return /^(gpt-5|o\d|gpt-4\.1)/i.test(model);
}

export function getOpenAIKey(): string {
  const key = readEnv('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not configured on server');
  return key;
}

// ---------------------------------------------------------------------------
// Normalised message format (provider-agnostic; converted per API below)
// ---------------------------------------------------------------------------

export type AiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'file'; filename: string; dataBase64: string; mimeType?: string }
  | { type: 'image'; dataBase64: string; mimeType: string };

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentBlock[];
}

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface CallResponsesOptions {
  messages: AiMessage[];
  /** Caps the model output. Mapped to max_output_tokens (Responses) / max_tokens (Chat). */
  maxOutputTokens?: number;
  /** Only applied to models that accept a custom temperature (i.e. the fallback). */
  temperature?: number;
  /** When set, requests OpenAI Structured Outputs constrained to this schema. */
  jsonSchema?: JsonSchemaFormat;
  model?: string;
  fallbackModel?: string;
}

export interface CallResponsesResult {
  text: string;
  model: string;
  raw: unknown;
}

function dataUrl(mimeType: string | undefined, base64: string, fallbackMime: string): string {
  return `data:${mimeType || fallbackMime};base64,${base64}`;
}

/** Convert a normalised message to the Responses API `input` shape. */
function toResponsesMessage(message: AiMessage): Record<string, unknown> {
  const role = message.role === 'system' ? 'developer' : message.role;
  if (typeof message.content === 'string') {
    return { role, content: message.content };
  }
  const content = message.content.map((block) => {
    if (block.type === 'text') return { type: 'input_text', text: block.text };
    if (block.type === 'image') {
      return {
        type: 'input_image',
        image_url: dataUrl(block.mimeType, block.dataBase64, 'image/png'),
      };
    }
    return {
      type: 'input_file',
      filename: block.filename,
      file_data: dataUrl(block.mimeType, block.dataBase64, 'application/pdf'),
    };
  });
  return { role, content };
}

/** Convert a normalised message to the Chat Completions `messages` shape. */
function toChatMessage(message: AiMessage): Record<string, unknown> {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content };
  }
  const content = message.content.map((block) => {
    if (block.type === 'text') return { type: 'text', text: block.text };
    if (block.type === 'image') {
      return {
        type: 'image_url',
        image_url: { url: dataUrl(block.mimeType, block.dataBase64, 'image/png') },
      };
    }
    return {
      type: 'file',
      file: {
        filename: block.filename,
        file_data: dataUrl(block.mimeType, block.dataBase64, 'application/pdf'),
      },
    };
  });
  return { role: message.role, content };
}

function extractResponsesText(resJson: Record<string, unknown>): string {
  if (typeof resJson.output_text === 'string' && resJson.output_text) {
    return resJson.output_text;
  }
  let text = '';
  const output = resJson.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if (
        item &&
        typeof item === 'object' &&
        Array.isArray((item as Record<string, unknown>).content)
      ) {
        for (const block of (item as { content: Array<Record<string, unknown>> }).content) {
          if (block?.type === 'output_text' || block?.type === 'text') {
            text += String(block.text || '');
          }
        }
      }
    }
  }
  return text;
}

/**
 * Call the OpenAI Responses API with the primary model, transparently falling
 * back to Chat Completions on the fallback model. Returns the model's text
 * output. Supports inline file/image attachments and Structured Outputs.
 */
export async function callResponses(options: CallResponsesOptions): Promise<CallResponsesResult> {
  const apiKey = getOpenAIKey();
  const model = options.model || OPENAI_PRIMARY_MODEL;
  const fallbackModel = options.fallbackModel || OPENAI_FALLBACK_MODEL;

  // ── Attempt 1: Responses API (primary model) ──────────────────────────
  try {
    const body: Record<string, unknown> = {
      model,
      input: options.messages.map(toResponsesMessage),
    };
    if (options.maxOutputTokens) body.max_output_tokens = options.maxOutputTokens;
    if (options.temperature != null && !isResponsesOnlyModel(model)) {
      body.temperature = options.temperature;
    }
    if (options.jsonSchema) {
      body.text = {
        format: {
          type: 'json_schema',
          name: options.jsonSchema.name,
          schema: options.jsonSchema.schema,
          strict: options.jsonSchema.strict ?? true,
        },
      };
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const resJson = await res.json();
      const text = extractResponsesText(resJson);
      if (text) return { text, model, raw: resJson };
      log.warn('Responses API returned OK but no extractable text — falling back');
    } else {
      const errBody = await res.text();
      log.warn('Responses API failed — falling back to Chat Completions', {
        status: res.status,
        body: errBody.substring(0, 400),
      });
    }
  } catch (err) {
    log.warn('Responses API error — falling back to Chat Completions', { error: getErrMsg(err) });
  }

  // ── Attempt 2: Chat Completions API (fallback model) ──────────────────
  const chatBody: Record<string, unknown> = {
    model: fallbackModel,
    messages: options.messages.map(toChatMessage),
    max_tokens: options.maxOutputTokens ?? 2000,
    temperature: options.temperature ?? 0.7,
  };
  if (options.jsonSchema) {
    chatBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
        strict: options.jsonSchema.strict ?? true,
      },
    };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(chatBody),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 429) {
      throw new Error('OpenAI API rate limit exceeded. Please wait and try again.');
    }
    throw new Error(`OpenAI request failed (${res.status}): ${errBody.substring(0, 400)}`);
  }

  const chatJson = await res.json();
  const text = chatJson.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('OpenAI returned empty content');
  return { text, model: fallbackModel, raw: chatJson };
}

/**
 * Parse a model JSON response, tolerating markdown code fences. Throws if the
 * payload cannot be parsed as JSON.
 */
export function parseJsonResponse<T = unknown>(rawText: string): T {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  return JSON.parse(cleaned) as T;
}
