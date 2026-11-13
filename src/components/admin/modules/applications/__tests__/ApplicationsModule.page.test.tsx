/**
 * Applications: status tabs with counts in the address, a Review button and
 * ⋯ per row, the review / complete-on-behalf / preview pages in the address,
 * and the approve confirmation that says what approval does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestQueryClient } from '@/test/utils';
import type { Application } from '../types';

const app = (id: string, status: Application['status'], first: string): Application =>
  ({
    id,
    user_id: `u-${id}`,
    status,
    created_at: '2026-07-09T09:00:00Z',
    updated_at: '2026-07-09T09:10:00Z',
    submitted_at: '2026-07-09T09:01:00Z',
    application_number: `APP-2026-${id}`,
    application_data: { firstName: first, lastName: 'Hendricks', emailAddress: `${first}@x.co` },
    user_email: `${first}@x.co`,
    user_name: `${first} Hendricks`,
    origin: 'admin_import',
  }) as unknown as Application;

const rows = [app('0190', 'submitted', 'Nadia'), app('0191', 'approved', 'Riaan')];
const api = vi.hoisted(() => ({
  getApplications: vi.fn(),
  getStats: vi.fn(),
  getApplicationDetail: vi.fn(),
  approveApplication: vi.fn(),
  declineApplication: vi.fn(),
  resendInvite: vi.fn(),
}));
const toastError = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({ applicationsApi: api }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m), info: vi.fn() },
}));
vi.mock('../../../../auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'admin-1', role: 'admin' } }),
}));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));
vi.mock('../components/ReviewPage', () => ({
  ReviewPage: (props: {
    application: Application;
    backLabel: string;
    onClose: () => void;
    onApprove: (a: Application) => void;
  }) => (
    <div>
      <h1>{props.application.application_data.firstName} Hendricks</h1>
      <button onClick={props.onClose}>Back to {props.backLabel.toLowerCase()}</button>
      <button onClick={() => props.onApprove(props.application)}>Approve</button>
    </div>
  ),
}));
vi.mock('../components/CompleteOnBehalfPage', () => ({
  CompleteOnBehalfPage: (props: { application: Application }) => (
    <h1>Complete application for {props.application.application_data.firstName}</h1>
  ),
}));
vi.mock('../components/ApplicationPreviewPage', () => ({
  ApplicationPreviewPage: () => <p>Nothing you type here is saved.</p>,
}));

import { ApplicationsModule } from '../ApplicationsModule';

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function renderAt(url = '/admin?module=applications') {
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <ApplicationsModule />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setup() {
  api.getApplications.mockImplementation(async (tab: string) =>
    tab === 'all'
      ? rows
      : rows.filter((r) => (tab === 'pending' ? r.status === 'submitted' : r.status === tab)),
  );
  api.getStats.mockResolvedValue({
    total: 187,
    submitted_for_review: 183,
    approved: 2,
    declined: 1,
    invited: 0,
    incomplete: 1,
  });
  api.getApplicationDetail.mockImplementation(async (id: string) => {
    const found = rows.find((r) => r.id === id);
    if (!found) throw new Error('404');
    return found;
  });
  api.approveApplication.mockResolvedValue({});
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Applications page', () => {
  it('shows status tabs with counts (All = total) and keeps the tab in the address', async () => {
    setup();
    renderAt();
    await screen.findByText('Nadia Hendricks');
    expect(screen.getByRole('tab', { name: /Pending review/ }).textContent).toContain('183');
    expect(screen.getByRole('tab', { name: /All/ }).textContent).toContain('187');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /All/ }), { button: 0 });
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=applications&status=all'),
    );
    await screen.findByText('Riaan Hendricks');
    expect(screen.getByRole('button', { name: 'Open client' })).toBeDefined();
  });

  it('has a Review button and ⋯ per row, and opens the review as a page', async () => {
    setup();
    renderAt();
    await screen.findByText('Nadia Hendricks');
    expect(screen.getByRole('button', { name: 'More actions for Nadia Hendricks' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by origin' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Nadia Hendricks' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=applications&application=0190');
    fireEvent.click(screen.getByRole('button', { name: 'Back to pending review' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Applications' }));
  });

  it('confirms approval with what it does', async () => {
    setup();
    renderAt('/admin?module=applications&application=0190');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Nadia Hendricks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Approve Nadia Hendricks?')).toBeDefined();
    expect(within(dialog).getByText(/creates the client profile/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() => expect(api.approveApplication).toHaveBeenCalledWith('0190'));
  });

  it('drops an unknown application from the address with a message', async () => {
    setup();
    renderAt('/admin?module=applications&application=nope');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Application not found'));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=applications'),
    );
  });

  it('opens the form preview and complete-on-behalf as pages', async () => {
    setup();
    renderAt();
    await screen.findByText('Nadia Hendricks');
    fireEvent.click(screen.getByRole('button', { name: /Preview form/ }));
    await screen.findByText('Nothing you type here is saved.');
    expect(screen.getByTestId('search').textContent).toBe('?module=applications&preview=form');
    cleanup();
    renderAt('/admin?module=applications&behalf=0190');
    await screen.findByRole('heading', { name: 'Complete application for Nadia' });
  });

  it('shows the per-tab empty state', async () => {
    setup();
    renderAt('/admin?module=applications&status=invited');
    await screen.findByRole('heading', { name: 'No invited applicants' });
    expect(screen.getAllByRole('button', { name: /Invite applicant/ }).length).toBe(2);
  });
});
