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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const downloadPdf = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../ClientOverviewTab', async () => {
  const { useEffect } = await import('react');
  return {
    ClientOverviewTab: ({
      client,
      onRegisterActions,
    }: {
      client: { firstName: string; lastName: string };
      onRegisterActions?: (a: unknown) => void;
    }) => {
      useEffect(() => {
        onRegisterActions?.({ refresh: vi.fn(), downloadPdf, generatingPdf: false });
        return () => onRegisterActions?.(null);
      }, [onRegisterActions]);
      return (
        <div>
          Overview of {client.firstName} {client.lastName}
        </div>
      );
    },
  };
});
vi.mock('../KeyInspectorTab', () => ({ KeyInspectorTab: () => <div>client keys</div> }));
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

import { MemoryRouter, useLocation } from 'react-router';
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
        <MemoryRouter initialEntries={['/admin?module=clients&client=c-aaron']}>
          <ClientDrawer client={STALE_ROW} open onOpenChange={() => {}} />
        </MemoryRouter>
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
        throw new APIError('Client not found', 404, 'CLIENT_NOT_FOUND');
      }
      return respond(url);
    });

    render(
      <QueryClientProvider client={makeTestQueryClient()}>
        <MemoryRouter initialEntries={['/admin?module=clients&client=c-aaron']}>
          <ClientDrawer client={STALE_ROW} open onOpenChange={() => {}} />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('This client could not be opened')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to clients' })).toBeTruthy();
    expect(screen.queryByText(/Oldname/)).toBeNull();
  });
});

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderPage(url = '/admin?module=clients&client=c-aaron', onOpenChange = vi.fn()) {
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <ClientDrawer client={STALE_ROW} open onOpenChange={onOpenChange} />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Client page', () => {
  it('shows the name with status pills and the client ID', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Aaron Teng' });
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('In application')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy client ID c-aaron/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
  });

  it('keeps the open tab in the address and opens on it', async () => {
    renderPage('/admin?module=clients&client=c-aaron&ctab=security');
    await screen.findByRole('heading', { level: 1, name: 'Aaron Teng' });
    expect(screen.getByRole('tab', { name: 'Security' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Notes' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toContain('ctab=notes'));
  });

  it('drops the tab from the address when the client closes', async () => {
    const onOpenChange = vi.fn();
    renderPage('/admin?module=clients&client=c-aaron&ctab=notes', onOpenChange);
    await screen.findByRole('heading', { level: 1, name: 'Aaron Teng' });
    fireEvent.click(screen.getByRole('button', { name: 'Personal clients' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=clients&client=c-aaron'),
    );
  });

  it('Download PDF from another tab opens the Overview and builds the PDF', async () => {
    downloadPdf.mockClear();
    renderPage('/admin?module=clients&client=c-aaron&ctab=notes');
    await screen.findByRole('heading', { level: 1, name: 'Aaron Teng' });
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
    await screen.findByText('Overview of Aaron Teng');
    await waitFor(() => expect(downloadPdf).toHaveBeenCalledTimes(1));
  });

  it('opens the key inspector from the ⋯ menu', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Aaron Teng' });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'More actions' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Key inspector' }));
    expect(await screen.findByText('client keys')).toBeTruthy();
  });
});
