import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DraftPosts } from '../DraftPosts';
import type { SocialPost } from '../../types';

vi.mock('../../constants', () => ({
  BRAND: { navy: '#1B2A4A', gold: '#C9A84C' },
  PLATFORM_DISPLAY: {
    facebook: { label: 'Facebook', color: '#1877F2' },
    instagram: { label: 'Instagram', color: '#E1306C' },
    linkedin: { label: 'LinkedIn', color: '#0A66C2' },
    twitter: { label: 'Twitter', color: '#1DA1F2' },
  },
  formatDateZA: (d: Date) => d.toLocaleDateString(),
  formatTimeZA: (d: Date) => d.toLocaleTimeString(),
}));

const mockPost: SocialPost = {
  id: 'post-1',
  profiles: ['profile-1'],
  body: 'This is a draft post body content.',
  media: [],
  status: 'draft',
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  retryCount: 0,
};

const profileNameLookup = {
  'profile-1': { name: 'Navigate Wealth', platform: 'linkedin' as const },
};

describe('DraftPosts', () => {
  it('renders without crashing with empty posts', () => {
    const { container } = render(<DraftPosts posts={[]} profileNameLookup={{}} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders empty state message when no drafts', () => {
    render(<DraftPosts posts={[]} profileNameLookup={{}} />);
    expect(screen.getByText(/No draft/i)).toBeDefined();
  });

  it('renders draft post body', () => {
    render(<DraftPosts posts={[mockPost]} profileNameLookup={profileNameLookup} />);
    expect(screen.getByText(/draft post body/i)).toBeDefined();
  });

  it('renders search input when more than 3 posts', () => {
    const manyPosts = [1, 2, 3, 4].map((n) => ({ ...mockPost, id: `post-${n}` }));
    render(<DraftPosts posts={manyPosts} profileNameLookup={profileNameLookup} />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('renders non-empty container', () => {
    const { container } = render(
      <DraftPosts posts={[mockPost]} profileNameLookup={profileNameLookup} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
