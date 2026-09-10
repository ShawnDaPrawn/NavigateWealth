import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PostComposer } from '../PostComposer';
import type { SocialProfile } from '../types';

const profiles: SocialProfile[] = [
  { id: 'li', platform: 'linkedin', name: 'Navigate Wealth', username: 'nw', isConnected: true },
  {
    id: 'ig',
    platform: 'instagram',
    name: 'navigate_wealth',
    username: 'navigate_wealth',
    isConnected: true,
  },
  { id: 'off', platform: 'x', name: 'Old X', username: 'old', isConnected: false },
];

function setup(selected: string[] = []) {
  const onSubmit = vi.fn().mockResolvedValue({ created: [{ channelId: 'li' }], failed: [] });
  const onProfilesChange = vi.fn();
  render(
    <PostComposer
      profiles={profiles}
      selectedProfiles={selected}
      onProfilesChange={onProfilesChange}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onProfilesChange };
}

beforeEach(() => vi.clearAllMocks());

describe('PostComposer', () => {
  it('lists only connected channels and explains what is missing', () => {
    setup();
    expect(screen.getByText('Navigate Wealth')).toBeDefined();
    expect(screen.queryByText('Old X')).toBeNull();
    expect(screen.getByText('Choose at least one channel.')).toBeDefined();
  });

  it('requires an image for Instagram', () => {
    setup(['ig']);
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Hello' } });
    expect(screen.getByText('Instagram posts need an image.')).toBeDefined();
  });

  it('submits a queue post with an image URL and a link', async () => {
    const { onSubmit } = setup(['li']);
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Hello world' } });
    fireEvent.change(screen.getByLabelText('Image URL'), {
      target: { value: 'https://cdn/a.png' },
    });
    fireEvent.click(screen.getByText('Add'));
    fireEvent.change(screen.getByLabelText('Link URL'), { target: { value: 'https://nw/a' } });
    fireEvent.click(screen.getByText('Add to queue'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      channelIds: ['li'],
      text: 'Hello world',
      mode: 'queue',
      images: [{ url: 'https://cdn/a.png', altText: 'a.png' }],
      link: { url: 'https://nw/a' },
    });
    // Full success resets the form
    await waitFor(() =>
      expect((screen.getByLabelText('Post text') as HTMLTextAreaElement).value).toBe(''),
    );
  });

  it('publishes now and flags an over-long X post', async () => {
    const { onSubmit } = setup(['li']);
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Short' } });
    fireEvent.click(screen.getByText('Publish now'));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mode: 'now' })),
    );
  });
});
