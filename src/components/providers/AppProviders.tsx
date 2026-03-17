import React from 'react';
import { BrowserRouter as Router } from 'react-router';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { AuthProvider } from '../auth/AuthContext';
import { Toaster } from '../ui/sonner';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { PerformanceOptimizer } from '../shared/PerformanceOptimizer';
import { InactivityManager } from '../auth/InactivityManager';
import { ScrollToTop } from '../shared/ScrollToTop';
import { ImageOptimization } from '../shared/ImageOptimization';
import { createClient } from '../../utils/supabase/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes — evict inactive query data to free memory
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
    onError: (error: unknown, query) => {
      // When a 401 reaches the global cache handler, the session is truly
      // invalid (the API client already tried refreshing). Attempt one
      // last proactive refresh — if it succeeds, invalidate all queries
      // so they re-fetch with the new token.
      if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 401) {
        console.error('React Query 401 — attempting global session recovery:', error);
        const supabase = createClient();
        supabase.auth.refreshSession().then(({ data: { session }, error: refreshError }) => {
          if (session && !refreshError) {
            console.log('Global session recovery succeeded — invalidating queries');
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallbackTitle="Application Error" showDetails={true}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary fallbackTitle="Authentication Error">
          <AuthProvider>
            <Router>
              <PerformanceOptimizer />
              <ImageOptimization />
              <InactivityManager />
              <ScrollToTop />
              <ErrorBoundary fallbackTitle="Navigation Error">
                {children}
              </ErrorBoundary>
              <Toaster position="top-right" richColors />
            </Router>
          </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}