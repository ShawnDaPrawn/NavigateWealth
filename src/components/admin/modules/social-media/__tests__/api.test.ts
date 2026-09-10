/**
 * Social media API slices — contract with the Edge Function.
 *
 * The slices sit on the shared `api` client (Guidelines §20.3), so what is
 * pinned here is the endpoint each call hits, the query it builds, and the
 * shape it returns after mapping Buffer's vocabulary into the app's.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../../../../utils/api', () => ({ api: client }));

import { analyticsApi, postsApi, profilesApi, socialAssetsApi } from '../api';

const channel = {
  id: '6aa09ad0cd8b9c702c32ab6a',
  name: 'navigatewealth',
  displayName: 'Navigate Wealth',
  service: 'linkedin',
  type: 'page',
  avatar: 'https://a/b.png',
  isDisconnected: false,
  isLocked: false,
  timezone: 'Africa/Johannesburg',
  externalLink: 'https://www.linkedin.com/company/1',
  postingSchedule: [{ day: 'mon', times: ['07:30'], paused: false }],
  platform: 'linkedin' as const,
  isConnected: true,
};

const post = {
  id: '6aa09ad0cd8b9c702c32ab6b',
  channelId: channel.id,
  channelService: 'twitter',
  text: 'Hello',
  status: 'sent',
  dueAt: '2026-09-15T05:30:00.000Z',
  sentAt: '2026-09-15T05:31:00.000Z',
  externalLink: 'https://x.com/p/1',
  via: 'api',
  schedulingType: 'automatic',
  createdAt: '2026-09-13T10:00:00.000Z',
  updatedAt: '2026-09-15T05:31:00.000Z',
  error: null,
  assets: [{ type: 'image', source: 'https://cdn/a.png', thumbnail: 'https://cdn/a-thumb.png' }],
  tags: [{ id: 't', name: 'nw-auto' }],
  platform: 'x' as const,
  appStatus: 'published' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profilesApi (Buffer channels)', () => {
  it('maps channels to profiles', async () => {
    client.get.mockResolvedValue({ success: true, data: [channel] });
    const profiles = await profilesApi.getAll();
    expect(client.get).toHaveBeenCalledWith('/social-marketing/channels');
    expect(profiles[0]).toMatchObject({
      id: channel.id,
      platform: 'linkedin',
      name: 'Navigate Wealth',
      username: 'navigatewealth',
      isConnected: true,
      accountType: 'organization',
      service: 'linkedin',
      externalLink: channel.externalLink,
    });
  });

  it('reads Buffer status', async () => {
    client.get.mockResolvedValue({ success: true, data: { configured: false } });
    expect(await profilesApi.getStatus()).toEqual({ configured: false });
    expect(client.get).toHaveBeenCalledWith('/social-marketing/status');
  });
});

describe('postsApi (Buffer posts)', () => {
  it('builds the window query and maps posts', async () => {
    client.get.mockResolvedValue({ success: true, data: [post] });
    const posts = await postsApi.getByDateRange(
      new Date('2026-09-14T00:00:00.000Z'),
      new Date('2026-09-21T00:00:00.000Z'),
    );
    expect(client.get).toHaveBeenCalledWith(
      '/social-marketing/posts?from=2026-09-14T00%3A00%3A00.000Z&to=2026-09-21T00%3A00%3A00.000Z',
    );
    expect(posts[0]).toMatchObject({
      id: post.id,
      profiles: [channel.id],
      channelId: channel.id,
      platform: 'x',
      body: 'Hello',
      status: 'published',
      bufferStatus: 'sent',
      externalLink: 'https://x.com/p/1',
      tags: ['nw-auto'],
    });
    expect(posts[0].scheduledAt?.toISOString()).toBe('2026-09-15T05:30:00.000Z');
    expect(posts[0].publishedAt?.toISOString()).toBe('2026-09-15T05:31:00.000Z');
    expect(posts[0].media).toEqual([
      {
        id: 'https://cdn/a.png#0',
        url: 'https://cdn/a.png',
        type: 'image',
        filename: 'a.png',
        size: 0,
      },
    ]);
  });

  it('applies a client-side status filter and hits the bare endpoint without a window', async () => {
    client.get.mockResolvedValue({
      success: true,
      data: [post, { ...post, id: 'x2', status: 'scheduled', appStatus: 'scheduled' }],
    });
    const scheduled = await postsApi.getAll({ status: 'scheduled' });
    expect(client.get).toHaveBeenCalledWith('/social-marketing/posts');
    expect(scheduled.map((p) => p.id)).toEqual(['x2']);
  });

  it('creates and deletes through the Edge Function', async () => {
    client.post.mockResolvedValue({
      success: true,
      data: { created: [{ channelId: channel.id }], failed: [] },
    });
    const result = await postsApi.create({ channelIds: [channel.id], text: 'hi', mode: 'queue' });
    expect(client.post).toHaveBeenCalledWith('/social-marketing/posts', {
      channelIds: [channel.id],
      text: 'hi',
      mode: 'queue',
    });
    expect(result.created).toHaveLength(1);

    client.delete.mockResolvedValue({ success: true });
    await postsApi.delete(post.id);
    expect(client.delete).toHaveBeenCalledWith(`/social-marketing/posts/${post.id}`);
  });
});

describe('analyticsApi', () => {
  it('reads the aggregated summary for a window', async () => {
    client.get.mockResolvedValue({ success: true, data: { totals: { impressions: 5 } } });
    const summary = await analyticsApi.getSummary(7);
    expect(client.get).toHaveBeenCalledWith('/social-marketing/analytics?days=7');
    expect(summary.totals.impressions).toBe(5);
  });
});

describe('socialAssetsApi', () => {
  it('lists batches, reads one, and filters assets', async () => {
    client.get.mockResolvedValueOnce({ success: true, batches: [{ week_key: '2026-W38' }] });
    expect(await socialAssetsApi.listBatches(3)).toEqual([{ week_key: '2026-W38' }]);
    expect(client.get).toHaveBeenLastCalledWith('/social-assets/batches?limit=3');

    client.get.mockResolvedValueOnce({ success: true, batch: { id: 'b' }, assets: [{ id: 'a' }] });
    expect(await socialAssetsApi.getBatch('2026-W38')).toEqual({
      batch: { id: 'b' },
      assets: [{ id: 'a' }],
    });
    expect(client.get).toHaveBeenLastCalledWith('/social-assets/batches/2026-W38');

    client.get.mockResolvedValueOnce({ success: true, assets: [] });
    await socialAssetsApi.listAssets({
      week: '2026-W38',
      channel: 'x',
      state: 'generated',
      limit: 5,
    });
    expect(client.get).toHaveBeenLastCalledWith(
      '/social-assets/assets?week=2026-W38&channel=x&state=generated&limit=5',
    );
  });

  it('updates an asset, settings and a playbook; runs a live job', async () => {
    client.patch.mockResolvedValue({ success: true, asset: { id: 'a', state: 'rejected' } });
    expect(await socialAssetsApi.updateAsset('a', { state: 'rejected' })).toMatchObject({
      state: 'rejected',
    });
    expect(client.patch).toHaveBeenCalledWith('/social-assets/assets/a', { state: 'rejected' });

    client.put.mockResolvedValueOnce({ success: true, settings: { enabled: false } });
    expect(await socialAssetsApi.updateSettings({ enabled: false })).toEqual({ enabled: false });
    expect(client.put).toHaveBeenLastCalledWith('/social-assets/settings', { enabled: false });

    client.put.mockResolvedValueOnce({ success: true, playbook: { id: 'generate', version: 2 } });
    await socialAssetsApi.updatePlaybook('generate', { instructions: 'x' });
    expect(client.put).toHaveBeenLastCalledWith('/social-assets/playbooks/generate', {
      instructions: 'x',
    });

    client.post.mockResolvedValue({ success: true, report: { rendered: 1 } });
    expect(await socialAssetsApi.runJob('render-images')).toEqual({ rendered: 1 });
    expect(client.post).toHaveBeenCalledWith('/social-assets/jobs/render-images', {
      dryRun: false,
    });
  });
});
