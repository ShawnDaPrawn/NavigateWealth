/**
 * Buffer Integration — Service Layer
 *
 * Resolves the API key (env secret wins over a stored admin key), talks to
 * Buffer GraphQL, and maps Navigate Wealth social posts onto Buffer channels.
 *
 * @module buffer/service
 */

import { APIError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { bufferGraphql } from './buffer-client.ts';
import {
  BUFFER_CREDENTIALS_ID,
  bufferCredentials,
} from './repositories/buffer-credentials-repository.ts';
import type {
  BufferAccount,
  BufferChannel,
  BufferConnectionStatus,
  BufferCreatePostInput,
  BufferCreatePostResult,
  BufferCredentialSource,
  BufferPost,
  BufferShareMode,
} from './buffer-types.ts';
import type { SocialPost } from './social-marketing-types.ts';

const log = createModuleLogger('buffer-service');

const ACCOUNT_QUERY = `
  query BufferAccount {
    account {
      id
      email
      name
      timezone
      organizations { id name channelCount }
    }
  }
`;

const CHANNELS_QUERY = `
  query BufferChannels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id
      name
      service
      displayName
      avatar
      isDisconnected
      timezone
      type
    }
  }
`;

const POSTS_QUERY = `
  query BufferPosts(
    $organizationId: OrganizationId!
    $first: Int
    $after: String
    $status: [PostStatus!]
  ) {
    posts(
      first: $first
      after: $after
      input: {
        organizationId: $organizationId
        filter: { status: $status }
        sort: [{ field: dueAt, direction: asc }]
      }
    ) {
      edges {
        node {
          id
          text
          status
          dueAt
          channelId
          channelService
          channel { id name service }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const CREATE_POST_MUTATION = `
  mutation CreateBufferPost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post { id text dueAt status channelId }
      }
      ... on MutationError { message }
    }
  }
`;

interface ResolvedKey {
  key: string;
  source: BufferCredentialSource;
  organizationId?: string;
}

/** Map our social-marketing platform ids onto Buffer channel `service` values. */
export function bufferServicesForPlatform(platform: string): string[] {
  const normalised = platform.trim().toLowerCase();
  if (normalised === 'all') {
    return ['linkedin', 'instagram', 'facebook', 'twitter', 'x'];
  }
  if (normalised === 'x' || normalised === 'twitter') return ['twitter', 'x'];
  return [normalised];
}

export class BufferService {
  async getStatus(): Promise<BufferConnectionStatus> {
    const resolved = await this.resolveKey();
    if (!resolved) {
      return { configured: false, connected: false, canDisconnect: false };
    }

    try {
      const account = await this.fetchAccount(resolved.key);
      const organizationId = this.pickOrganizationId(account, resolved.organizationId);
      return {
        configured: true,
        connected: true,
        source: resolved.source,
        canDisconnect: resolved.source === 'stored',
        account,
        organizationId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Buffer connection failed';
      log.warn('Buffer status check failed', { source: resolved.source });
      return {
        configured: true,
        connected: false,
        source: resolved.source,
        canDisconnect: resolved.source === 'stored',
        error: message,
      };
    }
  }

  async connect(
    apiKey: string,
    adminUserId: string,
    organizationId?: string,
  ): Promise<BufferConnectionStatus> {
    const envKey = Deno.env.get('BUFFER_API_KEY')?.trim();
    if (envKey) {
      throw new APIError(
        'BUFFER_API_KEY is already set as an Edge Function secret. Disconnect is not needed — remove the secret to switch keys.',
        409,
        'BUFFER_ENV_CONFIGURED',
      );
    }

    const account = await this.fetchAccount(apiKey);
    const resolvedOrgId = this.pickOrganizationId(account, organizationId);
    await bufferCredentials.put(BUFFER_CREDENTIALS_ID, {
      apiKey,
      connectedAt: new Date().toISOString(),
      connectedBy: adminUserId,
      organizationId: resolvedOrgId,
    });
    log.success('Buffer connected', { adminUserId, organizationId: resolvedOrgId });

    return {
      configured: true,
      connected: true,
      source: 'stored',
      canDisconnect: true,
      account,
      organizationId: resolvedOrgId,
    };
  }

  async disconnect(adminUserId: string): Promise<void> {
    const envKey = Deno.env.get('BUFFER_API_KEY')?.trim();
    if (envKey) {
      throw new APIError(
        'BUFFER_API_KEY is set as an Edge Function secret and cannot be disconnected from the app.',
        409,
        'BUFFER_ENV_CONFIGURED',
      );
    }
    await bufferCredentials.remove(BUFFER_CREDENTIALS_ID);
    log.success('Buffer disconnected', { adminUserId });
  }

  async listChannels(organizationId?: string): Promise<BufferChannel[]> {
    const { key, orgId } = await this.requireKey(organizationId);
    const data = await bufferGraphql<{ channels: BufferChannel[] | null }>(key, CHANNELS_QUERY, {
      organizationId: orgId,
    });
    return data.channels ?? [];
  }

  async listPosts(organizationId?: string): Promise<BufferPost[]> {
    const { key, orgId } = await this.requireKey(organizationId);
    const data = await bufferGraphql<{
      posts: {
        edges?: Array<{
          node: {
            id: string;
            text?: string;
            status?: string;
            dueAt?: string;
            channelId?: string;
            channelService?: string;
            channel?: { id: string; name?: string; service?: string };
          };
        }>;
      } | null;
    }>(key, POSTS_QUERY, {
      organizationId: orgId,
      first: 25,
      status: ['scheduled', 'sending'],
    });

    return (data.posts?.edges ?? []).map((edge) => ({
      id: edge.node.id,
      text: edge.node.text,
      status: edge.node.status,
      dueAt: edge.node.dueAt,
      channelId: edge.node.channelId,
      channelService: edge.node.channelService ?? edge.node.channel?.service,
      channelName: edge.node.channel?.name,
    }));
  }

  async createPosts(input: BufferCreatePostInput): Promise<BufferCreatePostResult[]> {
    const { key, orgId } = await this.requireKey();
    const data = await bufferGraphql<{ channels: BufferChannel[] | null }>(key, CHANNELS_QUERY, {
      organizationId: orgId,
    });
    const channels = data.channels ?? [];
    const byId = new Map(channels.map((channel) => [channel.id, channel]));
    const results: BufferCreatePostResult[] = [];

    for (const channelId of input.channelIds) {
      const channel = byId.get(channelId);
      const created = await this.createOnePost(key, channelId, channel?.service, input);
      results.push(created);
    }

    log.success('Buffer posts created', { count: results.length });
    return results;
  }

  /**
   * Best-effort push of a local social-marketing post onto matching Buffer
   * channels. Returns skipped when Buffer is not configured.
   */
  async pushLocalPost(
    post: Pick<SocialPost, 'platform' | 'content' | 'media_urls' | 'scheduled_for'>,
    mode: BufferShareMode,
  ): Promise<{ pushed: boolean; postIds: string[]; error?: string }> {
    const resolved = await this.resolveKey();
    if (!resolved) return { pushed: false, postIds: [] };

    try {
      const channels = await this.listChannels(resolved.organizationId);
      const services = new Set(bufferServicesForPlatform(post.platform));
      const targets = channels.filter(
        (channel) => !channel.isDisconnected && services.has(channel.service.toLowerCase()),
      );
      if (targets.length === 0) return { pushed: false, postIds: [] };

      const created = await this.createPosts({
        channelIds: targets.map((channel) => channel.id),
        text: post.content,
        mode,
        dueAt: post.scheduled_for,
        imageUrls: post.media_urls,
      });
      return { pushed: true, postIds: created.map((item) => item.postId) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Buffer publish failed';
      log.warn('Buffer push of local post failed', { platform: post.platform });
      return { pushed: false, postIds: [], error: message };
    }
  }

  private async createOnePost(
    apiKey: string,
    channelId: string,
    service: string | undefined,
    input: BufferCreatePostInput,
  ): Promise<BufferCreatePostResult> {
    const assets = (input.imageUrls ?? []).map((url) => ({ image: { url } }));
    const graphqlInput: Record<string, unknown> = {
      channelId,
      text: input.text,
      schedulingType: 'automatic',
      mode: input.mode,
      source: 'navigate-wealth',
    };
    if (input.dueAt) graphqlInput.dueAt = input.dueAt;
    if (input.saveToDraft) graphqlInput.saveToDraft = true;
    if (assets.length > 0) graphqlInput.assets = assets;
    if (service?.toLowerCase() === 'instagram') {
      graphqlInput.metadata = {
        instagram: { type: 'post', shouldShareToFeed: true },
      };
    }

    const data = await bufferGraphql<{
      createPost: {
        post?: { id: string; dueAt?: string; status?: string; channelId?: string };
        message?: string;
      };
    }>(apiKey, CREATE_POST_MUTATION, { input: graphqlInput });

    if (data.createPost?.message && !data.createPost.post) {
      throw new APIError(data.createPost.message, 502, 'BUFFER_MUTATION_ERROR');
    }
    const post = data.createPost?.post;
    if (!post?.id) {
      throw new APIError('Buffer did not return a created post', 502, 'BUFFER_MUTATION_ERROR');
    }
    return {
      postId: post.id,
      channelId: post.channelId ?? channelId,
      dueAt: post.dueAt,
      status: post.status,
    };
  }

  private async fetchAccount(apiKey: string): Promise<BufferAccount> {
    const data = await bufferGraphql<{ account: BufferAccount }>(apiKey, ACCOUNT_QUERY);
    if (!data.account?.id) {
      throw new APIError('Buffer account query returned no account', 502, 'BUFFER_API_ERROR');
    }
    return {
      ...data.account,
      organizations: data.account.organizations ?? [],
    };
  }

  private pickOrganizationId(account: BufferAccount, preferred?: string): string | undefined {
    if (preferred && account.organizations.some((org) => org.id === preferred)) return preferred;
    return account.organizations[0]?.id;
  }

  private async resolveKey(): Promise<ResolvedKey | null> {
    const envKey = Deno.env.get('BUFFER_API_KEY')?.trim();
    if (envKey) return { key: envKey, source: 'env' };

    const stored = await bufferCredentials.get(BUFFER_CREDENTIALS_ID);
    if (stored?.apiKey) {
      return {
        key: stored.apiKey,
        source: 'stored',
        organizationId: stored.organizationId,
      };
    }
    return null;
  }

  private async requireKey(
    organizationId?: string,
  ): Promise<{ key: string; orgId: string; source: BufferCredentialSource }> {
    const resolved = await this.resolveKey();
    if (!resolved) {
      throw new APIError(
        'Buffer is not connected. Paste an API key from Buffer → Settings → API, or set BUFFER_API_KEY.',
        400,
        'BUFFER_NOT_CONFIGURED',
      );
    }
    const account = await this.fetchAccount(resolved.key);
    const orgId = this.pickOrganizationId(account, organizationId ?? resolved.organizationId);
    if (!orgId) {
      throw new APIError(
        'No Buffer organization found on this account.',
        400,
        'BUFFER_NO_ORGANIZATION',
      );
    }
    return { key: resolved.key, orgId, source: resolved.source };
  }
}
