import React, { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../components/auth/AuthContext';
import { AdminDataPrefetch } from '../components/providers/AdminDataPrefetch';
import { QueryCachePersistence } from '../components/providers/QueryCachePersistence';
import { Toaster } from '../components/ui/sonner';
import { ErrorBoundary } from '../components/shared/ErrorBoundary';
import { OfflineScreen } from '../components/shared/OfflineScreen';
import { InactivityManager } from '../components/auth/InactivityManager';
import { ScrollToTop } from '../components/shared/ScrollToTop';
import { ImageOptimization } from '../components/shared/ImageOptimization';
import { UnsavedChangesRegistryProvider } from '../components/shared/unsaved-changes';
import { createClient } from '../utils/supabase/client';
import { createAppRouter } from './router/createAppRouter';
import { AppRoutes } from './AppRoutes';
import { logger } from '../utils/logger';
import { MAX_AGE_MS } from '../utils/query/persistedQueryCache';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      // Keep data for the working day rather than 5 minutes, so returning to a
      // module shows its last copy at once while it refreshes. It must also be
      // at least the persisted cache's MAX_AGE_MS: a query evicted from memory
      // is dropped from the next save too (see utils/query/persistedQueryCache).
      gcTime: MAX_AGE_MS,
      retry: (failureCount, error) => {
        // Never retry 401/403 auth errors — the API client already attempted
        // a session refresh. Retrying wastes network calls and delays the
        // user seeing a meaningful error or being redirected to login.
        if (error instanceof Error && 'statusCode' in error) {
          const status = (error as any).statusCode;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (error: unknown, _query) => {
      // When a 401 reaches the global cache handler, the session is truly
      // invalid (the API client already tried refreshing). Attempt one
      // last proactive refresh — if it succeeds, invalidate all queries
      // so they re-fetch with the new token.
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 401) {
        console.error('React Query 401 — attempting global session recovery:', error);
        const supabase = createClient();
        supabase.auth.refreshSession().then(({ data: { session }, error: refreshError }) => {
          if (session && !refreshError) {
            logger.info('Global session recovery succeeded — invalidating queries');
            queryClient.invalidateQueries();
          } else {
            // "Auth session missing!" is expected when no user is logged in —
            // don't log it as a recovery failure.
            const isExpected = refreshError?.message?.includes('Auth session missing');
            if (!isExpected) {
              console.error('Global session recovery failed — user may need to re-login');
            }
          }
        });
        return;
      }
      console.error('React Query error:', error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      console.error('React Query mutation error:', error);
    },
  }),
});

function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <ImageOptimization />
      <InactivityManager />
      <ScrollToTop />
      <UnsavedChangesRegistryProvider>
        <ErrorBoundary fallbackTitle="Navigation Error">{children}</ErrorBoundary>
      </UnsavedChangesRegistryProvider>
      {/* Here, outside the routes' Suspense and error boundaries, so it still
          covers a page whose chunk is loading or failed to load. Signed-in
          only: everything behind a sign-in is server-backed. */}
      <OfflineScreen enabled={isAuthenticated} />
      <Toaster position="top-right" richColors />
    </>
  );
}

export function AppProviders() {
  const router = useMemo(
    () =>
      createAppRouter(
        <AppShell>
          <AppRoutes />
        </AppShell>,
      ),
    [],
  );

  return (
    <ErrorBoundary fallbackTitle="Application Error" showDetails={true}>
      <QueryClientProvider client={queryClient}>
        {/* Starts the admin dashboard's fetches alongside profile hydration
            instead of after it. Renders nothing; see AdminDataPrefetch. */}
        <AdminDataPrefetch />
        {/* Restores a staff user's saved query cache as soon as the session is
            known, and wipes it on sign-out. Renders nothing. */}
        <QueryCachePersistence />
        <ErrorBoundary fallbackTitle="Authentication Error">
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
