import React, { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthContext';
import { Toaster } from '../ui/sonner';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { PerformanceOptimizer } from '../shared/PerformanceOptimizer';
import { InactivityManager } from '../auth/InactivityManager';
import { ScrollToTop } from '../shared/ScrollToTop';
import { ImageOptimization } from '../shared/ImageOptimization';
import { UnsavedChangesRegistryProvider } from '../shared/unsaved-changes';
import { createClient } from '../../utils/supabase/client';
import { createAppRouter } from '../../router/createAppRouter';
import { AppRoutes } from '../../AppRoutes';
import { logger } from '../../utils/logger';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes — evict inactive query data to free memory
      retry: (failureCount, error) => {
        if (error instanceof Error && 'statusCode' in error) {
          const status = (error as any).statusCode;
          // 403 is a genuine authorization denial — never retry.
          if (status === 403) return false;
          // 401 means the session token wasn't accepted. The API client + global
          // cache handler refresh the session in the background; retry a couple
          // of times (with a short delay) so the query stays in its loading state
          // and silently resolves once the fresh token lands — instead of
          // flashing an error card that "fixes itself".
          if (status === 401) return failureCount < 2;
        }
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 2000),
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
  return (
    <>
      <PerformanceOptimizer />
      <ImageOptimization />
      <InactivityManager />
      <ScrollToTop />
      <UnsavedChangesRegistryProvider>
        <ErrorBoundary fallbackTitle="Navigation Error">{children}</ErrorBoundary>
      </UnsavedChangesRegistryProvider>
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
        <ErrorBoundary fallbackTitle="Authentication Error">
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
