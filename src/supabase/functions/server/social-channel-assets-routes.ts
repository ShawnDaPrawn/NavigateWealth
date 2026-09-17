/**
 * Social library — the Assets tab's media, and the way an outside agent adds to it.
 *
 *   GET    /social-library/channels        — the three channels and their counts
 *   GET    /social-library/assets          — list, filtered by channel/status/type
 *   POST   /social-library/assets          — add one (multipart file, or JSON sourceUrl)
 *   GET    /social-library/assets/:id      — one asset
 *   PATCH  /social-library/assets/:id      — caption, alt text, tags, notes, status, channel
 *   POST   /social-library/assets/:id/used — mark it published (a routine calls this)
 *   DELETE /social-library/assets/:id      — remove the row and the file
 *
 * TWO KINDS OF CALLER, ONE SURFACE
 * --------------------------------
 * The admin UI and an integrating agent do exactly the same things here, so
 * they share the routes rather than duplicating them. The gate accepts, in
 * order: the dedicated token against an env var (development only), the same
 * token against Vault (the production path for ChatGPT), the shared cron
 * token, and finally an admin session (the browser).
 *
 * The env branch is honoured ONLY when DENO_ENV is 'development', which is set
 * nowhere in deployment, so in production it can never act as a second
 * credential and rotating the Vault secret revokes everything.
 *
 * Kept in its own router so the machine gate cannot leak onto the admin-only
 * social routes next door — the same separation newsletter-intake-routes.ts
 * makes for the same reason.
 */

import { Hono, type Context, type Next } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { asyncHandler } from './error.middleware.ts';
import { constantTimeEqual } from './crypto-utils.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import { verifySocialAssetsToken } from './social-channel-assets-auth.ts';
import { SOCIAL_ASSETS_TOKEN_HEADER } from './social-channel-assets-types.ts';
import {
  AddChannelAssetSchema,
  ListChannelAssetsQuerySchema,
  MarkUsedSchema,
  UpdateChannelAssetSchema,
} from './social-channel-assets-validation.ts';
import {
  addChannelAsset,
  channelAssetSummary,
  deleteChannelAsset,
  getChannelAsset,
  listChannelAssets,
  markChannelAssetUsed,
  updateChannelAsset,
} from './social-channel-assets-service.ts';

const app = new Hono();
const log = createModuleLogger('social-library-routes');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The env override, honoured only under DENO_ENV=development.
 *
 * Kept out of the gate body so `constantTimeEqual` stays inside the
 * route-auth detector's scan window of `app.use(`.
 */
const developmentOverrideToken = (): string =>
  Deno.env.get('DENO_ENV') === 'development'
    ? (Deno.env.get('NW_SOCIAL_ASSETS_TOKEN') || '').trim()
    : '';

app.use('*', async (c: Context, next: Next) => {
  const dedicated = (c.req.header(SOCIAL_ASSETS_TOKEN_HEADER) || '').trim();
  const expected = developmentOverrideToken();
  if (expected !== '' && dedicated !== '' && constantTimeEqual(dedicated, expected)) {
    c.set('assetActor', 'integration');
    return next();
  }
  if (dedicated !== '' && (await verifySocialAssetsToken(dedicated))) {
    c.set('assetActor', 'integration');
    return next();
  }
  if (await isAuthorizedCronRequest(c)) {
    c.set('assetActor', 'scheduled');
    return next();
  }
  return requireAdmin(c, next);
});

/** Who is writing: the integration, a scheduled job, or the signed-in admin. */
function actorOf(c: Context): string {
  const machine = c.get('assetActor') as string | undefined;
  if (machine) return machine;
  const userId = c.get('userId') as string | undefined;
  return userId ? `admin:${userId}` : 'admin';
}

app.get(
  '/channels',
  asyncHandler(async (c) => {
    const counts = await channelAssetSummary();
    return c.json({
      success: true,
      data: [
        { id: 'linkedin', label: 'LinkedIn', ...counts.linkedin },
        { id: 'instagram', label: 'Instagram', ...counts.instagram },
        { id: 'x', label: 'X (Twitter)', ...counts.x },
      ],
    });
  }),
);

app.get(
  '/assets',
  asyncHandler(async (c) => {
    const parsed = ListChannelAssetsQuerySchema.safeParse({
      channel: c.req.query('channel') ?? undefined,
      status: c.req.query('status') ?? undefined,
      mediaType: c.req.query('mediaType') ?? undefined,
      limit: c.req.query('limit') ?? undefined,
      offset: c.req.query('offset') ?? undefined,
    });
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const assets = await listChannelAssets(parsed.data);
    return c.json({ success: true, data: assets });
  }),
);

/**
 * Add one asset.
 *
 * Multipart when the caller has the bytes; JSON with `sourceUrl` when it only
 * has a link. Both land in the same place and obey the same checks.
 */
app.post(
  '/assets',
  asyncHandler(async (c) => {
    const contentType = c.req.header('content-type') || '';
    let fields: Record<string, unknown> = {};
    let bytes: Uint8Array | undefined;
    let declaredType: string | undefined;
    let fileName: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await c.req.formData().catch(() => null);
      if (!form) return c.json({ error: 'Could not read the multipart body.' }, 400);
      for (const [key, value] of form.entries()) {
        if (key === 'file') continue;
        if (typeof value === 'string') fields[key] = value;
      }
      const file = form.get('file');
      // `instanceof File` is unreliable across the edge and test runtimes; the
      // shape is what matters.
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const upload = file as {
          name?: string;
          type?: string;
          arrayBuffer: () => Promise<ArrayBuffer>;
        };
        bytes = new Uint8Array(await upload.arrayBuffer());
        declaredType = upload.type;
        fileName = upload.name;
      }
    } else {
      fields = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    }

    const parsed = AddChannelAssetSchema.safeParse(fields);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    if (!bytes && !parsed.data.sourceUrl) {
      return c.json(
        { error: 'Attach the file as the "file" field, or pass a sourceUrl for us to fetch.' },
        400,
      );
    }

    const actor = actorOf(c);
    const asset = await addChannelAsset({
      ...parsed.data,
      bytes,
      declaredType,
      fileName: parsed.data.fileName ?? fileName,
      source: parsed.data.source ?? (actor === 'integration' ? 'chatgpt' : actor),
      agent: actor,
    });

    log.info('Channel asset created', {
      id: asset.id,
      channel: asset.channel,
      mediaType: asset.media_type,
      actor,
    });
    return c.json({ success: true, data: asset }, 201);
  }),
);

app.get(
  '/assets/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!UUID.test(id)) return c.json({ error: 'Invalid asset id' }, 400);
    return c.json({ success: true, data: await getChannelAsset(id) });
  }),
);

app.patch(
  '/assets/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!UUID.test(id)) return c.json({ error: 'Invalid asset id' }, 400);
    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdateChannelAssetSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const asset = await updateChannelAsset(id, parsed.data, actorOf(c));
    return c.json({ success: true, data: asset });
  }),
);

app.post(
  '/assets/:id/used',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!UUID.test(id)) return c.json({ error: 'Invalid asset id' }, 400);
    const raw = await c.req.json().catch(() => ({}));
    const parsed = MarkUsedSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', ...formatZodError(parsed.error) }, 400);
    }
    const actor = actorOf(c);
    const asset = await markChannelAssetUsed(id, parsed.data.bufferPostId, actor);
    log.info('Channel asset marked used', { id, bufferPostId: parsed.data.bufferPostId, actor });
    return c.json({ success: true, data: asset });
  }),
);

app.delete(
  '/assets/:id',
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (!UUID.test(id)) return c.json({ error: 'Invalid asset id' }, 400);
    await deleteChannelAsset(id);
    log.info('Channel asset deleted', { id, actor: actorOf(c) });
    return c.json({ success: true });
  }),
);

export default app;
