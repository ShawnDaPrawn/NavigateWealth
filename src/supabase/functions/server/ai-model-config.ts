/**
 * ai-model-config.ts — centralized OpenAI model configuration + a shared
 * Responses API helper used across the server AI services.
 *
 * Single source of truth for the OpenAI model id. The default is `gpt-4o`
 * (the model every AI service used and verified in production before this
 * config was centralised). The primary model is env-overridable (OPENAI_MODEL)
 * so a GPT-5-family identifier can be adopted without a code change once it has
 * been verified against the account's available models; gpt-4o is also the
 * resilient fallback.
 *
 * GPT-5-family models are served through the Responses API: they use
 * `max_output_tokens` (not `max_tokens`) and do not accept a custom
 * `temperature`. This module encapsulates those differences and falls back to
 * the Chat Completions API on the fallback model when the Responses call fails.
 *
 * NOTE: do NOT default this to an unverified id (a previous default of
 * "gpt-5.4" did not exist and silently broke every AI feature — the chat-
 * completions callers have no model fallback). Point OPENAI_MODEL at a real
 * GPT-5 id only after confirming the account can serve it.
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

/** Primary model used for new AI features (env-overridable, verified default). */
export const OPENAI_PRIMARY_MODEL = readEnv('OPENAI_MODEL') || 'gpt-4o';

/** Resilient fallback model served through Chat Completions. */
export const OPENAI_FALLBACK_MODEL = readEnv('OPENAI_FALLBACK_MODEL') || 'gpt-4o';

/**
 * Resolve the model for ONE feature, from a feature-specific env var.
 *
 * WHY THIS EXISTS
 * ---------------
 * `OPENAI_MODEL` is global: eleven services read `OPENAI_PRIMARY_MODEL`
 * (policy extraction, Vasco, will-chat, tax-agent, the RoA conversation,
 * social-media text, ai-advisor, ai-intelligence, ai-management, the
 * integrations extraction routes and the document summariser). Moving it is
 * therefore an all-or-nothing act across the whole product, and most of those
 * callers reach OpenAI through Chat Completions with NO model fallback — which
 * is precisely how the `gpt-5.4` default in this file's history took every AI
 * feature down at once.
 *
 * A per-feature override makes adopting a new model an experiment on one
 * surface instead of a bet on all of them. Roll it forward one feature at a
 * time, watch that feature, and roll back by clearing one secret.
 *
 * SAFE ONLY WHERE THERE IS A FALLBACK. Use this for callers that go through
 * `callResponses`, which retries on `OPENAI_FALLBACK_MODEL` via Chat
 * Completions when the primary call fails: there a wrong or unavailable id
 * degrades (an extra failed request, then a gpt-4o answer) rather than
 * breaking the feature. Do NOT wire it into a bare Chat Completions caller,
 * where a bad id is simply a 400 and the feature is dead.
 *
 * Returns `OPENAI_PRIMARY_MODEL` when the feature's var is unset, so an
 * unconfigured feature behaves exactly as it did before this existed.
 */
export function resolveFeatureModel(envVar: string): string {
  return readEnv(envVar) || OPENAI_PRIMARY_MODEL;
}

// ---------------------------------------------------------------------------
// Account-verified model preferences
// ---------------------------------------------------------------------------

/**
 * The account's own list of servable model ids, cached per function instance.
 *
 * WHY ASK THE ACCOUNT INSTEAD OF HARDCODING A NAME
 * ------------------------------------------------
 * Every previous attempt to move off gpt-4o in this repository has come down to
 * someone naming a model from memory. `gpt-5.4` was named that way, did not
 * exist, and took every AI feature down. Model line-ups also change faster than
 * a codebase gets revisited, so a name that is right today is a latent outage
 * later — and nothing in the code notices, because a bad id is just a 400 at
 * request time.
 *
 * The account already knows the answer. Asking it turns "which model exists"
 * from a guess into a fact, and turns a wrong name in a preference list from an
 * outage into a skipped entry.
 *
 * `null` means the probe has not run or could not answer; callers treat that as
 * "no information" and fall back, never as "nothing is available".
 */
let availableModelIds: Set<string> | null = null;
let availableModelsFetchedAt = 0;

/** Re-probe at most this often per instance. Model lists change rarely. */
const MODEL_LIST_TTL_MS = 30 * 60 * 1000;

/** Reset the cache. Tests only — production has no reason to call this. */
export function resetAvailableModelsCache(): void {
  availableModelIds = null;
  availableModelsFetchedAt = 0;
}

/**
 * Fetch the model ids this account can serve.
 *
 * Fails OPEN: any error returns null and the caller keeps its current model. A
 * model-selection nicety must never be the reason a summary does not get
 * written.
 */
export async function listAvailableModels(): Promise<Set<string> | null> {
  const now = Date.now();
  if (availableModelIds && now - availableModelsFetchedAt < MODEL_LIST_TTL_MS) {
    return availableModelIds;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${getOpenAIKey()}` },
    });
    if (!res.ok) {
      log.warn('Could not list account models — keeping the configured model', {
        status: res.status,
      });
      return null;
    }

    const json = (await res.json()) as { data?: Array<{ id?: unknown }> };
    const ids = (json.data ?? [])
      .map((entry) => entry?.id)
      .filter((id): id is string => typeof id === 'string');
    if (ids.length === 0) return null;

    availableModelIds = new Set(ids);
    availableModelsFetchedAt = now;

    // Logged once per instance, filtered to the text-generation families, so an
    // operator can read the real list out of the function logs and refine a
    // preference list without needing the API key in hand.
    log.info('OpenAI models available to this account', {
      count: ids.length,
      textModels: ids.filter((id) => /^(gpt-|o\d)/i.test(id)).sort(),
    });

    return availableModelIds;
  } catch (error) {
    log.warn('Model list probe failed — keeping the configured model', {
      error: getErrMsg(error),
    });
    return null;
  }
}

/**
 * Pick the first model in `preferences` this account actually serves.
 *
 * An explicit `envVar` wins outright and skips the probe: an operator who names
 * a model has made a decision, and second-guessing it would make the setting
 * untrustworthy.
 *
 * Otherwise the preference list is a RANKING, not an assertion. Entries the
 * account does not serve — including ones that never existed — are skipped, so
 * the list can be edited optimistically without risking anything. When nothing
 * matches, or the probe could not answer, the answer is `OPENAI_PRIMARY_MODEL`,
 * which is exactly what the caller would have used anyway.
 */
export async function resolvePreferredModel(
  preferences: readonly string[],
  envVar: string,
): Promise<string> {
  const explicit = readEnv(envVar);
  if (explicit) return explicit;
  if (preferences.length === 0) return OPENAI_PRIMARY_MODEL;

  const available = await listAvailableModels();
  if (!available) return OPENAI_PRIMARY_MODEL;

  for (const candidate of preferences) {
    if (available.has(candidate)) return candidate;
  }
  return OPENAI_PRIMARY_MODEL;
}

/**
 * GPT-5 family (and the o-series reasoning models) are served through the
 * Responses API and reject a custom `temperature`, using `max_output_tokens`
 * instead of `max_tokens`.
 */
export function isResponsesOnlyModel(model: string): boolean {
  return /^(gpt-5|o\d|gpt-4\.1)/i.test(model);
}

/**
 * Apply the correct output-token cap to a Chat Completions request body.
 * GPT-5 / o-series models reject `max_tokens` on Chat Completions and require
 * `max_completion_tokens`; older models still use `max_tokens`.
 */
export function applyChatTokenLimit(
  body: Record<string, unknown>,
  model: string,
  maxTokens: number,
): void {
  if (isResponsesOnlyModel(model)) body.max_completion_tokens = maxTokens;
  else body.max_tokens = maxTokens;
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
    temperature: options.temperature ?? 0.7,
  };
  applyChatTokenLimit(chatBody, fallbackModel, options.maxOutputTokens ?? 2000);
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
