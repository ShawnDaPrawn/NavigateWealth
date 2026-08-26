/**
 * ai-advisor.ts — chat, history and the staff-proxy write routes
 * =============================================================
 *
 * The other half of Ask Vasco: the non-streaming chat turn, a client's own
 * history, and the staff routes that read, clear and delete a client's
 * conversation on their behalf.
 *
 * These are the destructive ones. `assertCanProxyClientVasco` gates reads and
 * deletes through the same allow-list, so the tests here make explicit which
 * roles can erase a client's conversation record — see the `viewer` case at the
 * foot of the file, which is pinned as current behaviour and flagged, not
 * endorsed.
 *
 * Real collaborators: the whole auth chain, the advisor session store, the
 * in-memory KV. Only OpenAI, the prompt service and the Supabase client are
 * stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authUsers, chat, inserts } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-openai-key' : `test-${key}`),
    },
  };
  return {
    authUsers: new Map<string, Record<string, unknown>>(),
    inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
    chat: {
      buildAdvisorSseResponse: vi.fn(async () => new Response('data: hi\n\n', { status: 200 })),
      callOpenAI: vi.fn(async () => 'A considered answer.'),
      getUserContext: vi.fn(async () => 'context'),
      buildRuntimeContextPrompt: vi.fn(() => 'runtime prompt'),
    },
  };
});

vi.mock('../kv_store.tsx', async () =>
  (await import('./helpers/contract-harness.ts')).makeKvMock(),
);
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);
vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => {
        const user = authUsers.get(token);
        return user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: 'invalid token' } };
      },
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return { error: null };
      },
    }),
  }),
}));
vi.mock('../prompt-service.ts', () => ({
  ensureSeeded: vi.fn(async () => undefined),
  getActivePrompt: vi.fn(async () => 'Stored base prompt.'),
}));
vi.mock('../ai-advisor-chat.ts', () => ({
  ADVISOR_AGENT_ID: 'vasco',
  ADVISOR_CONTEXT: 'portal',
  DEFAULT_PORTAL_PROMPT: 'You are Vasco.',
  ...chat,
}));

import { kvStore } from './helpers/contract-harness.ts';
import { PROFILE_KEY } from '../ai-advisor-shared.ts';
import { ensureAdvisorSession, loadAdvisorSessionMessages } from '../ai-advisor-store.ts';
import app from '../ai-advisor.ts';

const CLIENT = 'client-1';
const ADVISER = 'adviser-1';

const asUser = (id: string, role?: string) => {
  const token = `token-${id}-${role ?? 'none'}`;
  authUsers.set(token, {
    id,
    email: `${id}@example.co.za`,
    app_metadata: role ? { role } : {},
    user_metadata: {},
  });
  return `Bearer ${token}`;
};

const seedClientProfile = (userId: string, profile: Record<string, unknown> = {}) =>
  kvStore.set(PROFILE_KEY(userId), { role: 'client', ...profile });

const call = (path: string, init: RequestInit & { auth?: string } = {}) => {
  const { auth, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (auth) headers.set('Authorization', auth);
  if (rest.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return app.request(path, { ...rest, headers });
};

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

beforeEach(() => {
  kvStore.clear();
  authUsers.clear();
  inserts.length = 0;
  Object.values(chat).forEach((fn) => fn.mockClear());
});

describe('POST /chat', () => {
  it('refuses an empty message', async () => {
    const res = await call('/chat', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ message: '' }),
    });

    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('Message required');
    expect(chat.callOpenAI).not.toHaveBeenCalled();
  });

  it('answers, and records both turns against the authenticated user', async () => {
    const res = await call('/chat', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ message: 'Should I move my RA offshore?' }),
    });

    expect(await json(res)).toEqual({ message: 'A considered answer.' });
    expect(chat.callOpenAI).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Should I move my RA offshore?' }],
      expect.stringContaining('Stored base prompt.'),
    );
    // Both halves of the exchange are stored, keyed to the caller from the
    // verified token rather than anything in the body.
    expect(inserts).toHaveLength(2);
    expect(inserts.every((i) => String(i.row.key).startsWith(`ai_advisor:${CLIENT}:chat:`))).toBe(
      true,
    );
    expect(inserts.map((i) => (i.row.value as { role: string }).role)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('builds the system prompt from the stored base plus the runtime context', async () => {
    await call('/chat', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(chat.getUserContext).toHaveBeenCalledWith(CLIENT);
    const systemPrompt = chat.callOpenAI.mock.calls[0][1] as string;
    expect(systemPrompt).toContain('Stored base prompt.');
    expect(systemPrompt).toContain('runtime prompt');
  });

  it('reports a model failure as a 500 and stores nothing', async () => {
    chat.callOpenAI.mockRejectedValueOnce(new Error('model unavailable'));

    const res = await call('/chat', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ message: 'hello' }),
    });

    expect(res.status).toBe(500);
    expect((await json(res)).error).toBe('model unavailable');
    expect(inserts).toHaveLength(0);
  });
});

describe('GET /history', () => {
  it('reports an empty conversation rather than an error', async () => {
    const res = await call('/history', { auth: asUser(CLIENT, 'client') });

    expect(await json(res)).toEqual({ messages: [], sessionId: null, session: null });
  });

  it('returns the most recent session when none is named', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'My thread');

    const body = await json(await call('/history', { auth: asUser(CLIENT, 'client') }));

    expect(body.sessionId).toBe(session.id);
  });

  it('returns a named session', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'My thread');

    const body = await json(
      await call(`/history?sessionId=${session.id}`, { auth: asUser(CLIENT, 'client') }),
    );

    expect(body).toMatchObject({ sessionId: session.id });
  });

  it('404s a session that belongs to someone else', async () => {
    const other = await ensureAdvisorSession('client-2', null, 'Theirs');

    const res = await call(`/history?sessionId=${other.id}`, { auth: asUser(CLIENT, 'client') });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /history', () => {
  it('clears one named session without removing it', async () => {
    // Clearing keeps the thread so the client can carry on in it; deleting the
    // whole conversation is the no-sessionId case below.
    const session = await ensureAdvisorSession(CLIENT, null, 'My thread');

    const body = await json(
      await call(`/history?sessionId=${session.id}`, {
        method: 'DELETE',
        auth: asUser(CLIENT, 'client'),
      }),
    );

    expect(body.success).toBe(true);
    expect(body.session).toMatchObject({ id: session.id });
    await expect(loadAdvisorSessionMessages(CLIENT, session.id)).resolves.toEqual([]);
  });

  it("404s clearing a session that is not the caller's", async () => {
    const other = await ensureAdvisorSession('client-2', null, 'Theirs');

    const res = await call(`/history?sessionId=${other.id}`, {
      method: 'DELETE',
      auth: asUser(CLIENT, 'client'),
    });

    expect(res.status).toBe(404);
  });

  it('removes every session when none is named', async () => {
    await ensureAdvisorSession(CLIENT, null, 'One');
    await ensureAdvisorSession(CLIENT, null, 'Two');

    const res = await call('/history', { method: 'DELETE', auth: asUser(CLIENT, 'client') });

    expect(await json(res)).toEqual({ success: true });
    const remaining = await json(await call('/sessions', { auth: asUser(CLIENT, 'client') }));
    expect(remaining.sessions).toEqual([]);
  });

  it("leaves another client's conversation alone", async () => {
    await ensureAdvisorSession(CLIENT, null, 'Mine');
    await ensureAdvisorSession('client-2', null, 'Theirs');

    await call('/history', { method: 'DELETE', auth: asUser(CLIENT, 'client') });

    const theirs = await json(await call('/sessions', { auth: asUser('client-2', 'client') }));
    expect((theirs.sessions as unknown[]).length).toBe(1);
  });
});

describe('GET and DELETE /admin/sessions/:sessionId', () => {
  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('requires the clientUserId on both', async () => {
    const auth = asUser('staff-1', 'admin');

    await expect(call('/admin/sessions/s-1', { auth }).then((r) => r.status)).resolves.toBe(400);
    await expect(
      call('/admin/sessions/s-1', { method: 'DELETE', auth }).then((r) => r.status),
    ).resolves.toBe(400);
  });

  it("refuses an adviser who is not the client's", async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Theirs');
    const auth = asUser('adviser-2', 'adviser');

    await expect(
      call(`/admin/sessions/${session.id}?clientUserId=${CLIENT}`, { auth }).then((r) => r.status),
    ).resolves.toBe(403);
    await expect(
      call(`/admin/sessions/${session.id}?clientUserId=${CLIENT}`, {
        method: 'DELETE',
        auth,
      }).then((r) => r.status),
    ).resolves.toBe(403);
  });

  it('serves the session with its messages to permitted staff', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Their thread');

    const body = await json(
      await call(`/admin/sessions/${session.id}?clientUserId=${CLIENT}`, {
        auth: asUser(ADVISER, 'adviser'),
      }),
    );

    expect(body.session).toMatchObject({ id: session.id });
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("404s a session id that is not the named client's", async () => {
    const other = await ensureAdvisorSession('client-2', null, 'Someone else');

    const res = await call(`/admin/sessions/${other.id}?clientUserId=${CLIENT}`, {
      auth: asUser('staff-1', 'admin'),
    });

    expect(res.status).toBe(404);
  });

  it('deletes the session', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Doomed');
    const auth = asUser('staff-1', 'admin');

    const res = await call(`/admin/sessions/${session.id}?clientUserId=${CLIENT}`, {
      method: 'DELETE',
      auth,
    });

    expect(await json(res)).toEqual({ success: true });
    const listed = await json(await call(`/admin/sessions?clientUserId=${CLIENT}`, { auth }));
    expect((listed.sessions as Array<{ id: string }>).map((s) => s.id)).not.toContain(session.id);
  });
});

describe('POST /admin/chat/stream', () => {
  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('requires a clientUserId in the body', async () => {
    const res = await call('/admin/chat/stream', {
      method: 'POST',
      auth: asUser('staff-1', 'admin'),
      body: JSON.stringify({ messages: [] }),
    });

    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('clientUserId is required');
    expect(chat.buildAdvisorSseResponse).not.toHaveBeenCalled();
  });

  it('treats a blank clientUserId as missing', async () => {
    const res = await call('/admin/chat/stream', {
      method: 'POST',
      auth: asUser('staff-1', 'admin'),
      body: JSON.stringify({ messages: [], clientUserId: '   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('refuses an adviser streaming into a client who is not theirs', async () => {
    const res = await call('/admin/chat/stream', {
      method: 'POST',
      auth: asUser('adviser-2', 'adviser'),
      body: JSON.stringify({ messages: [], clientUserId: CLIENT }),
    });

    expect(res.status).toBe(403);
    expect(chat.buildAdvisorSseResponse).not.toHaveBeenCalled();
  });

  it('streams into the named client for permitted staff', async () => {
    await call('/admin/chat/stream', {
      method: 'POST',
      auth: asUser(ADVISER, 'adviser'),
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'checking in' }],
        clientUserId: CLIENT,
        sessionId: 's-9',
      }),
    });

    // The stream is written into the CLIENT's conversation, not the adviser's.
    expect(chat.buildAdvisorSseResponse).toHaveBeenCalledWith(
      CLIENT,
      [{ role: 'user', content: 'checking in' }],
      's-9',
    );
  });

  it('rejects an unauthenticated request with the auth error shape', async () => {
    const res = await call('/admin/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ messages: [], clientUserId: CLIENT }),
    });

    expect(res.status).toBe(401);
    expect(await json(res)).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});

describe('DELETE /admin/history', () => {
  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('requires the clientUserId', async () => {
    const res = await call('/admin/history', {
      method: 'DELETE',
      auth: asUser('staff-1', 'admin'),
    });

    expect(res.status).toBe(400);
  });

  it('clears one named session', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Their thread');

    const body = await json(
      await call(`/admin/history?clientUserId=${CLIENT}&sessionId=${session.id}`, {
        method: 'DELETE',
        auth: asUser(ADVISER, 'adviser'),
      }),
    );

    expect(body.success).toBe(true);
    await expect(loadAdvisorSessionMessages(CLIENT, session.id)).resolves.toEqual([]);
  });

  it("404s clearing a session that is not the named client's", async () => {
    const other = await ensureAdvisorSession('client-2', null, 'Someone else');

    const res = await call(`/admin/history?clientUserId=${CLIENT}&sessionId=${other.id}`, {
      method: 'DELETE',
      auth: asUser('staff-1', 'admin'),
    });

    expect(res.status).toBe(404);
  });

  it("removes the client's whole conversation when no session is named", async () => {
    await ensureAdvisorSession(CLIENT, null, 'One');
    await ensureAdvisorSession(CLIENT, null, 'Two');
    const auth = asUser('staff-1', 'admin');

    const res = await call(`/admin/history?clientUserId=${CLIENT}`, { method: 'DELETE', auth });

    expect(await json(res)).toEqual({ success: true });
    const listed = await json(await call(`/admin/sessions?clientUserId=${CLIENT}`, { auth }));
    expect(listed.sessions).toEqual([]);
  });

  it("refuses an adviser who is not the client's", async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      method: 'DELETE',
      auth: asUser('adviser-2', 'adviser'),
    });

    expect(res.status).toBe(403);
  });

  it('refuses a client trying to clear another client', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      method: 'DELETE',
      auth: asUser('client-2', 'client'),
    });

    expect(res.status).toBe(403);
  });
});

describe('the destructive routes and the elevated allow-list', () => {
  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('lets a "viewer" delete a client\'s entire Ask Vasco conversation', async () => {
    // FLAGGED, NOT ENDORSED. `assertCanProxyClientVasco` gates the read routes
    // and the destructive ones through the same elevated allow-list, and that
    // list includes `viewer` — a real assignable personnel role whose name
    // promises read-only. So the least-privileged staff role can erase a
    // client's conversation record, not just read it.
    //
    // Left as-is because narrowing it is a product decision: `viewer` may be
    // used for a POPIA erasure workflow, and locking it out would break that.
    // Pinned here so the behaviour is visible rather than incidental.
    await ensureAdvisorSession(CLIENT, null, 'Their thread');
    const auth = asUser('viewer-1', 'viewer');

    const res = await call(`/admin/history?clientUserId=${CLIENT}`, { method: 'DELETE', auth });

    expect(res.status).toBe(200);
    const listed = await json(await call(`/admin/sessions?clientUserId=${CLIENT}`, { auth }));
    expect(listed.sessions).toEqual([]);
  });

  it.each(['compliance', 'compliance_officer', 'paraplanner'])(
    'lets a %s delete a client conversation too',
    async (role) => {
      await ensureAdvisorSession(CLIENT, null, 'Their thread');

      const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
        method: 'DELETE',
        auth: asUser(`staff-${role}`, role),
      });

      expect(res.status).toBe(200);
    },
  );
});
