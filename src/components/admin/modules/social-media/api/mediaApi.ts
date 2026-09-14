/**
 * Media library — images an admin uploaded for posts.
 *
 * The Edge Function stores them in the public assets bucket and hands back a
 * stable URL, which is what Compose passes to Buffer. Nothing here knows about
 * buckets: an item is a name, a URL and a storage path.
 */
import { api } from '../../../../../utils/api';
import type { SocialMediaAsset } from '../types';

const BASE = '/social-marketing/media';

export const mediaApi = {
  async list(limit = 60): Promise<SocialMediaAsset[]> {
    const res = await api.get<{ success: boolean; data: SocialMediaAsset[] }>(
      `${BASE}?limit=${limit}`,
    );
    return res.data ?? [];
  },

  /** Upload one image. The server validates the bytes, not just the file name. */
  async upload(file: File): Promise<SocialMediaAsset> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post<{ success: boolean; data: SocialMediaAsset }>(BASE, form);
    return res.data;
  },

  async remove(storagePath: string): Promise<void> {
    await api.delete(`${BASE}?storagePath=${encodeURIComponent(storagePath)}`);
  },
};
