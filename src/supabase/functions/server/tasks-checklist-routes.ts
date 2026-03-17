import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import { requireAdmin } from "./auth-mw.ts";
import * as kv from './kv_store.tsx';
import { formatZodError } from './shared-validation-utils.ts';

const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
  completed: z.boolean().default(false),
}).passthrough();

const SaveChecklistSchema = z.object({
  checklist: z.array(ChecklistItemSchema).max(100, 'Maximum 100 checklist items'),
});

const app = new Hono();
const log = createModuleLogger('tasks-checklist');

// All task-checklist routes require admin authentication (§12.2)
app.use('*', requireAdmin);

// Get checklist for a task
app.get('/:taskId', asyncHandler(async (c) => {
  const taskId = c.req.param('taskId');
  
  if (!taskId) {
    return c.json({ success: false, error: 'Task ID is required' }, 400);
  }

  try {
    const key = `task_checklist:${taskId}`;
    const checklist = await kv.get(key) || [];
    
    return c.json({ success: true, checklist });
  } catch (error) {
    log.error(`Failed to fetch checklist for task ${taskId}`, error);
    return c.json({ success: false, error: 'Failed to fetch checklist' }, 500);
  }
}));

// Save checklist for a task
app.post('/:taskId', asyncHandler(async (c) => {
  const taskId = c.req.param('taskId');
  
  if (!taskId) {
    return c.json({ success: false, error: 'Task ID is required' }, 400);
  }

  const body = await c.req.json();
  const parsed = SaveChecklistSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  try {
    const key = `task_checklist:${taskId}`;
    await kv.set(key, parsed.data.checklist);
    
    return c.json({ success: true, checklist: parsed.data.checklist });
  } catch (error) {
    log.error(`Failed to save checklist for task ${taskId}`, error);
    return c.json({ success: false, error: 'Failed to save checklist' }, 500);
  }
}));

export default app;