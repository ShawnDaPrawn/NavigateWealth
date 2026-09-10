/**
 * Channels — the Buffer channels the practice publishes to, presented as
 * `SocialProfile`s. Read-only: connecting a network happens in Buffer.
 */
import { api } from '../../../../../utils/api';
import type { BufferStatus, SocialProfile } from '../types';
import { channelToProfile, type BufferChannelDto } from './bufferMapping';

const BASE = '/social-marketing';

export const profilesApi = {
  /** All Buffer channels (connected or not). */
  async getAll(): Promise<SocialProfile[]> {
    const res = await api.get<{ success: boolean; data: BufferChannelDto[] }>(`${BASE}/channels`);
    return (res.data ?? []).map(channelToProfile);
  },

  /** Whether the Edge Function can reach Buffer, and for which account. */
  async getStatus(): Promise<BufferStatus> {
    const res = await api.get<{ success: boolean; data: BufferStatus }>(`${BASE}/status`);
    return res.data;
  },
};
