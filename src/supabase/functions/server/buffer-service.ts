/**
 * Buffer (buffer.com) — the publishing rail for social media.
 *
 * WHY BUFFER AND NOT THE NETWORKS DIRECTLY
 * ----------------------------------------
 * The practice's LinkedIn Page, Instagram business account and (soon) X
 * account are connected to one Buffer organisation. Buffer holds the network
 * OAuth tokens, handles their refresh, and exposes one GraphQL API for all of
 * them. The scheduling agents (Claude / ChatGPT routines) create posts through
 * their own Buffer connector; this module is the APP's view onto the same
 * organisation — channels for the Channels tab, posts for the calendar,
 * aggregated metrics for the stat cards, and the manual Compose path.
 *
 * AUTH: `BUFFER_API_KEY` (Supabase Edge Function secret) as a bearer token.
 * Optional `BUFFER_API_URL` (defaults to the public GraphQL endpoint) and
 * `BUFFER_ORGANIZATION_ID` (otherwise the account's first organisation).
 *
 * Every call is one POST carrying `{ query, variables }`. Mutation results are
 * unions of a success type and `MutationError` implementations, so the client
 * reads `__typename` and turns anything that is not the success type into an
 * `APIError` rather than returning a half-shaped object.
 *
 * @module buffer/service
 */

import { createModuleLogger } from './stderr-logger.ts';
import { APIError } from './error.middleware.ts';

const log = createModuleLogger('buffer-service');

export const BUFFER_API_URL_DEFAULT = 'https://api.buffer.com';

/** Buffer's own status vocabulary for a post. */
export type BufferPostStatus =
  | 'draft'
  | 'error'
  | 'needs_approval'
  | 'scheduled'
  | 'sending'
  | 'sent';

export type BufferShareMode = 'addToQueue' | 'shareNow' | 'shareNext' | 'customScheduled';
export type BufferSchedulingType = 'automatic' | 'notification';

export interface BufferScheduleSlot {
  day: string;
  times: string[];
  paused: boolean;
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string | null;
  /** Buffer's network slug: linkedin | instagram | twitter | facebook | ... */
  service: string;
  /** page | business | profile | account | ... */
  type: string;
  avatar: string;
  isDisconnected: boolean;
  isLocked: boolean;
  isQueuePaused: boolean;
  timezone: string;
  externalLink: string | null;
  postingSchedule: BufferScheduleSlot[];
}

export interface BufferAsset {
  type: 'image' | 'video' | 'document';
  source: string;
  thumbnail: string;
}

export interface BufferPost {
  id: string;
  channelId: string;
  channelService: string;
  text: string;
  status: BufferPostStatus;
  dueAt: string | null;
  sentAt: string | null;
  externalLink: string | null;
  via: string;
  schedulingType: string | null;
  createdAt: string;
  updatedAt: string;
  error: { message: string } | null;
  assets: BufferAsset[];
  tags: Array<{ id: string; name: string }>;
}

export interface BufferMetric {
  name: string;
  type: string;
  value: number;
  unit: 'count' | 'percentage';
  description: string;
}

export interface BufferAggregatedMetrics {
  metricsUpdatedAt: string | null;
  metrics: BufferMetric[];
}

export interface BufferImageAssetInput {
  image: { url: string; thumbnailUrl?: string; metadata?: { altText: string } };
}

export interface BufferCreatePostInput {
  channelId: string;
  text: string;
  mode: BufferShareMode;
  /** ISO 8601 with offset; required when mode is customScheduled. */
  dueAt?: string;
  schedulingType?: BufferSchedulingType;
  saveToDraft?: boolean;
  assets?: BufferImageAssetInput[];
  /** Service-keyed metadata, e.g. `{ instagram: { type: 'post', shouldShareToFeed: true } }`. */
  metadata?: Record<string, unknown>;
  aiAssisted?: boolean;
  source?: string;
}

export interface BufferCreatedPost {
  id: string;
  status: BufferPostStatus;
  dueAt: string | null;
  channelId: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function isBufferConfigured(): boolean {
  return Boolean(Deno.env.get('BUFFER_API_KEY'));
}

function getApiKey(): string {
  const key = Deno.env.get('BUFFER_API_KEY');
  if (!key) {
    throw new APIError('Buffer API key is not configured', 500, 'BUFFER_CONFIG_ERROR');
  }
  return key;
}

function getApiUrl(): string {
  return (Deno.env.get('BUFFER_API_URL') || BUFFER_API_URL_DEFAULT).replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

function parseGraphqlBody<T>(raw: string): GraphQLResponse<T> | null {
  try {
    return JSON.parse(raw) as GraphQLResponse<T>;
  } catch {
    return null;
  }
}

/**
 * One GraphQL round trip. Throws `APIError` (502) on transport, HTTP or
 * GraphQL-level failure so route handlers surface a clean message rather than
 * a `Cannot read properties of undefined`.
 */
export async function bufferGraphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const apiKey = getApiKey();
  let response: Response;
  try {
    response = await fetch(getApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Buffer API unreachable', { error: message });
    throw new APIError(`Buffer API unreachable: ${message}`, 502, 'BUFFER_UNREACHABLE');
  }

  const raw = await response.text();
  const parsed = parseGraphqlBody<T>(raw);

  if (!response.ok) {
    log.error('Buffer API HTTP error', { status: response.status, body: raw.slice(0, 300) });
    throw new APIError(`Buffer API error (HTTP ${response.status})`, 502, 'BUFFER_HTTP_ERROR');
  }

  if (!parsed) {
    throw new APIError('Buffer API returned a non-JSON response', 502, 'BUFFER_BAD_RESPONSE');
  }

  if (parsed.errors && parsed.errors.length > 0) {
    const message = parsed.errors.map((e) => e.message).join('; ');
    log.error('Buffer GraphQL error', { message });
    throw new APIError(`Buffer API error: ${message}`, 502, 'BUFFER_GRAPHQL_ERROR');
  }

  if (!parsed.data) {
    throw new APIError('Buffer API returned no data', 502, 'BUFFER_BAD_RESPONSE');
  }

  return parsed.data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const ACCOUNT_QUERY = `query NwAccount {
  account { id email timezone organizations { id name } }
}`;

const CHANNELS_QUERY = `query NwChannels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id name displayName service type avatar isDisconnected isLocked isQueuePaused timezone externalLink
    postingSchedule { day times paused }
  }
}`;

const POST_FIELDS = `id channelId channelService text status dueAt sentAt externalLink via schedulingType createdAt updatedAt
  error { message }
  assets { type source thumbnail }
  tags { id name }`;

const POSTS_QUERY = `query NwPosts($organizationId: OrganizationId!, $first: Int, $after: String, $filter: PostsFiltersInput) {
  posts(input: { organizationId: $organizationId, filter: $filter, sort: [{ field: dueAt, direction: asc }] }, first: $first, after: $after) {
    edges { node { ${POST_FIELDS} } }
    pageInfo { hasNextPage endCursor }
  }
}`;

const POST_QUERY = `query NwPost($id: PostId!) {
  post(input: { id: $id }) { ${POST_FIELDS} }
}`;

const METRICS_QUERY = `query NwMetrics($input: AggregatedPostMetricsInput!) {
  aggregatedPostMetrics(input: $input) {
    metricsUpdatedAt
    metrics { name type value unit description }
  }
}`;

const CREATE_POST_MUTATION = `mutation NwCreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    __typename
    ... on PostActionSuccess { post { id status dueAt channelId } }
    ... on MutationError { message }
  }
}`;

const DELETE_POST_MUTATION = `mutation NwDeletePost($input: DeletePostInput!) {
  deletePost(input: $input) {
    __typename
    ... on DeletePostSuccess { id }
    ... on MutationError { message }
  }
}`;

let cachedOrganizationId: string | null = null;

/** Test hook — clears the memoised organisation id. */
export function resetBufferOrganizationCache(): void {
  cachedOrganizationId = null;
}

export interface BufferAccount {
  id: string;
  email: string;
  timezone: string | null;
  organizations: Array<{ id: string; name: string }>;
}

export async function getBufferAccount(): Promise<BufferAccount> {
  const data = await bufferGraphql<{ account: BufferAccount }>(ACCOUNT_QUERY);
  return data.account;
}

/**
 * The organisation every other call is scoped to. `BUFFER_ORGANIZATION_ID`
 * wins; otherwise the account's first organisation, memoised for the life of
 * the isolate.
 */
export async function getBufferOrganizationId(): Promise<string> {
  const fromEnv = Deno.env.get('BUFFER_ORGANIZATION_ID');
  if (fromEnv) return fromEnv;
  if (cachedOrganizationId) return cachedOrganizationId;

  const account = await getBufferAccount();
  const first = account.organizations[0];
  if (!first) {
    throw new APIError('Buffer account has no organisation', 502, 'BUFFER_NO_ORGANIZATION');
  }
  if (account.organizations.length > 1) {
    log.warn('Buffer account has multiple organisations; using the first', {
      chosen: first.name,
      count: account.organizations.length,
    });
  }
  cachedOrganizationId = first.id;
  return first.id;
}

export async function listBufferChannels(): Promise<BufferChannel[]> {
  const organizationId = await getBufferOrganizationId();
  const data = await bufferGraphql<{ channels: BufferChannel[] }>(CHANNELS_QUERY, {
    organizationId,
  });
  return data.channels ?? [];
}

export interface ListBufferPostsOptions {
  /** Inclusive ISO bounds on the post's scheduled time (`dueAt`). */
  from?: string;
  to?: string;
  channelIds?: string[];
  statuses?: BufferPostStatus[];
  /** Hard cap on rows returned across pages. */
  limit?: number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 5;

export async function listBufferPosts(options: ListBufferPostsOptions = {}): Promise<BufferPost[]> {
  const organizationId = await getBufferOrganizationId();
  const filter: Record<string, unknown> = {};
  if (options.from || options.to) {
    filter.dueAt = {
      ...(options.from ? { start: options.from } : {}),
      ...(options.to ? { end: options.to } : {}),
    };
  }
  if (options.channelIds?.length) filter.channelIds = options.channelIds;
  if (options.statuses?.length) filter.status = options.statuses;

  const limit = Math.max(1, options.limit ?? PAGE_SIZE * MAX_PAGES);
  const posts: BufferPost[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES && posts.length < limit; page++) {
    const data: {
      posts: {
        edges: Array<{ node: BufferPost }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await bufferGraphql(POSTS_QUERY, {
      organizationId,
      first: Math.min(PAGE_SIZE, limit - posts.length),
      after,
      filter: Object.keys(filter).length ? filter : null,
    });
    const edges = data.posts?.edges ?? [];
    for (const edge of edges) posts.push(edge.node);
    if (!data.posts?.pageInfo?.hasNextPage || !data.posts.pageInfo.endCursor) break;
    after = data.posts.pageInfo.endCursor;
  }

  return posts;
}

export async function getBufferPost(postId: string): Promise<BufferPost> {
  const data = await bufferGraphql<{ post: BufferPost }>(POST_QUERY, { id: postId });
  if (!data.post) {
    throw new APIError('Buffer post not found', 404, 'BUFFER_POST_NOT_FOUND');
  }
  return data.post;
}

export interface BufferMetricsOptions {
  from: string;
  to: string;
  channelIds?: string[];
}

export async function getBufferAggregatedMetrics(
  options: BufferMetricsOptions,
): Promise<BufferAggregatedMetrics> {
  const organizationId = await getBufferOrganizationId();
  const input: Record<string, unknown> = {
    organizationId,
    startDateTime: options.from,
    endDateTime: options.to,
  };
  if (options.channelIds?.length) input.channelIds = options.channelIds;
  const data = await bufferGraphql<{ aggregatedPostMetrics: BufferAggregatedMetrics }>(
    METRICS_QUERY,
    { input },
  );
  return {
    metricsUpdatedAt: data.aggregatedPostMetrics?.metricsUpdatedAt ?? null,
    metrics: data.aggregatedPostMetrics?.metrics ?? [],
  };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

type CreatePostPayload =
  | { __typename: 'PostActionSuccess'; post: BufferCreatedPost }
  | { __typename: string; message?: string };

export async function createBufferPost(input: BufferCreatePostInput): Promise<BufferCreatedPost> {
  if (input.mode === 'customScheduled' && !input.dueAt) {
    throw new APIError(
      'dueAt is required for a custom-scheduled post',
      400,
      'BUFFER_DUE_AT_REQUIRED',
    );
  }
  const variables = {
    input: {
      channelId: input.channelId,
      text: input.text,
      mode: input.mode,
      schedulingType: input.schedulingType ?? 'automatic',
      assets: input.assets ?? [],
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      ...(input.saveToDraft !== undefined ? { saveToDraft: input.saveToDraft } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.aiAssisted !== undefined ? { aiAssisted: input.aiAssisted } : {}),
      source: input.source ?? 'navigate-wealth-admin',
    },
  };
  const data = await bufferGraphql<{ createPost: CreatePostPayload }>(
    CREATE_POST_MUTATION,
    variables,
  );
  const payload = data.createPost;
  if (payload.__typename === 'PostActionSuccess' && 'post' in payload) {
    log.success('Buffer post created', { postId: payload.post.id, channelId: input.channelId });
    return payload.post;
  }
  const message = ('message' in payload && payload.message) || payload.__typename;
  log.error('Buffer createPost rejected', { channelId: input.channelId, reason: message });
  throw new APIError(`Buffer rejected the post: ${message}`, 502, 'BUFFER_CREATE_FAILED');
}

type DeletePostPayload =
  | { __typename: 'DeletePostSuccess'; id: string }
  | { __typename: string; message?: string };

export async function deleteBufferPost(postId: string): Promise<void> {
  const data = await bufferGraphql<{ deletePost: DeletePostPayload }>(DELETE_POST_MUTATION, {
    input: { id: postId },
  });
  const payload = data.deletePost;
  if (payload.__typename === 'DeletePostSuccess') {
    log.success('Buffer post deleted', { postId });
    return;
  }
  const message = ('message' in payload && payload.message) || payload.__typename;
  throw new APIError(`Buffer could not delete the post: ${message}`, 502, 'BUFFER_DELETE_FAILED');
}

// ---------------------------------------------------------------------------
// Vocabulary mapping (Buffer ↔ this app)
// ---------------------------------------------------------------------------

export type SocialChannel = 'linkedin' | 'instagram' | 'x';

/** Buffer's `service` slug → the app's channel vocabulary (`null` for unsupported networks). */
export function bufferServiceToChannel(service: string): SocialChannel | null {
  switch (service) {
    case 'linkedin':
      return 'linkedin';
    case 'instagram':
      return 'instagram';
    case 'twitter':
      return 'x';
    default:
      return null;
  }
}

/** The app's channel vocabulary → Buffer's `service` slug. */
export function channelToBufferService(channel: SocialChannel): string {
  return channel === 'x' ? 'twitter' : channel;
}

export type AppPostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'pending_approval';

export function bufferStatusToAppStatus(status: BufferPostStatus): AppPostStatus {
  switch (status) {
    case 'sent':
      return 'published';
    case 'error':
      return 'failed';
    case 'draft':
      return 'draft';
    case 'needs_approval':
      return 'pending_approval';
    case 'scheduled':
    case 'sending':
    default:
      return 'scheduled';
  }
}
