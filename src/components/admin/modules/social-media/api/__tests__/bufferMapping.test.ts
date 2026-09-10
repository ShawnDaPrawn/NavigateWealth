import { describe, it, expect } from 'vitest';
import { bufferPostToSocialPost, channelToProfile } from '../bufferMapping';

describe('channelToProfile', () => {
  it('falls back to the service slug when the server could not map the platform', () => {
    const profile = channelToProfile({
      id: 'c',
      name: 'nw',
      displayName: null,
      service: 'facebook',
      type: 'page',
      avatar: '',
      isDisconnected: true,
      isLocked: false,
      timezone: 'UTC',
      externalLink: null,
      platform: null,
      isConnected: false,
    });
    expect(profile).toMatchObject({
      platform: 'facebook',
      name: 'nw',
      isConnected: false,
      accountType: 'organization',
      postingSchedule: [],
    });
  });

  it('maps twitter to x when the platform is missing', () => {
    expect(
      channelToProfile({
        id: 'c',
        name: 'n',
        displayName: 'N',
        service: 'twitter',
        type: 'profile',
        avatar: '',
        isDisconnected: false,
        isLocked: false,
        timezone: 'UTC',
        externalLink: null,
        platform: null,
        isConnected: true,
      }).platform,
    ).toBe('x');
  });
});

describe('bufferPostToSocialPost', () => {
  it('keeps a failed post’s reason and leaves dates undefined when Buffer has none', () => {
    const post = bufferPostToSocialPost({
      id: 'p',
      channelId: 'c',
      channelService: 'instagram',
      text: 't',
      status: 'error',
      dueAt: null,
      sentAt: null,
      externalLink: null,
      via: 'buffer',
      schedulingType: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      error: { message: 'Token expired' },
      assets: [],
      tags: [],
      platform: null,
      appStatus: 'failed',
    });
    expect(post).toMatchObject({
      platform: 'instagram',
      status: 'failed',
      failureReason: 'Token expired',
      media: [],
      tags: [],
    });
    expect(post.scheduledAt).toBeUndefined();
    expect(post.publishedAt).toBeUndefined();
  });
});
