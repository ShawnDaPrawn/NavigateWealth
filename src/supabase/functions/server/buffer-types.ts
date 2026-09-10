/**
 * Buffer GraphQL integration — shared types.
 *
 * The Edge Function talks to https://api.buffer.com on behalf of the admin
 * Social Media module. The API key never leaves the server.
 *
 * @module buffer/types
 */

export type BufferShareMode = 'addToQueue' | 'shareNow' | 'shareNext' | 'customScheduled';

export type BufferPostStatus =
  | 'draft'
  | 'needs_approval'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'error';

export type BufferCredentialSource = 'env' | 'stored';

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
  status?: BufferPostStatus | string;
  dueAt?: string;
  channelId?: string;
  channelService?: string;
  channelName?: string;
}

export interface BufferConnectionStatus {
  configured: boolean;
  connected: boolean;
  source?: BufferCredentialSource;
  canDisconnect: boolean;
  account?: BufferAccount;
  organizationId?: string;
  error?: string;
}

export interface BufferStoredCredentials {
  apiKey: string;
  connectedAt: string;
  connectedBy: string;
  organizationId?: string;
}

export interface BufferCreatePostInput {
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

export interface BufferGraphQLError {
  message: string;
}

export interface BufferGraphQLResponse<T> {
  data?: T;
  errors?: BufferGraphQLError[];
}
