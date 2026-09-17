import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CampaignListResult, NewsletterCampaign } from '../../types';

const hooks = vi.hoisted(() => ({
  campaigns: {
    data: undefined as CampaignListResult | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetching: false,
  },
  remove: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioCampaigns: () => hooks.campaigns,
  useDeleteCampaign: () => hooks.remove,
}));

import { NewsletterList } from '../NewsletterList';

const campaign = (overrides: Partial<NewsletterCampaign>): NewsletterCampaign => ({
  id: 'c1',
  title: 'September issue',
  description: 'd',
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  pdf: { storagePath: 'c1/x.pdf', fileName: 'x.pdf', sizeBytes: 100, uploadedAt: '2026-09-01' },
  source: 'admin',
  sourceRef: null,
  reviewNotifiedAt: null,
  issueMonth: '2026-09',
  publishToWebsite: true,
  website: null,
  status: 'draft',
  scheduledAt: null,
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  processedCount: 0,
  progressPercent: 0,
  readCount: 0,
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

const result = (campaigns: NewsletterCampaign[]): CampaignListResult => {
  const counts = {
    draft: 0,
    scheduled: 0,
    queued: 0,
    sending: 0,
    paused: 0,
    finished: 0,
    cancelled: 0,
  };
  for (const c of campaigns) counts[c.status]++;
  return { campaigns, total: campaigns.length, page: 1, limit: 100, statusCounts: counts };
};

const caps = { create: true, send: true, delete: true };

beforeEach(() => {
  vi.clearAllMocks();
  hooks.campaigns.isLoading = false;
  hooks.campaigns.isError = false;
  hooks.campaigns.data = undefined;
});

describe('NewsletterList', () => {
  it('invites the first upload when there is nothing yet', () => {
    hooks.campaigns.data = result([]);
    const onNew = vi.fn();
    render(<NewsletterList caps={caps} onOpen={vi.fn()} onNew={onNew} />);
    expect(screen.getByText('No newsletters yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /upload a newsletter/i }));
    expect(onNew).toHaveBeenCalled();
  });

  it('pins routine drafts awaiting review and opens a row on click', () => {
    const routine = campaign({ id: 'r1', title: 'From the routine', source: 'routine' });
    const sent = campaign({
      id: 's1',
      title: 'August issue',
      status: 'finished',
      recipientCount: 200,
      sentCount: 198,
      readCount: 50,
      completedAt: '2026-08-05T09:00:00.000Z',
    });
    hooks.campaigns.data = result([routine, sent]);
    const onOpen = vi.fn();
    render(<NewsletterList caps={caps} onOpen={onOpen} onNew={vi.fn()} />);

    expect(screen.getByText('Waiting for your review')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'From the routine' }));
    expect(onOpen).toHaveBeenCalledWith('r1');

    expect(screen.getByText('198 delivered')).toBeTruthy();
    expect(screen.getByText('25.3% read')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: /August issue/ }));
    expect(onOpen).toHaveBeenCalledWith('s1');
  });

  it('filters by status chip', () => {
    hooks.campaigns.data = result([
      campaign({ id: 'd1', title: 'Draft one' }),
      campaign({ id: 'f1', title: 'Sent one', status: 'finished' }),
    ]);
    render(<NewsletterList caps={caps} onOpen={vi.fn()} onNew={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /^Sent/ }));
    expect(screen.queryByText('Draft one')).toBeNull();
    expect(screen.getByText('Sent one')).toBeTruthy();
  });

  it('confirms before deleting and only offers delete on deletable statuses', () => {
    hooks.campaigns.data = result([
      campaign({ id: 'd1', title: 'Draft one' }),
      campaign({ id: 'q1', title: 'Sending one', status: 'sending', recipientCount: 10 }),
    ]);
    render(<NewsletterList caps={caps} onOpen={vi.fn()} onNew={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete Sending one' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Draft one' }));
    expect(screen.getByText(/Delete “Draft one”\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(hooks.remove.mutate).toHaveBeenCalledWith('d1');
  });

  it('shows an error state with retry', () => {
    hooks.campaigns.isError = true;
    hooks.campaigns.error = new Error('boom');
    render(<NewsletterList caps={caps} onOpen={vi.fn()} onNew={vi.fn()} />);
    expect(screen.getByText('The newsletters could not be loaded')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(hooks.campaigns.refetch).toHaveBeenCalled();
  });
});
