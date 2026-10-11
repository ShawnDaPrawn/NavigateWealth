/**
 * QueryCachePersistence — ties the persisted query cache to the signed-in user.
 *
 * Restores a staff user's saved cache the moment their session is known, saves
 * changes while they work, and on sign-out deletes the saved copy and empties
 * the in-memory cache. The cache itself, and how it stays fresh, is described
 * in `src/utils/query/persistedQueryCache.ts`.
 *
 * TWO SIGNALS FOR "SIGNED OUT", ON PURPOSE
 * ----------------------------------------
 * Supabase's `SIGNED_OUT` event only fires when its sign-out succeeds. When it
 * fails — offline, or a session that already expired server-side — auth-js
 * returns the error and emits nothing, while `AuthContext.logout` still clears
 * the user and tells the person they are signed out. So this component also
 * follows `AuthContext`'s user: when it goes from someone to no one (logout,
 * the session-expired event, a logout broadcast from another tab), the cache is
 * wiped whatever Supabase did. It must therefore render inside `AuthProvider`.
 *
 * And when a session event names a DIFFERENT user from the last one, with no
 * sign-out in between, the previous user's data is wiped before anything is
 * restored or saved for the new one — whether or not the previous user was
 * staff, since a client's queries would otherwise be saved under the staff
 * user's entry.
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

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { onAuthStateChange } from '../../utils/auth';
import { buildAppUserFromAuthSessionFallback } from '../../utils/auth/profileService';
import {
  NOOP_STORAGE,
  createIndexedDbStorage,
  createQueryCachePersister,
  type QueryCachePersister,
} from '../../utils/query/persistedQueryCache';

const STAFF_ROLES = new Set(['admin', 'super_admin', 'super-admin']);

export function QueryCachePersistence() {
  const queryClient = useQueryClient();
  const persisterRef = useRef<QueryCachePersister | null>(null);

  useEffect(() => {
    const persister = createQueryCachePersister({
      queryClient,
      storage: createIndexedDbStorage() ?? NOOP_STORAGE,
    });
    persisterRef.current = persister;
    // Whoever is signed in, staff or not: their data leaves memory on sign-out.
    let signedInUserId: string | null = null;

    // NOT async, and nothing here is awaited — see the header.
    const subscription = onAuthStateChange((authUser, { supabaseUser }) => {
      const previousUserId = signedInUserId;
      signedInUserId = authUser?.id ?? null;

      setTimeout(() => {
        void (async () => {
          if (!authUser) {
            if (previousUserId) await persister.signOut();
            return;
          }

          if (previousUserId && previousUserId !== authUser.id) {
            // A different user took over this tab with no sign-out between.
            await persister.signOut();
          }

          const isStaff =
            !!supabaseUser &&
            STAFF_ROLES.has(
              buildAppUserFromAuthSessionFallback(authUser.id, authUser.email, supabaseUser).role,
            );
          if (isStaff) await persister.start(authUser.id);
        })();
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
      persisterRef.current = null;
    };
  }, [queryClient]);

  // The app's own sign-out signal — see "two signals" in the header.
  const { user } = useAuth();
  const appUserId = user?.id ?? null;
  const previousAppUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = previousAppUserIdRef.current;
    previousAppUserIdRef.current = appUserId;
    if (previous && !appUserId) void persisterRef.current?.signOut();
  }, [appUserId]);

  return null;
}
