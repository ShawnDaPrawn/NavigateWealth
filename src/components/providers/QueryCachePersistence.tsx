/**
 * QueryCachePersistence — ties the persisted query cache to the signed-in user.
 *
 * Restores a staff user's saved cache the moment their session is known, saves
 * changes while they work, and on sign-out deletes the saved copy and empties
 * the in-memory cache. The cache itself, and how it stays fresh, is described
 * in `src/utils/query/persistedQueryCache.ts`.
 *
 * AUTH-LOCK RULES (same as AdminDataPrefetch, for the same reason)
 * ----------------------------------------------------------------
 * auth-js holds its lock for the whole of every `onAuthStateChange` callback,
 * and `AuthContext` hydrates the profile inside its own callback. So this
 * callback is synchronous, awaits nothing, never asks for the session, and
 * hands its work to a later task. See the header of `AdminDataPrefetch.tsx`
 * and AGENTS.md § "Auth hydration (do not regress)".
 *
 * The role comes from session metadata, a hint rather than a grant: it only
 * decides whether to keep a copy on this device. Every request still goes
 * through the server's own role checks.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChange } from '../../utils/auth';
import { buildAppUserFromAuthSessionFallback } from '../../utils/auth/profileService';
import {
  NOOP_STORAGE,
  createIndexedDbStorage,
  createQueryCachePersister,
} from '../../utils/query/persistedQueryCache';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'super-admin']);

export function QueryCachePersistence() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const persister = createQueryCachePersister({
      queryClient,
      storage: createIndexedDbStorage() ?? NOOP_STORAGE,
    });
    // Whoever is signed in, staff or not: their data leaves memory on sign-out.
    let signedInUserId: string | null = null;

    // NOT async, and nothing here is awaited — see the header.
    const subscription = onAuthStateChange((authUser, { supabaseUser }) => {
      const previousUserId = signedInUserId;
      signedInUserId = authUser?.id ?? null;

      setTimeout(() => {
        if (!authUser) {
          if (previousUserId) void persister.signOut();
          return;
        }

        const isStaff =
          !!supabaseUser &&
          STAFF_ROLES.has(
            buildAppUserFromAuthSessionFallback(authUser.id, authUser.email, supabaseUser).role,
          );

        if (isStaff) {
          void persister.start(authUser.id);
        } else if (previousUserId && previousUserId !== authUser.id) {
          void persister.signOut();
        }
      }, 0);
    });

    // Save promptly when the tab is hidden or closed, rather than losing the
    // last two seconds of changes to the save debounce.
    const flush = () => void persister.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [queryClient]);

  return null;
}
