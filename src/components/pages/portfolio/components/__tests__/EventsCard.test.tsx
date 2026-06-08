import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventsCard } from '../EventsCard';

const mockEvents = [
  {
    id: 'evt-1',
    type: 'review',
    title: 'Annual Review',
    description: 'Yearly portfolio review',
    date: '2026-07-01',
    time: '10:00',
    status: 'scheduled',
  },
];

describe('EventsCard', () => {
  it('renders card heading', () => {
    render(<EventsCard events={mockEvents} onBookMeeting={() => {}} />);
    expect(screen.getByText(/Upcoming Reviews/i)).toBeDefined();
  });

  it('renders event title', () => {
    render(<EventsCard events={mockEvents} onBookMeeting={() => {}} />);
    expect(screen.getByText('Annual Review')).toBeDefined();
  });

  it('renders empty state when no events', () => {
    render(<EventsCard events={[]} onBookMeeting={() => {}} />);
    expect(screen.getByText(/no upcoming/i)).toBeDefined();
  });

  it('calls onBookMeeting when Book Meeting button is clicked', () => {
    const onBookMeeting = vi.fn();
    render(<EventsCard events={[]} onBookMeeting={onBookMeeting} />);
    fireEvent.click(screen.getByText(/Book Meeting/i));
    expect(onBookMeeting).toHaveBeenCalledOnce();
  });
});
