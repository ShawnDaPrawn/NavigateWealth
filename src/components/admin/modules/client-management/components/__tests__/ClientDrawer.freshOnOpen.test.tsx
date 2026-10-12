/**
 * The client profile drawer shows nothing about a client until it has that
 * client's record fresh from the server for this open (owner's rule,
 * 2026-10-12: "I need to be sure I never open up a client profile on
 * old/outdated info").
 *
 * The drawer is opened from a client-list row and a cached profile that both
 * hold an OLD surname. The old surname must never reach the screen, not even
 * for the first frame; the drawer says it is loading, then shows the current
 * one. The tabs are stubbed: what they load is covered by
 * useFreshClientOnOpen.test.tsx, which resets every cached copy before they
 * mount.
 */
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
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

vi.mock('../../../communication', () => ({
  communicationApi: { getClientLogs: vi.fn(async () => []) },
}));
vi.mock('../../../notes', () => ({
  NotesAPI: { getClientNotes: vi.fn(async () => []) },
  NOTES_STALE_TIME: 0,
}));
vi.mock('../../../esign', () => ({
  esignApi: { getClientEnvelopes: vi.fn(async () => ({ envelopes: [] })) },
  esignKeys: { clientEnvelopes: (id: string) => ['esign', 'client', id] },
  QUERY_GC_TIME: 0,
  QUERY_STALE_TIME: 0,
}));
vi.mock('../ClientAvatar', () => ({ ClientAvatar: () => null }));
vi.mock('../AskVascoPortalTab', () => ({ AskVascoPortalTab: () => null }));
vi.mock('../ClientOverviewTab', () => ({
  ClientOverviewTab: ({ client }: { client: { firstName: string; lastName: string } }) => (
    <div>
      Overview of {client.firstName} {client.lastName}
    </div>
  ),
}));
const Empty = () => null;
vi.mock('../clientProfile/ClientProfileViewerFull', () => ({ ClientProfileViewerFull: Empty }));
vi.mock('../../../../profile-sections/PolicyDetailsSection', () => ({
  PolicyDetailsSection: Empty,
}));
vi.mock('../DocumentsTab', () => ({ DocumentsTab: Empty }));
vi.mock('../SecurityTab', () => ({ SecurityTab: Empty }));
vi.mock('../ComplianceTab', () => ({ ComplianceTab: Empty }));
vi.mock('../CommunicationTab', () => ({ CommunicationTab: Empty }));
vi.mock('../EsignTab', () => ({ EsignTab: Empty }));
vi.mock('../ClientNotesTab', () => ({ ClientNotesTab: Empty }));

import { ClientDrawer } from '../ClientDrawer';
import { clientKeys } from '@/utils/queryKeys';
import type { Client } from '../../types';

const ID = 'c-aaron';
const STALE_ROW = {
  id: ID,
  firstName: 'Aaron',
  lastName: 'Oldname',
  preferredName: 'Aaron',
  email: 'aaron@example.com',
} as Client;

function respond(url: string) {
  if (url === `profile/client-record/${ID}`) {
    return Promise.resolve({
      success: true,
      user: {
        id: ID,
        email: 'aaron@example.com',
        created_at: '2026-01-02T00:00:00.000Z',
        profile: { firstName: 'Aaron', lastName: 'Teng' },
      },
    });
  }
  if (url.startsWith('profile/personal-info')) {
    return Promise.resolve({ success: true, data: { firstName: 'Aaron', lastName: 'Teng' } });
  }
  if (url.startsWith('/integrations/policies')) return Promise.resolve({ policies: [] });
  if (url.startsWith('/fna/batch-status/client/'))
    return Promise.resolve({ success: true, data: [] });
  return Promise.reject(new Error(`unexpected request ${url}`));
}

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation(respond);
});

describe('ClientDrawer opens on fresh data only', () => {
  it('never shows the list row or a cached copy, and shows the current record', async () => {
    const queryClient = makeTestQueryClient();
    queryClient.setQueryData(clientKeys.profile(ID), { firstName: 'Aaron', lastName: 'Oldname' });
    queryClient.setQueryData(clientKeys.detail(ID), STALE_ROW);

    render(
      <QueryClientProvider client={queryClient}>
        <ClientDrawer client={STALE_ROW} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    // First frame: loading, and nothing of the client at all.
    expect(screen.getByText('Opening client profile')).toBeTruthy();
    expect(screen.queryByText(/Oldname/)).toBeNull();

    // Then the current record, in the header and in the tab.
    expect(await screen.findByText('Overview of Aaron Teng')).toBeTruthy();
    expect(screen.getAllByText(/Aaron Teng/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Oldname/)).toBeNull();
  });

  it('says so, and shows no client data, when the client is no longer listed', async () => {
    mockGet.mockImplementation(async (url: string) => {
      if (url === `profile/client-record/${ID}`) {
        const { APIError } = await import('@/utils/api/client');
        throw new APIError('Not found', 404);
      }
      return respond(url);
    });

    render(
      <QueryClientProvider client={makeTestQueryClient()}>
        <ClientDrawer client={STALE_ROW} open onOpenChange={() => {}} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Client not available')).toBeTruthy();
    expect(screen.queryByText(/Oldname/)).toBeNull();
  });
});
