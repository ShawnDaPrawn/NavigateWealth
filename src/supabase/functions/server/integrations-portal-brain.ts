/**
 * Portal automation — brain (LLM-assisted selector decisions) + brain memory.
 * ===========================================================================
 *
 * Extracted verbatim from integrations.tsx (Phase 5 decomposition). Owns the
 * portal "brain": memory load/save/summarise/remember, the brain-config + model
 * call (callPortalBrainModel), prompt building, and decision parsing. Self-
 * contained except for the KV store and the shared portal types; no I/O beyond
 * kv + the brain model fetch. Behaviour-preserving move (verbatim bodies).
 */
import * as kv from './kv_store.tsx';
import type {
  PortalBrainMemory,
  PortalBrainMemoryEntry,
  PortalBrainMemorySummary,
  PortalSearchBrainConfig,
} from './integrations-portal-types.ts';

export function normaliseBrainConfig(
  value: unknown,
  fallback?: PortalSearchBrainConfig,
): PortalSearchBrainConfig {
  const entry = (value || {}) as Record<string, unknown>;
  const maxDecisionsPerItem = Number(
    entry.maxDecisionsPerItem ?? fallback?.maxDecisionsPerItem ?? 2,
  );
  return {
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : (fallback?.enabled ?? false),
    goal: typeof entry.goal === 'string' ? entry.goal.trim().slice(0, 500) : fallback?.goal,
    maxDecisionsPerItem: Number.isFinite(maxDecisionsPerItem)
      ? Math.max(1, Math.min(maxDecisionsPerItem, 5))
      : 2,
    rememberSelectors:
      typeof entry.rememberSelectors === 'boolean'
        ? entry.rememberSelectors
        : (fallback?.rememberSelectors ?? true),
  };
}

export function defaultPortalBrainGoal(providerName: string) {
  return `Use the main provider search journey to find an exact policy-number match for ${providerName}, and stop instead of guessing if confidence is low.`;
}

export function emptyPortalBrainMemory(providerId: string, categoryId: string): PortalBrainMemory {
  return {
    providerId,
    categoryId,
    updatedAt: new Date().toISOString(),
    searchInputHints: [],
    searchResultHints: [],
    stats: {
      brainCalls: 0,
      successfulDecisions: 0,
      searchInputSuccesses: 0,
      searchResultSuccesses: 0,
    },
  };
}

export function portalBrainMemoryKey(providerId: string, categoryId: string) {
  return `portal-brain-memory:${providerId}:${categoryId}`;
}

export async function loadPortalBrainMemory(
  providerId: string,
  categoryId: string,
): Promise<PortalBrainMemory> {
  const stored = (await kv.get(
    portalBrainMemoryKey(providerId, categoryId),
  )) as PortalBrainMemory | null;
  if (!stored) return emptyPortalBrainMemory(providerId, categoryId);
  return {
    ...emptyPortalBrainMemory(providerId, categoryId),
    ...stored,
    providerId,
    categoryId,
    searchInputHints: Array.isArray(stored.searchInputHints) ? stored.searchInputHints : [],
    searchResultHints: Array.isArray(stored.searchResultHints) ? stored.searchResultHints : [],
    stats: {
      ...emptyPortalBrainMemory(providerId, categoryId).stats,
      ...(stored.stats || {}),
    },
  };
}

export async function savePortalBrainMemory(memory: PortalBrainMemory) {
  await kv.set(portalBrainMemoryKey(memory.providerId, memory.categoryId), {
    ...memory,
    updatedAt: new Date().toISOString(),
  });
}

export function summarisePortalBrainMemory(
  memory: PortalBrainMemory,
  options: { available: boolean; configured: boolean; model?: string },
): PortalBrainMemorySummary {
  return {
    providerId: memory.providerId,
    categoryId: memory.categoryId,
    available: options.available,
    configured: options.configured,
    model: options.model,
    updatedAt: memory.updatedAt,
    searchInputHints: memory.searchInputHints.length,
    searchResultHints: memory.searchResultHints.length,
    successfulDecisions: memory.stats.successfulDecisions,
    brainCalls: memory.stats.brainCalls,
    lastSearchInputSelector: memory.searchInputHints[0]?.selector,
    lastResultSelector: memory.searchResultHints[0]?.selector,
  };
}

export function rememberPortalBrainHint(
  list: PortalBrainMemoryEntry[],
  entry: {
    selector: string;
    label?: string;
    notes?: string;
    source?: PortalBrainMemoryEntry['source'];
  },
): PortalBrainMemoryEntry[] {
  const selector = String(entry.selector || '')
    .trim()
    .slice(0, 500);
  if (!selector) return list;
  const now = new Date().toISOString();
  const existingIndex = list.findIndex((item) => item.selector === selector);
  const nextEntry: PortalBrainMemoryEntry =
    existingIndex >= 0
      ? {
          ...list[existingIndex],
          label: entry.label ? String(entry.label).slice(0, 160) : list[existingIndex].label,
          notes: entry.notes ? String(entry.notes).slice(0, 300) : list[existingIndex].notes,
          successCount: (list[existingIndex].successCount || 0) + 1,
          lastUsedAt: now,
          source: entry.source || list[existingIndex].source || 'brain',
        }
      : {
          selector,
          label: entry.label ? String(entry.label).slice(0, 160) : undefined,
          notes: entry.notes ? String(entry.notes).slice(0, 300) : undefined,
          successCount: 1,
          lastUsedAt: now,
          source: entry.source || 'brain',
        };

  const withoutExisting =
    existingIndex >= 0 ? list.filter((_, index) => index !== existingIndex) : list.slice();
  return [nextEntry, ...withoutExisting]
    .sort(
      (a, b) =>
        b.successCount - a.successCount ||
        new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime(),
    )
    .slice(0, 12);
}

export function getPortalBrainConfig() {
  const apiKey = String(
    Deno.env.get('NW_GOOGLE_AI_API_KEY') ||
      Deno.env.get('GEMINI_API_KEY') ||
      Deno.env.get('GOOGLE_API_KEY') ||
      '',
  ).trim();
  const model = String(Deno.env.get('NW_PORTAL_BRAIN_MODEL') || 'gemini-2.5-flash').trim();
  const apiBase = String(
    Deno.env.get('NW_PORTAL_BRAIN_API_BASE') || 'https://generativelanguage.googleapis.com/v1beta',
  ).replace(/\/$/, '');
  const enabled = String(Deno.env.get('NW_PORTAL_BRAIN_ENABLED') || '1').trim() !== '0';
  return {
    enabled,
    available: enabled && !!apiKey,
    apiKey,
    model,
    apiBase,
  };
}

export function redactBrainText(value: string, preserve: string[] = []): string {
  let text = String(value || '');
  const placeholders = new Map<string, string>();
  preserve.filter(Boolean).forEach((item, index) => {
    const token = `__NW_PRESERVE_${index}__`;
    placeholders.set(token, item);
    text = text.split(item).join(token);
  });

  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_NUMBER]')
    .replace(/\bR\s?\d[\d\s,]*(?:\.\d{2})?\b/gi, '[REDACTED_AMOUNT]')
    .replace(/\b\d{6,16}\b/g, '[REDACTED_ID]');

  for (const [token, original] of placeholders.entries()) {
    text = text.split(token).join(original);
  }
  return text;
}

export function sanitiseBrainSnapshot(value: unknown, preserve: string[] = []): unknown {
  if (typeof value === 'string') return redactBrainText(value, preserve);
  if (Array.isArray(value)) return value.map((item) => sanitiseBrainSnapshot(item, preserve));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitiseBrainSnapshot(item, preserve),
      ]),
    );
  }
  return value;
}

export function extractFirstJsonObject(value: string): string {
  const text = String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('The brain response did not contain a JSON object.');
  }
  return text.slice(firstBrace, lastBrace + 1);
}

export async function callPortalBrainModel(options: {
  prompt: string;
  model: string;
  apiBase: string;
  apiKey: string;
}): Promise<{ text: string }> {
  const response = await fetch(
    `${options.apiBase}/models/${encodeURIComponent(options.model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: options.prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.1,
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['use_candidate', 'stop_uncertain'] },
              candidateId: { type: 'STRING' },
              confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
              reason: { type: 'STRING' },
            },
            required: ['action', 'candidateId', 'confidence', 'reason'],
          },
        },
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof data.error === 'object' && data.error && 'message' in data.error
        ? String((data.error as { message?: string }).message || 'Portal brain request failed')
        : `Portal brain request failed with HTTP ${response.status}`,
    );
  }

  const candidates = Array.isArray(data.candidates)
    ? (data.candidates as Array<Record<string, unknown>>)
    : [];
  const text = candidates
    .flatMap((candidate) => {
      const content = candidate.content as { parts?: Array<{ text?: string }> } | undefined;
      return Array.isArray(content?.parts) ? content.parts : [];
    })
    .map((part) => String(part.text || ''))
    .join('\n')
    .trim();

  if (!text) {
    throw new Error('The brain response did not contain usable text.');
  }

  return { text };
}

export function parsePortalBrainDecision(text: string): Record<string, unknown> {
  try {
    return JSON.parse(extractFirstJsonObject(text)) as Record<string, unknown>;
  } catch {
    return {
      action: 'stop_uncertain',
      candidateId: null,
      confidence: 'low',
      reason: `Brain returned non-JSON output: ${
        String(text || '')
          .trim()
          .slice(0, 180) || 'empty response'
      }`,
    };
  }
}

export function buildPortalBrainPrompt(options: {
  providerName: string;
  goal: string;
  stage: 'search_input' | 'search_result';
  policyNumber: string;
  instructions?: string;
  labels?: string[];
  memory: PortalBrainMemory;
  snapshot: Record<string, unknown>;
}) {
  const rememberedInputs = options.memory.searchInputHints.slice(0, 5).map((hint) => ({
    selector: hint.selector,
    label: hint.label,
    successCount: hint.successCount,
  }));
  const rememberedResults = options.memory.searchResultHints.slice(0, 5).map((hint) => ({
    selector: hint.selector,
    label: hint.label,
    successCount: hint.successCount,
  }));

  return [
    'You are a cautious browser-assistance model for a financial policy administration system.',
    `Provider: ${options.providerName}`,
    `Stage: ${options.stage}`,
    `Goal: ${options.goal}`,
    `Target policy number: ${options.policyNumber}`,
    options.instructions ? `Provider instructions: ${options.instructions}` : '',
    Array.isArray(options.labels) && options.labels.length > 0
      ? `Preferred search labels: ${options.labels.join(', ')}`
      : '',
    'Rules:',
    '- Never invent a candidate id.',
    '- Only choose a candidate when it is the best available option for finding or opening the exact policy number.',
    '- Prefer remembered selectors when they still fit the current page.',
    '- For search_input, candidates may be direct fields, safe search triggers, or navigation items that reveal a policy/client search area.',
    '- If the landing page only shows navigation like Clients, Investors, Funds, or Practice, choose the safest item that is most likely to lead to policy search.',
    '- Do not choose Home or generic legal/help/footer links.',
    '- Avoid OTP, password, username, and unrelated filter fields.',
    '- If confidence is low, return stop_uncertain.',
    'Return JSON only, with this exact shape:',
    '{"action":"use_candidate|stop_uncertain","candidateId":"candidate-id-or-null","confidence":"high|medium|low","reason":"short reason"}',
    `Remembered input hints: ${JSON.stringify(rememberedInputs)}`,
    `Remembered result hints: ${JSON.stringify(rememberedResults)}`,
    `Page snapshot: ${JSON.stringify(options.snapshot)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
