/**
 * Tests for ErrorBoundary's chunk-load auto-recovery.
 *
 * When a lazily-loaded chunk that wasn't wrapped in lazyWithRetry fails (e.g. a
 * nested admin module tab, or any plain React.lazy), the boundary should reload
 * once to fetch the fresh chunk and show the loader — not the scary error card.
 */
import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const reloadOnce = vi.fn(() => true);
vi.mock('../../../utils/chunkLoad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../utils/chunkLoad')>();
  return { ...actual, reloadOnceForChunkLoadFailure: () => reloadOnce() };
});

import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ message }: { message: string }): ReactElement {
  throw new Error(message);
}

describe('ErrorBoundary chunk-load recovery', () => {
  beforeEach(() => {
    reloadOnce.mockClear();
    reloadOnce.mockReturnValue(true);
    // Silence React's expected error-boundary console noise for these tests.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('reloads once and shows the loader (not the error card) on a chunk-load error', () => {
    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/x.js" />
      </ErrorBoundary>,
    );

    expect(reloadOnce).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Updating to the latest version/i)).toBeTruthy();
    expect(screen.queryByText(/Error Detected/i)).toBeNull();
  });

  it('shows the error card when the reload is throttled', () => {
    reloadOnce.mockReturnValue(false);

    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/x.js" />
      </ErrorBoundary>,
    );

    expect(reloadOnce).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Error Detected/i)).toBeTruthy();
    expect(screen.queryByText(/Updating to the latest version/i)).toBeNull();
  });

  it('does not reload on a normal (non-chunk) render error and shows the error card', () => {
    render(
      <ErrorBoundary>
        <Boom message="Cannot read properties of undefined" />
      </ErrorBoundary>,
    );

    expect(reloadOnce).not.toHaveBeenCalled();
    expect(screen.getByText(/Error Detected/i)).toBeTruthy();
  });
});
