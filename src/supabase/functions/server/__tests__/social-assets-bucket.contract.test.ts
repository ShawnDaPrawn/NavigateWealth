/**
 * social-assets-storage.ts — the bucket's shape.
 *
 * A bucket's file size limit and MIME list are fixed when it is created, and an
 * earlier version of this module created this one image-only at 10MB. Anywhere
 * that version ran first, every video would be refused by Storage after passing
 * our own validation, and shipping a wider `createBucket` call would never fix
 * it because creation is skipped for a bucket that already exists. So the
 * reconcile-on-existing path is the thing worth pinning.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const api = vi.hoisted(() => ({
  listBuckets: vi.fn(async () => ({ data: [] as Array<{ name: string }>, error: null })),
  createBucket: vi.fn(async () => ({ data: null, error: null })),
  updateBucket: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock('jsr:@supabase/supabase-js@2.49.8', () => ({
  createClient: () => ({ storage: api }),
}));
vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  ensureSocialAssetsBucket,
  resetBucketCache,
  SOCIAL_ASSETS_BUCKET,
  SOCIAL_ASSETS_BUCKET_LIMIT,
  SOCIAL_ASSETS_IMAGE_TYPES,
  SOCIAL_ASSETS_VIDEO_TYPES,
} from '../social-assets-storage.ts';

const EXPECTED = {
  public: true,
  fileSizeLimit: SOCIAL_ASSETS_BUCKET_LIMIT,
  allowedMimeTypes: [...SOCIAL_ASSETS_IMAGE_TYPES, ...SOCIAL_ASSETS_VIDEO_TYPES],
};

beforeEach(() => {
  vi.clearAllMocks();
  resetBucketCache();
  api.listBuckets.mockResolvedValue({ data: [], error: null });
  api.createBucket.mockResolvedValue({ data: null, error: null });
  api.updateBucket.mockResolvedValue({ data: null, error: null });
});

describe('ensureSocialAssetsBucket', () => {
  it('creates the bucket public, with video allowed, when it is not there', async () => {
    await ensureSocialAssetsBucket();
    expect(api.createBucket).toHaveBeenCalledWith(SOCIAL_ASSETS_BUCKET, EXPECTED);
    expect(api.updateBucket).not.toHaveBeenCalled();
  });

  it('widens a bucket an older version created narrow', async () => {
    api.listBuckets.mockResolvedValue({ data: [{ name: SOCIAL_ASSETS_BUCKET }], error: null });
    await ensureSocialAssetsBucket();
    expect(api.createBucket).not.toHaveBeenCalled();
    expect(api.updateBucket).toHaveBeenCalledWith(SOCIAL_ASSETS_BUCKET, EXPECTED);
  });

  it('carries on when the bucket cannot be widened', async () => {
    // Uploads inside the old limits still work; a 500 on someone's upload
    // would be a worse answer than a line in the log.
    api.listBuckets.mockResolvedValue({ data: [{ name: SOCIAL_ASSETS_BUCKET }], error: null });
    api.updateBucket.mockResolvedValue({ data: null, error: { message: 'not the owner' } });
    await expect(ensureSocialAssetsBucket()).resolves.toBeUndefined();
  });

  it('still throws when the bucket cannot be created at all', async () => {
    api.createBucket.mockResolvedValue({ data: null, error: { message: 'quota exceeded' } });
    await expect(ensureSocialAssetsBucket()).rejects.toThrow(/quota exceeded/);
  });

  it('tolerates a bucket created by another isolate in the same moment', async () => {
    api.createBucket.mockResolvedValue({ data: null, error: { message: 'Bucket already exists' } });
    await expect(ensureSocialAssetsBucket()).resolves.toBeUndefined();
  });

  it('asks the API once per isolate, however many uploads arrive', async () => {
    await ensureSocialAssetsBucket();
    await ensureSocialAssetsBucket();
    await ensureSocialAssetsBucket();
    expect(api.listBuckets).toHaveBeenCalledTimes(1);
  });
});
