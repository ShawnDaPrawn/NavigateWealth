/**
 * Posts — Buffer is the system of record. The calendar reads a window of
 * Buffer posts; Compose creates them; delete removes them in Buffer.
 */
import { api } from '../../../../../utils/api';
import type { ComposeRequest, ComposeResult, SocialPost } from '../types';
import { bufferPostToSocialPost, type BufferPostDto } from './bufferMapping';
import type { PostFilters } from './requests';

const BASE = '/social-marketing';

export const postsApi = {
  async getAll(filters: PostFilters = {}): Promise<SocialPost[]> {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('from', filters.startDate.toISOString());
    if (filters.endDate) params.set('to', filters.endDate.toISOString());
    if (filters.channelId) params.set('channelId', filters.channelId);
    const query = params.toString();
    const res = await api.get<{ success: boolean; data: BufferPostDto[] }>(
      query ? `${BASE}/posts?${query}` : `${BASE}/posts`,
    );
    let posts = (res.data ?? []).map(bufferPostToSocialPost);
    if (filters.status) {
      const wanted = new Set(Array.isArray(filters.status) ? filters.status : [filters.status]);
      posts = posts.filter((p) => wanted.has(p.status));
    }
    return posts;
  },

  async getByDateRange(startDate: Date, endDate: Date): Promise<SocialPost[]> {
    return this.getAll({ startDate, endDate });
  },

  /** Create one Buffer post per channel. Partial success is reported, not thrown. */
  async create(data: ComposeRequest): Promise<ComposeResult> {
    const res = await api.post<{ success: boolean; data: ComposeResult }>(`${BASE}/posts`, data);
    return res.data;
  },

  async delete(postId: string): Promise<void> {
    await api.delete(`${BASE}/posts/${postId}`);
  },
};
