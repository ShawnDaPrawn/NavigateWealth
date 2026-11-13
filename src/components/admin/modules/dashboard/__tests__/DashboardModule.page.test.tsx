import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { role: auth.role, firstName: 'Shawn' } }),
}));

const data = vi.hoisted(() => ({
  errors: { stats: false, tasks: false },
  refetchStats: vi.fn(),
  refetchTasks: vi.fn(),
}));
vi.mock('../hooks', () => ({
  useDashboardData: () => ({
    stats: { total_clients: 187, pending_tasks: 203, new_this_month: 0, new_last_month: 0 },
    metrics: { activePolicies: 8, newPoliciesCount: 0, completedFNAs: 0, pendingFNAs: 0 },
    tasks: [
      { id: 't1', title: 'Pay FSCA levy', due_date: '2026-11-13', priority: 'high' },
      { id: 't2', title: 'Reply to enquiry', due_date: '2026-11-13', priority: 'low' },
    ],
    activities: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
    errors: data.errors,
    refetchStats: data.refetchStats,
    refetchTasks: data.refetchTasks,
    loadingStates: { stats: false, metrics: false, tasks: false, activities: false },
  }),
  useDashboardKPIs: () => ({
    kpis: [],
    loading: false,
  }),
}));

const api = vi.hoisted(() => ({
  lastRun: null as null | { timestamp: string },
  getLog: vi.fn(),
}));
vi.mock('../api', () => ({
  taskStatsApi: { getStats: vi.fn().mockResolvedValue({ open: 203, completed: 27 }) },
  systemHealthApi: {
    getLastCleanupRun: () => Promise.resolve(api.lastRun),
    runCleanup: vi.fn(),
  },
  adminAuditApi: { getLog: (...args: unknown[]) => api.getLog(...args) },
}));

vi.mock('../../../hooks/usePendingCounts', () => ({
  usePendingCounts: () => ({
    applications: { count: 183 },
    submissions: { count: 1 },
    issues: { count: 3 },
  }),
}));

// Cards with their own data are covered elsewhere.
vi.mock('../components/RecentNotesWidget', () => ({ RecentNotesWidget: () => null }));
vi.mock('../components/PublicationsCard', () => ({ PublicationsCard: () => null }));
vi.mock('../components/NewsletterKPICard', () => ({ NewsletterKPICard: () => null }));

import { DashboardModule } from '../DashboardModule';

function Search() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url = '/admin', props: Parameters<typeof DashboardModule>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <DashboardModule {...props} />
        <Search />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getLog.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.role = 'admin';
  data.errors.stats = false;
  data.errors.tasks = false;
  api.lastRun = null;
  vi.clearAllMocks();
});

describe('Dashboard', () => {
  it('has the H1 "Dashboard" with the greeting and date as its description', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    expect(screen.getByText(/^Good (morning|afternoon|evening), Shawn · /)).toBeDefined();
  });

  it('shows the standard No access state to non-admins', () => {
    auth.role = 'adviser';
    renderAt();
    expect(screen.getByText("You don't have access to the dashboard")).toBeDefined();
    expect(screen.queryByRole('heading', { level: 1, name: 'Dashboard' })).toBeNull();
  });

  it('summarises what needs attention, one click to each list', () => {
    const onModuleChange = vi.fn();
    renderAt('/admin', { onModuleChange });
    expect(screen.getByText('Needs your attention')).toBeDefined();
    expect(screen.getByText('Applications to review')).toBeDefined();
    expect(screen.getByText('Tasks due today')).toBeDefined();
    fireEvent.click(screen.getByText('Open issues').closest('button')!);
    expect(onModuleChange).toHaveBeenCalledWith('issues');
  });

  it('shows the health status on the System health button', async () => {
    api.lastRun = { timestamp: new Date(Date.now() - 9 * 86_400_000).toISOString() };
    renderAt();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /System health/ }).textContent).toContain(
        'Overdue',
      ),
    );
  });

  it('opens the audit trail as a page with its own address, and Back returns', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Audit trail' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Audit trail' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('search').textContent).toBe('?view=audit');
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Dashboard' }));
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('reads the audit filters from the address', async () => {
    renderAt('/admin?view=audit&category=security&severity=critical');
    await waitFor(() => expect(api.getLog).toHaveBeenCalled());
    expect(api.getLog).toHaveBeenCalledWith({
      category: 'security',
      severity: 'critical',
      limit: 200,
    });
    expect(await screen.findByText('No entries match your filters')).toBeDefined();
  });

  it('shows an inline error with Try again on the card that failed', () => {
    data.errors.stats = true;
    data.errors.tasks = true;
    renderAt();
    const alerts = screen.getAllByRole('alert');
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Couldn't load the practice figures"),
        expect.stringContaining("Couldn't load tasks due today"),
      ]),
    );
    const retries = screen.getAllByRole('button', { name: /Try again/ });
    retries.forEach((b) => fireEvent.click(b));
    expect(data.refetchStats).toHaveBeenCalled();
    expect(data.refetchTasks).toHaveBeenCalled();
    // The rest of the page still works.
    expect(screen.getByText('Quick actions')).toBeDefined();
  });

  it('opens a task due today straight from its Open button', () => {
    const onViewTask = vi.fn();
    renderAt('/admin', { onViewTask });
    fireEvent.click(screen.getByRole('button', { name: 'Open Pay FSCA levy' }));
    expect(onViewTask).toHaveBeenCalledWith('t1');
  });
});
