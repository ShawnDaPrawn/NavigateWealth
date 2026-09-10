/**
 * Social automation — routes.
 *
 *   GET   /social-assets/batches               — recent weeks with counts
 *   GET   /social-assets/batches/:weekKey      — one week + its assets
 *   GET   /social-assets/assets                — assets by week/channel/state
 *   PATCH /social-assets/assets/:id            — reject / restore / retry image
 *   GET   /social-assets/settings              — automation settings
 *   PUT   /social-assets/settings              — edit settings (kill switch lives here)
 *   GET   /social-assets/playbooks             — the routines' instructions
 *   PUT   /social-assets/playbooks/:id         — edit a playbook
 *   POST  /social-assets/jobs/render-images    — scheduled: render pending images
 *   POST  /social-assets/jobs/sync-buffer      — scheduled: mirror Buffer status
 *
 * AUTH SHAPE
 * ----------
 * Everything a person does is `requireAdmin`. The two jobs accept EITHER the
 * Vault-backed cron token (their scheduled caller) OR an admin session (the
 * "Run now" buttons on the Assets tab), through a file-local gate that tries
 * the cron check first and falls back to `requireAdmin`. See
 * `__tests__/route-auth-classification.ts` for why that gate is classified
 * rather than added to the detector's marker list.
 *
 * The routines (Claude / ChatGPT) do not call any of these: they work through
 * their Supabase and Buffer connectors. This surface exists for the admin UI
 * and the Edge Function's own jobs.
 */

import { Hono, type Context, type Next } from 'npm:hono';
import { requireAdmin } from './auth-mw.ts';
import { isAuthorizedCronRequest } from './cron-auth.ts';
import { aiUsageLimit } from './ai-usage-limit.ts';
import { asyncHandler } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { formatZodError } from './shared-validation-utils.ts';
import {
  ListAssetsQuerySchema,
  ListBatchesQuerySchema,
  RenderImagesSchema,
  SyncBufferSchema,
  UpdateAssetSchema,
  UpdatePlaybookSchema,
  UpdateSettingsSchema,
} from './social-assets-validation.ts';
import {
  getBatch,
  getSettings,
  listAssets,
  listBatches,
  listPlaybooks,
  renderPendingImages,
  syncBufferStatuses,
  updateAsset,
  updatePlaybook,
  updateSettings,
} from './social-assets-service.ts';

const app = new Hono();
const log = createModuleLogger('social-assets-routes');

/**
 * Cron token OR admin session. The scheduled job has no user session and could
 * never satisfy requireAdmin (the same 401-forever failure auto-content's
 * `/process-due` had); an admin clicking "Run now" has no cron token. Cron is
 * checked first so the scheduled path never depends on the session machinery.
 */
async function requireCronOrAdmin(c: Context, next: Next) {
  if (await isAuthorizedCronRequest(c)) return next();
  return requireAdmin(c, next);
}

function actorOf(c: Context): string {
  return (c.get('userId') as string | undefined) || 'scheduled';
}

// ---------------------------------------------------------------------------
// Jobs — registered before any parameterised path (§14.2)
// ---------------------------------------------------------------------------

app.post(
  '/jobs/render-images',
  requireCronOrAdmin,
  aiUsageLimit({ surface: 'social-assets' }),
  asyncHandler(async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = RenderImagesSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    log.info('Render images job requested', { ...parsed.data, actor: actorOf(c) });
    const report = await renderPendingImages(parsed.data);
    return c.json({ success: true, report });
  }),
);

app.post(
  '/jobs/sync-buffer',
  requireCronOrAdmin,
  asyncHandler(async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = SyncBufferSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    log.info('Buffer sync job requested', { ...parsed.data, actor: actorOf(c) });
    const report = await syncBufferStatuses(parsed.data);
    return c.json({ success: true, report });
  }),
);

// ---------------------------------------------------------------------------
// Batches and assets
// ---------------------------------------------------------------------------

app.get(
  '/batches',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = ListBatchesQuerySchema.safeParse({ limit: c.req.query('limit') ?? undefined });
    const limit = parsed.success ? parsed.data.limit : 12;
    const batches = await listBatches(limit);
    return c.json({ success: true, batches });
  }),
);

app.get(
  '/batches/:weekKey',
  requireAdmin,
  asyncHandler(async (c) => {
    const weekKey = c.req.param('weekKey')!;
    if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
      return c.json({ success: false, error: 'weekKey must look like 2026-W38' }, 400);
    }
    const { batch, assets } = await getBatch(weekKey);
    return c.json({ success: true, batch, assets });
  }),
);

app.get(
  '/assets',
  requireAdmin,
  asyncHandler(async (c) => {
    const parsed = ListAssetsQuerySchema.safeParse({
      week: c.req.query('week') ?? undefined,
      channel: c.req.query('channel') ?? undefined,
      state: c.req.query('state') ?? undefined,
      limit: c.req.query('limit') ?? undefined,
    });
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const assets = await listAssets(parsed.data);
    return c.json({ success: true, assets });
  }),
);

app.patch(
  '/assets/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const assetId = c.req.param('id')!;
    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdateAssetSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const asset = await updateAsset(assetId, parsed.data, actorOf(c));
    return c.json({ success: true, asset });
  }),
);

// ---------------------------------------------------------------------------
// Settings and playbooks
// ---------------------------------------------------------------------------

app.get(
  '/settings',
  requireAdmin,
  asyncHandler(async (c) => {
    const settings = await getSettings();
    return c.json({ success: true, settings });
  }),
);

app.put(
  '/settings',
  requireAdmin,
  asyncHandler(async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdateSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const settings = await updateSettings(parsed.data, actorOf(c));
    return c.json({ success: true, settings });
  }),
);

app.get(
  '/playbooks',
  requireAdmin,
  asyncHandler(async (c) => {
    const playbooks = await listPlaybooks();
    return c.json({ success: true, playbooks });
  }),
);

app.put(
  '/playbooks/:id',
  requireAdmin,
  asyncHandler(async (c) => {
    const id = c.req.param('id')!;
    if (id !== 'generate' && id !== 'schedule') {
      return c.json({ success: false, error: 'Unknown playbook' }, 404);
    }
    const raw = await c.req.json().catch(() => ({}));
    const parsed = UpdatePlaybookSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: 'Validation failed', ...formatZodError(parsed.error) },
        400,
      );
    }
    const playbook = await updatePlaybook(id, parsed.data, actorOf(c));
    return c.json({ success: true, playbook });
  }),
);

export default app;
