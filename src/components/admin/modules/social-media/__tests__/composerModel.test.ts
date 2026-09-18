import { describe, it, expect } from 'vitest';
import {
  assetIdsInDraft,
  assetToMediaFile,
  buildComposeRequest,
  characterLimitFor,
  combineDateAndTime,
  composeBlocker,
  countForPlatform,
  effectiveTextFor,
  isOverLimit,
  toIsoWithOffset,
} from '../composerModel';
import type { ChannelAsset, SocialProfile } from '../types';

const profile = (id: string, platform: SocialProfile['platform']): SocialProfile => ({
  id,
  platform,
  name: id,
  username: id,
  isConnected: true,
});

describe('character limits', () => {
  it('takes the strictest selected platform', () => {
    expect(characterLimitFor(['linkedin', 'x'])).toBe(280);
    expect(characterLimitFor(['linkedin', 'instagram'])).toBe(2200);
    expect(characterLimitFor([])).toBe(280);
  });

  it('counts links as 23 characters on X only', () => {
    const text =
      'Read this https://www.navigatewealth.co/resources/article/a-very-long-slug-indeed';
    expect(countForPlatform(text, 'x')).toBe('Read this '.length + 23);
    expect(countForPlatform(text, 'linkedin')).toBe(text.length);
    expect(isOverLimit({ text: 'x'.repeat(281), linkUrl: '' }, ['x'])).toBe(true);
    expect(isOverLimit({ text: 'x'.repeat(281), linkUrl: '' }, ['linkedin'])).toBe(false);
  });

  it('counts the link the server appends for X, but only when it is not already in the body', () => {
    const body = 'x'.repeat(230);
    expect(effectiveTextFor({ text: body, linkUrl: 'https://nw/a' }, 'x')).toBe(
      `${body}\nhttps://nw/a`,
    );
    expect(effectiveTextFor({ text: body, linkUrl: 'https://nw/a' }, 'linkedin')).toBe(body);
    expect(effectiveTextFor({ text: `${body} https://nw/a`, linkUrl: 'https://nw/a' }, 'x')).toBe(
      `${body} https://nw/a`,
    );
    // 230 + newline + 23 for the link = 254 <= 280, but 260 + 24 = 284 > 280
    expect(isOverLimit({ text: body, linkUrl: 'https://nw/a' }, ['x'])).toBe(false);
    expect(isOverLimit({ text: 'x'.repeat(260), linkUrl: 'https://nw/a' }, ['x'])).toBe(true);
  });
});

describe('dates', () => {
  it('formats an ISO string with the local offset and combines date + time', () => {
    const at = combineDateAndTime(new Date(2026, 8, 15, 0, 0, 0), '07:30');
    expect(at.getHours()).toBe(7);
    expect(at.getMinutes()).toBe(30);
    const iso = toIsoWithOffset(at);
    expect(iso).toMatch(/^2026-09-15T07:30:00[+-]\d{2}:\d{2}$/);
  });
});

describe('buildComposeRequest', () => {
  const draft = {
    text: '  Hello  ',
    channelIds: ['c1'],
    media: [
      {
        id: 'm1',
        url: 'blob:x',
        type: 'image' as const,
        filename: 'a.png',
        size: 0,
        storagePath: 'u/a.png',
      },
      {
        id: 'm2',
        url: 'https://cdn/b.png',
        type: 'image' as const,
        filename: 'b.png',
        size: 0,
        alt: 'B',
      },
      { id: 'm3', url: 'https://cdn/v.mp4', type: 'video' as const, filename: 'v.mp4', size: 0 },
    ],
    linkUrl: ' https://nw/a ',
    linkTitle: 'A',
  };

  it('prefers the private storage path over the URL, drops videos, trims text and link', () => {
    const req = buildComposeRequest(draft, 'queue');
    expect(req).toEqual({
      channelIds: ['c1'],
      text: 'Hello',
      mode: 'queue',
      images: [
        { storagePath: 'u/a.png', altText: 'a.png' },
        { url: 'https://cdn/b.png', altText: 'B' },
      ],
      link: { url: 'https://nw/a', title: 'A' },
    });
  });

  it('adds scheduledAt only for the scheduled mode', () => {
    const at = new Date(2026, 8, 15, 7, 30);
    expect(buildComposeRequest(draft, 'scheduled', at).scheduledAt).toMatch(/^2026-09-15T07:30:00/);
    expect(buildComposeRequest(draft, 'now', at).scheduledAt).toBeUndefined();
    expect(buildComposeRequest({ ...draft, linkUrl: '', media: [] }, 'draft')).toEqual({
      channelIds: ['c1'],
      text: 'Hello',
      mode: 'draft',
    });
  });
});

describe('composeBlocker', () => {
  const profiles = [profile('li', 'linkedin'), profile('ig', 'instagram'), profile('x', 'x')];
  const base = { text: 'Hello', channelIds: ['li'], media: [], linkUrl: '', linkTitle: '' };

  it('explains what is missing, in priority order', () => {
    expect(composeBlocker({ ...base, channelIds: [] }, profiles)).toBe(
      'Choose at least one channel.',
    );
    expect(composeBlocker({ ...base, text: '  ' }, profiles)).toBe('Write the post text.');
    expect(composeBlocker({ ...base, channelIds: ['x'], text: 'y'.repeat(300) }, profiles)).toBe(
      'The text is too long for a selected channel.',
    );
    expect(
      composeBlocker(
        { ...base, channelIds: ['x'], text: 'y'.repeat(260), linkUrl: 'https://nw/a' },
        profiles,
      ),
    ).toBe('The text is too long for a selected channel.');
    expect(composeBlocker({ ...base, channelIds: ['ig'] }, profiles)).toBe(
      'Instagram posts need an image.',
    );
    expect(composeBlocker(base, profiles)).toBeNull();
    expect(
      composeBlocker(
        {
          ...base,
          channelIds: ['ig'],
          media: [{ id: 'm', url: 'u', type: 'image', filename: 'f', size: 0 }],
        },
        profiles,
      ),
    ).toBeNull();
  });
});

describe('carrying a library asset through compose', () => {
  const asset = (id: string): ChannelAsset =>
    ({
      id,
      channel: 'instagram',
      media_type: 'image',
      storage_path: `channels/instagram/${id}.png`,
      url: `https://cdn.test/${id}.png`,
      file_name: `${id}.png`,
      content_type: 'image/png',
      byte_size: 1024,
      alt_text: 'A chart',
      status: 'available',
    }) as ChannelAsset;

  it('keeps the asset id recoverable from the draft', () => {
    // The compose request has no room for a row id, so the id rides in the
    // media id. If this breaks, nothing marks the asset used and the
    // publishing routine posts the same picture again.
    const draft = {
      text: 'x',
      channelIds: ['ig'],
      media: [assetToMediaFile(asset('11111111-2222-3333-4444-555555555555'))],
      linkUrl: '',
      linkTitle: '',
    };
    expect(assetIdsInDraft(draft)).toEqual(['11111111-2222-3333-4444-555555555555']);
  });

  it('ignores media that did not come from the library', () => {
    const draft = {
      text: 'x',
      channelIds: ['ig'],
      media: [
        { id: 'ai_img_2026-W38/gen.png', url: 'u', type: 'image' as const, filename: 'f', size: 0 },
        { id: 'manual', url: 'u', type: 'image' as const, filename: 'f', size: 0 },
        assetToMediaFile(asset('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')),
      ],
      linkUrl: '',
      linkTitle: '',
    };
    expect(assetIdsInDraft(draft)).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);
  });

  it('sends the asset by URL, because the bucket copy is already public', () => {
    // storagePath means "copy this out of the private AI bucket" — an asset
    // must not take that path or it would be duplicated into the post.
    const media = assetToMediaFile(asset('cafe0000-0000-4000-8000-000000000001'));
    expect(media.storagePath).toBeUndefined();
    const request = buildComposeRequest(
      { text: 'x', channelIds: ['ig'], media: [media], linkUrl: '', linkTitle: '' },
      'now',
    );
    expect(request.images).toEqual([
      { url: 'https://cdn.test/cafe0000-0000-4000-8000-000000000001.png', altText: 'A chart' },
    ]);
  });
});
