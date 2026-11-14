/**
 * Calendar: "Calendar" header, Month · Week · Day · Agenda in the address,
 * filter chips beside search, and an event as a page (?event=<id>, ?event=new).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import type { CalendarEvent } from '../types';

const today = new Date();
const at = (h: number) => {
  const d = new Date(today);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const review = {
  id: 'ev-1',
  title: 'Annual review',
  event_type: 'review',
  start_at: at(10),
  end_at: at(11),
  location_type: 'video',
  status: 'scheduled',
  description: 'Bring the statements',
  recurrence_rule: null,
} as unknown as CalendarEvent;

const toastError = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m), info: vi.fn() },
}));
const ev = vi.hoisted(() => ({ loading: false, error: null as Error | null }));
vi.mock('../hooks', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useEvents: (filters: { search?: string }) => ({
      data:
        ev.loading || ev.error
          ? []
          : [review].filter(
              (e) =>
                !filters?.search || e.title.toLowerCase().includes(filters.search.toLowerCase()),
            ),
      isLoading: ev.loading,
      error: ev.error,
      refetch: vi.fn(),
    }),
    useCreateEvent: mutation,
    useUpdateEvent: mutation,
    useDeleteEvent: mutation,
    useClientBirthdays: () => ({ data: [] }),
  };
});
vi.mock('../hooks/usePolicyRenewals', () => ({ usePolicyRenewals: () => ({ data: [] }) }));
vi.mock('../../tasks', () => ({ useTasks: () => ({ data: [] }) }));
vi.mock('../../personnel', () => ({
  useCurrentUserPermissions: () => ({ canDo: () => true }),
}));
vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({ data: [{ id: 'c1', full_name: 'Lindiwe Dube', email: 'l@x.co' }] }),
}));
vi.mock('../components/EventPage', () => ({
  EventPage: (props: { event?: CalendarEvent | null; onClose: () => void }) => (
    <div>
      <h1>{props.event ? props.event.title : 'New event'}</h1>
      <button onClick={props.onClose}>Back to calendar</button>
    </div>
  ),
}));

import { CalendarModule } from '../CalendarModule';

function Location() {
  return <output data-testid="search">{useLocation().search}</output>;
}
function renderAt(url = '/admin?module=calendar') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <CalendarModule />
      <Location />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  toastError.mockClear();
  ev.loading = false;
  ev.error = null;
});

describe('Calendar page', () => {
  it('is called Calendar, with the view switch and filter chips beside search', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeDefined();
    for (const v of ['Month', 'Week', 'Day', 'Agenda']) {
      expect(screen.getByRole('tab', { name: v })).toBeDefined();
    }
    expect(screen.getByLabelText('Search events')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by event type' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by status' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Filter by client' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Colour key' })).toBeDefined();
  });

  it('keeps the view in the address and lists the day', async () => {
    renderAt();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Day' }), { button: 0 });
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=calendar&view=day'),
    );
    expect(screen.getByText('Annual review')).toBeDefined();
    expect(screen.getByText('1 item')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Annual review' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=calendar&view=day&event=ev-1');
  });

  it('opens Add event as a page at ?event=new and goes back', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'New event' }));
    expect(screen.getByTestId('search').textContent).toBe('?module=calendar&event=new');
    fireEvent.click(screen.getByRole('button', { name: 'Back to calendar' }));
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Calendar' }));
  });

  it('opens the event named in the address and drops an unknown one', async () => {
    renderAt('/admin?module=calendar&event=ev-1');
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'Annual review' }));
    cleanup();
    renderAt('/admin?module=calendar&event=nope');
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Event not found'));
    expect(screen.getByTestId('search').textContent).toBe('?module=calendar');
  });

  it('keeps the shown date in the address and opens on it after a reload', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toMatch(
        /^\?module=calendar&date=\d{4}-\d{2}-\d{2}$/,
      ),
    );
    cleanup();
    renderAt('/admin?module=calendar&view=day&date=2026-11-12');
    expect(screen.getByRole('heading', { name: 'Thursday, 12 November 2026' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    await waitFor(() =>
      expect(screen.getByTestId('search').textContent).toBe('?module=calendar&view=day'),
    );
  });

  it('shows a grid-shaped skeleton while events load', () => {
    ev.loading = true;
    renderAt();
    expect(screen.getByRole('status', { name: 'Loading events' })).toBeDefined();
  });

  it('keeps a linked event in the address while events fail to load', () => {
    ev.error = new Error('boom');
    renderAt('/admin?module=calendar&event=ev-1');
    expect(screen.getByRole('heading', { name: 'Unable to load your calendar' })).toBeDefined();
    expect(toastError).not.toHaveBeenCalledWith('Event not found');
    expect(screen.getByTestId('search').textContent).toBe('?module=calendar&event=ev-1');
  });

  it('says when no event matches the filters, with Clear filters', async () => {
    renderAt('/admin?module=calendar&view=day');
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'zzz' } });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'No events match your filters' })).toBeDefined(),
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1)!);
    await waitFor(() => expect(screen.getByText('Annual review')).toBeDefined());
  });
});
