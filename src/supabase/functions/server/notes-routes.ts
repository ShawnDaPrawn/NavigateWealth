/**
 * ****************************************************************************
 * NOTES ROUTES
 * ****************************************************************************
 *
 * VERSION: 1.0.0
 *
 * CRUD endpoints for personnel notes with optional client linking
 * and convert-to-task functionality.
 *
 * KV key patterns:
 *   note:{noteId}                      — individual note data
 *   notes:personnel:{personnelId}      — array of note IDs per personnel
 *   notes:client:{clientId}            — array of note IDs linked to a client
 *
 * §4.2 — Thin route handlers delegating to inline service logic
 * §5.4 — KV store conventions with deterministic key naming
 * §12.2 — All routes require admin authentication
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import { requireAdmin, getAuthContext } from "./auth-mw.ts";
import * as kv from './kv_store.tsx';

const app = new Hono();
const log = createModuleLogger('notes');

// All note routes require admin authentication
app.use('*', requireAdmin);

// ============================================================================
// HELPERS
// ============================================================================

function noteKey(id: string): string {
  return `note:${id}`;
}

function personnelIndexKey(personnelId: string): string {
  return `notes:personnel:${personnelId}`;
}

function clientIndexKey(clientId: string): string {
  return `notes:client:${clientId}`;
}

function generateId(): string {
  return crypto.randomUUID();
}

interface KvNote {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  personnelId: string;
  personnelName: string;
  clientId?: string | null;
  clientName?: string | null;
  tags: string[];
  color: string;
  isPinned: boolean;
  isArchived: boolean;
  convertedToTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// GET /notes — List all notes for the authenticated personnel
// ============================================================================

app.get('/', asyncHandler(async (c) => {
  const personnelId = c.req.query('personnelId');

  if (!personnelId) {
    return c.json({ error: 'Missing personnelId query parameter' }, 400);
  }

  log.info('Fetching notes for personnel', { personnelId });

  const noteIds: string[] = (await kv.get(personnelIndexKey(personnelId))) || [];

  if (noteIds.length === 0) {
    return c.json({ notes: [] });
  }

  const noteKeysArr = noteIds.map(noteKey);
  const notes: KvNote[] = (await kv.mget(noteKeysArr)).filter(Boolean) as KvNote[];

  // Sort: pinned first, then by updatedAt descending
  notes.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return c.json({ notes });
}));

// ============================================================================
// GET /notes/client/:clientId — List notes linked to a specific client
// ============================================================================

app.get('/client/:clientId', asyncHandler(async (c) => {
  const clientId = c.req.param('clientId');

  log.info('Fetching notes for client', { clientId });

  const noteIds: string[] = (await kv.get(clientIndexKey(clientId))) || [];

  if (noteIds.length === 0) {
    return c.json({ notes: [] });
  }

  const noteKeysArr = noteIds.map(noteKey);
  const notes: KvNote[] = (await kv.mget(noteKeysArr)).filter(Boolean) as KvNote[];

  // Filter out archived, sort by updatedAt descending
  const visible = notes
    .filter(n => !n.isArchived)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return c.json({ notes: visible });
}));

// ============================================================================
// GET /notes/:id — Get a single note
// ============================================================================

app.get('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const note = await kv.get(noteKey(id)) as KvNote | null;

  if (!note) {
    return c.json({ error: 'Note not found' }, 404);
  }

  return c.json({ note });
}));

// ============================================================================
// POST /notes — Create a note
// ============================================================================

app.post('/', asyncHandler(async (c) => {
  const body = await c.req.json();
  const { title, content, personnelId, personnelName, clientId, clientName, tags, color } = body;

  if (!personnelId) {
    return c.json({ error: 'personnelId is required' }, 400);
  }
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return c.json({ error: 'title is required' }, 400);
  }

  const now = new Date().toISOString();
  const id = generateId();

  const note: KvNote = {
    id,
    title: title.trim(),
    content: content || '',
    personnelId,
    personnelName: personnelName || 'Unknown',
    clientId: clientId || null,
    clientName: clientName || null,
    tags: Array.isArray(tags) ? tags : [],
    color: color || 'default',
    isPinned: false,
    isArchived: false,
    convertedToTaskId: null,
    createdAt: now,
    updatedAt: now,
  };

  // Save note + update personnel index (+ client index if linked)
  const writes: Promise<void>[] = [
    kv.set(noteKey(id), note),
  ];

  // Update personnel index
  const personnelNotes: string[] = (await kv.get(personnelIndexKey(personnelId))) || [];
  personnelNotes.unshift(id);
  writes.push(kv.set(personnelIndexKey(personnelId), personnelNotes));

  // Update client index if linked
  if (clientId) {
    const clientNotes: string[] = (await kv.get(clientIndexKey(clientId))) || [];
    clientNotes.unshift(id);
    writes.push(kv.set(clientIndexKey(clientId), clientNotes));
  }

  await Promise.all(writes);

  log.info('Note created', { id, personnelId, clientId: clientId || 'none' });
  return c.json({ note }, 201);
}));

// ============================================================================
// PUT /notes/:id — Update a note
// ============================================================================

app.put('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await kv.get(noteKey(id)) as KvNote | null;

  if (!existing) {
    return c.json({ error: 'Note not found' }, 404);
  }

  const now = new Date().toISOString();
  const oldClientId = existing.clientId;
  const newClientId = body.clientId !== undefined ? (body.clientId || null) : existing.clientId;

  const updated: KvNote = {
    ...existing,
    title: body.title !== undefined ? body.title.trim() : existing.title,
    content: body.content !== undefined ? body.content : existing.content,
    summary: body.summary !== undefined ? body.summary : existing.summary,
    clientId: newClientId,
    clientName: body.clientName !== undefined ? body.clientName : existing.clientName,
    tags: body.tags !== undefined ? body.tags : existing.tags,
    color: body.color !== undefined ? body.color : existing.color,
    isPinned: body.isPinned !== undefined ? body.isPinned : existing.isPinned,
    isArchived: body.isArchived !== undefined ? body.isArchived : existing.isArchived,
    updatedAt: now,
  };

  const writes: Promise<void>[] = [kv.set(noteKey(id), updated)];

  // Handle client link changes
  if (oldClientId !== newClientId) {
    // Remove from old client index
    if (oldClientId) {
      const oldIndex: string[] = (await kv.get(clientIndexKey(oldClientId))) || [];
      const filtered = oldIndex.filter(nid => nid !== id);
      writes.push(kv.set(clientIndexKey(oldClientId), filtered));
    }
    // Add to new client index
    if (newClientId) {
      const newIndex: string[] = (await kv.get(clientIndexKey(newClientId))) || [];
      if (!newIndex.includes(id)) {
        newIndex.unshift(id);
        writes.push(kv.set(clientIndexKey(newClientId), newIndex));
      }
    }
  }

  await Promise.all(writes);

  log.info('Note updated', { id });
  return c.json({ note: updated });
}));

// ============================================================================
// DELETE /notes/:id — Delete a note permanently
// ============================================================================

app.delete('/:id', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const existing = await kv.get(noteKey(id)) as KvNote | null;

  if (!existing) {
    return c.json({ error: 'Note not found' }, 404);
  }

  const writes: Promise<void>[] = [kv.del(noteKey(id))];

  // Remove from personnel index
  const personnelNotes: string[] = (await kv.get(personnelIndexKey(existing.personnelId))) || [];
  const filteredPersonnel = personnelNotes.filter(nid => nid !== id);
  writes.push(kv.set(personnelIndexKey(existing.personnelId), filteredPersonnel));

  // Remove from client index if linked
  if (existing.clientId) {
    const clientNotes: string[] = (await kv.get(clientIndexKey(existing.clientId))) || [];
    const filteredClient = clientNotes.filter(nid => nid !== id);
    writes.push(kv.set(clientIndexKey(existing.clientId), filteredClient));
  }

  await Promise.all(writes);

  log.info('Note deleted', { id, personnelId: existing.personnelId });
  return c.json({ success: true });
}));

// ============================================================================
// POST /notes/:id/summarise — AI-powered summarisation of note content
// Must be registered before /:id to prevent path collisions (§14.2)
// ============================================================================

app.post('/:id/summarise', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const existing = await kv.get(noteKey(id)) as KvNote | null;

  if (!existing) {
    return c.json({ success: false, error: 'Note not found' }, 404);
  }

  if (!existing.content || !existing.content.trim()) {
    return c.json({ success: false, error: 'Note has no content to summarise' }, 400);
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    log.error('OPENAI_API_KEY not configured for summarisation');
    return c.json({ success: false, error: 'AI summarisation is not configured' }, 500);
  }

  log.info('Summarising note', { id, contentLength: existing.content.length });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional assistant for a wealth management platform. Your task is to summarise and organise notes taken by financial advisors.

Rules:
- Produce a clear, well-structured summary in markdown format
- Organise the content into logical sections with headings if the note covers multiple topics
- Extract and highlight any action items, deadlines, or follow-ups as a checklist
- Preserve all important details, names, figures, and dates
- Use bullet points for clarity
- Keep the tone professional and concise
- If the note appears to be a voice transcription, clean up any verbal artifacts (ums, ahs, repetitions) while preserving meaning
- Output ONLY the summary — no preamble or meta-commentary`,
          },
          {
            role: 'user',
            content: `Please summarise and organise the following note titled "${existing.title}":\n\n${existing.content}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error('OpenAI API error during summarisation', {
        status: response.status,
        body: errorBody.substring(0, 500),
      });
      return c.json({
        success: false,
        error: `AI summarisation failed (${response.status}). Please try again.`,
      }, 502);
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content?.trim() || '';

    if (!summary) {
      return c.json({
        success: false,
        error: 'AI returned an empty summary. Please try again.',
      }, 502);
    }

    // Persist the summary on the note
    const now = new Date().toISOString();
    const updated: KvNote = {
      ...existing,
      summary,
      updatedAt: now,
    };

    await kv.set(noteKey(id), updated);

    log.info('Note summarised successfully', { id, summaryLength: summary.length });
    return c.json({ success: true, summary, note: updated });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.error('Summarisation error', { id, error: msg });
    return c.json({
      success: false,
      error: `Summarisation failed: ${msg}`,
    }, 500);
  }
}));

// ============================================================================
// POST /notes/:id/convert-to-task — Convert a note into a to-do task
// ============================================================================

app.post('/:id/convert-to-task', asyncHandler(async (c) => {
  const id = c.req.param('id');
  const existing = await kv.get(noteKey(id)) as KvNote | null;

  if (!existing) {
    return c.json({ error: 'Note not found' }, 404);
  }

  if (existing.convertedToTaskId) {
    return c.json({ error: 'Note has already been converted to a task', taskId: existing.convertedToTaskId }, 400);
  }

  // Create the task — prefer AI summary over raw content for the description
  const taskId = generateId();
  const now = new Date().toISOString();
  const taskDescription = existing.summary?.trim() || existing.content;

  const task = {
    id: taskId,
    title: existing.title,
    description: taskDescription,
    status: 'new',
    priority: 'medium',
    reminder_frequency: null,
    is_template: false,
    due_date: null,
    assignee_initials: null,
    assignee_id: null,
    tags: [...existing.tags, 'from-note'],
    category: existing.clientId ? 'client' : 'internal',
    created_by: existing.personnelId,
    created_at: now,
    updated_at: now,
    completed_at: null,
    sort_order: 0,
  };

  // Save task + update note with reference
  const updated: KvNote = {
    ...existing,
    convertedToTaskId: taskId,
    updatedAt: now,
  };

  await Promise.all([
    kv.set(`task:${taskId}`, task),
    kv.set(noteKey(id), updated),
  ]);

  log.info('Note converted to task', { noteId: id, taskId });
  return c.json({ success: true, taskId, note: updated });
}));

export default app;