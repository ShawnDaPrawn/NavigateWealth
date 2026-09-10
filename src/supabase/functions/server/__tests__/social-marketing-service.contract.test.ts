/**
 * social-marketing-service.ts — Contract Tests (Buffer-backed)
 * ============================================================
 *
 * Pins the per-network payload the manual Compose path sends Buffer — the
 * rules that differ by network are the whole point of the module:
 *   - Instagram needs an image and gets `type: post`;
 *   - LinkedIn shows a link card INSTEAD of an image when a link is given;
 *   - X has no link card, so the link goes into the text;
 * and that one channel failing does not stop the others.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  (globalThis as unknown as { Deno?: unknown }).Deno = { env: { get: () => 'test' } };
});

const buffer = vi.hoisted(() => ({
  listBufferChannels: vi.fn(),
  listBufferPosts: vi.fn(),
  createBufferPost: vi.fn(),
  deleteBufferPost: vi.fn(),
  getBufferAccount: vi.fn(),
  getBufferAggregatedMetrics: vi.fn(),
  isBufferConfigured: vi.fn(() => true),
  bufferServiceToChannel: (s: string) =>
    s === 'twitter' ? 'x' : s === 'linkedin' || s === 'instagram' ? s : null,
  bufferStatusToAppStatus: (s: string) =>
    s === 'sent' ? 'published' : s === 'error' ? 'failed' : 'scheduled',
}));
vi.mock('../buffer-service.ts', () => buffer);

const storage = vi.hoisted(() => ({
  publishPrivateImage: vi.fn(async () => 'https://cdn/public.png'),
}));
vi.mock('../social-assets-storage.ts', () => storage);

vi.mock('../stderr-logger.ts', async () =>
  (await import('./helpers/contract-harness.ts')).makeLoggerMock(),
);

import {
  buildCreateInput,
  composePost,
  getAnalytics,
  getStatus,
  listChannels,
  listPosts,
} from '../social-marketing-service.ts';

const linkedin = {
  id: 'li',
  service: 'linkedin',
  type: 'page',
  isDisconnected: false,
  isLocked: false,
} as never;
const instagram = {
  id: 'ig',
  service: 'instagram',
  type: 'business',
  isDisconnected: false,
  isLocked: false,
} as never;
const twitter = {
  id: 'tw',
  service: 'twitter',
  type: 'profile',
  isDisconnected: true,
  isLocked: false,
} as never;

const base = { channelIds: ['li'], text: 'Hello', mode: 'queue' as const };
const image = { image: { url: 'https://cdn/a.png', metadata: { altText: 'alt' } } };

beforeEach(() => {
  vi.clearAllMocks();
  buffer.isBufferConfigured.mockReturnValue(true);
});

describe('buildCreateInput', () => {
  it('Instagram requires an image and posts to the feed', () => {
    expect(() => buildCreateInput(instagram, base, [])).toThrow(/image/);
    const out = buildCreateInput(instagram, base, [image]);
    expect(out).toMatchObject({
      channelId: 'ig',
      mode: 'addToQueue',
      schedulingType: 'automatic',
      assets: [image],
      metadata: { instagram: { type: 'post', shouldShareToFeed: true } },
    });
  });

  it('LinkedIn shows a link card instead of an image when a link is given', () => {
    const out = buildCreateInput(linkedin, { ...base, link: { url: 'https://nw/a', title: 'A' } }, [
      image,
    ]);
    expect(out.assets).toBeUndefined();
    expect(out.metadata).toEqual({
      linkedin: { linkAttachment: { url: 'https://nw/a', title: 'A' } },
    });
    const withImage = buildCreateInput(linkedin, base, [image]);
    expect(withImage.assets).toEqual([image]);
    expect(withImage.metadata).toBeUndefined();
  });

  it('X appends the link to the text once', () => {
    const out = buildCreateInput(twitter, { ...base, link: { url: 'https://nw/a' } }, []);
    expect(out.text).toBe('Hello\nhttps://nw/a');
    const already = buildCreateInput(
      twitter,
      { ...base, text: 'See https://nw/a', link: { url: 'https://nw/a' } },
      [],
    );
    expect(already.text).toBe('See https://nw/a');
  });

  it('maps modes: now, scheduled (with dueAt), draft', () => {
    expect(buildCreateInput(linkedin, { ...base, mode: 'now' }, []).mode).toBe('shareNow');
    const scheduled = buildCreateInput(
      linkedin,
      { ...base, mode: 'scheduled', scheduledAt: '2026-09-15T07:30:00+02:00' },
      [],
    );
    expect(scheduled).toMatchObject({
      mode: 'customScheduled',
      dueAt: '2026-09-15T07:30:00+02:00',
    });
    expect(buildCreateInput(linkedin, { ...base, mode: 'draft' }, [])).toMatchObject({
      mode: 'addToQueue',
      saveToDraft: true,
    });
  });
});

describe('composePost', () => {
  it('copies private AI images to the public bucket, creates per channel, and isolates failures', async () => {
    buffer.listBufferChannels.mockResolvedValue([linkedin, instagram, twitter]);
    buffer.createBufferPost
      .mockResolvedValueOnce({ id: 'p-li', status: 'scheduled', dueAt: null, channelId: 'li' })
      .mockRejectedValueOnce(new Error('Instagram token expired'));

    const result = await composePost(
      {
        channelIds: ['li', 'ig', 'missing'],
        text: 'Hello',
        mode: 'queue',
        images: [{ storagePath: 'user/x.png', altText: 'alt' }],
      },
      'admin',
    );

    expect(storage.publishPrivateImage).toHaveBeenCalledWith(
      'make-91ed8379-social-ai-images',
      'user/x.png',
      expect.stringMatching(/^manual\/.+\.png$/),
    );
    expect(result.created).toEqual([
      { channelId: 'li', platform: 'linkedin', postId: 'p-li', status: 'scheduled', dueAt: null },
    ]);
    expect(result.failed).toEqual([
      { channelId: 'ig', platform: 'instagram', error: 'Instagram token expired' },
      { channelId: 'missing', platform: null, error: 'Channel is not connected to Buffer' },
    ]);
    const igCall = buffer.createBufferPost.mock.calls[1][0];
    expect(igCall.assets[0].image.url).toBe('https://cdn/public.png');
  });
});

describe('reads', () => {
  it('lists channels with the app platform and a connected flag', async () => {
    buffer.listBufferChannels.mockResolvedValue([linkedin, twitter]);
    const channels = await listChannels();
    expect(channels.map((c) => [c.platform, c.isConnected])).toEqual([
      ['linkedin', true],
      ['x', false],
    ]);
  });

  it('lists posts in a default window with app status and platform', async () => {
    buffer.listBufferPosts.mockResolvedValue([
      { id: 'p1', channelService: 'twitter', status: 'sent' },
    ]);
    const posts = await listPosts();
    expect(posts[0]).toMatchObject({ platform: 'x', appStatus: 'published' });
    const args = buffer.listBufferPosts.mock.calls[0][0];
    expect(new Date(args.from).getTime()).toBeLessThan(Date.now());
    expect(new Date(args.to).getTime()).toBeGreaterThan(Date.now());
  });

  it('sums metrics by type', async () => {
    buffer.getBufferAggregatedMetrics.mockResolvedValue({
      metricsUpdatedAt: 'u',
      metrics: [
        { name: 'A', type: 'impressions', value: 10, unit: 'count', description: '' },
        { name: 'B', type: 'impressions', value: 5, unit: 'count', description: '' },
        { name: 'C', type: 'reactions', value: 2, unit: 'count', description: '' },
      ],
    });
    const out = await getAnalytics(30);
    expect(out.totals).toEqual({ impressions: 15, reactions: 2 });
    expect(out.metricsUpdatedAt).toBe('u');
  });

  it('status reports unconfigured without calling Buffer, and a reachability error when configured', async () => {
    buffer.isBufferConfigured.mockReturnValue(false);
    expect(await getStatus()).toEqual({ configured: false });
    expect(buffer.getBufferAccount).not.toHaveBeenCalled();

    buffer.isBufferConfigured.mockReturnValue(true);
    buffer.getBufferAccount.mockRejectedValue(new Error('401'));
    expect(await getStatus()).toEqual({ configured: true, error: '401' });
  });
});
