/**
 * Tax Agent Routes — Thin Hono Dispatchers
 *
 * Route handlers for the AI-driven Tax Submission Interview agent.
 *
 * The server owns all OpenAI communication. The frontend sends messages
 * to the server, which proxies them to the Navigate Wealth Tax Agent
 * (workflow ID: wf_69a1a4d2e8a881909802326ffc40464904d116eb78b3bdb1) via
 * the OpenAI Responses API. OPENAI_API_KEY never leaves the server.
 *
 * Routes:
 *   GET  /status                            -> Check API key status
 *   POST /create-session                    -> Create KV session (returns sessionId + profileContext)
 *   GET  /sessions/client/:clientId         -> List sessions for a client
 *   GET  /sessions/:sessionId               -> Get session (resume)
 *   POST /sessions/:sessionId/send          -> Send message to agent + persist
 *   POST /sessions/:sessionId/save          -> Save completed session
 *   DELETE /sessions/:sessionId             -> Delete session
 *
 * IMPORTANT: Static paths (create-session, sessions/client) are registered
 * BEFORE parameterised /:sessionId routes to prevent path collision (S14.2).
 *
 * @module tax-agent/routes
 */

import { Hono } from 'npm:hono';
import { authenticateUser } from './fna-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import * as service from './tax-agent-service.ts';

const app = new Hono();
const log = createModuleLogger('tax-agent-routes');

// Root health check
app.get('/', (c) => c.json({ service: 'tax-agent', status: 'active' }));
app.get('', (c) => c.json({ service: 'tax-agent', status: 'active' }));

// ── GET /status — Check OpenAI API key configuration ──────────────

app.get('/status', async (c) => {
  try {
    await authenticateUser(c.req.header('Authorization'), 'tax-agent');
    const configured = !!Deno.env.get('OPENAI_API_KEY');
    return c.json({ configured });
  } catch (error: unknown) {
    log.error('Error checking status', error);
    const message = getErrMsg(error);
    return c.json({ error: message }, message === 'Unauthorized' ? 401 : 500);
  }
});

// ── POST /create-session — Create KV session ──────────────────────
// IMPORTANT: Registered before /:sessionId to prevent path collision (S14.2)

app.post('/create-session', async (c) => {
  try {
    log.info('POST /create-session');
    const user = await authenticateUser(c.req.header('Authorization'), 'tax-agent');

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

    log.info('Tax agent session created', {
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
    log.error('Error creating tax agent session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── GET /sessions/client/:clientId — List sessions for a client ────
// IMPORTANT: Registered before /:sessionId to prevent path collision (S14.2)

app.get('/sessions/client/:clientId', async (c) => {
  try {
    log.info('GET /sessions/client/:clientId');
    await authenticateUser(c.req.header('Authorization'), 'tax-agent');

    const clientId = c.req.param('clientId');
    const sessions = await service.getClientSessions(clientId);

    const summaries = sessions.map((s) => ({
      id: s.id,
      clientId: s.clientId,
      clientName: s.clientName,
      status: s.status,
      messageCount: s.messages.filter((m) => m.role !== 'system').length,
      interviewComplete: s.status === 'completed',
      outputPack: s.outputPack,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return c.json({ success: true, data: summaries });
  } catch (error: unknown) {
    log.error('Error listing tax agent sessions', error);
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
    await authenticateUser(c.req.header('Authorization'), 'tax-agent');

    const sessionId = c.req.param('sessionId');
    // clientId is the prefix of the sessionId before '-ta-'
    const clientId = sessionId.replace(/-ta-\d+$/, '');

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
        interviewComplete: session.status === 'completed',
        outputPack: session.outputPack,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error: unknown) {
    log.error('Error getting tax agent session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── POST /sessions/:sessionId/send — Send message to agent ─────────

app.post('/sessions/:sessionId/send', async (c) => {
  try {
    log.info('POST /sessions/:sessionId/send');
    await authenticateUser(c.req.header('Authorization'), 'tax-agent');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-ta-\d+$/, '');

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
        interviewComplete: result.interviewComplete,
        outputPack: result.outputPack,
      },
    });
  } catch (error: unknown) {
    log.error('Error sending message to tax agent', error);
    const errMsg = getErrMsg(error);
    return c.json(
      { success: false, error: errMsg },
      errMsg === 'Unauthorized' ? 401 : 500,
    );
  }
});

// ── POST /sessions/:sessionId/save — Save completed session ────────

app.post('/sessions/:sessionId/save', async (c) => {
  try {
    log.info('POST /sessions/:sessionId/save');
    const user = await authenticateUser(c.req.header('Authorization'), 'tax-agent');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-ta-\d+$/, '');

    const result = await service.saveSessionOutput(clientId, sessionId, user.id);
    return c.json({ success: true, data: result });
  } catch (error: unknown) {
    log.error('Error saving tax agent session', error);
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
    await authenticateUser(c.req.header('Authorization'), 'tax-agent');

    const sessionId = c.req.param('sessionId');
    const clientId = sessionId.replace(/-ta-\d+$/, '');

    await service.deleteSession(clientId, sessionId);
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('Error deleting tax agent session', error);
    const message = getErrMsg(error);
    return c.json(
      { success: false, error: message },
      message === 'Unauthorized' ? 401 : 500,
    );
  }
});

export default app;
