/**
 * QueryCachePersistence — who gets a saved cache, and when it is wiped.
 *
 * The persister's own behaviour (restore, freshness, deletion) is pinned in
 * `utils/query/__tests__/persistedQueryCache.test.ts`. This file pins the
 * wiring: staff sessions persist, client sessions do not, any sign-out wipes,
 * a public visitor's first "no session" event wipes nothing, and the auth
 * callback itself does no work (see the auth-lock rules in the header).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '../../../test/utils';

const mockUnsubscribe = vi.fn();
const persister = { start: vi.fn(), signOut: vi.fn(), flush: vi.fn(), userId: null };
let authCallback: ((authUser: unknown, meta: unknown) => unknown) | null = null;

vi.mock('../../../utils/auth', () => ({
  onAuthStateChange: (cb: (authUser: unknown, meta: unknown) => unknown) => {
    authCallback = cb;
    return { unsubscribe: mockUnsubscribe };
  },
}));

vi.mock('../../../utils/query/persistedQueryCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/query/persistedQueryCache')>()),
  createQueryCachePersister: () => persister,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { QueryCachePersistence } from '../QueryCachePersistence';

const ADMIN = { id: 'admin-1', email: 'admin@navigatewealth.co' };
const ADMIN_SESSION_USER = { id: 'admin-1', user_metadata: { role: 'admin' }, app_metadata: {} };
const CLIENT = { id: 'client-1', email: 'client@example.com' };
const CLIENT_SESSION_USER = { id: 'client-1', user_metadata: { role: 'client' }, app_metadata: {} };

function mount() {
  return render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <QueryCachePersistence />
    </QueryClientProvider>,
  );
}

async function emit(authUser: unknown, meta: Record<string, unknown>) {
  const result = authCallback?.(authUser, meta);
  await act(async () => {
    vi.runAllTimers();
  });
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  authCallback = null;
  persister.start.mockReset();
  persister.signOut.mockReset();
  persister.flush.mockReset();
  mockUnsubscribe.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('QueryCachePersistence', () => {
  it('restores and saves for a staff session', async () => {
    mount();
    await emit(ADMIN, { event: 'INITIAL_SESSION', supabaseUser: ADMIN_SESSION_USER });
    expect(persister.start).toHaveBeenCalledWith('admin-1');
  });

  it('keeps nothing on the device for a client session', async () => {
    mount();
    await emit(CLIENT, { event: 'INITIAL_SESSION', supabaseUser: CLIENT_SESSION_USER });
    expect(persister.start).not.toHaveBeenCalled();
    expect(persister.signOut).not.toHaveBeenCalled();
  });

  it('wipes on sign-out', async () => {
    mount();
    await emit(ADMIN, { event: 'SIGNED_IN', supabaseUser: ADMIN_SESSION_USER });
    await emit(null, { event: 'SIGNED_OUT' });
    expect(persister.signOut).toHaveBeenCalledTimes(1);
  });

  it("wipes a client's data from memory on sign-out too", async () => {
    mount();
    await emit(CLIENT, { event: 'SIGNED_IN', supabaseUser: CLIENT_SESSION_USER });
    await emit(null, { event: 'SIGNED_OUT' });
    expect(persister.signOut).toHaveBeenCalledTimes(1);
  });

  it('wipes when a different, non-staff user takes over the tab', async () => {
    mount();
    await emit(ADMIN, { event: 'SIGNED_IN', supabaseUser: ADMIN_SESSION_USER });
    await emit(CLIENT, { event: 'SIGNED_IN', supabaseUser: CLIENT_SESSION_USER });
    expect(persister.signOut).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a public visitor's first no-session event", async () => {
    mount();
    await emit(null, { event: 'INITIAL_SESSION' });
    expect(persister.signOut).not.toHaveBeenCalled();
    expect(persister.start).not.toHaveBeenCalled();
  });

  it('does no work inside the auth callback itself', () => {
    mount();
    const returned = authCallback?.(ADMIN, {
      event: 'INITIAL_SESSION',
      supabaseUser: ADMIN_SESSION_USER,
    });
    expect(returned).toBeUndefined(); // not a promise: nothing for auth-js to wait on
    expect(persister.start).not.toHaveBeenCalled();
  });

  it('saves immediately when the tab is hidden or closed', () => {
    mount();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    expect(persister.flush).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = mount();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
