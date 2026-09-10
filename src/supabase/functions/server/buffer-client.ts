/**
 * Buffer GraphQL HTTP client.
 *
 * Posts to https://api.buffer.com with a bearer API key. Never logs the key.
 *
 * @module buffer/client
 */

import { APIError } from './error.middleware.ts';
import { createModuleLogger } from './stderr-logger.ts';
import type { BufferGraphQLResponse } from './buffer-types.ts';

const log = createModuleLogger('buffer-client');

export const BUFFER_API_URL = 'https://api.buffer.com';
const DEFAULT_TIMEOUT_MS = 30_000;

export async function bufferGraphql<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(BUFFER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new APIError(
        'Buffer API key is invalid or has been revoked.',
        401,
        'BUFFER_AUTH_ERROR',
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 'unknown';
      throw new APIError(
        `Buffer rate limit exceeded. Retry after ${retryAfter}s.`,
        429,
        'BUFFER_RATE_LIMIT',
      );
    }

    if (!response.ok) {
      log.error('Buffer GraphQL HTTP error', { status: response.status });
      throw new APIError(`Buffer API returned HTTP ${response.status}`, 502, 'BUFFER_API_ERROR');
    }

    const payload = (await response.json()) as BufferGraphQLResponse<T>;
    if (payload.errors?.length) {
      const message = payload.errors[0]?.message || 'Buffer GraphQL error';
      throw new APIError(message, 502, 'BUFFER_GRAPHQL_ERROR');
    }
    if (!payload.data) {
      throw new APIError('Buffer API returned an empty response', 502, 'BUFFER_API_ERROR');
    }
    return payload.data;
  } catch (error) {
    if (error instanceof APIError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError('Buffer API request timed out', 504, 'BUFFER_TIMEOUT');
    }
    const message = error instanceof Error ? error.message : 'Buffer API request failed';
    throw new APIError(message, 502, 'BUFFER_API_ERROR');
  } finally {
    clearTimeout(timer);
  }
}
