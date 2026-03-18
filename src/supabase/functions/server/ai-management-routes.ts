/**
 * AI Management Routes — Admin AI Agent Control Plane
 *
 * Thin route dispatcher for the AI Management admin module.
 * Business logic lives in ai-management-service.ts and kb-service.ts.
 *
 * All routes require admin authentication.
 *
 * Routes:
 *   GET    /agents       — List all registered agents
 *   GET    /agents/:id   — Get a single agent config
 *   GET    /kb/stats     — Knowledge base summary stats
 *   GET    /kb           — List all KB entries
 *   POST   /kb           — Create a new KB entry
 *   GET    /kb/:id       — Get a single KB entry
 *   PUT    /kb/:id       — Update a KB entry
 *   DELETE /kb/:id       — Delete a KB entry
 *
 * Guidelines: §4.2 (thin dispatcher pattern), §14.2 (static before parameterised)
 */

import { Hono } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getAllAgents, getAgent } from './ai-management-service.ts';
import * as kbService from './kb-service.ts';
import * as promptService from './prompt-service.ts';

const app = new Hono();
const log = createModuleLogger('ai-management-routes');

// Apply admin middleware to all routes
app.use('*', requireAdmin);

// Root handler
app.get('/', (c) => c.json({ service: 'ai-management', status: 'active' }));

// ============================================================================
// AGENT REGISTRY
// ============================================================================

/**
 * GET /agents — List all registered AI agents
 */
app.get('/agents', asyncHandler(async (c) => {
  const agents = await getAllAgents();
  return c.json({ agents });
}));

/**
 * GET /agents/:id — Get a single agent config
 */
app.get('/agents/:id', asyncHandler(async (c) => {
  const { id } = c.req.param();
  const agent = await getAgent(id);

  if (!agent) {
    return c.json({ error: `Agent '${id}' not found` }, 404);
  }

  return c.json({ agent });
}));

// ============================================================================
// KNOWLEDGE BASE — Static routes first (§14.2)
// ============================================================================

/**
 * GET /kb/stats — Knowledge base summary stats
 */
app.get('/kb/stats', asyncHandler(async (c) => {
  const stats = await kbService.getStats();
  return c.json({ stats });
}));

/**
 * GET /kb — List all KB entries
 */
app.get('/kb', asyncHandler(async (c) => {
  const entries = await kbService.getAllEntries();
  return c.json({ entries });
}));

/**
 * POST /kb — Create a new KB entry
 */
app.post('/kb', asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const input = await c.req.json() as kbService.CreateKBInput;

  // Basic validation
  if (!input.title || !input.type) {
    return c.json({ error: 'title and type are required' }, 400);
  }

  const validTypes: kbService.KBEntryType[] = ['qa', 'article', 'snippet', 'faq', 'policy'];
  if (!validTypes.includes(input.type)) {
    return c.json({ error: `type must be one of: ${validTypes.join(', ')}` }, 400);
  }

  // For Q&A type, require question and answer; for other types, require content
  if (input.type === 'qa' && (!input.question || !input.answer)) {
    return c.json({ error: 'Q&A type requires question and answer fields' }, 400);
  }
  if (input.type !== 'qa' && !input.content) {
    return c.json({ error: 'content is required for non-Q&A entry types' }, 400);
  }

  const entry = await kbService.createEntry(input, userId);
  log.info('KB entry created via admin', { id: entry.id, userId });
  return c.json({ entry }, 201);
}));

/**
 * GET /kb/:id — Get a single KB entry
 */
app.get('/kb/:id', asyncHandler(async (c) => {
  const { id } = c.req.param();
  const entry = await kbService.getEntry(id);

  if (!entry) {
    return c.json({ error: `KB entry '${id}' not found` }, 404);
  }

  return c.json({ entry });
}));

/**
 * PUT /kb/:id — Update a KB entry
 */
app.put('/kb/:id', asyncHandler(async (c) => {
  const { id } = c.req.param();
  const input = await c.req.json() as kbService.UpdateKBInput;

  const updated = await kbService.updateEntry(id, input);
  if (!updated) {
    return c.json({ error: `KB entry '${id}' not found` }, 404);
  }

  log.info('KB entry updated via admin', { id });
  return c.json({ entry: updated });
}));

/**
 * DELETE /kb/:id — Delete a KB entry
 */
app.delete('/kb/:id', asyncHandler(async (c) => {
  const { id } = c.req.param();
  const deleted = await kbService.deleteEntry(id);

  if (!deleted) {
    return c.json({ error: `KB entry '${id}' not found` }, 404);
  }

  log.info('KB entry deleted via admin', { id });
  return c.json({ success: true });
}));

// ============================================================================
// PROMPTS (Phase 3)
// ============================================================================

const VALID_PROMPT_CONTEXTS: promptService.PromptContext[] = ['public', 'authenticated', 'admin'];

function parsePromptContext(raw: string): promptService.PromptContext | null {
  return VALID_PROMPT_CONTEXTS.includes(raw as promptService.PromptContext)
    ? (raw as promptService.PromptContext)
    : null;
}

app.get('/prompts/:agentId/:context', asyncHandler(async (c) => {
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const [active, draft, versions] = await Promise.all([
    promptService.getActivePrompt(agentId, ctx),
    promptService.getDraftPrompt(agentId, ctx),
    promptService.listVersions(agentId, ctx),
  ]);

  return c.json({ active, draft, versions });
}));

app.put('/prompts/:agentId/:context/draft', asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const body = await c.req.json() as { prompt?: string };
  if (!body.prompt || typeof body.prompt !== 'string') {
    return c.json({ error: 'prompt is required' }, 400);
  }

  await promptService.setDraftPrompt(agentId, ctx, body.prompt);
  log.info('Prompt draft updated', { agentId, context: ctx, userId });
  return c.json({ success: true });
}));

app.post('/prompts/:agentId/:context/publish', asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const version = await promptService.publishDraft(agentId, ctx, userId);
  log.info('Prompt published', { agentId, context: ctx, userId, versionId: version.id });
  return c.json({ version });
}));

app.get('/prompts/:agentId/:context/versions', asyncHandler(async (c) => {
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const versions = await promptService.listVersions(agentId, ctx);
  return c.json({ versions });
}));

app.post('/prompts/:agentId/:context/rollback', asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const body = await c.req.json() as { versionId?: string };
  if (!body.versionId) return c.json({ error: 'versionId is required' }, 400);

  const version = await promptService.rollbackToVersion(agentId, ctx, body.versionId, userId);
  if (!version) return c.json({ error: 'version not found' }, 404);

  log.info('Prompt rolled back', { agentId, context: ctx, userId, toVersionId: body.versionId, newVersionId: version.id });
  return c.json({ version });
}));

/**
 * POST /prompts/:agentId/:context/seed — Seed active/draft if missing
 * Body: { seedPrompt: string }
 */
app.post('/prompts/:agentId/:context/seed', asyncHandler(async (c) => {
  const userId = c.get('userId') as string;
  const { agentId, context } = c.req.param();
  const ctx = parsePromptContext(context);
  if (!ctx) return c.json({ error: 'Invalid context' }, 400);

  const body = await c.req.json() as { seedPrompt?: string };
  if (!body.seedPrompt || typeof body.seedPrompt !== 'string') {
    return c.json({ error: 'seedPrompt is required' }, 400);
  }

  await promptService.ensureSeeded(agentId, ctx, body.seedPrompt);
  const [active, draft, versions] = await Promise.all([
    promptService.getActivePrompt(agentId, ctx),
    promptService.getDraftPrompt(agentId, ctx),
    promptService.listVersions(agentId, ctx),
  ]);

  log.info('Prompt seeded (if missing)', { agentId, context: ctx, userId });
  return c.json({ active, draft, versions });
}));

export default app;