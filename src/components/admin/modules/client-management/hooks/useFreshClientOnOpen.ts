/**
 * Client Management — an open client profile never shows old data.
 *
 * The owner's rule (2026-10-12): "I need to be sure I never open up a client
 * profile on old/outdated info." The persisted cache paints a saved copy first
 * and refreshes it behind the scenes, and some of the profile's reads were
 * cached for minutes (the profile itself for five, the avatar for thirty). The
 * header, status, ID number and email came from the client-list row the profile
 * was opened from, which can be minutes old as well.
 *
 * So every time a profile opens:
 *   1. every cached query whose key names this client is reset: the in-memory
 *      copy and anything the persisted cache restored. No tab can paint data
 *      from before this open; each one loads.
 *   2. the client's record is fetched fresh (GET profile/client-record/:id) and
 *      replaces the list row for everything the profile shows.
 *   3. the reads the Overview needs first start at the same moment, so opening
 *      costs one round trip, not two.
 * Nothing about the client renders until the record fetched by THIS open has
 * arrived. There is deliberately no fallback to the list row: a failed load
 * shows an error and a retry, never an older copy.
 *
 * @module client-management/hooks
 */

import { useEffect, useLayoutEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { clientKeys } from './queryKeys';
import { fetchClientRecord } from './useClientList';
import { getClientProfileQueryOptions } from '../api';
import { clientPoliciesQueryOptions } from '../../../../../shared/api/clientPolicies';
import { fnaBatchStatusQueryOptions } from '../../../../../shared/fna-intake/hooks/useFnaBatchStatus';
import type { Client } from '../types';

/** True when a query key names this client anywhere (nested arrays and objects included). */
export function queryKeyMentions(value: unknown, id: string, depth = 0): boolean {
  if (value === id) return true;
  if (depth > 5 || value === null || typeof value !== 'object') return false;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.some((child) => queryKeyMentions(child, id, depth + 1));
}

/**
 * Forget every cached copy of this client's data. Reset (not invalidate): an
 * invalidated query still shows its old data while it refetches.
 */
export function forgetClientData(queryClient: QueryClient, clientId: string): void {
  void queryClient
    .resetQueries({ predicate: (query) => queryKeyMentions(query.queryKey, clientId) })
    .catch(() => undefined);
}

export function clientRecordQueryOptions(clientId: string) {
  return {
    queryKey: clientKeys.detail(clientId),
    queryFn: () => fetchClientRecord(clientId),
    staleTime: 0,
  };
}

export type FreshClientState =
  | { status: 'loading' }
  | { status: 'ready'; client: Client }
  | { status: 'missing' }
  | { status: 'error'; retry: () => void };

export function useFreshClientOnOpen(clientId: string, open: boolean): FreshClientState {
  const queryClient = useQueryClient();
  // When this open started; null while closed. Only data fetched after it counts.
  const [openedAt, setOpenedAt] = useState<number | null>(null);

  // Layout effect: runs before the browser paints, so the reset lands before
  // anything about the client can be drawn.
  useLayoutEffect(() => {
    if (!open) {
      setOpenedAt(null);
      return;
    }
    const startedAt = Date.now();
    forgetClientData(queryClient, clientId);
    // What the Overview shows first, started now rather than after the record.
    void queryClient.prefetchQuery(getClientProfileQueryOptions(clientId));
    void queryClient.prefetchQuery(clientPoliciesQueryOptions(clientId));
    void queryClient.prefetchQuery(fnaBatchStatusQueryOptions(clientId));
    setOpenedAt(startedAt);
  }, [open, clientId, queryClient]);

  const record = useQuery({ ...clientRecordQueryOptions(clientId), enabled: openedAt !== null });
  const freshThisOpen = openedAt !== null && record.dataUpdatedAt >= openedAt;

  // Bring the list row behind the profile up to date with it, without
  // resetting the list's own refresh schedule.
  useEffect(() => {
    const fresh = record.data;
    if (!fresh || !freshThisOpen) return;
    const listKey = clientKeys.lists();
    queryClient.setQueryData<Client[]>(
      listKey,
      (rows) => rows?.map((row) => (row.id === fresh.id ? fresh : row)),
      { updatedAt: queryClient.getQueryState(listKey)?.dataUpdatedAt },
    );
  }, [record.data, freshThisOpen, queryClient]);

  if (openedAt === null) return { status: 'loading' };
  if (!freshThisOpen) {
    return record.isError
      ? { status: 'error', retry: () => void record.refetch() }
      : { status: 'loading' };
  }
  if (!record.data) return { status: 'missing' };
  return { status: 'ready', client: record.data };
}
