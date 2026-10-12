/**
 * An open client profile never shows old data (owner's rule, 2026-10-12).
 *
 * Pinned here:
 *   - opening a profile forgets every cached copy of that client's data (the
 *     in-memory cache and anything the persisted cache restored), and nothing
 *     else's;
 *   - the profile is ready only with the record fetched by THIS open, never a
 *     cached record and never the list row, even one fetched a second ago;
 *   - a client no longer listed reads as missing, a failed load as an error
 *     with a retry, and neither falls back to an older copy;
 *   - the list row behind the profile is brought up to date with the record.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestQueryClient } from '@/test/utils';

const mockGet = vi.fn();
vi.mock('@/utils/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api/client')>();
  return {
    ...actual,
    api: { get: (...args: unknown[]) => mockGet(...args), post: vi.fn(), put: vi.fn() },
  };
});

import { APIError } from '@/utils/api/client';
import { clientKeys, clientPolicyKeys, fnaKeys, noteKeys } from '@/utils/queryKeys';
import { queryKeyMentions, useFreshClientOnOpen } from '../useFreshClientOnOpen';
import type { Client } from '../../types';

const ID = 'c-aaron';

let surname = 'Teng';
let recordStatus: 'ok' | 'missing' | 'down' = 'ok';

function respond(url: string) {
  if (url === `profile/client-record/${ID}`) {
    if (recordStatus === 'missing') return Promise.reject(new APIError('Not found', 404));
    if (recordStatus === 'down') return Promise.reject(new APIError('Unavailable', 503));
    return Promise.resolve({
      success: true,
      user: {
        id: ID,
        email: 'aaron@example.com',
        created_at: '2026-01-02T00:00:00.000Z',
        profile: { firstName: 'Aaron', lastName: surname },
        application_status: 'approved',
      },
    });
  }
  if (url.startsWith('profile/personal-info')) {
    return Promise.resolve({ success: true, data: { firstName: 'Aaron', lastName: surname } });
  }
  if (url.startsWith('/integrations/policies')) return Promise.resolve({ policies: [] });
  if (url.startsWith('/fna/batch-status/client/'))
    return Promise.resolve({ success: true, data: [] });
  return Promise.reject(new Error(`unexpected request ${url}`));
}

function setup(queryClient: QueryClient, initiallyOpen = true) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(({ open }: { open: boolean }) => useFreshClientOnOpen(ID, open), {
    wrapper,
    initialProps: { open: initiallyOpen },
  });
}

const OLD = Date.now() - 60_000;
const listRow = (lastName: string) => ({ id: ID, firstName: 'Aaron', lastName }) as Client;
const recordRequests = () =>
  mockGet.mock.calls.filter(([url]) => url === `profile/client-record/${ID}`);

beforeEach(() => {
  surname = 'Teng';
  recordStatus = 'ok';
  mockGet.mockReset();
  mockGet.mockImplementation(respond);
});

describe('queryKeyMentions', () => {
  it('finds the client id anywhere in a key, nested arrays and objects included', () => {
    expect(queryKeyMentions(['clients', 'profile', ID], ID)).toBe(true);
    expect(queryKeyMentions(['client-policies', ID, { archived: false }], ID)).toBe(true);
    expect(queryKeyMentions(['x', { filter: { clientId: ID } }], ID)).toBe(true);
  });

  it('never matches a different client, or a key that merely contains the id as text', () => {
    expect(queryKeyMentions(['clients', 'profile', 'c-other'], ID)).toBe(false);
    expect(queryKeyMentions(['search', `name:${ID}`], ID)).toBe(false);
    expect(queryKeyMentions(['clients', 'list'], ID)).toBe(false);
  });
});

describe('useFreshClientOnOpen', () => {
  it('forgets every cached copy of this client on open, and no one else', () => {
    const queryClient = makeTestQueryClient();
    const seed = (key: readonly unknown[], data: unknown) =>
      queryClient.setQueryData(key, data, { updatedAt: OLD });
    seed(clientKeys.profile(ID), { lastName: 'Old' });
    seed(clientKeys.avatar(ID), 'old-url');
    seed(noteKeys.clientNotes(ID), ['old note']);
    seed(fnaKeys.latestPublished(ID), { old: true });
    seed(clientKeys.profile('c-other'), { lastName: 'Other' });
    seed(clientKeys.lists(), [listRow('Old')]);

    setup(queryClient);

    // Nothing of Aaron's that was cached before the open is still there. The
    // profile was refetched on open, so it is either loading or fresh.
    expect(queryClient.getQueryData(clientKeys.avatar(ID))).toBeUndefined();
    expect(queryClient.getQueryData(noteKeys.clientNotes(ID))).toBeUndefined();
    expect(queryClient.getQueryData(fnaKeys.latestPublished(ID))).toBeUndefined();
    expect(queryClient.getQueryData(clientKeys.profile(ID))).not.toEqual({ lastName: 'Old' });
    // Other clients' data and the list itself are untouched.
    expect(queryClient.getQueryData(clientKeys.profile('c-other'))).toEqual({
      lastName: 'Other',
    });
    expect(queryClient.getQueryData(clientKeys.lists())).toHaveLength(1);
  });

  it('is ready only with the record fetched by this open, never a cached one', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientKeys.detail(ID), listRow('Cached'), { updatedAt: OLD });

    const { result } = setup(queryClient);
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ client: { lastName: 'Teng' } });
  });

  it('starts the Overview reads with the record, not after it', () => {
    setup(makeTestQueryClient());
    const urls = mockGet.mock.calls.map(([url]) => String(url));
    expect(urls).toContain(`profile/client-record/${ID}`);
    expect(urls.some((url) => url.startsWith('profile/personal-info'))).toBe(true);
    expect(urls).toContain(`/integrations/policies?clientId=${ID}`);
    expect(urls).toContain(`/fna/batch-status/client/${ID}`);
  });

  it('fetches again on every open, even one a moment after the last', async () => {
    const queryClient = makeTestQueryClient();
    const { result, rerender } = setup(queryClient);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(recordRequests()).toHaveLength(1);

    rerender({ open: false });
    surname = 'Teng-Smith';
    rerender({ open: true });

    // The record from the first open is not good enough for the second.
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ client: { lastName: 'Teng-Smith' } });
    expect(recordRequests()).toHaveLength(2);
  });

  it('brings the list row behind the profile up to date', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientKeys.lists(), [listRow('Old')], { updatedAt: OLD });

    const { result } = setup(queryClient);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    await waitFor(() =>
      expect(queryClient.getQueryData<Client[]>(clientKeys.lists())?.[0]?.lastName).toBe('Teng'),
    );
    // The list keeps its own refresh schedule.
    expect(queryClient.getQueryState(clientKeys.lists())?.dataUpdatedAt).toBe(OLD);
  });

  it('reads as missing when Client Management no longer lists the client', async () => {
    recordStatus = 'missing';
    const { result } = setup(makeTestQueryClient());
    await waitFor(() => expect(result.current.status).toBe('missing'));
  });

  it('shows an error and a retry, never an older copy, when the load fails', async () => {
    recordStatus = 'down';
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientKeys.detail(ID), listRow('Cached'), { updatedAt: OLD });

    const { result } = setup(queryClient);
    await waitFor(() => expect(result.current.status).toBe('error'));

    recordStatus = 'ok';
    act(() => {
      if (result.current.status === 'error') result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ client: { lastName: 'Teng' } });
  });

  it('fetches nothing while closed', () => {
    setup(makeTestQueryClient(), false);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('keeps policies keyed to this client in the reset', () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientPolicyKeys.list(ID, true), [{ id: 'archived-old' }], {
      updatedAt: OLD,
    });
    setup(queryClient);
    expect(queryClient.getQueryData(clientPolicyKeys.list(ID, true))).toBeUndefined();
  });
});
