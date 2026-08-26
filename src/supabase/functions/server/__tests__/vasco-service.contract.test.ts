/**
 * vasco-service.ts — Contract Tests
 * =================================
 *
 * The public "Ask Vasco" chatbot: the feature flag, the chat turn with RAG
 * context injection, and session persistence. 164 statements, 0% covered.
 *
 * `vasco-guardrails.ts` constants run for real. Stubbed: OpenAI (via `fetch`),
 * the RAG retriever and the prompt service — the three IO boundaries.
 *
 * The RAG behaviour is the part worth testing carefully. Vasco answers the
 * public, so what gets injected into its prompt and which citations come back
 * to the browser both matter: a citation is a link the visitor is invited to
 * click, and the context is what the model is told is true.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = vi.hoisted(() => ({ openaiKey: 'test-openai-key' as string | undefined }));
vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => undefined } };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

const rag = vi.hoisted(() => ({ retrieveContext: vi.fn(async () => [] as unknown[]) }));
vi.mock('../vasco-rag-service.ts', () => rag);

const prompts = vi.hoisted(() => ({
  ensureSeeded: vi.fn(async () => undefined),
  getActivePrompt: vi.fn(async () => 'Stored Vasco prompt.'),
}));
vi.mock('../prompt-service.ts', () => prompts);

import { kvStore } from './helpers/contract-harness.ts';

// `Deno.env.get` is read at CALL time inside `chat`, so the key can be varied
// per test rather than being fixed when the module loaded.
(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
  env: { get: (k: string) => (k === 'OPENAI_API_KEY' ? env.openaiKey : `test-${k}`) },
};

const { getVascoStatus, updateVascoConfig, chat, saveSession, loadSession, deleteSession } =
  await import('../vasco-service.ts');

const FLAG_KEY = 'platform:feature_flags:vasco_public';

/** The OpenAI chat-completions stand-in. */
const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function openAiReplies(content: string) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  });
}

/** The request body the service posted to OpenAI on the last call. */
function lastPostedBody() {
  const [, init] = fetchMock.mock.calls.at(-1)!;
  return JSON.parse((init as { body: string }).body) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    safety_identifier?: string;
    temperature?: number;
  };
}

beforeEach(() => {
  kvStore.clear();
  fetchMock.mockReset();
  rag.retrieveContext.mockReset();
  rag.retrieveContext.mockResolvedValue([]);
  prompts.ensureSeeded.mockClear();
  prompts.getActivePrompt.mockClear();
  prompts.getActivePrompt.mockResolvedValue('Stored Vasco prompt.');
  env.openaiKey = 'test-openai-key';
  openAiReplies('A considered answer.');
});

// ============================================================================
// FEATURE FLAG
// ============================================================================

describe('feature flag', () => {
  it('defaults to DISABLED when nothing has been stored', async () => {
    // Secure by default: a public AI endpoint that is on until switched off is
    // the wrong way round.
    const status = await getVascoStatus();
    expect(status).toMatchObject({ enabled: false, updatedBy: 'system' });
  });

  it('returns the stored config once set', async () => {
    await updateVascoConfig(true, 'admin@navigatewealth.co');
    const status = await getVascoStatus();
    expect(status).toMatchObject({ enabled: true, updatedBy: 'admin@navigatewealth.co' });
    expect(kvStore.get(FLAG_KEY)).toMatchObject({ enabled: true });
  });

  it('falls back to DISABLED when the read throws', async () => {
    const kv = await import('../kv_store.tsx');
    const get = kv.get as unknown as ReturnType<typeof vi.fn>;
    get.mockRejectedValueOnce(new Error('kv down'));

    // Failing closed on an unreadable flag matters more here than elsewhere:
    // the fallback decides whether an unauthenticated endpoint is live.
    expect(await getVascoStatus()).toMatchObject({ enabled: false });
  });
});

// ============================================================================
// CHAT
// ============================================================================

describe('chat', () => {
  it('refuses to run without an OpenAI key', async () => {
    env.openaiKey = undefined;
    await expect(chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      'OpenAI API key not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the STORED prompt as the system message', async () => {
    await chat({ messages: [{ role: 'user', content: 'What is a TFSA?' }] });

    const body = lastPostedBody();
    expect(body.messages[0]).toMatchObject({ role: 'system', content: 'Stored Vasco prompt.' });
    expect(prompts.ensureSeeded).toHaveBeenCalled();
  });

  it('falls back to the built-in prompt when none is stored', async () => {
    prompts.getActivePrompt.mockResolvedValueOnce(null as unknown as string);
    await chat({ messages: [{ role: 'user', content: 'hi' }] });

    const body = lastPostedBody();
    expect(body.messages[0].content).toContain('You are Vasco');
  });

  it('returns the reply and mints a session id when none is supplied', async () => {
    openAiReplies('Here is how a TFSA works.');
    const res = await chat({ messages: [{ role: 'user', content: 'What is a TFSA?' }] });

    expect(res.reply).toBe('Here is how a TFSA works.');
    expect(res.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.citations).toEqual([]);
  });

  it('keeps the caller’s session id when one is supplied', async () => {
    const res = await chat({ messages: [{ role: 'user', content: 'hi' }], sessionId: 'sess-1' });
    expect(res.sessionId).toBe('sess-1');
  });

  it('passes the safety identifier through to OpenAI', async () => {
    await chat({ messages: [{ role: 'user', content: 'hi' }], safetyIdentifier: 'visitor-abc' });
    expect(lastPostedBody().safety_identifier).toBe('visitor-abc');
  });

  it('caps the history it sends, so a long session cannot grow the prompt without limit', async () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      role: 'user' as const,
      content: `message ${i}`,
    }));
    await chat({ messages });

    const body = lastPostedBody();
    // System prompt plus at most `maxSubmittedMessages` turns.
    expect(body.messages.length).toBeLessThanOrEqual(1 + 12);
    // And it keeps the MOST RECENT ones, not the first.
    expect(body.messages.at(-1)!.content).toBe('message 39');
  });

  it('surfaces an OpenAI failure as a user-safe message', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'upstream detail' });

    await expect(chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      'AI service temporarily unavailable',
    );
    // The upstream body is logged, not returned — this endpoint answers the
    // public and must not relay provider internals.
    await expect(chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.not.toThrow(
      /upstream detail/,
    );
  });

  it('throws when OpenAI returns no content', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) });
    await expect(chat({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      'No response received',
    );
  });
});

// ============================================================================
// RAG
// ============================================================================

describe('chat with retrieved article context', () => {
  const CONTEXTS = [
    {
      articleTitle: 'Understanding Tax-Free Savings',
      articleSlug: 'understanding-tfsa',
      text: 'A TFSA allows R36,000 per tax year.',
    },
    {
      articleTitle: 'Understanding Tax-Free Savings',
      articleSlug: 'understanding-tfsa',
      text: 'The lifetime limit is R500,000.',
    },
    {
      articleTitle: 'Retirement Annuities Explained',
      articleSlug: 'retirement-annuities',
      text: 'Section 11F caps the deduction.',
    },
  ];

  it('injects the retrieved article text and returns deduplicated citations', async () => {
    rag.retrieveContext.mockResolvedValue(CONTEXTS);
    const res = await chat({
      messages: [{ role: 'user', content: 'How much can I put in a TFSA?' }],
    });

    // Two chunks came from one article; the visitor is offered one link to it.
    expect(res.citations).toEqual([
      {
        title: 'Understanding Tax-Free Savings',
        slug: 'understanding-tfsa',
        url: '/resources/article/understanding-tfsa',
      },
      {
        title: 'Retirement Annuities Explained',
        slug: 'retirement-annuities',
        url: '/resources/article/retirement-annuities',
      },
    ]);

    const injected = lastPostedBody().messages.find((m) => m.content.includes('ARTICLE_CONTEXT'));
    expect(injected).toBeTruthy();
    expect(injected!.role).toBe('system');
    // All three chunks are present, including both from the same article.
    expect(injected!.content).toContain('R36,000');
    expect(injected!.content).toContain('R500,000');
    expect(injected!.content).toContain('Section 11F');
  });

  it('places the context BEFORE the latest user message, not after it', async () => {
    rag.retrieveContext.mockResolvedValue(CONTEXTS);
    await chat({
      messages: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'the actual question' },
      ],
    });

    const messages = lastPostedBody().messages;
    const contextAt = messages.findIndex((m) => m.content.includes('ARTICLE_CONTEXT'));
    const questionAt = messages.findIndex((m) => m.content === 'the actual question');
    expect(contextAt).toBeGreaterThan(0);
    expect(contextAt).toBeLessThan(questionAt);
  });

  it('retrieves against the LATEST user message, not the first', async () => {
    rag.retrieveContext.mockResolvedValue([]);
    await chat({
      messages: [
        { role: 'user', content: 'something about wills' },
        { role: 'assistant', content: 'reply' },
        { role: 'user', content: 'now tell me about medical aid' },
      ],
    });
    expect(rag.retrieveContext).toHaveBeenCalledWith('now tell me about medical aid');
  });

  it('answers anyway when retrieval fails — RAG is not on the critical path', async () => {
    rag.retrieveContext.mockRejectedValue(new Error('embedding service down'));
    const res = await chat({ messages: [{ role: 'user', content: 'hi' }] });

    expect(res.reply).toBe('A considered answer.');
    expect(res.citations).toEqual([]);
    expect(lastPostedBody().messages.some((m) => m.content.includes('ARTICLE_CONTEXT'))).toBe(
      false,
    );
  });

  it('injects nothing when retrieval returns no chunks', async () => {
    rag.retrieveContext.mockResolvedValue([]);
    const res = await chat({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.citations).toEqual([]);
    expect(lastPostedBody().messages).toHaveLength(2);
  });

  it('does not retrieve at all when there is no user message to retrieve against', async () => {
    await chat({ messages: [{ role: 'assistant', content: 'orphaned reply' }] });
    expect(rag.retrieveContext).not.toHaveBeenCalled();
  });
});

// ============================================================================
// SESSIONS
// ============================================================================

describe('session persistence', () => {
  const SESSION = {
    sessionId: 'sess-1',
    messages: [
      { role: 'user' as const, content: 'What is a TFSA?', timestamp: '2026-03-01T09:00:00.000Z' },
      {
        role: 'assistant' as const,
        content: 'It is a tax-free savings account.',
        timestamp: '2026-03-01T09:00:02.000Z',
        citations: [{ title: 'Understanding TFSA', slug: 'tfsa', url: '/resources/article/tfsa' }],
      },
    ],
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:02.000Z',
  };

  it('round-trips a session with its citations intact', async () => {
    await saveSession('sess-1', SESSION);
    const loaded = await loadSession('sess-1');

    // Everything survives except `updatedAt`, which `saveSession` stamps at
    // write time rather than trusting the caller's value — so a client that
    // sends a stale or forged timestamp cannot make a session look older or
    // newer than it is.
    expect(loaded).toMatchObject({
      sessionId: SESSION.sessionId,
      createdAt: SESSION.createdAt,
      messages: SESSION.messages,
    });
    expect(loaded!.messages[1].citations).toEqual([
      { title: 'Understanding TFSA', slug: 'tfsa', url: '/resources/article/tfsa' },
    ]);
    expect(loaded!.updatedAt).not.toBe(SESSION.updatedAt);
  });

  it('stamps updatedAt on every save, so the caller cannot backdate a session', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(Date.parse('2026-06-01T12:00:00.000Z'));
      await saveSession('sess-1', { ...SESSION, updatedAt: '1999-01-01T00:00:00.000Z' });
      expect((await loadSession('sess-1'))!.updatedAt).toBe('2026-06-01T12:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null for a session that was never saved', async () => {
    expect(await loadSession('never-existed')).toBeNull();
  });

  it('deletes a session', async () => {
    await saveSession('sess-1', SESSION);
    await deleteSession('sess-1');
    expect(await loadSession('sess-1')).toBeNull();
  });

  it('keeps sessions separate from one another', async () => {
    await saveSession('sess-1', SESSION);
    await saveSession('sess-2', { ...SESSION, sessionId: 'sess-2', messages: [] });

    await deleteSession('sess-1');
    expect(await loadSession('sess-2')).toMatchObject({ sessionId: 'sess-2' });
  });
});
