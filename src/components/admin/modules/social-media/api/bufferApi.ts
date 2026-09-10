/**
 * Buffer integration. One slice of the social-media API client —
 * api.ts re-exports the whole surface.
 */
import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorUtils';
import { BASE_URL, get, post, type APIResponse } from './apiBase';

export type BufferShareMode = 'addToQueue' | 'shareNow' | 'shareNext' | 'customScheduled';

export interface BufferOrganization {
  id: string;
  name: string;
  channelCount?: number;
}

export interface BufferAccount {
  id: string;
  email?: string;
  name?: string;
  timezone?: string;
  organizations: BufferOrganization[];
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
  displayName?: string;
  avatar?: string;
  isDisconnected?: boolean;
  timezone?: string;
  type?: string;
}

export interface BufferPost {
  id: string;
  text?: string;
  status?: string;
  dueAt?: string;
  channelId?: string;
  channelService?: string;
  channelName?: string;
}

export interface BufferConnectionStatus {
  configured: boolean;
  connected: boolean;
  source?: 'env' | 'stored';
  canDisconnect: boolean;
  account?: BufferAccount;
  organizationId?: string;
  error?: string;
}

export interface CreateBufferPostRequest {
  channelIds: string[];
  text: string;
  mode: BufferShareMode;
  dueAt?: string;
  imageUrls?: string[];
  saveToDraft?: boolean;
}

export interface BufferCreatePostResult {
  postId: string;
  channelId: string;
  dueAt?: string;
  status?: string;
}

const BUFFER_BASE = `${BASE_URL}/buffer`;

export const bufferApi = {
  async getStatus(): Promise<APIResponse<BufferConnectionStatus>> {
    return get<BufferConnectionStatus>(`${BUFFER_BASE}/status`);
  },

  async connect(
    apiKey: string,
    organizationId?: string,
  ): Promise<APIResponse<BufferConnectionStatus>> {
    try {
      return await post<BufferConnectionStatus>(`${BUFFER_BASE}/connect`, {
        apiKey,
        organizationId,
      });
    } catch (error) {
      logger.error('Failed to connect Buffer', error);
      return { success: false, error: getErrorMessage(error) || 'Failed to connect Buffer' };
    }
  },

  async disconnect(): Promise<APIResponse<{ message: string }>> {
    return post<{ message: string }>(`${BUFFER_BASE}/disconnect`);
  },

  async listChannels(): Promise<APIResponse<BufferChannel[]>> {
    return get<BufferChannel[]>(`${BUFFER_BASE}/channels`);
  },

  async listPosts(): Promise<APIResponse<BufferPost[]>> {
    return get<BufferPost[]>(`${BUFFER_BASE}/posts`);
  },

  async createPost(input: CreateBufferPostRequest): Promise<APIResponse<BufferCreatePostResult[]>> {
    return post<BufferCreatePostResult[]>(`${BUFFER_BASE}/posts`, input);
  },
};
