import { Hono } from 'npm:hono';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { createServiceClient } from './client-management-utils.ts';
import { requireClientAccess } from './client-access.ts';

const app = new Hono();
const log = createModuleLogger('client-management-avatar');

/**
 * Client profile photos.
 *
 * One private object per client at `<userId>/avatar`, replaced in place, so the
 * photo needs no KV record and no profile-schema change: the object existing IS
 * the "has a photo" state. The browser downsizes to a small square before
 * upload; the limits below are the server-side backstop.
 *
 * SVG is deliberately not accepted — it can carry script.
 */
const AVATAR_BUCKET = 'make-91ed8379-client-avatars';
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const avatarPath = (userId: string) => `${userId}/avatar`;

let bucketReady = false;
async function ensureBucket(supabase: ReturnType<typeof createServiceClient>) {
  if (bucketReady) return;
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === AVATAR_BUCKET)) {
    await supabase.storage.createBucket(AVATAR_BUCKET, {
      public: false,
      fileSizeLimit: AVATAR_MAX_BYTES,
      allowedMimeTypes: AVATAR_MIME_TYPES,
    });
  }
  bucketReady = true;
}

async function signedAvatarUrl(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarPath(userId), SIGNED_URL_TTL_SECONDS);
  // A missing object is the normal "no photo yet" state, not a failure.
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** GET /avatar/:userId — signed URL for the client's photo, or `url: null`. */
app.get('/avatar/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const accessDenied = await requireClientAccess(c, userId);
    if (accessDenied) return accessDenied;

    const supabase = createServiceClient();
    return c.json({ success: true, url: await signedAvatarUrl(supabase, userId) });
  } catch (error) {
    log.error('Error in GET /avatar', error);
    return c.json({ error: 'Failed to load photo', details: getErrMsg(error) }, 500);
  }
});

/** POST /avatar/:userId — set or replace the client's photo (multipart `file`). */
app.post('/avatar/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const accessDenied = await requireClientAccess(c, userId);
    if (accessDenied) return accessDenied;

    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    if (!AVATAR_MIME_TYPES.includes(file.type)) {
      return c.json({ error: 'Photo must be a JPEG, PNG or WebP image' }, 400);
    }
    if (file.size > AVATAR_MAX_BYTES) {
      return c.json({ error: 'Photo must be 2MB or smaller' }, 400);
    }

    const supabase = createServiceClient();
    await ensureBucket(supabase);

    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(avatarPath(userId), file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) {
      log.error('Avatar upload failed', error);
      return c.json({ error: error.message }, 500);
    }

    return c.json({ success: true, url: await signedAvatarUrl(supabase, userId) });
  } catch (error) {
    log.error('Error in POST /avatar', error);
    return c.json({ error: 'Failed to save photo', details: getErrMsg(error) }, 500);
  }
});

/** DELETE /avatar/:userId — remove the client's photo (idempotent). */
app.delete('/avatar/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const accessDenied = await requireClientAccess(c, userId);
    if (accessDenied) return accessDenied;

    const supabase = createServiceClient();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
    if (error) {
      log.error('Avatar delete failed', error);
      return c.json({ error: error.message }, 500);
    }
    return c.json({ success: true });
  } catch (error) {
    log.error('Error in DELETE /avatar', error);
    return c.json({ error: 'Failed to remove photo', details: getErrMsg(error) }, 500);
  }
});

export default app;
