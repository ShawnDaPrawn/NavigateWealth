import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComposeRequest } from '../types';

const posts = vi.hoisted(() => ({ createPost: vi.fn() }));
const assets = vi.hoisted(() => ({ markUsed: vi.fn() }));
const composer = vi.hoisted(() => ({
  onSubmit: null as
    | ((request: ComposeRequest, assetIds: string[]) => Promise<unknown> | unknown)
    | null,
}));

vi.mock('../hooks/useSocialProfiles', () => ({
  useSocialProfiles: () => ({ profiles: [], connectedProfiles: [], loading: false, error: null }),
  useBufferStatus: () => ({ data: { configured: true } }),
}));
vi.mock('../hooks/useSocialPosts', () => ({
  defaultPostRange: () => ({
    start: new Date(Date.now() - 14 * 86_400_000),
    end: new Date(Date.now() + 63 * 86_400_000),
  }),
  useSocialPosts: () => ({
    posts: [],
    range: {
      start: new Date(Date.now() - 14 * 86_400_000),
      end: new Date(Date.now() + 63 * 86_400_000),
    },
    setRange: vi.fn(),
    createPost: posts.createPost,
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
vi.mock('../hooks/useChannelAssets', () => ({
  useMarkChannelAssetsUsed: () => ({ mutate: assets.markUsed }),
}));
vi.mock('../hooks/useSocialAnalytics', () => ({
  useSocialAnalytics: () => ({
    data: { totals: { postCount: 9, reactions: 4, comments: 2, shares: 1 } },
    error: null,
  }),
}));
vi.mock('../channel-assets/ChannelAssetsTab', () => ({
  ChannelAssetsTab: () => <div>Assets tab body</div>,
}));
vi.mock('../assets/WeeklyPipelineTab', () => ({
  WeeklyPipelineTab: () => <div>Weekly pipeline body</div>,
}));

vi.mock('../PostComposer', () => ({
  PostComposer: (props: {
    onSubmit: (request: ComposeRequest, assetIds: string[]) => Promise<unknown> | unknown;
  }) => {
    composer.onSubmit = props.onSubmit;
    return <div>Composer body</div>;
  },
}));

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

  describe('composing with a library asset', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      composer.onSubmit = null;
    });

    const request = { channelIds: ['li'], text: 'hi', mode: 'now' } as ComposeRequest;

    it('takes the asset off the shelf once Buffer has the post', async () => {
      // Without this the asset stays `available` and the publishing routine
      // queues the same picture a second time.
      posts.createPost.mockResolvedValue({
        created: [{ channelId: 'li', platform: 'linkedin', postId: 'buf1', status: 'scheduled' }],
        failed: [],
      });
      render(<SocialMediaTab />);
      // Radix activates a tab on focus in its default automatic mode, so a
      // bare click does not switch panels under jsdom.
      const tab = screen.getByRole('tab', { name: 'Compose' });
      tab.focus();
      fireEvent.click(tab);
      await waitFor(() => expect(composer.onSubmit).not.toBeNull());

      await composer.onSubmit!(request, ['asset-1', 'asset-2']);
      expect(assets.markUsed).toHaveBeenCalledWith({
        ids: ['asset-1', 'asset-2'],
        bufferPostId: 'buf1',
      });
    });

    it('leaves the asset alone when Buffer took nothing', async () => {
      posts.createPost.mockResolvedValue({
        created: [],
        failed: [{ channelId: 'li', platform: 'linkedin', error: 'rejected' }],
      });
      render(<SocialMediaTab />);
      // Radix activates a tab on focus in its default automatic mode, so a
      // bare click does not switch panels under jsdom.
      const tab = screen.getByRole('tab', { name: 'Compose' });
      tab.focus();
      fireEvent.click(tab);
      await waitFor(() => expect(composer.onSubmit).not.toBeNull());

      await composer.onSubmit!(request, ['asset-1']);
      expect(assets.markUsed).not.toHaveBeenCalled();
    });

    it('does not call the endpoint for a post that carried no library asset', async () => {
      posts.createPost.mockResolvedValue({
        created: [{ channelId: 'li', platform: 'linkedin', postId: 'buf2', status: 'sent' }],
        failed: [],
      });
      render(<SocialMediaTab />);
      // Radix activates a tab on focus in its default automatic mode, so a
      // bare click does not switch panels under jsdom.
      const tab = screen.getByRole('tab', { name: 'Compose' });
      tab.focus();
      fireEvent.click(tab);
      await waitFor(() => expect(composer.onSubmit).not.toBeNull());

      await composer.onSubmit!(request, []);
      expect(assets.markUsed).not.toHaveBeenCalled();
    });
  });
});
