import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MonthView } from '../MonthView';
import type { CalendarEvent } from '../../../types';

const event = {
  id: 'e1',
  user_id: 'u1',
  title: 'Annual review',
  description: null,
  event_type: 'meeting',
  start_at: '2026-11-10T09:00:00.000Z',
  end_at: '2026-11-10T10:00:00.000Z',
  location_type: 'in_person',
  location: null,
  video_link: null,
  status: 'scheduled',
  client_id: null,
  created_by: 'u1',
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
  recurrence_rule: null,
} as unknown as CalendarEvent;

describe('MonthView keyboard', () => {
  it('Enter on an event button is left to the button, not taken by the day cell', () => {
    const onViewChange = vi.fn();
    render(
      <MonthView
        events={[event]}
        currentDate={new Date('2026-11-14T12:00:00.000Z')}
        onDateChange={vi.fn()}
        onViewChange={onViewChange}
        onViewEvent={vi.fn()}
      />,
    );
    const button = screen.getByRole('button', { name: /Annual review/ });
    const keydown = fireEvent.keyDown(button, { key: 'Enter' });
    // The day cell neither switched to the day view nor cancelled the key,
    // so the browser still turns it into the button's click.
    expect(onViewChange).not.toHaveBeenCalled();
    expect(keydown).toBe(true);
  });
});
