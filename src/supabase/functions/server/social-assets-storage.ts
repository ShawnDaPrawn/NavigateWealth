/**
 * Social automation — the PUBLIC assets bucket.
 *
 * WHY A SECOND BUCKET
 * -------------------
 * The AI generator's bucket (`make-91ed8379-social-ai-images`) is private and
 * hands out one-hour signed URLs, which suits an admin previewing a picture.
 * Buffer fetches a post's image from the URL it is given, and the scheduling
 * routine may create that post a day after the image was rendered. So assets
 * bound for Buffer live in a public bucket under a stable path, and the URL
 * stored on `social_assets.image_url` never expires.
 *
 * Nothing sensitive is ever written here: only generated marketing imagery.
 * This module deliberately does not import the DALL-E renderer, so the manual
 * Compose path (which only copies images) does not sit in the AI-spend graph.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('social-assets-storage');

export const SOCIAL_ASSETS_BUCKET = 'make-91ed8379-social-assets';

/** Lazy service-role client — never constructed at module top level. */
export const getSocialSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

let bucketEnsured = false;

/** Create the public bucket once per isolate (idempotent against the API). */
export async function ensureSocialAssetsBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSocialSupabase();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: { name: string }) => b.name === SOCIAL_ASSETS_BUCKET);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(SOCIAL_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: '10MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Failed to create social assets bucket: ${error.message}`);
    }
    log.info('Created public social assets bucket', { bucket: SOCIAL_ASSETS_BUCKET });
  }
  bucketEnsured = true;
}

/** Test hook. */
export function resetBucketCache(): void {
  bucketEnsured = false;
}

export function publicUrlFor(storagePath: string): string {
  const { data } = getSocialSupabase().storage.from(SOCIAL_ASSETS_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Download an image from a URL we trust (DALL-E's temporary result URL) and
 * store it at `storagePath` in the public bucket. Returns the public URL.
 */
export async function uploadPublicImage(sourceUrl: string, storagePath: string): Promise<string> {
  await ensureSocialAssetsBucket();
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download generated image: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = (response.headers.get('content-type') || 'image/png').split(';')[0];

  const { error } = await getSocialSupabase()
    .storage.from(SOCIAL_ASSETS_BUCKET)
    .upload(storagePath, bytes, { contentType, upsert: true });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
  return publicUrlFor(storagePath);
}

/**
 * Copy an object out of a private bucket (the AI generator's) into the public
 * bucket so Buffer can fetch it. Used by the manual Compose path.
 */
export async function publishPrivateImage(
  sourceBucket: string,
  sourcePath: string,
  storagePath: string,
): Promise<string> {
  const supabase = getSocialSupabase();
  const { data, error } = await supabase.storage.from(sourceBucket).download(sourcePath);
  if (error || !data) {
    throw new Error(`Could not read ${sourcePath}: ${error?.message ?? 'no data'}`);
  }
  await ensureSocialAssetsBucket();
  const bytes = new Uint8Array(await data.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(SOCIAL_ASSETS_BUCKET)
    .upload(storagePath, bytes, { contentType: data.type || 'image/png', upsert: true });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }
  return publicUrlFor(storagePath);
}
