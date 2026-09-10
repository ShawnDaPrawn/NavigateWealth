import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PostCalendar } from '../PostCalendar';
import type { SocialPost, SocialProfile } from '../types';

const scheduled: SocialPost = {
  id: 'post-1',
  profiles: ['c1'],
  channelId: 'c1',
  platform: 'linkedin',
  body: 'Scheduled post content here.',
  media: [],
  status: 'scheduled',
  scheduledAt: new Date(2026, 5, 15, 9, 0, 0),
  createdBy: 'api',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  retryCount: 0,
};

const profiles: SocialProfile[] = [
  { id: 'c1', platform: 'linkedin', name: 'Navigate Wealth', username: 'nw', isConnected: true },
];

const baseProps = {
  posts: [scheduled],
  profiles,
  selectedDate: new Date(2026, 5, 15),
  onDateChange: vi.fn(),
  onPostDelete: vi.fn(),
  onCreatePost: vi.fn(),
  viewMode: 'week' as const,
  onViewModeChange: vi.fn(),
};

describe('PostCalendar', () => {
  it('renders the week with the channel name and status on the chip', () => {
    render(<PostCalendar {...baseProps} />);
    expect(screen.getByText('Navigate Wealth')).toBeDefined();
    expect(screen.getByText('Scheduled')).toBeDefined();
    expect(screen.getByText('Scheduled post content here.')).toBeDefined();
  });

  it('opens the detail dialog and asks for confirmation before deleting in Buffer', async () => {
    render(<PostCalendar {...baseProps} />);
    fireEvent.click(screen.getByText('Scheduled post content here.'));
    expect(await screen.findByText('Post in Buffer')).toBeDefined();
    fireEvent.click(screen.getByText('Delete in Buffer'));
    expect(await screen.findByText('Delete this post in Buffer?')).toBeDefined();
    fireEvent.click(screen.getByText('Delete'));
    expect(baseProps.onPostDelete).toHaveBeenCalledWith('post-1');
  });

  it('routes the empty day view to Compose', () => {
    render(<PostCalendar {...baseProps} posts={[]} viewMode="day" />);
    expect(screen.getByText('Nothing queued for this day')).toBeDefined();
    const composeButtons = screen.getAllByRole('button', { name: /Compose/ });
    fireEvent.click(composeButtons[composeButtons.length - 1]);
    expect(baseProps.onCreatePost).toHaveBeenCalled();
  });

  it('renders the month view with the selected day’s posts beside it', () => {
    render(<PostCalendar {...baseProps} viewMode="month" />);
    expect(screen.getByText('Scheduled post content here.')).toBeDefined();
    render(<PostCalendar {...baseProps} posts={[]} viewMode="month" />);
    expect(screen.getByText('Nothing queued for this day.')).toBeDefined();
  });
});
