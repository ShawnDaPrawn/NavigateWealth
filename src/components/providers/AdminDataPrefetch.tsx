/**
 * AdminDataPrefetch — starts the admin dashboard's fetches during sign-in.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * Signing in ends with `window.location.href = '/admin'` (LoginPage), a hard
 * navigation, so the admin lands on a cold app: no React Query cache, no
 * warmed chunks. The app then does three things strictly in sequence:
 *
 *   1. boot the SPA and read the Supabase session,
 *   2. hydrate the KV profile into an AppUser (`loadUserProfile`), during
 *      which `AdminRoute` shows a page loader,
 *   3. mount `AdminDashboardPage`, whose queries are gated on `enabled:
 *      isAdmin` — which is derived from the AppUser that step 2 produces.
 *
 * So the dashboard's first byte of data could not be requested until the
 * profile round trip had finished, even though the two have nothing to do with
 * one another. That serial chain is why a fresh login felt so much slower than
 * navigating back to the dashboard in an already-open tab.
 *
 * Step 3's data no longer waits for step 2: the moment the session is known,
 * the fetches go out alongside profile hydration. The queries mount afterwards
 * against the same keys, so React Query serves them from cache or attaches to
 * the in-flight request.
 *
 * TWO RULES THIS FILE MUST KEEP — BOTH ABOUT THE AUTH LOCK
 * --------------------------------------------------------
 * auth-js holds its storage-key lock for the ENTIRE duration of every
 * `onAuthStateChange` subscriber callback. `_emitInitialSession` is dispatched
 * inside `_acquireLock`, and that lock's drain loop waits on the emit before
 * releasing, so `lockAcquired` stays true for as long as any subscriber — this
 * one, and `AuthContext` running `loadUserProfile` — is still working. Two
 * consequences, and neither is theoretical:
 *
 * 1. **The callback must not await the prefetch.** `supabase.auth.getSession()`
 *    re-entering the held lock queues behind the pending emit, and that emit is
 *    itself awaiting this callback. Awaiting here closes the cycle: the
 *    requests never settle, the callback never returns, and the auth lock is
 *    never released — a far worse login than the one this file exists to fix.
 *    So the callback returns synchronously and the prefetch runs detached.
 *
 * 2. **The prefetch must not ask for the session.** Even detached, a
 *    `getSession()` during hydration queues behind `AuthContext`'s callback —
 *    which is precisely the work this is meant to overlap with, so the
 *    optimisation would quietly become a no-op. The auth event already carries
 *    an access token; `prefetchDashboardData` requires it and sends it
 *    directly, so these three requests touch no auth code at all.
 *
 * `AGENTS.md` § "Auth hydration (do not regress — 2026-05 incident)" records
 * the production incident behind the same lock: a second bootstrapping
 * `getSession()` path caused long timeouts and spurious sign-outs. The
 * invariant there — hydrate only from `onAuthStateChange`, and do not add
 * another `getSession()` path — is why this reads the token off the event
 * instead of asking for one.
 *
 * WHY THIS IS NOT AN AUTHORISATION DECISION
 * -----------------------------------------
 * The role here comes from session metadata, which is a hint, not a grant: it
 * decides only whether it is worth spending three requests before the real
 * profile arrives. Every endpoint behind them is `requireAdmin` on the server,
 * and nothing is rendered from a prefetch that the real queries would not have
 * fetched anyway.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChange } from '../../utils/auth';
import { buildAppUserFromAuthSessionFallback } from '../../utils/auth/profileService';
import { logger } from '../../utils/logger';

/**
 * True when this page load is heading for the admin dashboard itself.
 *
 * `/admin` renders whichever module `?module=` names, defaulting to the
 * dashboard. Prefetching for `?module=clients` would spend a request on the
 * heaviest route in the app for a page that never reads it.
 */
function isHeadingForAdminDashboard(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search } = window.location;
  if (pathname !== '/admin') return false;
  const activeModule = new URLSearchParams(search).get('module');
  return !activeModule || activeModule === 'dashboard';
}

export function AdminDataPrefetch() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isHeadingForAdminDashboard()) return;

    let done = false;

    // NOT async, and nothing here is awaited — see rule 1 in the header.
    const subscription = onAuthStateChange((authUser, { supabaseUser, accessToken }) => {
      if (done || !authUser || !supabaseUser || !accessToken) return;

      // Same session-metadata reading the auth fallback uses, so the optimistic
      // role and the eventual real one are derived by one piece of code.
      const { role } = buildAppUserFromAuthSessionFallback(
        authUser.id,
        authUser.email,
        supabaseUser,
      );
      if (role !== 'admin' && role !== 'super_admin') return;

      done = true;

      // Detached, and on a later task than the auth callback, so the auth
      // pipeline finishes its turn before any of this runs.
      setTimeout(() => {
        // Dynamic so the dashboard module stays out of the initial bundle. It
        // is the same specifier AdminDashboardPage lazy-loads, so this also
        // starts that chunk downloading while the profile is still hydrating.
        void import('../admin/modules/dashboard')
          .then(({ prefetchDashboardData }) => prefetchDashboardData(queryClient, accessToken))
          .catch((error) => {
            // Best effort only — the real queries will fetch and report normally.
            logger.debug('Admin dashboard prefetch skipped', { error });
          });
      }, 0);
    });

    return () => {
      done = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return null;
}
