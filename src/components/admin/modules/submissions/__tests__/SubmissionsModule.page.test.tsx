/**
 * Submissions: board filters in the address, a submission opens as a page
 * (?id=), unknown ids are dropped, the archive has search and a Type chip,
 * and deletes ask first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { Submission } from '../types';

const base = { sourceChannel: 'website_form', payload: {}, updatedAt: '2026-11-02T00:00:00Z' };
const data = vi.hoisted(() => ({
  list: [] as unknown[],
  error: null as string | null,
  del: vi.fn().mockResolvedValue({ success: true }),
  update: vi.fn().mockResolvedValue({ success: true }),
}));
const getById = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m), info: vi.fn() },
}));
vi.mock('../hooks/useSubmissions', () => ({
  useSubmissions: () => ({
    submissions: data.list,
    isLoading: false,
    error: data.error,
    updateSubmission: data.update,
    deleteSubmission: data.del,
    refetch: vi.fn(),
  }),
}));
vi.mock('../api', () => ({ submissionsApi: { getById: (id: string) => getById(id) } }));
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => children,
  Droppable: ({
    children,
  }: {
    children: (p: Record<string, unknown>, s: Record<string, unknown>) => React.ReactNode;
  }) =>
    children(
      { innerRef: () => {}, droppableProps: {}, placeholder: null },
      { isDraggingOver: false },
    ),
}));
vi.mock('../components/SubmissionCard', () => ({
  SubmissionCard: (props: {
    submission: Submission;
    onView: (s: Submission) => void;
    onDelete: (s: Submission) => void;
  }) => (
    <div>
      <button onClick={() => props.onView(props.submission)}>
        {props.submission.submitterName}
      </button>
      <button onClick={() => props.onDelete(props.submission)}>
        Delete {props.submission.submitterName}
      </button>
    </div>
  ),
}));
vi.mock('../components/SubmissionPage', () => ({
  SubmissionPage: (props: { submission: Submission; onClose: () => void; backLabel: string }) => (
    <div>
      <h1>{props.submission.submitterName}</h1>
      <button onClick={props.onClose}>Back to {props.backLabel}</button>
    </div>
  ),
}));

import { SubmissionsModule } from '../SubmissionsModule';

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function renderAt(url = '/admin?module=submissions') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <SubmissionsModule />
      <Location />
    </MemoryRouter>,
  );
}

const subs = [
  {
    ...base,
    id: 's-new',
    type: 'client_signup',
    status: 'new',
    submitterName: 'Sipho Ndlovu',
    submittedAt: '2026-03-24T00:00:00Z',
  },
  {
    ...base,
    id: 's-done',
    type: 'quote',
    status: 'completed',
    submitterName: 'Megan Clarke',
    submittedAt: '2026-11-02T00:00:00Z',
  },
  {
    ...base,
    id: 's-arch',
    type: 'contact',
    status: 'archived',
    submitterName: 'Ruan Venter',
    submitterEmail: 'ruan@example.com',
    submittedAt: '2026-10-18T00:00:00Z',
  },
  {
    ...base,
    id: 's-arch2',
    type: 'will_draft',
    status: 'archived',
    submitterName: 'Zanele Khumalo',
    submittedAt: '2026-10-03T00:00:00Z',
  },
];

afterEach(() => {
  cleanup();
  data.list = [];
  data.error = null;
  data.del.mockClear();
  toastError.mockClear();
  getById.mockReset();
});

describe('Submissions page', () => {
  it('shows the header, tab counts and status cards that filter the board', () => {
    data.list = subs;
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Submissions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Invite a client/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Board/ }).textContent).toContain('2');
    expect(screen.getByRole('tab', { name: /Archived/ }).textContent).toContain('2');

    const active = screen.getByRole('button', { name: /^Active/ });
    expect(active.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^New/ }));
    expect(screen.getByTestId('search').textContent).toBe('?module=submissions&status=new');
    expect(screen.getByText('Sipho Ndlovu')).toBeDefined();
    expect(screen.queryByText('Megan Clarke')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter by type' })).toBeDefined();
  });

  it('opens a submission as a page with its id in the address', async () => {
    data.list = subs;
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Megan Clarke' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Megan Clarke' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=submissions&id=s-done');
    fireEvent.click(screen.getByRole('button', { name: 'Back to board' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Submissions' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=submissions');
  });

  it('opens the old ?type=&id= link, fetching a submission outside the list', async () => {
    data.list = subs;
    getById.mockResolvedValue({ ...subs[1], id: 's-other', submitterName: 'Faizel Khan' });
    renderAt('/admin?module=submissions&type=quote&id=s-other');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Faizel Khan' }));
    expect(getById).toHaveBeenCalledWith('s-other');
  });

  it('drops an unknown submission from the address and says so', async () => {
    data.list = subs;
    getById.mockRejectedValue(new Error('404'));
    renderAt('/admin?module=submissions&id=nope');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Submission not found'));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=submissions'),
    );
  });

  it('asks before deleting from the board', async () => {
    data.list = subs;
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Megan Clarke' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Delete submission?')).toBeDefined();
    expect(data.del).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(data.del).toHaveBeenCalledWith('s-done'));
  });

  it('lists archived submissions with search and a Type chip', () => {
    data.list = subs;
    renderAt('/admin?module=submissions&tab=archived');
    expect(screen.getByText('Ruan Venter')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by type' })).toBeDefined();
    fireEvent.change(screen.getByLabelText('Search archived submissions'), {
      target: { value: 'ruan' },
    });
    expect(screen.queryByText('Zanele Khumalo')).toBeNull();
    expect(screen.getByText('1 of 2 archived')).toBeDefined();
  });

  it('shows the empty state and the standard error', () => {
    renderAt();
    expect(screen.getByRole('heading', { name: 'No submissions yet' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send a form link' })).toBeDefined();
    cleanup();
    data.error = 'boom';
    renderAt();
    expect(screen.getByRole('heading', { name: 'Unable to load submissions' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });
});
