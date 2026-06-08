import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostCalendar } from '../PostCalendar';
import type { SocialPost } from '../types';

const mockPost: SocialPost = {
  id: 'post-1',
  profiles: ['profile-1'],
  body: 'Scheduled post content here.',
  media: [],
  status: 'scheduled',
  scheduledAt: new Date('2026-06-15T10:00:00Z'),
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  retryCount: 0,
};

const baseProps = {
  posts: [],
  selectedDate: new Date('2026-06-01'),
  onDateChange: vi.fn(),
  onPostEdit: vi.fn(),
  onPostDelete: vi.fn(),
  onPostDuplicate: vi.fn(),
  onCreatePost: vi.fn(),
  viewMode: 'month' as const,
  onViewModeChange: vi.fn(),
};

describe('PostCalendar', () => {
  it('renders without crashing', () => {
    const { container } = render(<PostCalendar {...baseProps} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders view mode selector', () => {
    render(<PostCalendar {...baseProps} />);
    expect(screen.getByText('Month')).toBeDefined();
  });

  it('renders with posts', () => {
    const { container } = render(<PostCalendar {...baseProps} posts={[mockPost]} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders in week view mode', () => {
    const { container } = render(<PostCalendar {...baseProps} viewMode="week" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders in day view mode', () => {
    const { container } = render(<PostCalendar {...baseProps} viewMode="day" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(<PostCalendar {...baseProps} />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
