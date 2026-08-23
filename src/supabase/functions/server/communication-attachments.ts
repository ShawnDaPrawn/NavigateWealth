/**
 * Attachment upload to storage — the one capability both a direct message and a campaign need.
 *
 * Split out of `communication-service.ts` (1,387 lines), a stateless class whose
 * `this.` only ever called a sibling method. The class remains as a facade with
 * field assignments; the logger keeps its channel name.
 */
import { createModuleLogger } from './stderr-logger.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import type { StoredAttachment } from './communication-service-helpers.ts';

const log = createModuleLogger('communication-service');

export async function uploadFile(file: File): Promise<StoredAttachment> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const BUCKET_NAME = 'make-91ed8379-communication';

  // Ensure bucket exists
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
      });
    }
  } catch (e) {
    log.warn('Bucket check failed', { error: String(e) });
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${timestamp}_${sanitizedName}`;

  const fileBuffer = await file.arrayBuffer();

  const { data: _data, error } = await supabase.storage.from(BUCKET_NAME).upload(path, fileBuffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return {
    id: crypto.randomUUID(),
    name: file.name,
    path: path,
    bucket: BUCKET_NAME,
    type: file.type,
    size: file.size,
    url: publicUrl,
  };
}
