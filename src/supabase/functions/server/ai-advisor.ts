/**
 * AI Advisor Routes (Client Facing)
 * Backend for the Client Portal AI Financial Advisor
 */

import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import type { Context, Next } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { ensureSeeded, getActivePrompt } from './prompt-service.ts';
import { getAuthContext, AuthError, enforceAccountSecurity } from './auth-mw.ts';
import { PERSONNEL_ROLES } from './constants.ts';
import { PROFILE_KEY, getOpenAIKey, getSupabase } from './ai-advisor-shared.ts';
import {
  clearAdvisorSessionMessages,
  deleteAdvisorSession,
  deleteLegacyAdvisorHistory,
  ensureAdvisorSession,
  getAdvisorSessionSummary,
  isRecord,
  listEnsuredAdvisorSessions,
  loadAdvisorSessionMessages,
} from './ai-advisor-store.ts';
import {
  ADVISOR_AGENT_ID,
  ADVISOR_CONTEXT,
  DEFAULT_PORTAL_PROMPT,
  buildAdvisorSseResponse,
  buildRuntimeContextPrompt,
  callOpenAI,
  getUserContext,
} from './ai-advisor-chat.ts';

const app = new Hono();
const log = createModuleLogger('ai-advisor');

/**
 * Ordinals that fix the order of the two rows written for one legacy chat
 * exchange. They sit in the key between the exchange timestamp and the uuid, so
 * ascending key order — which is what `listAllKvRowsByPrefix` returns and what
 * the stable timestamp sort in `migrateLegacyAdvisorHistory` therefore falls
 * back to on a tie — always puts the client's message before the reply.
 *
 * Single digits on purpose: the segment is compared as a string.
 */
const TURN = { user: '0', assistant: '1' } as const;

async function requireAuth(c: Context, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Unauthorized: Invalid user session' }, 401);
    }

    // Same account-security policy as auth-mw (P1.2) — see the note in
    // ai-intelligence.tsx. Without it a suspended account keeps talking to the
    // advisor until its token expires on its own.
    try {
      await enforceAccountSecurity(user.id);
    } catch (securityError) {
      if (securityError instanceof AuthError) {
        return c.json(
          { error: securityError.message, code: securityError.code },
          securityError.statusCode as 403,
        );
      }
      throw securityError;
    }

    // Attach user info to context
    c.set('user', user);
    await next();
  } catch (error) {
    log.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

function getAdviserIdFromClientProfile(profile: unknown): string | null {
  if (!isRecord(profile)) return null;
  const pi = isRecord(profile.personalInformation) ? profile.personalInformation : null;
  const raw = profile.adviserId ?? pi?.adviserId;
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

/**
 * Staff may open the client's portal Ask Vasco (same KV conversation) for oversight.
 * Elevated roles see any client; advisers only their assigned book.
 */
async function assertCanProxyClientVasco(
  c: Context,
  staffUserId: string,
  staffRole: string,
  clientUserId: string,
): Promise<Response | null> {
  const profile = await kv.get(PROFILE_KEY(clientUserId));
  const targetRole = isRecord(profile) && typeof profile.role === 'string' ? profile.role : null;
  if (targetRole && (PERSONNEL_ROLES as readonly string[]).includes(targetRole)) {
    return c.json({ error: 'Cannot open Ask Vasco for staff accounts' }, 403);
  }

  const elevated = new Set([
    'admin',
    'super_admin',
    'super-admin',
    'compliance',
    'compliance_officer',
    'paraplanner',
    'viewer',
  ]);
  if (elevated.has(staffRole)) return null;

  if (staffRole === 'adviser') {
    const adviserId = getAdviserIdFromClientProfile(profile);
    if (adviserId !== staffUserId) {
      return c.json(
        { error: 'Forbidden: you can only view Ask Vasco for clients assigned to you' },
        403,
      );
    }
    return null;
  }

  return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
}

app.get('/status', requireAuth, (c) => {
  return c.json({ configured: !!getOpenAIKey() });
});

/**
 * POST /chat/stream — SSE streaming chat (real-time token delivery)
 */
app.post('/chat/stream', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const body = await c.req.json();
    const { messages: clientMessages, sessionId } = body;
    return await buildAdvisorSseResponse(user.id, clientMessages, sessionId);
  } catch (error: unknown) {
    log.error('Streaming chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * GET /sessions - list authenticated Ask Vasco sessions for the current client
 */
app.get('/sessions', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const sessions = await listEnsuredAdvisorSessions(user.id);
    return c.json({ sessions });
  } catch (error) {
    log.error('Failed to list advisor sessions', error);
    return c.json({ error: 'Failed to load chat sessions' }, 500);
  }
});

/**
 * POST /sessions - create an empty Ask Vasco session for the current client
 */
app.post('/sessions', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const body = await c.req.json().catch(() => ({}));
    const title = isRecord(body) && typeof body.title === 'string' ? body.title : undefined;
    const session = await ensureAdvisorSession(user.id, null, title);
    return c.json({ session });
  } catch (error) {
    log.error('Failed to create advisor session', error);
    return c.json({ error: 'Failed to create chat session' }, 500);
  }
});

/**
 * GET /sessions/:sessionId - load one authenticated Ask Vasco session
 */
app.get('/sessions/:sessionId', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const sessionId = c.req.param('sessionId')!;
    const session = await getAdvisorSessionSummary(user.id, sessionId);
    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    const messages = await loadAdvisorSessionMessages(user.id, sessionId);
    return c.json({ session, messages });
  } catch (error) {
    log.error('Failed to load advisor session', error);
    return c.json({ error: 'Failed to load chat session' }, 500);
  }
});

/**
 * DELETE /sessions/:sessionId - delete an authenticated Ask Vasco thread
 */
app.delete('/sessions/:sessionId', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const sessionId = c.req.param('sessionId')!;
    await deleteAdvisorSession(user.id, sessionId);
    return c.json({ success: true });
  } catch (error) {
    log.error('Failed to delete advisor session', error);
    return c.json({ error: 'Failed to delete chat session' }, 500);
  }
});

/**
 * GET /admin/history — fetch portal Ask Vasco history for a client (staff only)
 */
app.get('/admin/history', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.query('sessionId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    if (sessionId) {
      const session = await getAdvisorSessionSummary(clientUserId, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      const messages = await loadAdvisorSessionMessages(clientUserId, sessionId);
      return c.json({ messages, sessionId, session });
    }

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    const activeSession = sessions[0];
    if (!activeSession) {
      return c.json({ messages: [], sessionId: null, session: null });
    }

    const messages = await loadAdvisorSessionMessages(clientUserId, activeSession.id);
    return c.json({ messages, sessionId: activeSession.id, session: activeSession });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

/**
 * GET /admin/sessions - list portal Ask Vasco sessions for a client (staff only)
 */
app.get('/admin/sessions', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    return c.json({ sessions });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('Failed to list admin advisor sessions', error);
    return c.json({ error: 'Failed to load chat sessions' }, 500);
  }
});

/**
 * POST /admin/sessions - create an Ask Vasco session for a client (staff only)
 */
app.post('/admin/sessions', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const body = await c.req.json().catch(() => ({}));
    const clientUserId =
      isRecord(body) && typeof body.clientUserId === 'string' ? body.clientUserId.trim() : '';
    if (!clientUserId) {
      return c.json({ error: 'clientUserId is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const title = isRecord(body) && typeof body.title === 'string' ? body.title : undefined;
    const session = await ensureAdvisorSession(clientUserId, null, title);
    return c.json({ session });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('Failed to create admin advisor session', error);
    return c.json({ error: 'Failed to create chat session' }, 500);
  }
});

/**
 * GET /admin/sessions/:sessionId - load one portal Ask Vasco session for a client (staff only)
 */
app.get('/admin/sessions/:sessionId', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.param('sessionId')!;
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    const session = await getAdvisorSessionSummary(clientUserId, sessionId);
    if (!session) {
      return c.json({ error: 'Chat session not found' }, 404);
    }

    const messages = await loadAdvisorSessionMessages(clientUserId, sessionId);
    return c.json({ session, messages });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('Failed to load admin advisor session', error);
    return c.json({ error: 'Failed to load chat session' }, 500);
  }
});

/**
 * DELETE /admin/sessions/:sessionId - delete a client's Ask Vasco thread (staff only)
 */
app.delete('/admin/sessions/:sessionId', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.param('sessionId')!;
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    await deleteAdvisorSession(clientUserId, sessionId);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('Failed to delete admin advisor session', error);
    return c.json({ error: 'Failed to delete chat session' }, 500);
  }
});

/**
 * POST /admin/chat/stream — same SSE contract as /chat/stream but for a client's user id
 */
app.post('/admin/chat/stream', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const body = await c.req.json();
    const { messages: clientMessages, sessionId, clientUserId } = body;
    const uid = typeof clientUserId === 'string' ? clientUserId.trim() : '';
    if (!uid) {
      return c.json({ error: 'clientUserId is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, uid);
    if (denied) return denied;
    return await buildAdvisorSseResponse(uid, clientMessages, sessionId);
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      const ae = error as AuthError;
      return new Response(JSON.stringify({ error: ae.message, code: ae.code }), {
        status: ae.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    log.error('Admin streaming chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * DELETE /admin/history — clear portal Ask Vasco history for a client (staff only)
 */
app.delete('/admin/history', async (c) => {
  try {
    const { userId, role } = await getAuthContext(c);
    const clientUserId = c.req.query('clientUserId')?.trim();
    const sessionId = c.req.query('sessionId')?.trim();
    if (!clientUserId) {
      return c.json({ error: 'clientUserId query parameter is required' }, 400);
    }
    const denied = await assertCanProxyClientVasco(c, userId, role, clientUserId);
    if (denied) return denied;

    if (sessionId) {
      const session = await clearAdvisorSessionMessages(clientUserId, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      return c.json({ success: true, session });
    }

    const sessions = await listEnsuredAdvisorSessions(clientUserId);
    await Promise.all(sessions.map((session) => deleteAdvisorSession(clientUserId, session.id)));
    await deleteLegacyAdvisorHistory(clientUserId);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message, code: error.code }), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return c.json({ error: 'Failed to clear history' }, 500);
  }
});

/**
 * POST /chat
 */
app.post('/chat', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const body = await c.req.json();
    const { message } = body;

    if (!message) return c.json({ error: 'Message required' }, 400);

    // Get context (Phase 3 KV-backed base prompt + context overlay)
    const context = await getUserContext(user.id);
    await ensureSeeded(ADVISOR_AGENT_ID, ADVISOR_CONTEXT, DEFAULT_PORTAL_PROMPT);
    const activeBase =
      (await getActivePrompt(ADVISOR_AGENT_ID, ADVISOR_CONTEXT)) ?? DEFAULT_PORTAL_PROMPT;
    const systemPrompt = `${activeBase}\n\n${buildRuntimeContextPrompt(context)}`;

    // Call AI
    const reply = await callOpenAI([{ role: 'user', content: message }], systemPrompt);

    // Save history. Two segments after the timestamp, and both are load-bearing:
    //
    //   :${TURN.user|assistant}:  an ordinal fixing the order WITHIN one
    //     exchange. The reply used to be keyed `Date.now() + 1` purely to push
    //     it past the message; that made the order deterministic but left the
    //     reply able to collide with the NEXT turn's message key. Both
    //     `toISOString()` calls below run back-to-back after the AI call
    //     returns, so they land in the same millisecond most of the time, and
    //     `migrateLegacyAdvisorHistory` sorts by that timestamp with a stable
    //     sort over key-ascending input. Without the ordinal the tie resolves
    //     on the random uuid and a migrated transcript can show the assistant
    //     answering before the client asked.
    //
    //   :${crypto.randomUUID()}:  uniqueness. `Date.now()` is only
    //     millisecond-resolution and this table upserts on key.
    //
    // Readers sort by the record's own `timestamp` field
    // (migrateLegacyAdvisorHistory) or do not order at all
    // (deleteLegacyAdvisorHistory), so both extra segments are backward
    // compatible with rows already stored under the old shape.
    const exchangeAt = Date.now();
    const conversationKey = `ai_advisor:${user.id}:chat:${exchangeAt}:${TURN.user}:${crypto.randomUUID()}`;
    await getSupabase()
      .from('kv_store_91ed8379')
      .insert({
        key: conversationKey,
        value: {
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        },
      });

    // Save reply
    const replyKey = `ai_advisor:${user.id}:chat:${exchangeAt}:${TURN.assistant}:${crypto.randomUUID()}`;
    await getSupabase()
      .from('kv_store_91ed8379')
      .insert({
        key: replyKey,
        value: {
          role: 'assistant',
          content: reply,
          timestamp: new Date().toISOString(),
        },
      });

    return c.json({ message: reply });
  } catch (error: unknown) {
    log.error('Chat error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Chat failed' }, 500);
  }
});

/**
 * GET /history
 */
app.get('/history', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const sessionId = c.req.query('sessionId')?.trim();

    if (sessionId) {
      const session = await getAdvisorSessionSummary(user.id, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      const messages = await loadAdvisorSessionMessages(user.id, sessionId);
      return c.json({ messages, sessionId, session });
    }

    const sessions = await listEnsuredAdvisorSessions(user.id);
    const activeSession = sessions[0];
    if (!activeSession) {
      return c.json({ messages: [], sessionId: null, session: null });
    }

    const messages = await loadAdvisorSessionMessages(user.id, activeSession.id);
    return c.json({ messages, sessionId: activeSession.id, session: activeSession });
  } catch (_error) {
    return c.json({ error: 'Failed to fetch history' }, 500);
  }
});

/**
 * DELETE /history
 */
app.delete('/history', requireAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string };
    const sessionId = c.req.query('sessionId')?.trim();

    if (sessionId) {
      const session = await clearAdvisorSessionMessages(user.id, sessionId);
      if (!session) {
        return c.json({ error: 'Chat session not found' }, 404);
      }
      return c.json({ success: true, session });
    }

    const sessions = await listEnsuredAdvisorSessions(user.id);
    await Promise.all(sessions.map((session) => deleteAdvisorSession(user.id, session.id)));
    await deleteLegacyAdvisorHistory(user.id);

    return c.json({ success: true });
  } catch (_error) {
    return c.json({ error: 'Failed to clear history' }, 500);
  }
});

export default app;
