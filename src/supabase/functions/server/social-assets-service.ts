/**
 * Social automation — service layer.
 *
 * Reads and writes the `social_*` tables created by the social-automation
 * migration. Two kinds of caller:
 *
 *   - the Assets tab (admin): batches, assets, settings, playbooks;
 *   - the scheduled jobs (cron): render pending images, mirror Buffer status.
 *
 * The routines that generate and schedule posts never come through here —
 * they write the same tables through their Supabase connector. This module
 * therefore treats the rows as shared state: it changes only the columns it
 * owns (`image_*`, `buffer_status`, `published_at`, and the human's
 * `state` overrides) and never rewrites an asset's copy.
 */

import { createModuleLogger } from './stderr-logger.ts';
import { APIError, NotFoundError, ValidationError } from './error.middleware.ts';
import { getSocialSupabase as getSupabase } from './social-assets-storage.ts';
import { getBufferPost } from './buffer-service.ts';
import { renderAssetImage } from './social-assets-images.ts';
import type {
  RenderImagesReport,
  SocialAsset,
  SocialAssetBatch,
  SocialAutomationPlaybook,
  SocialAutomationSettings,
  SocialBatchSummary,
  SyncBufferReport,
} from './social-assets-types.ts';

const log = createModuleLogger('social-assets-service');

const BATCHES = 'social_asset_batches';
const ASSETS = 'social_assets';
const SETTINGS = 'social_automation_settings';
const PLAYBOOKS = 'social_automation_playbooks';

function failed(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'unknown database error'}`);
}

// ---------------------------------------------------------------------------
// Batches and assets (Assets tab)
// ---------------------------------------------------------------------------

export async function listBatches(limit = 12): Promise<SocialBatchSummary[]> {
  const supabase = getSupabase();
  const { data: batches, error } = await supabase
    .from(BATCHES)
    .select('*')
    .order('week_key', { ascending: false })
    .limit(limit);
  if (error) failed('listBatches', error);
  const rows = (batches ?? []) as SocialAssetBatch[];
  if (rows.length === 0) return [];

  const { data: assets, error: assetsError } = await supabase
    .from(ASSETS)
    .select('batch_id, channel, state')
    .in(
      'batch_id',
      rows.map((b) => b.id),
    );
  if (assetsError) failed('listBatches assets', assetsError);

  const counts = new Map<
    string,
    { perChannel: Record<string, number>; scheduled: number; published: number }
  >();
  for (const a of (assets ?? []) as Array<Pick<SocialAsset, 'batch_id' | 'channel' | 'state'>>) {
    const entry = counts.get(a.batch_id) ?? { perChannel: {}, scheduled: 0, published: 0 };
    entry.perChannel[a.channel] = (entry.perChannel[a.channel] ?? 0) + 1;
    if (a.state === 'scheduled') entry.scheduled += 1;
    if (a.state === 'published') entry.published += 1;
    counts.set(a.batch_id, entry);
  }

  return rows.map((b) => {
    const c = counts.get(b.id) ?? { perChannel: {}, scheduled: 0, published: 0 };
    return {
      ...b,
      asset_counts: c.perChannel,
      scheduled_count: c.scheduled,
      published_count: c.published,
    };
  });
}

export async function getBatch(
  weekKey: string,
): Promise<{ batch: SocialAssetBatch; assets: SocialAsset[] }> {
  const supabase = getSupabase();
  const { data: batch, error } = await supabase
    .from(BATCHES)
    .select('*')
    .eq('week_key', weekKey)
    .maybeSingle();
  if (error) failed('getBatch', error);
  if (!batch) throw new NotFoundError(`No batch for week ${weekKey}`);

  const { data: assets, error: assetsError } = await supabase
    .from(ASSETS)
    .select('*')
    .eq('batch_id', (batch as SocialAssetBatch).id)
    .order('channel', { ascending: true })
    .order('selection_rank', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (assetsError) failed('getBatch assets', assetsError);

  return { batch: batch as SocialAssetBatch, assets: (assets ?? []) as SocialAsset[] };
}

export interface ListAssetsFilters {
  week?: string;
  channel?: string;
  state?: string;
  limit?: number;
}

export async function listAssets(filters: ListAssetsFilters = {}): Promise<SocialAsset[]> {
  const supabase = getSupabase();
  let query = supabase.from(ASSETS).select('*');
  if (filters.week) query = query.eq('week_key', filters.week);
  if (filters.channel) query = query.eq('channel', filters.channel);
  if (filters.state) query = query.eq('state', filters.state);
  const { data, error } = await query
    .order('week_key', { ascending: false })
    .order('channel', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(filters.limit ?? 200);
  if (error) failed('listAssets', error);
  return (data ?? []) as SocialAsset[];
}

export interface UpdateAssetInput {
  state?: 'rejected' | 'generated';
  retryImage?: boolean;
}

/**
 * The human's overrides. `rejected` pulls an asset out of the routine's
 * candidate pool (it selects from `generated` only); `generated` puts it back.
 * A scheduled or published asset cannot be rejected here — that is a Buffer
 * delete, done in Buffer, so the two systems cannot disagree about it.
 */
export async function updateAsset(
  assetId: string,
  input: UpdateAssetInput,
  actor: string,
): Promise<SocialAsset> {
  const supabase = getSupabase();
  const { data: existing, error } = await supabase
    .from(ASSETS)
    .select('*')
    .eq('id', assetId)
    .maybeSingle();
  if (error) failed('updateAsset read', error);
  if (!existing) throw new NotFoundError('Asset not found');
  const asset = existing as SocialAsset;

  const patch: Partial<SocialAsset> = { updated_by: actor };

  if (input.state) {
    if (asset.state === 'scheduled' || asset.state === 'published') {
      throw new ValidationError(
        'A scheduled or published asset is managed in Buffer; delete the post there.',
      );
    }
    patch.state = input.state;
  }

  if (input.retryImage) {
    if (!asset.image_brief) {
      throw new ValidationError('This asset has no image brief to render.');
    }
    patch.image_status = 'pending';
    patch.image_error = null;
  }

  const { data: updated, error: updateError } = await supabase
    .from(ASSETS)
    .update(patch)
    .eq('id', assetId)
    .select('*')
    .single();
  if (updateError) failed('updateAsset write', updateError);
  log.info('Asset updated by admin', { assetId, patch: Object.keys(patch) });
  return updated as SocialAsset;
}

// ---------------------------------------------------------------------------
// Settings and playbooks
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<SocialAutomationSettings> {
  const { data, error } = await getSupabase()
    .from(SETTINGS)
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) failed('getSettings', error);
  if (!data)
    throw new NotFoundError('Social automation settings row is missing — run the migration');
  return data as SocialAutomationSettings;
}

export async function updateSettings(
  patch: Partial<SocialAutomationSettings>,
  actor: string,
): Promise<SocialAutomationSettings> {
  const { data, error } = await getSupabase()
    .from(SETTINGS)
    .update({ ...patch, updated_by: actor })
    .eq('id', 'default')
    .select('*')
    .single();
  if (error) failed('updateSettings', error);
  log.info('Social automation settings updated', { actor, fields: Object.keys(patch) });
  return data as SocialAutomationSettings;
}

export async function listPlaybooks(): Promise<SocialAutomationPlaybook[]> {
  const { data, error } = await getSupabase().from(PLAYBOOKS).select('*').order('id');
  if (error) failed('listPlaybooks', error);
  return (data ?? []) as SocialAutomationPlaybook[];
}

export async function updatePlaybook(
  id: string,
  patch: { title?: string; instructions?: string },
  actor: string,
): Promise<SocialAutomationPlaybook> {
  const supabase = getSupabase();
  const { data: existing, error } = await supabase
    .from(PLAYBOOKS)
    .select('version')
    .eq('id', id)
    .maybeSingle();
  if (error) failed('updatePlaybook read', error);
  if (!existing) throw new NotFoundError('Playbook not found');

  const { data, error: updateError } = await supabase
    .from(PLAYBOOKS)
    .update({
      ...patch,
      version: ((existing as { version: number }).version ?? 0) + 1,
      updated_by: actor,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (updateError) failed('updatePlaybook write', updateError);
  log.info('Playbook updated', { id, actor });
  return data as SocialAutomationPlaybook;
}

// ---------------------------------------------------------------------------
// Scheduled jobs
// ---------------------------------------------------------------------------

/**
 * Render every asset whose image is `pending`, oldest first, up to
 * `maxImages`. Sequential on purpose: DALL-E rate-limits per minute and one
 * failure should not take the batch down. A failure is recorded on the asset
 * (`image_status = 'failed'`, `image_error`) and the scheduling routine skips
 * it; an admin can re-queue it from the Assets tab.
 */
export async function renderPendingImages(options: {
  dryRun: boolean;
  maxImages: number;
}): Promise<RenderImagesReport> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(ASSETS)
    .select('*')
    .eq('image_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(options.maxImages);
  if (error) failed('renderPendingImages read', error);
  const pending = (data ?? []) as SocialAsset[];

  const report: RenderImagesReport = {
    dryRun: options.dryRun,
    scanned: pending.length,
    rendered: 0,
    failed: 0,
    skipped: 0,
    details: [],
  };

  for (const asset of pending) {
    if (!asset.image_brief) {
      report.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      report.details.push({ assetId: asset.id, channel: asset.channel, outcome: 'would-render' });
      continue;
    }

    await supabase.from(ASSETS).update({ image_status: 'rendering' }).eq('id', asset.id);
    try {
      const rendered = await renderAssetImage({
        channel: asset.channel,
        brief: asset.image_brief,
        style: asset.image_style,
        topic: asset.title,
        storagePath: `${asset.week_key}/${asset.id}.png`,
      });
      const { error: writeError } = await supabase
        .from(ASSETS)
        .update({
          image_status: 'ready',
          image_url: rendered.publicUrl,
          image_storage_path: rendered.storagePath,
          image_error: null,
        })
        .eq('id', asset.id);
      if (writeError) throw new Error(writeError.message);
      report.rendered += 1;
      report.details.push({ assetId: asset.id, channel: asset.channel, outcome: 'rendered' });
    } catch (renderError) {
      const message = renderError instanceof Error ? renderError.message : String(renderError);
      log.error('Asset image render failed', { assetId: asset.id, error: message });
      await supabase
        .from(ASSETS)
        .update({ image_status: 'failed', image_error: message.slice(0, 2000) })
        .eq('id', asset.id);
      report.failed += 1;
      report.details.push({
        assetId: asset.id,
        channel: asset.channel,
        outcome: 'failed',
        error: message,
      });
    }
  }

  log.info('Render pending images finished', {
    dryRun: options.dryRun,
    scanned: report.scanned,
    rendered: report.rendered,
    failed: report.failed,
  });
  return report;
}

/**
 * Mirror Buffer's status onto every asset the routine scheduled. `sent`
 * becomes `published`; `error` becomes `failed` with Buffer's message; anything
 * else stays `scheduled` (with `buffer_status` refreshed). One Buffer read per
 * asset — at two posts per channel per week that is a handful of calls.
 */
export async function syncBufferStatuses(options: {
  dryRun: boolean;
  maxPosts: number;
}): Promise<SyncBufferReport> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(ASSETS)
    .select('*')
    .eq('state', 'scheduled')
    .not('buffer_post_id', 'is', null)
    .order('scheduled_for', { ascending: true })
    .limit(options.maxPosts);
  if (error) failed('syncBufferStatuses read', error);
  const scheduled = (data ?? []) as SocialAsset[];

  const report: SyncBufferReport = {
    dryRun: options.dryRun,
    checked: scheduled.length,
    published: 0,
    failed: 0,
    unchanged: 0,
    removed: 0,
    errors: [],
  };

  for (const asset of scheduled) {
    try {
      const post = await getBufferPost(asset.buffer_post_id as string);
      let patch: Partial<SocialAsset> | null = null;
      if (post.status === 'sent') {
        patch = {
          state: 'published',
          buffer_status: 'sent',
          buffer_error: null,
          published_at: post.sentAt ?? new Date().toISOString(),
        };
        report.published += 1;
      } else if (post.status === 'error') {
        patch = {
          state: 'failed',
          buffer_status: 'error',
          buffer_error: (post.error?.message ?? 'Buffer reported an error').slice(0, 2000),
        };
        report.failed += 1;
      } else if (post.status !== asset.buffer_status) {
        patch = { buffer_status: post.status };
        report.unchanged += 1;
      } else {
        report.unchanged += 1;
      }

      if (patch && !options.dryRun) {
        const { error: writeError } = await supabase.from(ASSETS).update(patch).eq('id', asset.id);
        if (writeError) throw new Error(writeError.message);
      }
    } catch (syncError) {
      if (isBufferPostGone(syncError)) {
        // The operator deleted it directly in Buffer — the documented way to stop a
        // post. Reconcile instead of retrying every hour: the asset leaves `scheduled`
        // (shown as "Removed"; restorable from its card) so the Assets tab is truthful
        // and the next scheduling run does not count a post that no longer exists.
        if (!options.dryRun) {
          const { error: writeError } = await supabase
            .from(ASSETS)
            .update({
              state: 'rejected',
              buffer_status: 'deleted',
              buffer_error: 'Deleted in Buffer',
            })
            .eq('id', asset.id);
          if (writeError) {
            report.errors.push({ assetId: asset.id, error: writeError.message });
            continue;
          }
        }
        log.info('Asset reconciled: post deleted in Buffer', { assetId: asset.id });
        report.removed += 1;
        continue;
      }
      const message = syncError instanceof Error ? syncError.message : String(syncError);
      log.warn('Buffer status sync failed for asset', { assetId: asset.id, error: message });
      report.errors.push({ assetId: asset.id, error: message });
    }
  }

  return report;
}

/** Buffer no longer has the post: our own 404, or Buffer's GraphQL "not found" error. */
function isBufferPostGone(error: unknown): boolean {
  if (!(error instanceof APIError)) return false;
  if (error.code === 'BUFFER_POST_NOT_FOUND') return true;
  return error.code === 'BUFFER_GRAPHQL_ERROR' && /not found/i.test(error.message);
}
