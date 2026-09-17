/**
 * Channel assets — the Assets tab's media.
 *
 * One surface, shared with the outside agent that fills it: the admin session
 * and ChatGPT's integration token reach the same `/social-library` routes, so
 * what the tab shows is exactly what an agent sees.
 */
import { api } from '../../../../../utils/api';
import type {
  ChannelAsset,
  ChannelAssetChannel,
  ChannelAssetFilters,
  ChannelAssetPatch,
  ChannelAssetSummary,
} from '../types';

const BASE = '/social-library';

export const channelAssetsApi = {
  async listChannels(): Promise<ChannelAssetSummary[]> {
    const res = await api.get<{ success: boolean; data: ChannelAssetSummary[] }>(
      `${BASE}/channels`,
    );
    return res.data ?? [];
  },

  async list(filters: ChannelAssetFilters = {}): Promise<ChannelAsset[]> {
    const params = new URLSearchParams();
    if (filters.channel) params.set('channel', filters.channel);
    if (filters.status) params.set('status', filters.status);
    if (filters.mediaType) params.set('mediaType', filters.mediaType);
    params.set('limit', String(filters.limit ?? 60));
    params.set('offset', String(filters.offset ?? 0));
    const res = await api.get<{ success: boolean; data: ChannelAsset[] }>(
      `${BASE}/assets?${params.toString()}`,
    );
    return res.data ?? [];
  },

  /**
   * Upload one file against a channel.
   *
   * Transient retries are OFF: the client retries a POST on a network error or
   * a 5xx, and every attempt mints a fresh storage path, so a lost response
   * would register the same media twice.
   */
  async upload(channel: ChannelAssetChannel, file: File): Promise<ChannelAsset> {
    const form = new FormData();
    form.append('file', file);
    form.append('channel', channel);
    form.append('fileName', file.name);
    const res = await api.post<{ success: boolean; data: ChannelAsset }>(`${BASE}/assets`, form, {
      retryTransientFailures: false,
    });
    return res.data;
  },

  /**
   * Record that an asset has gone out, and which Buffer post took it.
   *
   * This is what stops the same picture being published twice: an asset stays
   * in the `available` queue a publishing routine draws from until something
   * says otherwise, and composing by hand is one of the ways it goes out.
   */
  async markUsed(id: string, bufferPostId?: string): Promise<ChannelAsset> {
    const res = await api.post<{ success: boolean; data: ChannelAsset }>(
      `${BASE}/assets/${id}/used`,
      bufferPostId ? { bufferPostId } : {},
    );
    return res.data;
  },

  async update(id: string, patch: ChannelAssetPatch): Promise<ChannelAsset> {
    const res = await api.patch<{ success: boolean; data: ChannelAsset }>(
      `${BASE}/assets/${id}`,
      patch,
    );
    return res.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`${BASE}/assets/${id}`);
  },
};
