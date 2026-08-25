/**
 * Shared constants and helpers for refund-clusters route modules.
 * Imported by refund-clusters-routes.ts, -documents-routes.ts, and -transactions-routes.ts.
 */

import { type Context } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { AdminAuditService } from '../admin-audit-service.ts';

export const BUCKET = 'make-91ed8379-refund-clusters';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
export const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

export const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

export function audit(
  c: Context,
  action: string,
  summary: string,
  options: {
    severity?: 'info' | 'warning' | 'critical';
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  return AdminAuditService.record({
    actorId: c.get('userId') as string,
    actorRole: c.get('userRole') as string,
    category: 'security',
    action,
    summary,
    severity: options.severity ?? 'info',
    entityType: options.entityType ?? 'refund_cluster',
    entityId: options.entityId,
    metadata: options.metadata,
  });
}

export function errStatus(error: unknown): number {
  const status = (error as { status?: number })?.status;
  return typeof status === 'number' ? status : 500;
}

export function validateUpload(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return 'File exceeds the 10MB limit';
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Only PDF, JPEG and PNG files are allowed';
  }
  return null;
}

export async function ensureBucket(supabase: ReturnType<typeof getSupabase>): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
    });
  }
}
