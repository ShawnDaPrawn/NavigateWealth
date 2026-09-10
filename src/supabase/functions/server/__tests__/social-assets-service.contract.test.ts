/**
 * social-assets-service.ts — Contract Tests
 * =========================================
 *
 * The service is a second writer on tables the routines also write, so what
 * matters is that it changes ONLY the columns it owns:
 *   - the image job moves image_status pending → rendering → ready|failed and
 *     never touches copy or state;
 *   - the Buffer sync moves state scheduled → published|failed from Buffer's
 *     answer and leaves everything else alone;
 *   - the admin override refuses to reject a scheduled/published asset (that
 *     is a Buffer delete, done in Buffer).
 *
 * Supabase is replaced by a small in-memory query builder that understands the
 * calls this service makes; the renderer and Buffer are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: new Map<string, Row[]>() }));

/** Enough of supabase-js's PostgREST builder for this service. */
function makeBuilder(table: string) {
  const rows = () => db.tables.get(table) ?? [];
  const filters: Array<(r: Row) => boolean> = [];
  const orderBy: Array<{ col: string; asc: boolean }> = [];
  let limitN: number | null = null;
  let op: 'select' | 'update' = 'select';
  let patch: Row = {};
  let single: 'single' | 'maybe' | null = null;

  const apply = () => {
    let out = rows().filter((r) => filters.every((f) => f(r)));
    for (const o of [...orderBy].reverse()) {
      out = [...out].sort((a, b) => {
        const x = String(a[o.col] ?? ''),
          y = String(b[o.col] ?? '');
        return (x < y ? -1 : x > y ? 1 : 0) * (o.asc ? 1 : -1);
      });
    }
    if (limitN !== null) out = out.slice(0, limitN);
    return out;
  };

  const builder = {
    select() {
      return builder;
    },
    update(p: Row) {
      op = 'update';
      patch = p;
      return builder;
    },
    eq(col: string, v: unknown) {
      filters.push((r) => r[col] === v);
      return builder;
    },
    in(col: string, vs: unknown[]) {
      filters.push((r) => vs.includes(r[col]));
      return builder;
    },
    not(col: string, _o: string, _v: unknown) {
      filters.push((r) => r[col] !== null && r[col] !== undefined);
      return builder;
    },
    order(col: string, o?: { ascending?: boolean }) {
      orderBy.push({ col, asc: o?.ascending !== false });
      return builder;
    },
    limit(n: number) {
      limitN = n;
      return builder;
    },
    single() {
      single = 'single';
      return builder;
    },
    maybeSingle() {
      single = 'maybe';
      return builder;
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      let data: unknown;
      if (op === 'update') {
        const targets = rows().filter((r) => filters.every((f) => f(r)));
        for (const t of targets) Object.assign(t, patch);
        data = single ? (targets[0] ?? null) : targets;
      } else {
        const out = apply();
        data = single ? (out[0] ?? null) : out;
      }
      resolve({ data: data == null ? data : JSON.parse(JSON.stringify(data)), error: null });
    },
  };
  return builder;
}

vi.mock('../social-assets-storage.ts', () => ({
  getSocialSupabase: () => ({ from: (t: string) => makeBuilder(t) }),
}));

const renderer = vi.hoisted(() => ({ renderAssetImage: vi.fn() }));
vi.mock('../social-assets-images.ts', () => renderer);

const buffer = vi.hoisted(() => ({ getBufferPost: vi.fn() }));
vi.mock('../buffer-service.ts', () => buffer);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  getBatch,
  listBatches,
  renderPendingImages,
  syncBufferStatuses,
  updateAsset,
  updatePlaybook,
} from '../social-assets-service.ts';

function asset(overrides: Row): Row {
  return {
    id: 'a-' + Math.random().toString(36).slice(2, 8),
    batch_id: 'b1',
    week_key: '2026-W38',
    channel: 'instagram',
    title: 'T',
    body: 'B',
    image_brief: 'calm scene',
    image_style: 'editorial',
    image_status: 'pending',
    image_url: null,
    state: 'generated',
    buffer_post_id: null,
    buffer_status: null,
    created_at: '2026-09-12T04:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.tables.clear();
  db.tables.set('social_asset_batches', [
    { id: 'b1', week_key: '2026-W38', status: 'generated' },
    { id: 'b0', week_key: '2026-W37', status: 'scheduled' },
  ]);
  db.tables.set('social_assets', []);
  db.tables.set('social_automation_playbooks', [
    { id: 'generate', version: 3, instructions: 'old' },
  ]);
});

describe('batches', () => {
  it('lists newest week first with per-channel and lifecycle counts', async () => {
    db.tables.set('social_assets', [
      asset({
        batch_id: 'b1',
        channel: 'linkedin',
        state: 'scheduled',
        image_brief: null,
        image_status: 'none',
      }),
      asset({
        batch_id: 'b1',
        channel: 'linkedin',
        state: 'generated',
        image_brief: null,
        image_status: 'none',
      }),
      asset({
        batch_id: 'b1',
        channel: 'x',
        state: 'published',
        image_brief: null,
        image_status: 'none',
      }),
    ]);
    const batches = await listBatches(5);
    expect(batches.map((b) => b.week_key)).toEqual(['2026-W38', '2026-W37']);
    expect(batches[0].asset_counts).toEqual({ linkedin: 2, x: 1 });
    expect(batches[0].scheduled_count).toBe(1);
    expect(batches[0].published_count).toBe(1);
    expect(batches[1].asset_counts).toEqual({});
  });

  it('getBatch 404s for an unknown week', async () => {
    await expect(getBatch('2030-W01')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('renderPendingImages', () => {
  it('dry run reports what it would render and writes nothing', async () => {
    db.tables.set('social_assets', [asset({ id: 'a1' })]);
    const report = await renderPendingImages({ dryRun: true, maxImages: 10 });
    expect(report).toMatchObject({ dryRun: true, scanned: 1, rendered: 0, failed: 0 });
    expect(report.details[0]).toMatchObject({ assetId: 'a1', outcome: 'would-render' });
    expect(renderer.renderAssetImage).not.toHaveBeenCalled();
    expect(db.tables.get('social_assets')![0].image_status).toBe('pending');
  });

  it('live run stores the public URL on success and the error on failure, touching nothing else', async () => {
    db.tables.set('social_assets', [
      asset({ id: 'ok', created_at: '2026-09-12T04:00:00Z' }),
      asset({ id: 'boom', created_at: '2026-09-12T04:01:00Z' }),
    ]);
    renderer.renderAssetImage
      .mockResolvedValueOnce({
        publicUrl: 'https://cdn/ok.png',
        storagePath: '2026-W38/ok.png',
        revisedPrompt: 'p',
        dimensions: '1024x1024',
      })
      .mockRejectedValueOnce(new Error('content policy'));

    const report = await renderPendingImages({ dryRun: false, maxImages: 10 });
    expect(report).toMatchObject({ rendered: 1, failed: 1, scanned: 2 });
    expect(renderer.renderAssetImage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'instagram',
        brief: 'calm scene',
        storagePath: '2026-W38/ok.png',
      }),
    );

    const rows = db.tables.get('social_assets')!;
    const ok = rows.find((r) => r.id === 'ok')!;
    expect(ok).toMatchObject({
      image_status: 'ready',
      image_url: 'https://cdn/ok.png',
      image_storage_path: '2026-W38/ok.png',
      state: 'generated',
      body: 'B',
    });
    const boom = rows.find((r) => r.id === 'boom')!;
    expect(boom).toMatchObject({
      image_status: 'failed',
      image_error: 'content policy',
      state: 'generated',
    });
  });

  it('skips a pending row with no brief instead of calling the renderer', async () => {
    db.tables.set('social_assets', [asset({ id: 'nobrief', image_brief: null })]);
    const report = await renderPendingImages({ dryRun: false, maxImages: 10 });
    expect(report.skipped).toBe(1);
    expect(renderer.renderAssetImage).not.toHaveBeenCalled();
  });
});

describe('syncBufferStatuses', () => {
  it('mirrors sent → published and error → failed, refreshes an in-flight status, and isolates read errors', async () => {
    db.tables.set('social_assets', [
      asset({
        id: 's1',
        state: 'scheduled',
        buffer_post_id: 'bp1',
        buffer_status: 'scheduled',
        scheduled_for: '2026-09-15T05:30:00Z',
      }),
      asset({
        id: 's2',
        state: 'scheduled',
        buffer_post_id: 'bp2',
        buffer_status: 'scheduled',
        scheduled_for: '2026-09-16T05:30:00Z',
      }),
      asset({
        id: 's3',
        state: 'scheduled',
        buffer_post_id: 'bp3',
        buffer_status: 'scheduled',
        scheduled_for: '2026-09-17T05:30:00Z',
      }),
      asset({
        id: 's4',
        state: 'scheduled',
        buffer_post_id: 'bp4',
        buffer_status: 'scheduled',
        scheduled_for: '2026-09-18T05:30:00Z',
      }),
      asset({ id: 'g1', state: 'generated', buffer_post_id: null }),
    ]);
    buffer.getBufferPost.mockImplementation(async (id: string) => {
      if (id === 'bp1') return { status: 'sent', sentAt: '2026-09-15T05:31:00Z', error: null };
      if (id === 'bp2') return { status: 'error', error: { message: 'Token expired' } };
      if (id === 'bp3') return { status: 'sending', error: null };
      throw new Error('Buffer post not found');
    });

    const report = await syncBufferStatuses({ dryRun: false, maxPosts: 50 });
    expect(report).toMatchObject({ checked: 4, published: 1, failed: 1, unchanged: 1 });
    expect(report.errors).toEqual([{ assetId: 's4', error: 'Buffer post not found' }]);

    const rows = db.tables.get('social_assets')!;
    expect(rows.find((r) => r.id === 's1')).toMatchObject({
      state: 'published',
      buffer_status: 'sent',
      published_at: '2026-09-15T05:31:00Z',
    });
    expect(rows.find((r) => r.id === 's2')).toMatchObject({
      state: 'failed',
      buffer_status: 'error',
      buffer_error: 'Token expired',
    });
    expect(rows.find((r) => r.id === 's3')).toMatchObject({
      state: 'scheduled',
      buffer_status: 'sending',
    });
    expect(rows.find((r) => r.id === 'g1')).toMatchObject({ state: 'generated' });
  });

  it('dry run reads Buffer but writes nothing', async () => {
    db.tables.set('social_assets', [
      asset({ id: 's1', state: 'scheduled', buffer_post_id: 'bp1', buffer_status: 'scheduled' }),
    ]);
    buffer.getBufferPost.mockResolvedValue({ status: 'sent', sentAt: 'x', error: null });
    const report = await syncBufferStatuses({ dryRun: true, maxPosts: 50 });
    expect(report.published).toBe(1);
    expect(db.tables.get('social_assets')![0].state).toBe('scheduled');
  });
});

describe('updateAsset', () => {
  it('rejects and restores a candidate, stamping the actor', async () => {
    db.tables.set('social_assets', [asset({ id: 'a1', state: 'generated' })]);
    const rejected = await updateAsset('a1', { state: 'rejected' }, 'admin@x');
    expect(rejected).toMatchObject({ state: 'rejected', updated_by: 'admin@x' });
    const restored = await updateAsset('a1', { state: 'generated' }, 'admin@x');
    expect(restored.state).toBe('generated');
  });

  it('refuses to reject a scheduled asset — that is a Buffer delete', async () => {
    db.tables.set('social_assets', [asset({ id: 'a1', state: 'scheduled', buffer_post_id: 'bp' })]);
    await expect(updateAsset('a1', { state: 'rejected' }, 'admin')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('re-queues a failed image only when there is a brief to render', async () => {
    db.tables.set('social_assets', [
      asset({ id: 'a1', image_status: 'failed', image_error: 'x' }),
      asset({ id: 'a2', image_brief: null, image_status: 'none' }),
    ]);
    const requeued = await updateAsset('a1', { retryImage: true }, 'admin');
    expect(requeued).toMatchObject({ image_status: 'pending', image_error: null });
    await expect(updateAsset('a2', { retryImage: true }, 'admin')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('404s for an unknown asset', async () => {
    await expect(updateAsset('nope', { state: 'rejected' }, 'admin')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('updatePlaybook', () => {
  it('bumps the version on every edit', async () => {
    const out = await updatePlaybook('generate', { instructions: 'new' }, 'admin');
    expect(out).toMatchObject({ version: 4, instructions: 'new', updated_by: 'admin' });
  });

  it('404s for an unknown playbook', async () => {
    await expect(updatePlaybook('other', { title: 't' }, 'admin')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
