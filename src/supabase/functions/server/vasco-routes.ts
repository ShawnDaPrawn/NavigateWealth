/**
 * Vasco Routes — Public AI Financial Navigator
 * 
 * Thin route dispatcher for the "Ask Vasco" public chatbot.
 * All business logic lives in vasco-service.ts, vasco-rag-service.ts,
 * and vasco-analytics-service.ts.
 * 
 * Public Routes:
 *   GET  /vasco/status       — Feature flag check (nav visibility)
 *   POST /vasco/chat         — Chat with Vasco (rate-limited, RAG-augmented)
 *   POST /vasco/feedback     — Submit feedback on a response
 *   POST /vasco/handoff      — Submit adviser callback request (lead capture)
 *   POST /vasco/chat/stream  — Streaming chat with Vasco (SSE — real-time token delivery)
 *   POST /vasco/session      — Save conversation
 *   GET  /vasco/session/:sessionId — Load conversation
 *   DELETE /vasco/session/:sessionId — Delete conversation
 * 
 * Admin Routes:
 *   GET  /vasco/config       — Get full feature flag config
 *   PUT  /vasco/config       — Toggle feature flag
 *   POST /vasco/index        — Trigger article indexing for RAG
 *   GET  /vasco/index        — Get current index status
 *   DELETE /vasco/index      — Clear the article index
 *   GET  /vasco/analytics    — Get analytics summary (last 7 days)
 *   GET  /vasco/feedback     — Get recent feedback entries
 *   GET  /vasco/handoffs     — Get handoff requests
 *   PUT  /vasco/handoffs/:id — Update handoff status
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import {
  getVascoStatus,
  updateVascoConfig,
  checkVascoRateLimit,
  chat,
  chatStream,
  saveSession,
  loadSession,
  deleteSession,
} from './vasco-service.ts';
import {
  indexAllArticles,
  getArticleIndex,
  clearArticleIndex,
} from './vasco-rag-service.ts';
import {
  trackChatEvent,
  trackRateLimitEvent,
  trackTopic,
  submitFeedback,
  getRecentFeedback,
  createHandoff,
  getHandoffs,
  updateHandoffStatus,
  getAnalyticsSummary,
} from './vasco-analytics-service.ts';

const app = new Hono();
const log = createModuleLogger('vasco-routes');

// Root handler
app.get('/', (c) => c.json({ service: 'vasco', status: 'active' }));

// ============================================================================
// PUBLIC: Feature flag status (lightweight — used by frontend nav)
// ============================================================================

app.get('/status', asyncHandler(async (c) => {
  const config = await getVascoStatus();
  return c.json({ enabled: config.enabled });
}));

// ============================================================================
// PUBLIC: Chat with Vasco (rate-limited, RAG-augmented, analytics-tracked)
// ============================================================================

app.post('/chat', asyncHandler(async (c) => {
  // Check feature flag first
  const config = await getVascoStatus();
  if (!config.enabled) {
    return c.json(
      { error: 'Vasco is temporarily unavailable. Please check back soon.' },
      503
    );
  }

  // Extract IP for rate limiting
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  // Check rate limits
  const rateLimit = await checkVascoRateLimit(ip);
  if (!rateLimit.allowed) {
    // Track rate limit event (non-blocking)
    trackRateLimitEvent().catch(() => {});
    return c.json(
      {
        error: rateLimit.reason || 'Rate limit exceeded. Please try again later.',
        rateLimited: true,
        remaining: 0,
      },
      429
    );
  }

  // Parse request body
  const body = await c.req.json();
  const { messages, sessionId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'Messages array is required' }, 400);
  }

  // Validate message format
  for (const msg of messages) {
    if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
      return c.json(
        { error: 'Each message must have a valid role (user/assistant) and content' },
        400
      );
    }
    if (typeof msg.content === 'string' && msg.content.length > 4000) {
      return c.json({ error: 'Message content exceeds maximum length' }, 400);
    }
  }

  // Call the service (includes RAG retrieval + citations)
  const result = await chat({ messages, sessionId });

  // Track analytics (non-blocking — fire and forget)
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  Promise.all([
    trackChatEvent({
      ip,
      sessionId: result.sessionId,
      hadRagContext: result.citations.length > 0,
    }),
    lastUserMsg ? trackTopic(lastUserMsg.content) : Promise.resolve(),
  ]).catch(() => {});

  return c.json({
    reply: result.reply,
    sessionId: result.sessionId,
    remaining: rateLimit.remaining,
    citations: result.citations,
  });
}));

// ============================================================================
// PUBLIC: Submit feedback on a Vasco response
// ============================================================================

app.post('/feedback', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { sessionId, messageContent, rating, comment } = body;

  if (!sessionId || !messageContent || !rating) {
    return c.json({ error: 'sessionId, messageContent, and rating are required' }, 400);
  }

  if (!['positive', 'negative'].includes(rating)) {
    return c.json({ error: 'rating must be "positive" or "negative"' }, 400);
  }

  const entry = await submitFeedback({
    sessionId,
    messageContent,
    rating,
    comment: typeof comment === 'string' ? comment : undefined,
  });

  return c.json({ success: true, feedbackId: entry.id });
}));

// ============================================================================
// PUBLIC: Submit adviser handoff request (lead capture)
// ============================================================================

app.post('/handoff', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { sessionId, name, email, phone, topic, conversationSummary } = body;

  if (!name || !email || !topic) {
    return c.json({ error: 'name, email, and topic are required' }, 400);
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Please provide a valid email address' }, 400);
  }

  const handoff = await createHandoff({
    sessionId: sessionId || 'unknown',
    name,
    email,
    phone: typeof phone === 'string' ? phone : undefined,
    topic,
    conversationSummary: typeof conversationSummary === 'string'
      ? conversationSummary
      : 'No conversation summary provided',
  });

  return c.json({
    success: true,
    handoffId: handoff.id,
    message: 'Thank you! A Navigate Wealth adviser will be in touch within 24 hours.',
  });
}));

// ============================================================================
// PUBLIC: Streaming chat with Vasco (SSE — real-time token delivery)
// ============================================================================

app.post('/chat/stream', asyncHandler(async (c) => {
  // Check feature flag first
  const config = await getVascoStatus();
  if (!config.enabled) {
    return c.json(
      { error: 'Vasco is temporarily unavailable. Please check back soon.' },
      503
    );
  }

  // Extract IP for rate limiting
  const ip =
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown';

  // Check rate limits
  const rateLimit = await checkVascoRateLimit(ip);
  if (!rateLimit.allowed) {
    trackRateLimitEvent().catch(() => {});
    return c.json(
      {
        error: rateLimit.reason || 'Rate limit exceeded. Please try again later.',
        rateLimited: true,
        remaining: 0,
      },
      429
    );
  }

  // Parse request body
  const body = await c.req.json();
  const { messages, sessionId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'Messages array is required' }, 400);
  }

  for (const msg of messages) {
    if (!msg.role || !msg.content || !['user', 'assistant'].includes(msg.role)) {
      return c.json(
        { error: 'Each message must have a valid role (user/assistant) and content' },
        400
      );
    }
    if (typeof msg.content === 'string' && msg.content.length > 4000) {
      return c.json({ error: 'Message content exceeds maximum length' }, 400);
    }
  }

  const result = await chatStream({ messages, sessionId });

  // Track analytics (non-blocking)
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  Promise.all([
    trackChatEvent({
      ip,
      sessionId: result.sessionId,
      hadRagContext: result.citations.length > 0,
    }),
    lastUserMsg ? trackTopic(lastUserMsg.content) : Promise.resolve(),
  ]).catch(() => {});

  return new Response(result.stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Vasco-Remaining': String(rateLimit.remaining),
    },
  });
}));

// ============================================================================
// PUBLIC: Session persistence — save conversation
// ============================================================================

app.post('/session', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { sessionId, messages: sessionMessages } = body;

  if (!sessionId || !sessionMessages) {
    return c.json({ error: 'sessionId and messages are required' }, 400);
  }

  await saveSession(sessionId, {
    sessionId,
    messages: sessionMessages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return c.json({ success: true, sessionId });
}));

// ============================================================================
// PUBLIC: Session persistence — load conversation
// ============================================================================

app.get('/session/:sessionId', asyncHandler(async (c) => {
  const sessionId = c.req.param('sessionId');
  const session = await loadSession(sessionId);

  if (!session) {
    return c.json({ success: true, found: false, messages: [] });
  }

  return c.json({ success: true, found: true, ...session });
}));

// ============================================================================
// PUBLIC: Session persistence — delete conversation
// ============================================================================

app.delete('/session/:sessionId', asyncHandler(async (c) => {
  const sessionId = c.req.param('sessionId');
  await deleteSession(sessionId);
  return c.json({ success: true });
}));

// ============================================================================
// ADMIN: Get Vasco configuration
// ============================================================================

app.get('/config', requireAdmin, asyncHandler(async (c) => {
  const config = await getVascoStatus();
  return c.json({ success: true, config });
}));

// ============================================================================
// ADMIN: Update Vasco configuration (toggle feature flag)
// ============================================================================

app.put('/config', requireAdmin, asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (typeof body.enabled !== 'boolean') {
    return c.json({ error: 'enabled must be a boolean' }, 400);
  }

  const config = await updateVascoConfig(body.enabled, userId);
  log.info('Vasco config updated by admin', { userId, enabled: body.enabled });
  return c.json({ success: true, config });
}));

// ============================================================================
// ADMIN: Trigger article indexing (RAG)
// ============================================================================

app.post('/index', requireAdmin, asyncHandler(async (c) => {
  log.info('Article indexing triggered by admin');
  const result = await indexAllArticles();
  return c.json({ success: true, ...result });
}));

// ============================================================================
// ADMIN: Get article index status
// ============================================================================

app.get('/index', requireAdmin, asyncHandler(async (c) => {
  const index = await getArticleIndex();

  if (!index) {
    return c.json({
      success: true,
      indexed: false,
      articles: [],
      totalChunks: 0,
      lastFullIndex: null,
    });
  }

  return c.json({
    success: true,
    indexed: true,
    articles: index.articles,
    totalChunks: index.totalChunks,
    lastFullIndex: index.lastFullIndex,
  });
}));

// ============================================================================
// ADMIN: Clear article index
// ============================================================================

app.delete('/index', requireAdmin, asyncHandler(async (c) => {
  await clearArticleIndex();
  log.info('Article index cleared by admin');
  return c.json({ success: true });
}));

// ============================================================================
// ADMIN: Get analytics summary
// ============================================================================

app.get('/analytics', requireAdmin, asyncHandler(async (c) => {
  const summary = await getAnalyticsSummary();
  return c.json({ success: true, ...summary });
}));

// ============================================================================
// ADMIN: Get recent feedback
// ============================================================================

app.get('/feedback', requireAdmin, asyncHandler(async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const entries = await getRecentFeedback(limit);
  return c.json({ success: true, feedback: entries, total: entries.length });
}));

// ============================================================================
// ADMIN: Get handoff requests
// ============================================================================

app.get('/handoffs', requireAdmin, asyncHandler(async (c) => {
  const status = c.req.query('status') as 'new' | 'contacted' | 'converted' | 'closed' | undefined;
  const handoffs = await getHandoffs(status || undefined);
  return c.json({ success: true, handoffs, total: handoffs.length });
}));

// ============================================================================
// ADMIN: Update handoff status
// ============================================================================

app.put('/handoffs/:id', requireAdmin, asyncHandler(async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  if (!body.status || !['new', 'contacted', 'converted', 'closed'].includes(body.status)) {
    return c.json({ error: 'status must be one of: new, contacted, converted, closed' }, 400);
  }

  const updated = await updateHandoffStatus(id, body.status);
  if (!updated) {
    return c.json({ error: 'Handoff request not found' }, 404);
  }

  return c.json({ success: true, handoff: updated });
}));

export default app;