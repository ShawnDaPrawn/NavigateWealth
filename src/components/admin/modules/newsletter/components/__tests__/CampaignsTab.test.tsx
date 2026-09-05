import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NewsletterCampaign } from '../../types';

const hooks = vi.hoisted(() => ({
  campaigns: {
    data: undefined as
      | { campaigns: NewsletterCampaign[]; total: number; page: number; limit: number }
      | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetching: false,
  },
  duplicate: { mutate: vi.fn(), isPending: false },
  remove: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioCampaigns: () => hooks.campaigns,
  useDuplicateCampaign: () => hooks.duplicate,
  useDeleteCampaign: () => hooks.remove,
}));
vi.mock('../CampaignDetail', () => ({
  CampaignDetail: ({ campaignId }: { campaignId: string }) => <div>detail:{campaignId}</div>,
}));
vi.mock('../CampaignEditor', () => ({
  CampaignEditor: ({ campaign }: { campaign: NewsletterCampaign | null }) => (
    <div>editor:{campaign ? campaign.id : 'new'}</div>
  ),
}));

import { CampaignsTab } from '../CampaignsTab';

const make = (id: string, overrides: Partial<NewsletterCampaign>): NewsletterCampaign => ({
  id,
  name: `Campaign ${id}`,
  subject: `Subject ${id}`,
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  bodyHtml: '<p>Hi</p>',
  templateId: null,
  trackClicks: true,
  status: 'draft',
  scheduledAt: null,
  links: [],
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  processedCount: 0,
  progressPercent: 0,
  openCount: 0,
  clickCount: 0,
  statsRefreshedAt: null,
  createdBy: 'admin',
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T09:00:00.000Z',
  startedAt: null,
  completedAt: null,
  lastProgressAt: null,
  lastError: null,
  pendingCount: 0,
  stuck: false,
  ...overrides,
});

const caps = { create: true, send: true, delete: true };

beforeEach(() => {
  vi.clearAllMocks();
  hooks.campaigns.isLoading = false;
  hooks.campaigns.isError = false;
  hooks.campaigns.data = {
    campaigns: [
      make('a', { status: 'draft' }),
      make('b', { status: 'sending', recipientCount: 100, sentCount: 40, progressPercent: 40 }),
      make('c', {
        status: 'finished',
        recipientCount: 50,
        sentCount: 50,
        progressPercent: 100,
        openCount: 5,
        clickCount: 10,
      }),
    ],
    total: 3,
    page: 1,
    limit: 100,
  };
});

describe('CampaignsTab', () => {
  it('routes to the editor and drill-down views', () => {
    const { rerender } = render(
      <CampaignsTab caps={caps} view={{ kind: 'editor', campaign: null }} onViewChange={vi.fn()} />,
    );
    expect(screen.getByText('editor:new')).toBeTruthy();
    rerender(
      <CampaignsTab
        caps={caps}
        view={{ kind: 'detail', campaignId: 'b' }}
        onViewChange={vi.fn()}
      />,
    );
    expect(screen.getByText('detail:b')).toBeTruthy();
  });

  it('shows status chips with live counts and filters the table', () => {
    render(<CampaignsTab caps={caps} view={{ kind: 'list' }} onViewChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /All\s*3/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Sending\s*1/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Sent\s*1/ }));
    expect(screen.getByText('Campaign c')).toBeTruthy();
    expect(screen.queryByText('Campaign a')).toBeNull();
    expect(screen.getByText(/20%/)).toBeTruthy(); // click rate 10/50
  });

  it('opens a campaign from its row and exposes row actions gated by capability', async () => {
    const onViewChange = vi.fn();
    render(<CampaignsTab caps={caps} view={{ kind: 'list' }} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Campaign b'));
    expect(onViewChange).toHaveBeenCalledWith({ kind: 'detail', campaignId: 'b' });

    fireEvent.click(screen.getByRole('button', { name: 'New campaign' }));
    expect(onViewChange).toHaveBeenCalledWith({ kind: 'editor', campaign: null });

    // Draft "a" is deletable; open its menu and confirm the delete.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Campaign a' }));
    const deleteItem = await screen.findByRole('menuitem', { name: /delete/i });
    fireEvent.click(deleteItem);
    fireEvent.click(await screen.findByRole('button', { name: /delete campaign/i }));
    await waitFor(() => expect(hooks.remove.mutate).toHaveBeenCalledWith('a'));
  });

  it('renders an empty state with a call to action, and a filtered empty state', () => {
    hooks.campaigns.data = { campaigns: [], total: 0, page: 1, limit: 100 };
    const onViewChange = vi.fn();
    render(<CampaignsTab caps={caps} view={{ kind: 'list' }} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByRole('button', { name: /create your first campaign/i }));
    expect(onViewChange).toHaveBeenCalledWith({ kind: 'editor', campaign: null });

    fireEvent.click(screen.getByRole('tab', { name: /Paused/ }));
    expect(screen.getByText('No campaigns match')).toBeTruthy();
  });

  it('shows a skeleton while loading and an error state on failure', () => {
    hooks.campaigns.isLoading = true;
    hooks.campaigns.data = undefined;
    const { rerender } = render(
      <CampaignsTab caps={caps} view={{ kind: 'list' }} onViewChange={vi.fn()} />,
    );
    expect(screen.getByTestId('campaign-list-skeleton')).toBeTruthy();

    hooks.campaigns.isLoading = false;
    hooks.campaigns.isError = true;
    hooks.campaigns.error = new Error('offline');
    rerender(<CampaignsTab caps={caps} view={{ kind: 'list' }} onViewChange={vi.fn()} />);
    expect(screen.getByText('offline')).toBeTruthy();
  });
});
