/* eslint-disable react-refresh/only-export-components */
/**
 * Shared test utilities for the SPA suite (Phase 4).
 *
 * Re-exports everything from React Testing Library and adds helpers that wrap
 * the providers component tests repeatedly need, so individual tests stop
 * re-implementing the boilerplate. Import from `@/test/utils` instead of
 * `@testing-library/react` to get both.
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export * from '@testing-library/react';

/** A QueryClient with retries off so failed queries fail fast and deterministically. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Render a component wrapped in a fresh QueryClientProvider. Use for components
 * that call react-query hooks (e.g. ClientOverviewTab). Returns the RTL result
 * plus the `queryClient` so a test can seed or inspect the cache.
 */
export function renderWithQueryClient(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = makeTestQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
