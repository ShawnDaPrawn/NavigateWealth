import { Hono } from "npm:hono";
import { z } from "npm:zod";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import { requireAdmin } from "./auth-mw.ts";
import * as kv from './kv_store.tsx';
import { formatZodError } from './shared-validation-utils.ts';

const AddCommentSchema = z.object({
  comment: z.object({
    text: z.string().min(1, 'Comment text is required').max(5000),
    authorId: z.string().optional(),
    authorName: z.string().max(200).optional(),
    authorInitials: z.string().max(5).optional(),
  }),
});

const app = new Hono();
const log = createModuleLogger('task-comments');

// All task-comments routes require admin authentication (§12.2)
app.use('*', requireAdmin);

// Get comments for a task
app.get('/:taskId', asyncHandler(async (c) => {
  const taskId = c.req.param('taskId');
  
  if (!taskId) {
    return c.json({ success: false, error: 'Task ID is required' }, 400);
  }

  try {
    const key = `task_comments:${taskId}`;
    
    // Ensure it's sorted by date (newest first usually, but Trello often does oldest first or newest first. Trello does oldest first usually for chat)
    // Let's sort oldest first (chronological)
    const comments = (await kv.get(key) || []).sort((a: { createdAt: string }, b: { createdAt: string }) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return c.json({ success: true, comments });
  } catch (error) {
    log.error(`Failed to fetch comments for task ${taskId}`, error);
    return c.json({ success: false, error: 'Failed to fetch comments' }, 500);
  }
}));

// Add a comment to a task
app.post('/:taskId', asyncHandler(async (c) => {
  const taskId = c.req.param('taskId');
  
  if (!taskId) {
    return c.json({ success: false, error: 'Task ID is required' }, 400);
  }

  const body = await c.req.json();
  const parsed = AddCommentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
  }

  try {
    const key = `task_comments:${taskId}`;
    const existingComments = await kv.get(key) || [];
    
    const newComment = {
      ...parsed.data.comment,
      id: crypto.randomUUID(),
      taskId,
      createdAt: new Date().toISOString()
    };
    
    const updatedComments = [...(existingComments as Record<string, unknown>[]), newComment];
    await kv.set(key, updatedComments);
    
    return c.json({ success: true, comment: newComment });
  } catch (error) {
    log.error(`Failed to add comment for task ${taskId}`, error);
    return c.json({ success: false, error: 'Failed to add comment' }, 500);
  }
}));

// Delete a comment
app.delete('/:taskId/:commentId', asyncHandler(async (c) => {
  const taskId = c.req.param('taskId');
  const commentId = c.req.param('commentId');
  
  if (!taskId || !commentId) {
    return c.json({ success: false, error: 'Task ID and Comment ID are required' }, 400);
  }

  try {
    const key = `task_comments:${taskId}`;
    const existingComments = await kv.get(key) || [];
    
    const updatedComments = existingComments.filter((comment: { id: string }) => comment.id !== commentId);
    
    await kv.set(key, updatedComments);
    
    return c.json({ success: true });
  } catch (error) {
    log.error(`Failed to delete comment ${commentId} for task ${taskId}`, error);
    return c.json({ success: false, error: 'Failed to delete comment' }, 500);
  }
}));

export default app;