import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { NewsletterCampaign, NewsletterDashboardSummary } from '../../types';

const hooks = vi.hoisted(() => ({
  dashboard: {
    data: undefined as NewsletterDashboardSummary | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
    isFetching: false,
  },
  runNow: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../hooks/useNewsletterStudio', () => ({
  useStudioDashboard: () => hooks.dashboard,
  useRunProcessorNow: () => hooks.runNow,
}));

import { DashboardTab } from '../DashboardTab';

const campaign = (overrides: Partial<NewsletterCampaign>): NewsletterCampaign => ({
  id: 'c1',
  name: 'September wrap',
  subject: 'Your September update',
  fromName: 'Navigate Wealth',
  listIds: ['sys_newsletter_contacts'],
  listNames: ['Newsletter Contacts'],
  bodyHtml: '<p>Hi</p>',
  templateId: null,
  trackClicks: true,
  status: 'sending',
  scheduledAt: null,
  links: [],
  recipientCount: 200,
  sentCount: 120,
  failedCount: 2,
  processedCount: 122,
  progressPercent: 61,
  openCount: 10,
  clickCount: 12,
  statsRefreshedAt: null,
  createdBy: 'admin',
  createdAt: '2026-09-05T08:00:00.000Z',
  updatedAt: '2026-09-05T09:00:00.000Z',
  startedAt: '2026-09-05T08:30:00.000Z',
  completedAt: null,
  lastProgressAt: '2026-09-05T09:00:00.000Z',
  lastError: null,
  pendingCount: 78,
  stuck: false,
  ...overrides,
});

const summary = (
  overrides: Partial<NewsletterDashboardSummary> = {},
): NewsletterDashboardSummary => ({
  subscribers: { total: 218, active: 206, pending: 0, unsubscribed: 12 },
  campaigns: { total: 0, draft: 0, scheduled: 0, active: 0, finished: 0, cancelled: 0 },
  delivery: { totalSent: 0, totalFailed: 0, totalOpens: 0, totalClicks: 0 },
  recentCampaigns: [],
  processor: null,
  listCount: 3,
  templateCount: 0,
  ...overrides,
});

const caps = { create: true, send: true, delete: true };

beforeEach(() => {
  vi.clearAllMocks();
  hooks.dashboard.isLoading = false;
  hooks.dashboard.isError = false;
});

describe('DashboardTab', () => {
  it('shows a skeleton while loading and an error state with retry on failure', () => {
    hooks.dashboard.isLoading = true;
    const { rerender } = render(
      <DashboardTab
        caps={caps}
        onOpenCampaign={vi.fn()}
        onNewCampaign={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByTestId('newsletter-dashboard-skeleton')).toBeTruthy();

    hooks.dashboard.isLoading = false;
    hooks.dashboard.isError = true;
    hooks.dashboard.error = new Error('boom');
    rerender(
      <DashboardTab
        caps={caps}
        onOpenCampaign={vi.fn()}
        onNewCampaign={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText('boom')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(hooks.dashboard.refetch).toHaveBeenCalled();
  });

  it('walks a new team through getting started when there are no campaigns', () => {
    hooks.dashboard.data = summary();
    const onNewCampaign = vi.fn();
    const onNavigate = vi.fn();
    render(
      <DashboardTab
        caps={caps}
        onOpenCampaign={vi.fn()}
        onNewCampaign={onNewCampaign}
        onNavigate={onNavigate}
      />,
    );
    expect(screen.getByText('206')).toBeTruthy();
    expect(screen.getByText(/206 subscribers ready/)).toBeTruthy();
    expect(screen.queryByText('Scheduler not installed')).toBeNull();
    expect(screen.getByText('No delivery runs yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /new campaign/i })[0]);
    expect(onNewCampaign).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /view audiences/i }));
    expect(onNavigate).toHaveBeenCalledWith('audiences');
  });

  it('lists recent campaigns with progress and flags a missing scheduler', () => {
    hooks.dashboard.data = summary({
      campaigns: { total: 1, draft: 0, scheduled: 0, active: 1, finished: 0, cancelled: 0 },
      delivery: { totalSent: 120, totalFailed: 2, totalOpens: 10, totalClicks: 12 },
      recentCampaigns: [campaign({})],
      processor: {
        mode: 'manual',
        lastRunAt: new Date().toISOString(),
        lastCronRunAt: null,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        lastHeartbeatAt: new Date().toISOString(),
        activeCampaignCount: 1,
        processedInLastRun: 20,
        sentInLastRun: 20,
        failedInLastRun: 0,
      },
    });
    const onOpenCampaign = vi.fn();
    render(
      <DashboardTab
        caps={caps}
        onOpenCampaign={onOpenCampaign}
        onNewCampaign={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.getByText('September wrap')).toBeTruthy();
    expect(screen.getByText(/120\/200 delivered/)).toBeTruthy();
    expect(screen.getByText('Scheduler not installed')).toBeTruthy();
    expect(screen.getByText('10%')).toBeTruthy(); // click rate 12/120

    fireEvent.click(screen.getByText('September wrap'));
    expect(onOpenCampaign).toHaveBeenCalledWith('c1');

    fireEvent.click(screen.getByRole('button', { name: /run a delivery pass now/i }));
    expect(hooks.runNow.mutate).toHaveBeenCalled();
  });

  it('hides the manual delivery pass from admins without the send capability', () => {
    hooks.dashboard.data = summary({
      processor: {
        mode: 'cron',
        lastRunAt: new Date().toISOString(),
        lastCronRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        lastHeartbeatAt: new Date().toISOString(),
        activeCampaignCount: 0,
        processedInLastRun: 0,
        sentInLastRun: 0,
        failedInLastRun: 0,
      },
    });
    render(
      <DashboardTab
        caps={{ create: false, send: false, delete: false }}
        onOpenCampaign={vi.fn()}
        onNewCampaign={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /run a delivery pass now/i })).toBeNull();
    expect(screen.getByText('Scheduler live')).toBeTruthy();
  });
});
