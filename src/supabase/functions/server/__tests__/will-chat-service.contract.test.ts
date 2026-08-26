/**
 * will-chat-service.ts — contract tests
 * =====================================
 *
 * An AI-conducted will interview. The output is a draft last will and
 * testament, so the properties worth pinning are the ones that decide whether
 * a document gets treated as finished: how completion is detected, how the
 * reply is split into the will draft and its accompanying registers, and that
 * a will can never be filed from a session that has not produced one.
 *
 * The profile pre-load is the other half. It injects a client's identity
 * number, date of birth and address into the model prompt, so what goes in
 * there — and what happens when the profile is missing — is asserted directly.
 *
 * Real collaborators: the in-memory KV, the real completion detector and
 * section parser. Only the OpenAI HTTP boundary is stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-openai-key' : undefined),
    },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import { kvStore } from './helpers/contract-harness.ts';
import {
  createSession,
  deleteSession,
  getClientSessions,
  getProfileContext,
  getSession,
  persistExchange,
  saveCompletedWill,
  sendAndPersist,
  sendToAgent,
} from '../will-chat-service.ts';
import type { WillChatSession } from '../will-chat-types.ts';

const CLIENT = 'client-1';
const ADVISER = 'adviser-1';

/** A reply that the completion detector accepts as a finished will. */
const COMPLETED_REPLY = [
  '# LAST WILL AND TESTAMENT',
  'I, Thandi Nkosi, revoke all former wills.',
  '',
  '## ISSUE REGISTER',
  '1. No alternate executor named.',
  '',
  '## EXECUTION CHECKLIST',
  '- Two witnesses required.',
  '',
  '## CLIENT CONFIRMATION SUMMARY',
  'Please confirm the residue clause.',
].join('\n');

const seedProfile = (fields: Record<string, unknown>) =>
  kvStore.set(`user_profile:${CLIENT}:personal_info`, fields);

const seedClientKeys = (fields: Record<string, unknown>) =>
  kvStore.set(`user_profile:${CLIENT}:client_keys`, fields);

const responsesOk = (text: string, id = 'resp-1') =>
  new Response(JSON.stringify({ id, output_text: text }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const chatOk = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

const newSession = () => createSession(CLIENT, 'Thandi Nkosi', ADVISER);

const storedSession = (sessionId: string) =>
  kvStore.get(`will_chat:${CLIENT}:${sessionId}`) as WillChatSession | undefined;

beforeEach(() => {
  kvStore.clear();
  fetchMock = vi.fn(async () => responsesOk('An ordinary interview question.'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSession', () => {
  it('opens an active session carrying a single system message', async () => {
    const session = await newSession();

    expect(session).toMatchObject({
      clientId: CLIENT,
      adviserId: ADVISER,
      clientName: 'Thandi Nkosi',
      status: 'active',
      willText: null,
      outputPack: null,
    });
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].role).toBe('system');
    expect(storedSession(session.id)).toMatchObject({ id: session.id });
  });

  it('pre-loads the profile into the system message', async () => {
    seedProfile({
      firstName: 'Thandi',
      surname: 'Nkosi',
      idNumber: '8501015800085',
      dateOfBirth: '1985-01-01',
      email: 'thandi@example.co.za',
      phone: '+27 82 000 0000',
      maritalStatus: 'Married',
      spouseName: 'Sipho Nkosi',
      physicalAddress: '1 Long Street, Cape Town',
    });

    const session = await newSession();
    const context = session.messages[0].content;

    expect(context).toContain('Full Name: Thandi Nkosi');
    expect(context).toContain('SA ID / Passport: 8501015800085');
    expect(context).toContain('Date of Birth: 1985-01-01');
    expect(context).toContain('Marital Status: Married');
    expect(context).toContain('Spouse Name: Sipho Nkosi');
    expect(context).toContain('Address: 1 Long Street, Cape Town');
    expect(context).toContain('Stage S1');
  });

  it('reads the snake_case spellings a profile may have been written under', async () => {
    seedProfile({ first_name: 'Thandi', last_name: 'Nkosi', phoneNumber: '+27 82 111 1111' });

    const context = (await newSession()).messages[0].content;

    expect(context).toContain('Full Name: Thandi Nkosi');
    expect(context).toContain('Phone: +27 82 111 1111');
  });

  it('omits a field the profile does not carry rather than printing an empty label', async () => {
    seedProfile({ firstName: 'Thandi', surname: 'Nkosi' });

    const context = (await newSession()).messages[0].content;

    expect(context).not.toContain('SA ID / Passport:');
    expect(context).not.toContain('Marital Status:');
    expect(context).not.toContain('Address:');
  });

  it('tells the agent to collect everything when there is no profile at all', async () => {
    const context = (await newSession()).messages[0].content;

    expect(context).toContain('Client name: Thandi Nkosi');
    expect(context).toContain('collect all information during interview');
  });

  it('summarises the financial data as a count, not as the data itself', async () => {
    // The interview does not need the figures, and putting them in the prompt
    // would send a client's whole financial position to the model for no reason.
    seedProfile({ firstName: 'Thandi' });
    seedClientKeys({ retirement_total: 1_250_000, life_cover: 3_000_000 });

    const context = (await newSession()).messages[0].content;

    expect(context).toContain('2 financial data points on file');
    expect(context).not.toContain('1250000');
    expect(context).not.toContain('3000000');
  });

  it('omits the financial section when there is nothing on file', async () => {
    seedClientKeys({});

    const context = (await newSession()).messages[0].content;

    expect(context).not.toContain('financial data points on file');
  });
});

describe('session reads and deletes', () => {
  it('returns null for a session that does not exist', async () => {
    await expect(getSession(CLIENT, 'no-such-session')).resolves.toBeNull();
    await expect(getProfileContext(CLIENT, 'no-such-session')).resolves.toBeNull();
  });

  it("does not serve one client another client's session", async () => {
    const session = await newSession();

    await expect(getSession('client-2', session.id)).resolves.toBeNull();
  });

  it('returns the profile context of an existing session', async () => {
    seedProfile({ firstName: 'Thandi', surname: 'Nkosi' });
    const session = await newSession();

    await expect(getProfileContext(CLIENT, session.id)).resolves.toContain('Thandi Nkosi');
  });

  it('gives two sessions opened in the same millisecond distinct ids', async () => {
    // `Date.now()` alone collided here, and because the id IS the KV key the
    // second session silently overwrote the first — losing the whole interview
    // transcript. The clock is frozen so the collision is certain rather than a
    // matter of luck.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const first = await newSession();
      const second = await newSession();

      expect(second.id).not.toBe(first.id);
      expect(storedSession(first.id)).toBeDefined();
      expect(storedSession(second.id)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a session id the routes can still derive the client id from', async () => {
    // will-chat-routes recovers the owner with `sessionId.replace(/-wc-\d+$/, '')`,
    // so the uniqueness suffix has to stay numeric or every route that takes a
    // session id starts looking in the wrong place.
    const session = await newSession();

    expect(session.id.replace(/-wc-\d+$/, '')).toBe(CLIENT);
  });

  it("lists a client's sessions most recently updated first", async () => {
    const first = await newSession();
    const second = await newSession();
    kvStore.set(`will_chat:${CLIENT}:${first.id}`, {
      ...storedSession(first.id),
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    kvStore.set(`will_chat:${CLIENT}:${second.id}`, {
      ...storedSession(second.id),
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const sessions = await getClientSessions(CLIENT);

    expect(sessions.map((s) => s.id)).toEqual([first.id, second.id]);
  });

  it('lists nothing for a client with no sessions', async () => {
    await expect(getClientSessions('client-nobody')).resolves.toEqual([]);
  });

  it('deletes a session', async () => {
    const session = await newSession();

    await deleteSession(CLIENT, session.id);

    expect(storedSession(session.id)).toBeUndefined();
  });
});

describe('sendToAgent', () => {
  it('prefers the Responses API and reports which path it took', async () => {
    const result = await sendToAgent([{ role: 'user', content: 'Hello' }], null);

    expect(result).toEqual({
      text: 'An ordinary interview question.',
      responseId: 'resp-1',
      strategy: 'responses_api',
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
  });

  it('renames the system role to developer for the Responses API', async () => {
    await sendToAgent(
      [
        { role: 'system', content: 'profile context' },
        { role: 'user', content: 'Hello' },
      ],
      null,
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.input.map((m: { role: string }) => m.role)).toEqual(['developer', 'user']);
  });

  it('sends only the latest turn when chaining from a previous response', async () => {
    // The point of `previous_response_id` — re-sending the whole transcript
    // every turn is what makes a long interview expensive.
    await sendToAgent(
      [
        { role: 'user', content: 'Turn one' },
        { role: 'user', content: 'Turn two' },
      ],
      'resp-previous',
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.previous_response_id).toBe('resp-previous');
    expect(body.input).toEqual([{ role: 'user', content: 'Turn two' }]);
  });

  it('falls back to Chat Completions when the Responses API refuses', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/responses')
        ? new Response('model not available', { status: 404 })
        : chatOk('Fallback answer.'),
    );

    const result = await sendToAgent([{ role: 'user', content: 'Hello' }], null);

    expect(result).toEqual({
      text: 'Fallback answer.',
      responseId: null,
      strategy: 'chat_completions',
    });
  });

  it('falls back when the Responses request throws rather than answering', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/responses')) throw new Error('ECONNRESET');
      return chatOk('Fallback answer.');
    });

    await expect(sendToAgent([{ role: 'user', content: 'Hello' }], null)).resolves.toMatchObject({
      strategy: 'chat_completions',
    });
  });

  it('reports both failures when neither path works', async () => {
    fetchMock.mockImplementation(async () => new Response('rate limited', { status: 429 }));

    await expect(sendToAgent([{ role: 'user', content: 'Hello' }], null)).rejects.toThrow(
      /both Responses API and Chat Completions.*429/s,
    );
  });
});

describe('sendAndPersist', () => {
  it('appends both turns and leaves the session active mid-interview', async () => {
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'My spouse is Sipho.', null);

    expect(result).toMatchObject({
      assistantReply: 'An ordinary interview question.',
      responseId: 'resp-1',
      strategy: 'responses_api',
      status: 'active',
      willReady: false,
      outputPack: null,
    });
    const stored = storedSession(session.id)!;
    expect(stored.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
  });

  it('re-stamps updatedAt on each turn while leaving createdAt alone', async () => {
    // The clock is driven explicitly rather than compared against itself.
    // Asserting `updatedAt !== createdAt` on the live clock was flaky: with a
    // mocked fetch, creating and sending can both land in the same millisecond
    // on a fast runner, and the two ISO strings come out identical. Caught by
    // CI on #244 after passing locally.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-26T10:00:00.000Z'));
      const session = await newSession();

      vi.setSystemTime(new Date('2026-08-26T10:05:00.000Z'));
      await sendAndPersist(CLIENT, session.id, 'My spouse is Sipho.', null);

      const stored = storedSession(session.id)!;
      expect(stored.createdAt).toBe('2026-08-26T10:00:00.000Z');
      expect(stored.updatedAt).toBe('2026-08-26T10:05:00.000Z');
      // Both new messages carry the turn's timestamp, not the session's.
      expect(stored.messages.slice(1).map((m) => m.timestamp)).toEqual([
        '2026-08-26T10:05:00.000Z',
        '2026-08-26T10:05:00.000Z',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('includes the profile context on the first turn and drops it once chained', async () => {
    seedProfile({ firstName: 'Thandi', surname: 'Nkosi' });
    const session = await newSession();

    await sendAndPersist(CLIENT, session.id, 'First message', null);
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(firstBody.input[0].role).toBe('developer');

    fetchMock.mockClear();
    await sendAndPersist(CLIENT, session.id, 'Second message', 'resp-1');
    const secondBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(secondBody.input).toEqual([{ role: 'user', content: 'Second message' }]);
  });

  it('marks the session completed and files the parsed output pack', async () => {
    fetchMock.mockImplementation(async () => responsesOk(COMPLETED_REPLY));
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'Please draft it.', null);

    expect(result).toMatchObject({ status: 'completed', willReady: true });
    expect(result.outputPack).toMatchObject({
      willDraft: expect.stringContaining('LAST WILL AND TESTAMENT'),
      issueRegister: expect.stringContaining('No alternate executor named.'),
      executionChecklist: expect.stringContaining('Two witnesses required.'),
      confirmationSummary: expect.stringContaining('confirm the residue clause'),
    });
    // The sections must not bleed into each other, or the filed will document
    // would carry the reviewer's notes inside the will text.
    expect(result.outputPack!.willDraft).not.toContain('ISSUE REGISTER');
    expect(storedSession(session.id)).toMatchObject({ status: 'completed' });
  });

  it('refuses a session that does not exist', async () => {
    await expect(sendAndPersist(CLIENT, 'no-such-session', 'Hello', null)).rejects.toThrow(
      'Session not found: no-such-session',
    );
  });
});

describe('persistExchange — completion detection', () => {
  it('does not treat a will draft alone as finished', async () => {
    // Both halves are required: a draft with no issue register or checklist is
    // an unfinished answer, and filing it would skip the review step.
    const session = await newSession();

    const result = await persistExchange(
      CLIENT,
      session.id,
      'Draft it',
      '# LAST WILL AND TESTAMENT\nI revoke all former wills.',
    );

    expect(result).toMatchObject({ willReady: false, status: 'active', outputPack: null });
  });

  it('accepts a draft accompanied by an issue register', async () => {
    const session = await newSession();

    const result = await persistExchange(
      CLIENT,
      session.id,
      'Draft it',
      '# LAST WILL AND TESTAMENT\nBody.\n## ISSUE REGISTER\nOne concern.',
    );

    expect(result).toMatchObject({ willReady: true, status: 'completed' });
  });

  it('accepts a draft accompanied by an execution checklist', async () => {
    const session = await newSession();

    const result = await persistExchange(
      CLIENT,
      session.id,
      'Draft it',
      '# Last Will and Testament\nBody.\n## Execution Checklist\nTwo witnesses.',
    );

    expect(result).toMatchObject({ willReady: true, status: 'completed' });
  });

  it('recognises the ampersand and lower-case spellings of the headings', async () => {
    const session = await newSession();

    const result = await persistExchange(
      CLIENT,
      session.id,
      'Draft it',
      '# LAST WILL & TESTAMENT\nBody.\n## Issue & Risk Register\nOne concern.',
    );

    expect(result).toMatchObject({ willReady: true });
  });

  it('treats the whole reply as the will when no section headings are found', async () => {
    const session = await newSession();

    const result = await persistExchange(
      CLIENT,
      session.id,
      'Draft it',
      'LAST WILL AND TESTAMENT — EXECUTION CHECKLIST follows in a later message.',
    );

    expect(result.willReady).toBe(true);
    expect(result.outputPack?.issueRegister).toBe('');
  });

  it('refuses a session that does not exist', async () => {
    await expect(persistExchange(CLIENT, 'no-such-session', 'a', 'b')).rejects.toThrow(
      'Session not found: no-such-session',
    );
  });
});

describe('saveCompletedWill', () => {
  const completeSession = async () => {
    const session = await newSession();
    await persistExchange(CLIENT, session.id, 'Draft it', COMPLETED_REPLY);
    return session;
  };

  it('files the will as a draft record carrying every section', async () => {
    const session = await completeSession();

    const { willId } = await saveCompletedWill(CLIENT, session.id, ADVISER);

    // Shape, not an exact string: the id carries a random suffix so two wills
    // that settle on the same version cannot overwrite each other.
    expect(willId).toMatch(new RegExp(`^${CLIENT}-last_will-v1-[0-9a-f]{8}$`));
    const record = kvStore.get(`will:${CLIENT}:last_will:${willId}`) as Record<string, unknown>;
    expect(record).toMatchObject({
      id: willId,
      clientId: CLIENT,
      clientName: 'Thandi Nkosi',
      type: 'last_will',
      version: 1,
      // Draft, never final: an AI-produced will has to be reviewed and executed
      // by a person before it means anything.
      status: 'draft',
      createdBy: ADVISER,
      finalizedAt: null,
      finalizedBy: null,
    });
    expect(record.data).toMatchObject({
      aiGenerated: true,
      chatSessionId: session.id,
      willText: expect.stringContaining('LAST WILL AND TESTAMENT'),
      issueRegister: expect.stringContaining('No alternate executor named.'),
      executionChecklist: expect.stringContaining('Two witnesses required.'),
    });
  });

  it('numbers each new will after the ones already on file', async () => {
    kvStore.set(`will:${CLIENT}:last_will:${CLIENT}-last_will-v1`, { version: 1 });
    kvStore.set(`will:${CLIENT}:last_will:${CLIENT}-last_will-v2`, { version: 2 });
    const session = await completeSession();

    const { willId } = await saveCompletedWill(CLIENT, session.id, ADVISER);

    expect(willId).toMatch(new RegExp(`^${CLIENT}-last_will-v3-[0-9a-f]{8}$`));
  });

  it('refuses a session that never produced a will', async () => {
    // The gate that stops an unfinished interview being filed as a legal
    // document.
    const session = await newSession();

    await expect(saveCompletedWill(CLIENT, session.id, ADVISER)).rejects.toThrow(
      'Session not found or will not yet completed',
    );
  });

  it('refuses a session that does not exist', async () => {
    await expect(saveCompletedWill(CLIENT, 'no-such-session', ADVISER)).rejects.toThrow(
      'Session not found or will not yet completed',
    );
  });
});
