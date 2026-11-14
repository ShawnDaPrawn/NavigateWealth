import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, renderWithQueryClient, screen, waitFor } from '@/test/utils';
import { MemoryRouter, useLocation } from 'react-router';
import type { Client } from '../../types';

const logs = vi.hoisted(() => ({ fail: false }));
vi.mock('../../../communication', () => ({
  communicationApi: {
    getClientLogs: vi.fn(async () => {
      if (logs.fail) throw new Error('400 Bad Request');
      return [
        {
          id: 'm1',
          subject: 'Welcome to Navigate Wealth',
          category: 'General',
          created_at: '2026-04-14T11:02:00Z',
          read: true,
          sent_via_email: true,
        },
      ];
    }),
  },
}));
vi.mock('../communication/ComposeForm', () => ({
  ComposeForm: (props: { onViewHistory: () => void }) => (
    <div>
      compose form
      <button onClick={props.onViewHistory}>View history</button>
    </div>
  ),
}));
vi.mock('../communication/HistoryDialog', () => ({
  HistoryDialog: (props: { inline?: boolean; communications: unknown[] }) => (
    <div>
      history {props.inline ? 'inline' : 'dialog'} · {props.communications.length}
    </div>
  ),
}));

import { CommunicationTab } from '../CommunicationTab';

afterEach(() => cleanup());

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}

const client = { id: 'c1', firstName: 'Elsa', lastName: 'van Wyk', email: 'e@x.co' } as Client;

function renderTab(url = '/') {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[url]}>
      <CommunicationTab client={client} />
      <Location />
    </MemoryRouter>,
  );
}

describe('Client communication tab', () => {
  it('opens on Compose with the recent messages beside it', async () => {
    renderTab();
    expect(screen.getByText(/compose form/)).toBeTruthy();
    expect(await screen.findByText('Welcome to Navigate Wealth')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'History · 1' })).toBeTruthy();
  });

  it('shows the history in the page, kept in the address', async () => {
    renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'View history' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?cview=history'));
    expect(await screen.findByText(/history inline/)).toBeTruthy();
  });

  it('shows an error in History, not an empty history, when messages fail to load', async () => {
    logs.fail = true;
    try {
      renderTab('/?cview=history');
      expect(
        await screen.findByText("Couldn't load the communication history", {}, { timeout: 5000 }),
      ).toBeTruthy();
    } finally {
      logs.fail = false;
    }
  });
});
