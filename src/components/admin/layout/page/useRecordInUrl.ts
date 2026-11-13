import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/** What happened when the address asked for a record. */
export type RecordOpenResult = 'opened' | 'waiting' | 'missing';

/**
 * Keeps the open record of a list page in the address bar (design system:
 * records are pages with their own address).
 *
 * The page keeps owning its state; this hook only keeps the two in step:
 * - opening a record in the UI adds `?<key>=<id>` (a new history entry, so
 *   Back returns to the list);
 * - closing it removes the parameter;
 * - Back, Forward, a reload or a pasted link change the address, and the
 *   hook asks the page to open or close to match.
 *
 * `openFromUrl` returns 'waiting' while the list is still loading; the hook
 * asks again when `ready` changes. 'missing' drops the parameter.
 */
export function useRecordInUrl(
  key: string,
  openId: string | null,
  {
    ready,
    openFromUrl,
    closeFromUrl,
  }: {
    ready: boolean;
    openFromUrl: (id: string) => RecordOpenResult;
    closeFromUrl: () => void;
  },
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlId = searchParams.get(key);
  // The id the page and the address last agreed on.
  const synced = useRef<string | null>(null);
  const openRef = useRef(openFromUrl);
  const closeRef = useRef(closeFromUrl);
  openRef.current = openFromUrl;
  closeRef.current = closeFromUrl;

  useEffect(() => {
    const setParam = (id: string | null) =>
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        if (id) params.set(key, id);
        else params.delete(key);
        return params;
      });

    if (urlId !== synced.current) {
      // The address changed on its own: follow it.
      if (!urlId) {
        synced.current = null;
        closeRef.current();
        return;
      }
      if (openId === urlId) {
        synced.current = urlId;
        return;
      }
      const result = openRef.current(urlId);
      if (result === 'opened') synced.current = urlId;
      else if (result === 'missing') {
        synced.current = null;
        setParam(null);
      }
      return;
    }

    if (openId !== synced.current) {
      // The page opened or closed a record: write it down.
      synced.current = openId;
      setParam(openId);
    }
  }, [key, urlId, openId, ready, setSearchParams]);
}
