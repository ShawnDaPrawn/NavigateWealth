import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from './kv_store.tsx';
import { createModuleLogger } from "./stderr-logger.ts";
import { requireAdmin } from "./auth-mw.ts";
import { asyncHandler } from './error.middleware.ts';
import { TaskIdParamSchema, DateQuerySchema, validateAttachmentFile } from './todo-validation.ts';

const app = new Hono();
const log = createModuleLogger('todo');

// All todo routes require admin authentication (§12.2)
app.use('*', requireAdmin);

// Root handlers
app.get('/', (c) => c.json({ service: 'todo', status: 'active' }));
app.get('', (c) => c.json({ service: 'todo', status: 'active' }));

// Helper to get supabase client
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Upload Attachment
app.post('/attachments/:taskId', asyncHandler(async (c) => {
  const taskId = TaskIdParamSchema.parse(c.req.param('taskId'));
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  // Validate file (size, type, name) — §12.1
  const fileValidation = validateAttachmentFile(file);
  if (!fileValidation.valid) {
    return c.json({ error: fileValidation.error }, 400);
  }

  const supabase = getSupabase();
  const bucketName = `make-91ed8379-todo-attachments`;

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);
  if (!bucketExists) {
    await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 10485760, // 10MB
    });
  }

  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${taskId}/${timestamp}-${cleanName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    log.error('Upload error:', uploadError);
    return c.json({ error: 'Failed to upload file' }, 500);
  }

  // Generate signed URL
  const { data: signedUrlData } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year expiry for simplicity

  const attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    type: file.type,
    path: path,
    url: signedUrlData?.signedUrl,
    uploadedAt: new Date().toISOString()
  };

  // Update KV store
  const key = `task_attachments:${taskId}`;
  const existingRaw = await kv.get(key);
  const existing = Array.isArray(existingRaw) ? existingRaw : [];
  const updated = [...existing, attachment];
  await kv.set(key, updated);

  return c.json({ success: true, attachment });
}));

// Get Attachments
app.get('/attachments/:taskId', asyncHandler(async (c) => {
  const taskId = TaskIdParamSchema.parse(c.req.param('taskId'));
  const key = `task_attachments:${taskId}`;
  const attachmentsRaw = await kv.get(key);
  const attachments = Array.isArray(attachmentsRaw) ? attachmentsRaw : [];
  
  // Refresh signed URLs
  const supabase = getSupabase();
  const bucketName = `make-91ed8379-todo-attachments`;

  const refreshedAttachments = await Promise.all(attachments.map(async (att: Record<string, unknown>) => {
      if (!att.path) return att;
      const { data } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(att.path as string, 60 * 60 * 24); // 24 hours
      return { ...att, url: data?.signedUrl || att.url };
  }));

  return c.json({ attachments: refreshedAttachments });
}));

// Get tasks due today
app.get('/due-today', asyncHandler(async (c) => {
  // Get all tasks from KV store
  const allTasksRaw = await kv.getByPrefix('task:');
  
  // Parse and filter tasks for today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const tasksDueToday = allTasksRaw
    .map((item: Record<string, unknown>) => item.value)
    .filter((task: Record<string, unknown>) => {
      if (!task || !task.dueDate) return false;
      const dueDate = new Date(task.dueDate as string);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime() && task.status !== 'completed';
    });
  
  log.info('Fetched tasks due today', { count: tasksDueToday.length });
  return c.json(tasksDueToday);
}));

// Get tasks by date
app.get('/by-date', asyncHandler(async (c) => {
  const dateParam = DateQuerySchema.parse(c.req.query('date') ?? '');
  
  // Get all tasks from KV store
  const allTasksRaw = await kv.getByPrefix('task:');
  
  // Parse and filter tasks for the specified date
  const targetDate = new Date(dateParam);
  targetDate.setHours(0, 0, 0, 0);
  
  const tasksByDate = allTasksRaw
    .map((item: Record<string, unknown>) => item.value)
    .filter((task: Record<string, unknown>) => {
      if (!task || !task.dueDate) return false;
      const dueDate = new Date(task.dueDate as string);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === targetDate.getTime();
    });
  
  log.info('Fetched tasks by date', { date: dateParam, count: tasksByDate.length });
  return c.json(tasksByDate);
}));

export default app;