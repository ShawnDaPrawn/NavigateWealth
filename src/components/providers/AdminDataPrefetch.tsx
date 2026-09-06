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
 * WHY THE SESSION EVENT AND NOT `getSession()`
 * --------------------------------------------
 * `AuthContext` documents that a parallel `getSession()` bootstrap "contended
 * with auth and produced 30s timeouts", and it was removed for that reason.
 * This subscribes to the same `onAuthStateChange` pipeline instead and reads
 * the session off the event, so it adds no call of its own and cannot race the
 * client's initialisation — `INITIAL_SESSION` fires once that has finished.
 *
 * WHY THIS IS NOT AN AUTHORISATION DECISION
 * -----------------------------------------
 * The role here comes from session metadata, which is a hint, not a grant:
 * it decides only whether it is worth spending three requests before the real
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

    const subscription = onAuthStateChange(async (authUser, { supabaseUser }) => {
      if (done || !authUser || !supabaseUser) return;

      // Same session-metadata reading the auth fallback uses, so the optimistic
      // role and the eventual real one are derived by one piece of code.
      const { role } = buildAppUserFromAuthSessionFallback(
        authUser.id,
        authUser.email,
        supabaseUser,
      );
      if (role !== 'admin' && role !== 'super_admin') return;

      done = true;
      try {
        // Dynamic so the dashboard module stays out of the initial bundle. It
        // is the same specifier AdminDashboardPage lazy-loads, so this also
        // starts that chunk downloading while the profile is still hydrating.
        const { prefetchDashboardData } = await import('../admin/modules/dashboard');
        await prefetchDashboardData(queryClient);
      } catch (error) {
        // Best effort only — the real queries will fetch and report normally.
        logger.debug('Admin dashboard prefetch skipped', { error });
      }
    });

    return () => {
      done = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return null;
}
