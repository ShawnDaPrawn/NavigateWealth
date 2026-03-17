/**
 * Will Chat Routes — Thin Hono Dispatchers
 *
 * Route handlers for the AI-driven Last Will & Testament chat interface.
 *
 * Architecture: The server owns all OpenAI communication. The frontend
 * sends messages to the server, which proxies them to OpenAI using the
 * real OPENAI_API_KEY via the Responses API (with Chat Completions fallback).
 * The server also handles KV persistence and will completion detection.
 *
 * Routes:
 *   POST /create-session                -> Create KV session (returns sessionId + profileContext)
 *   POST /sessions/:sessionId/send      -> Send message to agent + persist exchange
 *   POST /sessions/:sessionId/save      -> Save completed will to KV
 *   GET  /sessions/client/:clientId     -> List sessions for a client
 *   GET  /sessions/:sessionId           -> Get session (resume)
 *   DELETE /sessions/:sessionId         -> Delete session
 *   GET  /status                        -> Check API key status
 *
 * @module will-chat/routes
 */

import { Hono } from 'npm:hono';
import { authenticateUser } from './fna-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as service from './will-chat-service.ts';

const app = new Hono();
const log = createModuleLogger('will-chat-routes');

// Root handlers
app.get('/', (c) => c.json({ service: 'will-chat', status: 'active' }));
app.get('', (c) => c.json({ service: 'will-chat', status: 'active' }));

// ── POST /create-session — Create KV session ───────────────────────
// IMPORTANT: Static route — must be registered before parameterized /:sessionId routes (S14.2)
//
// Creates a KV session with profile context pre-loaded. Returns sessionId
// and profileContext so the frontend can build the initial hidden message.

app.post('/create-session', async (c) => {
  try {
    log.info('POST /create-session');
    const user = await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const body = await c.req.json();
    const { clientId, clientName } = body;

    if (!clientId || !clientName) {
      return c.json(
        { success: false, error: 'Missing required fields: clientId, clientName' },
        400,
      );
    }

    // Verify OPENAI_API_KEY is available (will be needed for /send)
    if (!Deno.env.get('OPENAI_API_KEY')) {
      return c.json(
        { success: false, error: 'OPENAI_API_KEY not configured on server' },
        500,
      );
    }

    // Create KV session (loads profile context automatically)
    const session = await service.createSession(clientId, clientName, user.id);

    // Get the profile context for the frontend to include in the initial message
    const profileContext = await service.getProfileContext(clientId, session.id);

    log.info('KV session created', {
      sessionId: session.id,
      clientId,
      hasProfileContext: !!profileContext,
    });

    return c.json({
      success: true,
      data: {
        sessionId: session.id,
        profileContext: profileContext || '',
      },
    });
  } catch (error: unknown) {
    log.error('Error creating session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── Backward compat: POST /chatkit-session → delegates to /create-session ──
// Ensures existing frontend code still works during transition.
app.post('/chatkit-session', async (c) => {
  try {
    log.info('POST /chatkit-session (compat → create-session)');
    const user = await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const body = await c.req.json();
    const { clientId, clientName } = body;

    if (!clientId || !clientName) {
      return c.json(
        { success: false, error: 'Missing required fields: clientId, clientName' },
        400,
      );
    }

    if (!Deno.env.get('OPENAI_API_KEY')) {
      return c.json(
        { success: false, error: 'OPENAI_API_KEY not configured on server' },
        500,
      );
    }

    const session = await service.createSession(clientId, clientName, user.id);
    const profileContext = await service.getProfileContext(clientId, session.id);

    return c.json({
      success: true,
      data: {
        sessionId: session.id,
        profileContext: profileContext || '',
      },
    });
  } catch (error: unknown) {
    log.error('Error creating session (compat)', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── GET /status — Check OpenAI API key configuration ───────────────

app.get('/status', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'), 'will-chat');
    const configured = !!Deno.env.get('OPENAI_API_KEY');
    return c.json({ configured });
  } catch (error: unknown) {
    log.error('Error checking status', error);
    const message = getErrMsg(error);
    return c.json({ error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

// ── GET /sessions/client/:clientId — List sessions for a client ────

app.get('/sessions/client/:clientId', async (c) => {
  try {
    log.info('GET /sessions/client/:clientId');
    await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const clientId = c.req.param('clientId');
    const sessions = await service.getClientSessions(clientId);

    const summaries = sessions.map((s) => ({
      id: s.id,
      clientId: s.clientId,
      clientName: s.clientName,
      status: s.status,
      messageCount: s.messages.filter((m) => m.role !== 'system').length,
      willReady: s.status === 'completed',
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return c.json({ success: true, data: summaries });
  } catch (error: unknown) {
    log.error('Error listing sessions', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── GET /sessions/:sessionId — Get full session (for resume) ───────

app.get('/sessions/:sessionId', async (c) => {
  try {
    log.info('GET /sessions/:sessionId');
    await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-wc-\d+$/, '');

    const session = await service.getSession(clientId, sessionId);
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404);
    }

    const visibleMessages = session.messages.filter((m) => m.role !== 'system');

    return c.json({
      success: true,
      data: {
        id: session.id,
        clientId: session.clientId,
        clientName: session.clientName,
        status: session.status,
        messages: visibleMessages,
        willReady: session.status === 'completed',
        outputPack: session.outputPack,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error: unknown) {
    log.error('Error getting session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── POST /sessions/:sessionId/send — Send message to agent + persist ─
//
// The primary chat endpoint. Accepts a user message, calls OpenAI
// server-side using OPENAI_API_KEY, persists the exchange to KV,
// and returns the assistant reply with conversation chaining metadata.

app.post('/sessions/:sessionId/send', async (c) => {
  try {
    log.info('POST /sessions/:sessionId/send');
    await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-wc-\d+$/, '');

    const body = await c.req.json();
    const { message, previousResponseId } = body;

    if (!message || typeof message !== 'string') {
      return c.json({ success: false, error: 'Missing or invalid message' }, 400);
    }

    const result = await service.sendAndPersist(
      clientId,
      sessionId,
      message,
      previousResponseId || null,
    );

    return c.json({
      success: true,
      data: {
        assistantReply: result.assistantReply,
        responseId: result.responseId,
        strategy: result.strategy,
        status: result.status,
        willReady: result.willReady,
        outputPack: result.outputPack,
      },
    });
  } catch (error: unknown) {
    log.error('Error sending message to agent', error);
    const errMsg = getErrMsg(error);
    return c.json(
      { success: false, error: errMsg },
      errMsg === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── POST /sessions/:sessionId/persist — Persist a frontend exchange ─
// Kept for backward compatibility but the /send endpoint is now preferred.

app.post('/sessions/:sessionId/persist', async (c) => {
  try {
    log.info('POST /sessions/:sessionId/persist');
    await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-wc-\d+$/, '');

    const body = await c.req.json();
    const { userMessage, assistantReply } = body;

    if (!userMessage || typeof userMessage !== 'string') {
      return c.json({ success: false, error: 'Missing or invalid userMessage' }, 400);
    }
    if (!assistantReply || typeof assistantReply !== 'string') {
      return c.json({ success: false, error: 'Missing or invalid assistantReply' }, 400);
    }

    const result = await service.persistExchange(
      clientId,
      sessionId,
      userMessage,
      assistantReply,
    );

    return c.json({
      success: true,
      data: {
        sessionId,
        status: result.status,
        willReady: result.willReady,
        outputPack: result.outputPack,
      },
    });
  } catch (error: unknown) {
    log.error('Error persisting exchange', error);
    const errMsg = getErrMsg(error);
    return c.json(
      { success: false, error: errMsg },
      errMsg === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── POST /sessions/:sessionId/save — Save completed will ───────────

app.post('/sessions/:sessionId/save', async (c) => {
  try {
    log.info('POST /sessions/:sessionId/save');
    const user = await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-wc-\d+$/, '');

    const result = await service.saveCompletedWill(clientId, sessionId, user.id);

    return c.json({ success: true, data: result });
  } catch (error: unknown) {
    log.error('Error saving completed will', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── DELETE /sessions/:sessionId — Delete session ───────────────────

app.delete('/sessions/:sessionId', async (c) => {
  try {
    log.info('DELETE /sessions/:sessionId');
    await authenticateUser(c.req.header('Authorization'), 'will-chat');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-wc-\d+$/, '');

    await service.deleteSession(clientId, sessionId);
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Error deleting session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

export default app;
