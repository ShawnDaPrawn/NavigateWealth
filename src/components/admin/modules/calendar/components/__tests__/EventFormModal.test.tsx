/**
 * EventFormModal — render and submit tests
 * ========================================
 *
 * Locks the dialog titles, the submit button, and the payload the form hands
 * to `onSubmit`: date + start time + duration must turn into ISO `start_at` /
 * `end_at`, and a selected client must land in both `client_id` and the
 * `attendees` map (the backend derives the `client` relation from it).
 *
 * useClients (React Query) and useSearchInputAutofillGuard are mocked so the
 * component renders without a QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

const clients = [
  {
    id: 'client-1',
    full_name: 'Shawn Francisco',
    preferred_name: 'Shawn',
    email: 'shawn@example.com',
    phone: null,
    date_of_birth: null,
    created_by: 'system',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

vi.mock('@/hooks/useClients', () => ({
  useClients: () => ({ data: clients, isLoading: false }),
}));

vi.mock('@/shared/forms/useSearchInputAutofillGuard', () => ({
  useSearchInputAutofillGuard: () => ({
    id: 'search',
    name: 'search',
    type: 'text',
    readOnly: false,
    autoComplete: 'off',
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from 'sonner';
import { EventFormModal } from '../EventFormModal';
import type { CalendarEvent } from '../../types';

const noop = vi.fn();
const noopSubmit = vi.fn();

const existingEvent = {
  id: 'ev-1',
  user_id: 'u-1',
  title: 'My Meeting',
  description: 'Bring the statements',
  event_type: 'review',
  start_at: new Date(2026, 8, 7, 9, 20).toISOString(),
  end_at: new Date(2026, 8, 7, 10, 30).toISOString(),
  location_type: 'virtual',
  location: null,
  video_link: 'https://meet.example.com/abc',
  status: 'scheduled',
  client_id: 'client-1',
  attendees: { 'client-1': { name: 'Shawn Francisco', email: 'shawn@example.com' } },
  created_by: 'u-1',
  created_at: '2026-01-01T09:00:00.000Z',
  updated_at: '2026-01-01T09:00:00.000Z',
  recurrence_rule: JSON.stringify({ frequency: 'weekly', interval: 2, endDate: '2026-12-01' }),
} as unknown as CalendarEvent;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EventFormModal', () => {
  it('shows "New Event" dialog title when open with no event', () => {
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} />);

    expect(screen.getByText('New Event')).toBeTruthy();
  });

  it('shows "Edit Event" title when open with an existing event', () => {
    render(
      <EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} event={existingEvent} />,
    );

    expect(screen.getByText('Edit Event')).toBeTruthy();
  });

  it('shows a Create Event submit button when open with no event', () => {
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} />);

    expect(screen.getByRole('button', { name: /create event/i })).toBeTruthy();
  });

  it('offers date, start time and duration instead of raw datetime inputs', () => {
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} />);

    expect(screen.getByRole('button', { name: 'Date' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Start time' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Duration' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Event type' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Location type' })).toBeTruthy();
  });

  it('refuses to submit without a title', () => {
    const onSubmit = vi.fn();
    render(<EventFormModal open={true} onClose={noop} onSubmit={onSubmit} />);

    fireEvent.submit(screen.getByRole('button', { name: /create event/i }).closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Give the event a title');
  });

  it('submits start and end computed from date, time and duration', () => {
    const onSubmit = vi.fn();
    render(<EventFormModal open={true} onClose={noop} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Planning' } });
    fireEvent.click(screen.getByRole('radio', { name: /phone/i }));
    fireEvent.submit(screen.getByRole('button', { name: /create event/i }).closest('form')!);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.title).toBe('Planning');
    expect(payload.event_type).toBe('meeting');
    expect(payload.location_type).toBe('phone');
    expect(payload.location).toBeNull();
    expect(payload.video_link).toBeNull();
    expect(payload.client_id).toBeNull();
    expect(payload.attendees).toEqual({});
    expect(payload.recurrence_rule).toBeNull();

    const start = new Date(payload.start_at);
    const end = new Date(payload.end_at);
    expect(start.getMinutes() % 15).toBe(0);
    expect(end.getTime() - start.getTime()).toBe(60 * 60 * 1000);
  });

  it('loads an existing event, keeps its odd start time and duration, and maps virtual to video', () => {
    const onSubmit = vi.fn();
    render(
      <EventFormModal
        open={true}
        onClose={noop}
        onSubmit={onSubmit}
        event={existingEvent}
        onDelete={noop}
      />,
    );

    expect((screen.getByLabelText('Event title') as HTMLInputElement).value).toBe('My Meeting');
    expect(screen.getByRole('radio', { name: /video call/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect((screen.getByLabelText('Meeting link') as HTMLInputElement).value).toBe(
      'https://meet.example.com/abc',
    );
    expect(screen.getByText('Shawn Francisco')).toBeTruthy();
    expect((screen.getByLabelText('Repeat interval') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('Repeat until') as HTMLInputElement).value).toBe('2026-12-01');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();

    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.location_type).toBe('video');
    expect(payload.video_link).toBe('https://meet.example.com/abc');
    expect(payload.client_id).toBe('client-1');
    expect(payload.attendees).toEqual({
      'client-1': { name: 'Shawn Francisco', email: 'shawn@example.com', type: 'client' },
    });
    expect(payload.description).toBe('Bring the statements');
    expect(JSON.parse(payload.recurrence_rule)).toEqual({
      frequency: 'weekly',
      interval: 2,
      endDate: '2026-12-01',
    });
    const start = new Date(payload.start_at);
    const end = new Date(payload.end_at);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(20);
    expect((end.getTime() - start.getTime()) / 60000).toBe(70);
  });

  it('removes a client from the chips', () => {
    const onSubmit = vi.fn();
    render(<EventFormModal open={true} onClose={noop} onSubmit={onSubmit} event={existingEvent} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Shawn Francisco' }));
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.client_id).toBeNull();
    expect(payload.attendees).toEqual({});
  });

  it('rejects a meeting link that is not an http(s) URL', () => {
    const onSubmit = vi.fn();
    render(<EventFormModal open={true} onClose={noop} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Event title'), { target: { value: 'Call' } });
    fireEvent.click(screen.getByRole('radio', { name: /video call/i }));
    fireEvent.change(screen.getByLabelText('Meeting link'), {
      target: { value: 'meet.example.com/abc' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /create event/i }).closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The meeting link must start with http:// or https://',
    );
  });

  it('shows a clash hint for an overlapping event but still allows saving', () => {
    const onSubmit = vi.fn();
    const overlapping = {
      ...existingEvent,
      id: 'ev-2',
      title: 'Portfolio catch-up',
      start_at: new Date(2026, 8, 7, 9, 0).toISOString(),
      end_at: new Date(2026, 8, 7, 12, 0).toISOString(),
    } as CalendarEvent;
    render(
      <EventFormModal
        open={true}
        onClose={noop}
        onSubmit={onSubmit}
        event={existingEvent}
        events={[existingEvent, overlapping]}
      />,
    );

    expect(screen.getByText(/Clashes with “Portfolio catch-up”/)).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: /save changes/i }).closest('form')!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders system events read-only', () => {
    const birthday = {
      ...existingEvent,
      id: 'birthday-client-1',
      event_type: 'birthday',
      title: 'Shawn Francisco turns 40',
      recurrence_rule: null,
    } as CalendarEvent;
    render(<EventFormModal open={true} onClose={noop} onSubmit={noopSubmit} event={birthday} />);

    expect(screen.getByText('Shawn Francisco turns 40')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    // The dialog chrome has its own sr-only "Close"; the footer adds a visible one.
    expect(screen.getAllByRole('button', { name: 'Close' }).length).toBeGreaterThanOrEqual(2);
  });
});
