/**
 * Todo Validation Schemas
 *
 * Zod schemas for the Todo/Task Attachments endpoints (Guidelines §4.2).
 * Validates taskId params and request body inputs.
 *
 * All schemas are defined here and applied in the route handler layer
 * (todo-routes.ts) — services never validate directly.
 */

import { z } from 'npm:zod';

// ── Path Parameters ────────────────────────────────────────────────────────

/**
 * taskId must be a non-empty string. UUIDs are the expected format,
 * but legacy IDs may be present, so we enforce non-empty + max length
 * rather than strict UUID regex.
 */
export const TaskIdParamSchema = z.string()
  .min(1, 'taskId is required')
  .max(128, 'taskId must not exceed 128 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'taskId must contain only alphanumeric characters, hyphens, or underscores');

// ── Query Parameters ───────────────────────────────────────────────────────

/**
 * Date query param for the /by-date endpoint.
 * Must be a valid ISO 8601 date string (YYYY-MM-DD).
 */
export const DateQuerySchema = z.string()
  .min(1, 'Date parameter is required')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => {
    const d = new Date(val);
    return !isNaN(d.getTime());
  }, 'Date must be a valid calendar date');

// ── Attachment Upload ──────────────────────────────────────────────────────

/**
 * Maximum attachment file size: 10 MB (matches the Supabase Storage bucket limit
 * configured in todo-routes.ts).
 */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Allowed MIME types for attachments.
 * Broad enough for documents, images, and spreadsheets;
 * excludes executables and scripts.
 */
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
] as const;

/**
 * Validate an uploaded File object.
 * This cannot use Zod directly (File is a runtime object, not JSON),
 * so we export a plain validation function.
 */
export function validateAttachmentFile(file: File): { valid: true } | { valid: false; error: string } {
  if (!file.name || file.name.trim().length === 0) {
    return { valid: false, error: 'Attachment file name is required' };
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    const maxMB = MAX_ATTACHMENT_SIZE / (1024 * 1024);
    return { valid: false, error: `Attachment exceeds maximum size of ${maxMB} MB` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Attachment file is empty' };
  }

  // MIME type check — allow unknown types through but block known dangerous ones
  const dangerousTypes = [
    'application/x-msdownload',
    'application/x-executable',
    'application/x-msdos-program',
    'application/x-sh',
    'application/x-shellscript',
    'text/x-shellscript',
  ];

  if (dangerousTypes.includes(file.type)) {
    return { valid: false, error: `File type "${file.type}" is not allowed for security reasons` };
  }

  return { valid: true };
}
