/**
 * Client Management — deep link to one client's drawer.
 *
 * `/admin?module=clients&clientId=…` (the prefill banner, the form templates
 * link, a submission's "open client") opens that client's drawer ONCE. The id
 * is removed from the address bar as soon as it has been used.
 *
 * It used to stay there. Every later visit to Client Management (and every
 * reload) then reopened that client instead of the client list, which read as
 * "the app remembers the last client I opened" (2026-10-12).
 *
 * @module client-management/hooks
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { Client } from '../types';

export const CLIENT_DEEP_LINK_PARAM = 'clientId';

export function useClientDeepLink(
  clients: Client[],
  loading: boolean,
  openClient: (client: Client) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = searchParams.get(CLIENT_DEEP_LINK_PARAM);

  useEffect(() => {
    if (!clientId || loading || clients.length === 0) return;
    // Not in the list (yet): keep the link, so a refreshed list can still
    // honour it. It goes on the next module switch either way.
    const target = clients.find((client) => client.id === clientId);
    if (!target) return;
    openClient(target);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(CLIENT_DEEP_LINK_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [clientId, loading, clients, openClient, setSearchParams]);
}
