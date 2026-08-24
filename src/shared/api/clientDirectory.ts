/**
 * Client directory — the one place that fetches "all clients".
 *
 * This call used to live in client-management/api.ts, which meant e-sign's
 * recipient picker had to reach into that module's internals to build a list
 * of people to send to. Fetching the client directory is not a
 * client-management feature, it is infrastructure several features need, so it
 * sits in the shared layer where anything may call it without coupling to a
 * module.
 *
 * The endpoint and the pagination handling are unchanged from the original.
 */
import { api } from '@/utils/api';
import { logger } from '@/utils/logger';
import type { ClientDirectoryEntry, ClientDirectoryResponse } from '../types/client-directory';

/** `profile/all-users` — the admin client directory. */
export const CLIENT_DIRECTORY_ENDPOINT = 'profile/all-users';

/**
 * Fetch the client directory.
 *
 * Callers that model the nested `profile` / `application` objects pass their
 * own entry type; the default is the flat wire shape.
 */
export async function fetchClientDirectory<TEntry = ClientDirectoryEntry>(params?: {
  page?: number;
  perPage?: number;
}): Promise<ClientDirectoryResponse<TEntry>> {
  try {
    let endpoint: string = CLIENT_DIRECTORY_ENDPOINT;
    if (params?.page || params?.perPage) {
      const qs = new URLSearchParams();
      if (params.page) qs.set('page', String(params.page));
      if (params.perPage) qs.set('perPage', String(params.perPage));
      endpoint = `${endpoint}?${qs.toString()}`;
    }
    return await api.get<ClientDirectoryResponse<TEntry>>(endpoint);
  } catch (error) {
    logger.error('Failed to fetch clients', error);
    throw error;
  }
}
