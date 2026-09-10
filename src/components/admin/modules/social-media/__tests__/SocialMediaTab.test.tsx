import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../hooks/useSocialProfiles', () => ({
  useSocialProfiles: () => ({ profiles: [], connectedProfiles: [], loading: false, error: null }),
  useBufferStatus: () => ({ data: { configured: true } }),
}));
vi.mock('../hooks/useSocialPosts', () => ({
  useSocialPosts: () => ({
    posts: [],
    createPost: vi.fn(),
    isCreating: false,
    deletePost: vi.fn(),
    getPostsByStatus: () => [
      { id: 'p', scheduledAt: new Date(Date.now() + 86_400_000), status: 'scheduled' },
    ],
  }),
}));
vi.mock('../hooks/useSocialAssets', () => ({
  useSocialBatches: () => ({ data: [], isLoading: false, error: null }),
}));
vi.mock('../hooks/useSocialAnalytics', () => ({
  useSocialAnalytics: () => ({
    data: { totals: { postCount: 9, reactions: 4, comments: 2, shares: 1 } },
    error: null,
  }),
}));
vi.mock('../assets/AssetsTab', () => ({ AssetsTab: () => <div>Assets tab body</div> }));

import { SocialMediaTab } from '../SocialMediaTab';

describe('SocialMediaTab', () => {
  it('renders real stat cards and lands on the Assets tab', () => {
    render(<SocialMediaTab />);
    expect(screen.getByText('Assets this week')).toBeDefined();
    expect(screen.getByText('Queued in Buffer')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('9')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText('Assets tab body')).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Channels' })).toBeDefined();
  });
});
