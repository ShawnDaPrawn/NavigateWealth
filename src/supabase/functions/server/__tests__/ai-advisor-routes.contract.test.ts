/**
 * ai-advisor.ts — route contracts for the client-facing AI advisor
 * ================================================================
 *
 * "Ask Vasco" is the client portal's AI adviser. Two things about it make the
 * access rules worth pinning rather than assuming:
 *
 *  1. The conversation is a client's own financial questions — the most
 *     candid record the firm holds about them — and staff can open it for
 *     oversight. Who may do that is a real authorisation decision.
 *  2. A suspended or closed account keeps a valid JWT until it expires, so the
 *     route has to re-check account security on every request rather than
 *     trusting the token.
 *
 * Real collaborators: the whole auth chain (`auth-mw`, `resolveTrustedRole`,
 * `enforceAccountSecurity`), the advisor session store, and the in-memory KV.
 * Only the OpenAI-facing chat module, the prompt service and the Supabase auth
 * client are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { authUsers, chat } = vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = {
    env: {
      get: (key: string) => (key === 'OPENAI_API_KEY' ? 'test-openai-key' : `test-${key}`),
    },
  };
  return {
    /** token -> the Supabase user that token resolves to. */
    authUsers: new Map<string, Record<string, unknown>>(),
    chat: {
      buildAdvisorSseResponse: vi.fn(async () => new Response('data: hi\n\n', { status: 200 })),
      callOpenAI: vi.fn(async () => ({ content: 'A considered answer.', citations: [] })),
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
  }),
}));
vi.mock('../prompt-service.ts', () => ({
  ensureSeeded: vi.fn(async () => undefined),
  getActivePrompt: vi.fn(async () => null),
}));
vi.mock('../ai-advisor-chat.ts', () => ({
  ADVISOR_AGENT_ID: 'vasco',
  ADVISOR_CONTEXT: 'portal',
  DEFAULT_PORTAL_PROMPT: 'You are Vasco.',
  ...chat,
}));

import { kvStore } from './helpers/contract-harness.ts';
import { PROFILE_KEY } from '../ai-advisor-shared.ts';
import { ensureAdvisorSession } from '../ai-advisor-store.ts';
import app from '../ai-advisor.ts';

const CLIENT = 'client-1';
const ADVISER = 'adviser-1';

/** Registers a bearer token and returns the header value for it. */
const asUser = (id: string, role?: string, email = `${id}@example.co.za`) => {
  const token = `token-${id}-${role ?? 'none'}`;
  authUsers.set(token, {
    id,
    email,
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
  Object.values(chat).forEach((fn) => fn.mockClear());
});

describe('authentication on the client-facing routes', () => {
  const clientRoutes: Array<[string, string]> = [
    ['GET', '/status'],
    ['GET', '/sessions'],
    ['GET', '/sessions/s-1'],
    ['DELETE', '/sessions/s-1'],
    ['GET', '/history'],
    ['DELETE', '/history'],
  ];

  it.each(clientRoutes)('%s %s rejects a request with no token', async (method, path) => {
    const res = await call(path, { method });

    expect(res.status).toBe(401);
    expect((await json(res)).error).toMatch(/Missing or invalid token/);
  });

  it.each(clientRoutes)('%s %s rejects a token that does not resolve', async (method, path) => {
    const res = await call(path, { method, auth: 'Bearer not-a-real-token' });

    expect(res.status).toBe(401);
    expect((await json(res)).error).toMatch(/Invalid user session/);
  });

  it('rejects an Authorization header that is not a bearer token', async () => {
    const res = await call('/status', { headers: { Authorization: 'Basic abc123' } });

    expect(res.status).toBe(401);
  });

  it('shuts a suspended account out even though its token is still valid', async () => {
    // The whole reason the check is here: a JWT stays valid until it expires,
    // so suspension has to be enforced per request or a suspended client keeps
    // talking to the advisor.
    const auth = asUser(CLIENT, 'client');
    kvStore.set(`security:${CLIENT}`, { suspended: true });

    const res = await call('/sessions', { auth });

    expect(res.status).toBe(403);
    expect(await json(res)).toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('shuts a closed account out', async () => {
    const auth = asUser(CLIENT, 'client');
    kvStore.set(`security:${CLIENT}`, { deleted: true });

    const res = await call('/sessions', { auth });

    expect(res.status).toBe(403);
    expect(await json(res)).toMatchObject({ code: 'ACCOUNT_DELETED' });
  });

  it('lets a healthy account through', async () => {
    const auth = asUser(CLIENT, 'client');
    kvStore.set(`security:${CLIENT}`, { suspended: false, deleted: false });

    const res = await call('/sessions', { auth });

    expect(res.status).toBe(200);
  });
});

describe('GET /status', () => {
  it('reports whether the advisor is configured without leaking the key', async () => {
    const res = await call('/status', { auth: asUser(CLIENT, 'client') });

    const body = await json(res);
    expect(body).toEqual({ configured: true });
    expect(JSON.stringify(body)).not.toContain('test-openai-key');
  });
});

describe('a client and their own sessions', () => {
  it('creates a session and lists it back', async () => {
    const auth = asUser(CLIENT, 'client');

    const created = await json(await call('/sessions', { method: 'POST', auth, body: '{}' }));
    const listed = await json(await call('/sessions', { auth }));

    const session = created.session as { id: string };
    expect(session.id).toBeTruthy();
    expect((listed.sessions as Array<{ id: string }>).map((s) => s.id)).toContain(session.id);
  });

  it('accepts a caller-supplied title', async () => {
    const auth = asUser(CLIENT, 'client');

    const created = await json(
      await call('/sessions', {
        method: 'POST',
        auth,
        body: JSON.stringify({ title: 'Retirement questions' }),
      }),
    );

    expect(created.session).toMatchObject({ title: 'Retirement questions' });
  });

  it('ignores a non-string title rather than storing it', async () => {
    const auth = asUser(CLIENT, 'client');

    const created = await json(
      await call('/sessions', { method: 'POST', auth, body: JSON.stringify({ title: 42 }) }),
    );

    expect(typeof (created.session as { title: unknown }).title).toBe('string');
  });

  it('tolerates a request body that is not JSON', async () => {
    const auth = asUser(CLIENT, 'client');

    const res = await call('/sessions', { method: 'POST', auth, body: 'not json' });

    expect(res.status).toBe(200);
  });

  it('404s a session id the client does not have', async () => {
    const res = await call('/sessions/no-such-session', { auth: asUser(CLIENT, 'client') });

    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe('Chat session not found');
  });

  it("will not serve another client their neighbour's session", async () => {
    // Sessions are keyed per user, so the lookup for a different caller must
    // miss rather than fall through to a shared namespace.
    const other = await ensureAdvisorSession('client-2', null, 'Their private thread');

    const res = await call(`/sessions/${other.id}`, { auth: asUser(CLIENT, 'client') });

    expect(res.status).toBe(404);
  });

  it('returns the session with its messages', async () => {
    const auth = asUser(CLIENT, 'client');
    const session = await ensureAdvisorSession(CLIENT, null, 'My thread');

    const body = await json(await call(`/sessions/${session.id}`, { auth }));

    expect(body.session).toMatchObject({ id: session.id });
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it('deletes a session', async () => {
    const auth = asUser(CLIENT, 'client');
    const session = await ensureAdvisorSession(CLIENT, null, 'Doomed');

    const res = await call(`/sessions/${session.id}`, { method: 'DELETE', auth });

    expect(await json(res)).toEqual({ success: true });
    expect((await json(await call(`/sessions/${session.id}`, { auth }))).error).toBe(
      'Chat session not found',
    );
  });
});

describe('POST /chat/stream', () => {
  it('streams for the authenticated user, never for a user named in the body', async () => {
    // The user id comes off the verified token, so a body claiming someone
    // else's id cannot redirect the conversation.
    const auth = asUser(CLIENT, 'client');

    await call('/chat/stream', {
      method: 'POST',
      auth,
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], userId: 'client-2' }),
    });

    expect(chat.buildAdvisorSseResponse).toHaveBeenCalledWith(
      CLIENT,
      [{ role: 'user', content: 'hi' }],
      undefined,
    );
  });

  it('passes the session id through when one is given', async () => {
    await call('/chat/stream', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ messages: [], sessionId: 's-42' }),
    });

    expect(chat.buildAdvisorSseResponse).toHaveBeenCalledWith(CLIENT, [], 's-42');
  });

  it('reports a failure as a 500 rather than a broken stream', async () => {
    chat.buildAdvisorSseResponse.mockRejectedValueOnce(new Error('model unavailable'));

    const res = await call('/chat/stream', {
      method: 'POST',
      auth: asUser(CLIENT, 'client'),
      body: JSON.stringify({ messages: [] }),
    });

    expect(res.status).toBe(500);
    expect((await json(res)).error).toBe('model unavailable');
  });
});

describe('staff opening a client conversation', () => {
  const ELEVATED = [
    'admin',
    'super_admin',
    'super-admin',
    'compliance',
    'compliance_officer',
    'paraplanner',
    'viewer',
  ];

  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('requires the clientUserId to be named', async () => {
    const res = await call('/admin/history', { auth: asUser('staff-1', 'admin') });

    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/clientUserId query parameter is required/);
  });

  it.each(ELEVATED)('lets a %s open any client conversation', async (role) => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser(`staff-${role}`, role),
    });

    expect(res.status).toBe(200);
  });

  it('lets an adviser open a client assigned to them', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser(ADVISER, 'adviser'),
    });

    expect(res.status).toBe(200);
  });

  it('refuses an adviser a client who is not theirs', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser('adviser-2', 'adviser'),
    });

    expect(res.status).toBe(403);
    expect((await json(res)).error).toMatch(/only view Ask Vasco for clients assigned to you/);
  });

  it('reads the assignment from the nested personal-information block too', async () => {
    seedClientProfile(CLIENT, { personalInformation: { adviserId: ADVISER } });

    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser(ADVISER, 'adviser'),
    });

    expect(res.status).toBe(200);
  });

  it('refuses an adviser a client with no assignment recorded', async () => {
    // An unassigned client is not everybody's client.
    seedClientProfile(CLIENT, {});

    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser(ADVISER, 'adviser'),
    });

    expect(res.status).toBe(403);
  });

  it('refuses a client trying to read another client', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser('client-2', 'client'),
    });

    expect(res.status).toBe(403);
    expect((await json(res)).error).toMatch(/insufficient permissions/);
  });

  it("refuses to open a staff member's own conversation, even for an admin", async () => {
    // Staff accounts are not clients; their Ask Vasco is not an oversight
    // surface, and opening it would be surveillance of a colleague.
    seedClientProfile('staff-target', { role: 'adviser' });

    const res = await call('/admin/history?clientUserId=staff-target', {
      auth: asUser('staff-1', 'super_admin'),
    });

    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe('Cannot open Ask Vasco for staff accounts');
  });

  it('rejects an unauthenticated staff request with the auth error shape', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`);

    expect(res.status).toBe(401);
    expect(await json(res)).toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});

describe('the staff view of a client conversation', () => {
  beforeEach(() => {
    seedClientProfile(CLIENT, { adviserId: ADVISER });
  });

  it('reports an empty conversation rather than 404 when there is nothing yet', async () => {
    const res = await call(`/admin/history?clientUserId=${CLIENT}`, {
      auth: asUser('staff-1', 'admin'),
    });

    expect(await json(res)).toEqual({ messages: [], sessionId: null, session: null });
  });

  it('returns the most recent session when none is named', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Their thread');

    const body = await json(
      await call(`/admin/history?clientUserId=${CLIENT}`, { auth: asUser('staff-1', 'admin') }),
    );

    expect(body.sessionId).toBe(session.id);
    expect(body.session).toMatchObject({ id: session.id });
  });

  it('returns a named session', async () => {
    const session = await ensureAdvisorSession(CLIENT, null, 'Their thread');

    const body = await json(
      await call(`/admin/history?clientUserId=${CLIENT}&sessionId=${session.id}`, {
        auth: asUser('staff-1', 'admin'),
      }),
    );

    expect(body.sessionId).toBe(session.id);
  });

  it("404s a session id that is not the client's", async () => {
    const other = await ensureAdvisorSession('client-2', null, 'Someone else');

    const res = await call(`/admin/history?clientUserId=${CLIENT}&sessionId=${other.id}`, {
      auth: asUser('staff-1', 'admin'),
    });

    expect(res.status).toBe(404);
  });

  it("lists and creates sessions on the client's behalf", async () => {
    const auth = asUser('staff-1', 'admin');

    const created = await json(
      await call('/admin/sessions', {
        method: 'POST',
        auth,
        body: JSON.stringify({ clientUserId: CLIENT, title: 'Opened for review' }),
      }),
    );
    const listed = await json(await call(`/admin/sessions?clientUserId=${CLIENT}`, { auth }));

    expect(created.session).toMatchObject({ title: 'Opened for review' });
    expect((listed.sessions as Array<{ id: string }>).length).toBeGreaterThan(0);
  });

  it('requires clientUserId on every staff route that names a client', async () => {
    const auth = asUser('staff-1', 'admin');

    await expect(call('/admin/sessions', { auth }).then((r) => r.status)).resolves.toBe(400);
    await expect(
      call('/admin/sessions', { method: 'POST', auth, body: '{}' }).then((r) => r.status),
    ).resolves.toBe(400);
  });

  it('applies the same assignment rule to the session routes as to history', async () => {
    const auth = asUser('adviser-2', 'adviser');

    await expect(
      call(`/admin/sessions?clientUserId=${CLIENT}`, { auth }).then((r) => r.status),
    ).resolves.toBe(403);
    await expect(
      call('/admin/sessions', {
        method: 'POST',
        auth,
        body: JSON.stringify({ clientUserId: CLIENT }),
      }).then((r) => r.status),
    ).resolves.toBe(403);
  });
});
