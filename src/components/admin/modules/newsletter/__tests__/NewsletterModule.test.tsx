import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router';
import type { NewsletterCampaign } from '../types';

const hooks = vi.hoisted(() => ({
  campaign: {
    data: undefined as NewsletterCampaign | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetching: false,
  },
  dashboard: { data: undefined as unknown, isLoading: false },
  detailProps: [] as unknown[],
}));

vi.mock('../hooks/useNewsletterStudio', () => ({
  useStudioCampaign: () => hooks.campaign,
  useStudioDashboard: () => hooks.dashboard,
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true, can: () => true, isLoading: false }),
}));
vi.mock('../components/NewsletterList', () => ({
  NewsletterList: ({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) => (
    <div data-testid="newsletter-list">
      <button onClick={onNew}>list-new</button>
      <button onClick={() => onOpen('c-9')}>list-open</button>
    </div>
  ),
}));
vi.mock('../components/NewsletterEditor', () => ({
  NewsletterEditor: ({ onCreated }: { onCreated: (id: string) => void }) => (
    <div data-testid="newsletter-editor">
      <button onClick={() => onCreated('c-new')}>editor-created</button>
    </div>
  ),
}));
vi.mock('../components/NewsletterDetail', () => ({
  NewsletterDetail: (props: unknown) => {
    hooks.detailProps.push(props);
    return <div data-testid="newsletter-detail" />;
  },
}));
vi.mock('../components/DeliveryHealthCard', () => ({
  DeliveryHealthCard: () => <div data-testid="delivery-health" />,
}));

import { NewsletterModule } from '../NewsletterModule';

function Location() {
  const [params] = useSearchParams();
  return <output data-testid="location">{params.toString()}</output>;
}

function renderAt(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin${search}`]}>
      <NewsletterModule />
      <Location />
    </MemoryRouter>,
  );
}

const campaign = (overrides: Partial<NewsletterCampaign> = {}): NewsletterCampaign => ({
  id: 'c-1',
  title: 'September issue',
  description: 'What mattered.',
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  pdf: null,
  source: 'admin',
  sourceRef: null,
  reviewNotifiedAt: null,
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

beforeEach(() => {
  vi.clearAllMocks();
  hooks.detailProps.length = 0;
  hooks.campaign.data = undefined;
  hooks.campaign.isLoading = false;
  hooks.campaign.isError = false;
  hooks.campaign.error = null;
  hooks.dashboard.data = undefined;
  hooks.dashboard.isLoading = false;
});

describe('NewsletterModule', () => {
  it('opens on the list and puts a new-newsletter request in the URL', () => {
    renderAt('?module=newsletter');
    expect(screen.getByTestId('newsletter-list')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Newsletters' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /upload newsletter/i }));
    expect(screen.getByTestId('location').textContent).toContain('campaign=new');
    expect(screen.getByTestId('newsletter-editor')).toBeTruthy();
  });

  it('shows the audience and delivery tiles above the list once the dashboard loads', () => {
    hooks.dashboard.data = {
      subscribers: { total: 219, active: 205, pending: 0, unsubscribed: 14 },
      campaigns: {
        total: 1,
        draft: 0,
        awaitingReview: 0,
        scheduled: 0,
        active: 0,
        finished: 1,
        cancelled: 0,
      },
      delivery: { totalSent: 200, totalFailed: 3, totalRead: 50 },
      recentCampaigns: [],
      processor: null,
      listCount: 3,
    };
    renderAt('?module=newsletter');
    expect(screen.getByText('Reachable subscribers')).toBeTruthy();
    expect(screen.getByText('205')).toBeTruthy();
    expect(screen.getByText('Read rate')).toBeTruthy();
    expect(screen.getByText('25%')).toBeTruthy();
    expect(screen.getByTestId('delivery-health')).toBeTruthy();
  });

  it('navigates from the editor into the new draft', () => {
    renderAt('?module=newsletter&campaign=new');
    fireEvent.click(screen.getByText('editor-created'));
    expect(screen.getByTestId('location').textContent).toContain('campaign=c-new');
  });

  it('renders the detail for a deep-linked newsletter (the review email lands here)', () => {
    hooks.campaign.data = campaign({ source: 'routine' });
    renderAt('?module=newsletter&campaign=c-1');
    expect(screen.getByTestId('newsletter-detail')).toBeTruthy();
    expect(hooks.detailProps[0]).toMatchObject({ campaign: { id: 'c-1', source: 'routine' } });
    expect(screen.getByText('September issue')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Newsletters' }));
    expect(screen.getByTestId('location').textContent).not.toContain('campaign=');
  });

  it('shows a loading placeholder while a deep-link resolves its newsletter', () => {
    hooks.campaign.isLoading = true;
    renderAt('?module=newsletter&campaign=c-1');
    expect(screen.getByTestId('newsletter-loading')).toBeTruthy();
  });

  it('shows an actionable failure instead of a blank page when the newsletter cannot load', () => {
    hooks.campaign.isError = true;
    hooks.campaign.error = new Error('Campaign c-1 not found');
    renderAt('?module=newsletter&campaign=c-1');
    expect(screen.getByText('This newsletter could not be opened')).toBeTruthy();
    expect(screen.getByText('Campaign c-1 not found')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(hooks.campaign.refetch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to newsletters/i }));
    expect(screen.getByTestId('location').textContent).not.toContain('campaign=');
  });
});
