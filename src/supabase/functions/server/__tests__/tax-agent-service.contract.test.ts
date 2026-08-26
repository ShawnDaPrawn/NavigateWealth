/**
 * tax-agent-service.ts — contract tests
 * =====================================
 *
 * The AI-conducted tax interview. Structurally the twin of the will-chat
 * service — same session shape, same profile pre-load, same OpenAI fallback
 * chain — and it carried the same colliding session id, which is the first
 * thing pinned below.
 *
 * Completion here is signalled by sentinel markers in the reply rather than by
 * heading detection, so the marker parsing gets its own coverage: a partial
 * marker set has to degrade to something usable rather than producing an empty
 * output pack.
 *
 * Real collaborators: the in-memory KV and the real completion parser. Only the
 * OpenAI HTTP boundary is stubbed.
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
  saveSessionOutput,
  sendAndPersist,
} from '../tax-agent-service.ts';
import type { TaxAgentSession } from '../tax-agent-types.ts';

const CLIENT = 'client-1';
const ADVISER = 'adviser-1';

const COMPLETED_REPLY = [
  '[TAX_INTERVIEW_COMPLETE]',
  '[SUBMISSION_TYPE]: ITR12 individual return',
  '[INFORMATION_SUMMARY]: Salary income and one rental property.',
  '[DOCUMENT_CHECKLIST]: IRP5, rates account, bond statement.',
  '[NEXT_STEPS]: Gather the IRP5 and file before the deadline.',
  '[CONFIRMATION_SUMMARY]: Please confirm the rental figures.',
].join('\n');

/**
 * The canonical Responses API shape this module reads: an `output` array of
 * message items, each with `content` blocks. Note that it does NOT read the
 * top-level `output_text` convenience field that will-chat-service uses — the
 * two near-identical modules parse the same API differently.
 */
const responsesOk = (text: string, id = 'resp-1') =>
  new Response(
    JSON.stringify({
      id,
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

let fetchMock: ReturnType<typeof vi.fn>;

const newSession = () => createSession(CLIENT, 'Thandi Nkosi', ADVISER);

const storedSession = (sessionId: string) =>
  kvStore.get(`tax_agent:${CLIENT}:${sessionId}`) as TaxAgentSession | undefined;

beforeEach(() => {
  kvStore.clear();
  fetchMock = vi.fn(async () => responsesOk('What was your gross salary?'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSession', () => {
  it('gives two sessions opened in the same millisecond distinct ids', async () => {
    // The same defect as will-chat-service: the id was `${clientId}-ta-${Date.now()}`,
    // and because the id IS the KV key the second session silently overwrote the
    // first. The clock is frozen so the collision is certain, not a matter of luck.
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const first = await newSession();
      const second = await newSession();

      expect(second.id).not.toBe(first.id);
      expect(await getSession(CLIENT, first.id)).not.toBeNull();
      expect(await getSession(CLIENT, second.id)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a session id the routes can still derive the client id from', async () => {
    // tax-agent-routes recovers the owner with `sessionId.replace(/-ta-\\d+$/, '')`,
    // so the uniqueness suffix has to stay numeric.
    const session = await newSession();

    expect(session.id.replace(/-ta-\d+$/, '')).toBe(CLIENT);
  });

  it('opens an active session carrying a single system message', async () => {
    const session = await newSession();

    expect(session).toMatchObject({
      clientId: CLIENT,
      adviserId: ADVISER,
      clientName: 'Thandi Nkosi',
      status: 'active',
      outputPack: null,
    });
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].role).toBe('system');
  });

  it('pre-loads the profile into the system message', async () => {
    kvStore.set(`user_profile:${CLIENT}:personal_info`, {
      firstName: 'Thandi',
      surname: 'Nkosi',
      idNumber: '8501015800085',
    });

    const context = (await newSession()).messages[0].content;

    expect(context).toContain('Thandi');
    expect(context).toContain('8501015800085');
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

  it("lists a client's sessions most recently updated first", async () => {
    const older = await newSession();
    const newer = await newSession();
    kvStore.set(`tax_agent:${CLIENT}:${older.id}`, {
      ...storedSession(older.id),
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    kvStore.set(`tax_agent:${CLIENT}:${newer.id}`, {
      ...storedSession(newer.id),
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    const sessions = await getClientSessions(CLIENT);

    expect(sessions.map((s) => s.id)).toEqual([newer.id, older.id]);
  });

  it('deletes a session', async () => {
    const session = await newSession();

    await deleteSession(CLIENT, session.id);

    await expect(getSession(CLIENT, session.id)).resolves.toBeNull();
  });
});

describe('sendAndPersist', () => {
  it('appends both turns and stays active mid-interview', async () => {
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'I earn a salary.', null);

    expect(result).toMatchObject({
      assistantReply: 'What was your gross salary?',
      status: 'active',
      interviewComplete: false,
      outputPack: null,
    });
    expect(storedSession(session.id)!.messages.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
    ]);
  });

  it('completes the session and files the parsed output pack', async () => {
    fetchMock.mockImplementation(async () => responsesOk(COMPLETED_REPLY));
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'That is everything.', null);

    expect(result).toMatchObject({ status: 'completed', interviewComplete: true });
    expect(result.outputPack).toMatchObject({
      submissionType: 'ITR12 individual return',
      informationSummary: 'Salary income and one rental property.',
      documentChecklist: 'IRP5, rates account, bond statement.',
      nextSteps: 'Gather the IRP5 and file before the deadline.',
      confirmationSummary: 'Please confirm the rental figures.',
    });
    // Each marker's text must stop at the next marker, or the checklist ends up
    // inside the summary the adviser reads.
    expect(result.outputPack!.submissionType).not.toContain('INFORMATION_SUMMARY');
  });

  it('does not complete without the sentinel marker, however final the reply reads', async () => {
    fetchMock.mockImplementation(async () =>
      responsesOk('[SUBMISSION_TYPE]: ITR12\nThat is everything, we are done.'),
    );
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'Done?', null);

    expect(result).toMatchObject({ interviewComplete: false, status: 'active' });
  });

  it('falls back to the whole reply for a summary the agent did not tag', async () => {
    // A partial marker set has to degrade into something an adviser can read,
    // not into an empty pack that looks like the interview produced nothing.
    fetchMock.mockImplementation(async () =>
      responsesOk('[TAX_INTERVIEW_COMPLETE]\nSalary only, no other income.'),
    );
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'Done', null);

    expect(result.outputPack).toMatchObject({
      submissionType: 'Tax Submission',
      informationSummary: expect.stringContaining('Salary only'),
      documentChecklist: '',
      nextSteps: '',
    });
  });

  it('refuses a session that does not exist', async () => {
    await expect(sendAndPersist(CLIENT, 'no-such-session', 'Hello', null)).rejects.toThrow(
      'Tax agent session not found: no-such-session',
    );
  });
});

describe('an upstream response the extractor does not recognise', () => {
  it('persists the raw JSON as the assistant reply instead of failing', async () => {
    // Worth knowing rather than assuming: `extractResponsesText` falls back to
    // `JSON.stringify(data)`, so a shape change upstream puts a JSON blob into
    // the client's transcript as the adviser's answer rather than surfacing an
    // error. Pinned as current behaviour, not endorsed.
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ unexpected: 'shape' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const session = await newSession();

    const result = await sendAndPersist(CLIENT, session.id, 'Hello', null);

    expect(result.assistantReply).toBe('{"unexpected":"shape"}');
    expect(result.interviewComplete).toBe(false);
  });
});

describe('saveSessionOutput', () => {
  it('marks the session completed', async () => {
    const session = await newSession();

    await expect(saveSessionOutput(CLIENT, session.id, ADVISER)).resolves.toEqual({
      sessionId: session.id,
    });
    expect(storedSession(session.id)).toMatchObject({ status: 'completed' });
  });

  it('refuses a session that does not exist', async () => {
    await expect(saveSessionOutput(CLIENT, 'no-such-session', ADVISER)).rejects.toThrow(
      /session not found: no-such-session/i,
    );
  });
});
