/**
 * Tests for lazyWithRetry — the retrying replacement for React.lazy used by
 * every route. Verifies that a transient chunk-load failure recovers in place
 * (no error surfaced) and that a non-chunk error is surfaced immediately.
 */
import React, { Suspense } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const reloadOnce = vi.fn(() => true);
vi.mock('../chunkLoad', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../chunkLoad')>();
  return { ...actual, reloadOnceForChunkLoadFailure: () => reloadOnce() };
});

import { lazyWithRetry } from '../lazyWithRetry';

function Ok() {
  return <div>loaded-ok</div>;
}

class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <div>boundary:{this.state.error.message}</div>;
    return this.props.children;
  }
}

function renderLazy(Comp: React.LazyExoticComponent<React.ComponentType>) {
  return render(
    <Boundary>
      <Suspense fallback={<div>loading</div>}>
        <Comp />
      </Suspense>
    </Boundary>,
  );
}

describe('lazyWithRetry', () => {
  beforeEach(() => reloadOnce.mockClear());
  afterEach(() => vi.restoreAllMocks());

  it('renders normally when the import succeeds first time', async () => {
    const Comp = lazyWithRetry(() => Promise.resolve({ default: Ok }), { baseDelayMs: 1 });
    renderLazy(Comp);
    await screen.findByText('loaded-ok');
    expect(reloadOnce).not.toHaveBeenCalled();
  });

  it('retries a transient chunk-load failure and then succeeds (no error, no reload)', async () => {
    let calls = 0;
    const Comp = lazyWithRetry(
      () => {
        calls += 1;
        if (calls === 1) {
          return Promise.reject(
            new Error('Failed to fetch dynamically imported module: /assets/x.js'),
          );
        }
        return Promise.resolve({ default: Ok });
      },
      { retries: 3, baseDelayMs: 1 },
    );

    renderLazy(Comp);
    await screen.findByText('loaded-ok');
    expect(calls).toBe(2);
    expect(reloadOnce).not.toHaveBeenCalled();
  });

  it('reloads once after exhausting retries on a persistent chunk-load failure', async () => {
    const Comp = lazyWithRetry(
      () => Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/x.js')),
      { retries: 2, baseDelayMs: 1 },
    );

    renderLazy(Comp);
    await waitFor(() => expect(reloadOnce).toHaveBeenCalledTimes(1));
    // While the reload is "in flight" the promise stays pending → loader, not error.
    expect(screen.queryByText(/^boundary:/)).toBeNull();
  });

  it('surfaces a non-chunk error immediately without retrying', async () => {
    let calls = 0;
    const Comp = lazyWithRetry(
      () => {
        calls += 1;
        return Promise.reject(new Error('genuine bug in module'));
      },
      { retries: 3, baseDelayMs: 1 },
    );

    renderLazy(Comp);
    await screen.findByText('boundary:genuine bug in module');
    expect(calls).toBe(1);
    expect(reloadOnce).not.toHaveBeenCalled();
  });
});
