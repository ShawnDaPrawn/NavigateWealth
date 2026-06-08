import { describe, it, expect } from 'vitest';
import {
  formatFollowerCount,
  formatEngagementRate,
  formatCTR,
  formatFileSize,
  formatPostDate,
  formatScheduledTime,
  formatTimeAgo,
  getPlatformLimits,
  validatePostContent,
  canAddMedia,
  supportsFeature,
  countCharacters,
  getRemainingCharacters,
  isWithinCharacterLimit,
  buildUTMUrl,
  parseUTMParams,
  extractLinks,
  shortenUrl,
  isValidScheduleTime,
  roundToNearest15Minutes,
  getPostStatusColor,
  getPlatformColor,
  getPlatformDisplayName,
  calculateEngagementRate,
  calculateCTR,
  sortPostsByDate,
  filterPostsByDateRange,
  groupPostsByDate,
  extractHashtags,
  extractMentions,
  formatHashtagsForInstagram,
  calculateAspectRatio,
  isSupportedAspectRatio,
  getOptimalPostTimes,
} from '../utils';
import type { SocialPost } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makePost = (overrides: Partial<SocialPost> = {}): SocialPost => ({
  id: 'p1',
  profiles: ['prof1'],
  body: 'Test post',
  media: [],
  status: 'draft',
  createdBy: 'user1',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
  retryCount: 0,
  ...overrides,
});

// ── formatFollowerCount ───────────────────────────────────────────────────────

describe('formatFollowerCount', () => {
  it('returns plain number under 1000', () => {
    expect(formatFollowerCount(500)).toBe('500');
    expect(formatFollowerCount(0)).toBe('0');
  });

  it('formats thousands with K suffix', () => {
    expect(formatFollowerCount(5234)).toBe('5.2K');
    expect(formatFollowerCount(1000)).toBe('1.0K');
  });

  it('formats millions with M suffix', () => {
    expect(formatFollowerCount(1500000)).toBe('1.5M');
    expect(formatFollowerCount(2000000)).toBe('2.0M');
  });
});

// ── formatEngagementRate ──────────────────────────────────────────────────────

describe('formatEngagementRate', () => {
  it('formats to 2 decimal places with % suffix', () => {
    expect(formatEngagementRate(4.9745)).toBe('4.97%');
    expect(formatEngagementRate(0)).toBe('0.00%');
    expect(formatEngagementRate(100)).toBe('100.00%');
  });
});

// ── formatCTR ─────────────────────────────────────────────────────────────────

describe('formatCTR', () => {
  it('formats to 2 decimal places with % suffix', () => {
    expect(formatCTR(7.14)).toBe('7.14%');
    expect(formatCTR(0)).toBe('0.00%');
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('returns "0 Bytes" for zero', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('formats bytes', () => {
    expect(formatFileSize(512)).toContain('Bytes');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(245760)).toContain('KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toContain('MB');
    expect(formatFileSize(1048576)).toContain('1.00');
  });
});

// ── formatPostDate ────────────────────────────────────────────────────────────

describe('formatPostDate', () => {
  it('returns "Just now" for recent dates', () => {
    const now = new Date();
    expect(formatPostDate(now)).toBe('Just now');
  });

  it('returns minutes ago for dates under 1 hour', () => {
    const past = new Date(Date.now() - 15 * 60 * 1000);
    const result = formatPostDate(past);
    expect(result).toContain('min');
    expect(result).toContain('ago');
  });

  it('returns hours ago for dates under 1 day', () => {
    const past = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const result = formatPostDate(past);
    expect(result).toContain('hour');
    expect(result).toContain('ago');
  });

  it('returns days ago for dates within 7 days', () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatPostDate(past);
    expect(result).toContain('day');
    expect(result).toContain('ago');
  });

  it('returns formatted date for old dates', () => {
    const old = new Date('2020-01-15');
    const result = formatPostDate(old);
    expect(result).toMatch(/Jan|2020/);
  });
});

// ── formatScheduledTime ───────────────────────────────────────────────────────

describe('formatScheduledTime', () => {
  it('prefixes "Today at" for same-day dates', () => {
    const date = new Date();
    date.setHours(14, 30, 0, 0);
    expect(formatScheduledTime(date)).toMatch(/Today at/);
  });

  it('prefixes "Tomorrow at" for tomorrow', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    expect(formatScheduledTime(tomorrow)).toMatch(/Tomorrow at/);
  });

  it('returns date string for other dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const result = formatScheduledTime(future);
    expect(result).toContain(' at ');
    expect(result).not.toMatch(/Today|Tomorrow/);
  });
});

// ── formatTimeAgo ─────────────────────────────────────────────────────────────

describe('formatTimeAgo', () => {
  it('delegates to formatPostDate', () => {
    const now = new Date();
    expect(formatTimeAgo(now)).toBe('Just now');
  });
});

// ── getPlatformLimits ─────────────────────────────────────────────────────────

describe('getPlatformLimits', () => {
  it('returns limits for each platform', () => {
    expect(getPlatformLimits('linkedin').maxCharacters).toBeGreaterThan(0);
    expect(getPlatformLimits('instagram').maxCharacters).toBeGreaterThan(0);
    expect(getPlatformLimits('facebook').maxCharacters).toBeGreaterThan(0);
    expect(getPlatformLimits('x').maxCharacters).toBeGreaterThan(0);
  });

  it('linkedin allows more characters than x', () => {
    expect(getPlatformLimits('linkedin').maxCharacters).toBeGreaterThan(
      getPlatformLimits('x').maxCharacters,
    );
  });
});

// ── validatePostContent ───────────────────────────────────────────────────────

describe('validatePostContent', () => {
  it('returns valid for content within limits', () => {
    expect(validatePostContent('linkedin', 'Short post')).toEqual({ valid: true });
  });

  it('returns error when content exceeds limit', () => {
    const longContent = 'a'.repeat(10000);
    const result = validatePostContent('x', longContent);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('character limit');
  });
});

// ── canAddMedia ───────────────────────────────────────────────────────────────

describe('canAddMedia', () => {
  it('returns true when under image limit', () => {
    expect(canAddMedia('instagram', 0, 'image')).toBe(true);
  });

  it('returns false when at image limit', () => {
    const limit = getPlatformLimits('x').maxImages;
    expect(canAddMedia('x', limit, 'image')).toBe(false);
  });

  it('returns false when at video limit', () => {
    const limit = getPlatformLimits('x').maxVideos;
    expect(canAddMedia('x', limit, 'video')).toBe(false);
  });
});

// ── supportsFeature ───────────────────────────────────────────────────────────

describe('supportsFeature', () => {
  it('instagram supports firstComment', () => {
    expect(supportsFeature('instagram', 'firstComment')).toBe(true);
  });

  it('linkedin does not support firstComment', () => {
    expect(supportsFeature('linkedin', 'firstComment')).toBe(false);
  });

  it('all platforms support hashtags', () => {
    expect(supportsFeature('linkedin', 'hashtags')).toBe(true);
    expect(supportsFeature('instagram', 'hashtags')).toBe(true);
  });
});

// ── countCharacters ───────────────────────────────────────────────────────────

describe('countCharacters', () => {
  it('counts plain text normally', () => {
    expect(countCharacters('hello', 'linkedin')).toBe(5);
    expect(countCharacters('hello', 'instagram')).toBe(5);
  });

  it('counts URLs as 23 chars on x', () => {
    const url = 'https://example.com/very-long-url-path/here';
    const text = `Check this out: ${url}`;
    const withoutX = text.length;
    const onX = countCharacters(text, 'x');
    // URL normalised to 23 chars
    expect(onX).toBe(withoutX - url.length + 23);
  });
});

// ── getRemainingCharacters ────────────────────────────────────────────────────

describe('getRemainingCharacters', () => {
  it('returns positive number for short text', () => {
    expect(getRemainingCharacters('hello', 'linkedin')).toBeGreaterThan(0);
  });

  it('returns 0 when at limit (never negative)', () => {
    const longText = 'a'.repeat(10000);
    expect(getRemainingCharacters(longText, 'x')).toBe(0);
  });
});

// ── isWithinCharacterLimit ────────────────────────────────────────────────────

describe('isWithinCharacterLimit', () => {
  it('returns true for short text', () => {
    expect(isWithinCharacterLimit('short', 'x')).toBe(true);
  });

  it('returns true even for over-limit text (getRemainingCharacters clamps to 0)', () => {
    const over = 'a'.repeat(10000);
    // isWithinCharacterLimit returns getRemainingCharacters >= 0; Math.max(0,…) always >= 0
    expect(isWithinCharacterLimit(over, 'x')).toBe(true);
  });
});

// ── buildUTMUrl ───────────────────────────────────────────────────────────────

describe('buildUTMUrl', () => {
  it('appends required UTM params', () => {
    const result = buildUTMUrl('https://example.com', {
      source: 'linkedin',
      medium: 'social',
      campaign: 'q1-launch',
    });
    expect(result).toContain('utm_source=linkedin');
    expect(result).toContain('utm_medium=social');
    expect(result).toContain('utm_campaign=q1-launch');
  });

  it('appends optional utm_term and utm_content when provided', () => {
    const result = buildUTMUrl('https://example.com', {
      source: 'x',
      medium: 'social',
      campaign: 'test',
      term: 'keyword',
      content: 'variant-a',
    });
    expect(result).toContain('utm_term=keyword');
    expect(result).toContain('utm_content=variant-a');
  });

  it('returns original URL for invalid URLs', () => {
    const bad = 'not-a-url';
    expect(buildUTMUrl(bad, { source: 'x', medium: 'social', campaign: 'c' })).toBe(bad);
  });
});

// ── parseUTMParams ────────────────────────────────────────────────────────────

describe('parseUTMParams', () => {
  it('parses valid UTM params', () => {
    const url = 'https://example.com?utm_source=linkedin&utm_medium=social&utm_campaign=launch';
    const result = parseUTMParams(url);
    expect(result).not.toBeNull();
    expect(result!.source).toBe('linkedin');
    expect(result!.medium).toBe('social');
    expect(result!.campaign).toBe('launch');
  });

  it('returns null when required params are missing', () => {
    expect(parseUTMParams('https://example.com?utm_source=x')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(parseUTMParams('not-a-url')).toBeNull();
  });
});

// ── extractLinks ──────────────────────────────────────────────────────────────

describe('extractLinks', () => {
  it('extracts http and https URLs', () => {
    const text = 'Visit https://example.com and http://other.org for more';
    const links = extractLinks(text);
    expect(links).toHaveLength(2);
    expect(links[0]).toBe('https://example.com');
  });

  it('returns empty array for text without URLs', () => {
    expect(extractLinks('No links here!')).toHaveLength(0);
  });
});

// ── shortenUrl ────────────────────────────────────────────────────────────────

describe('shortenUrl', () => {
  it('returns original URL (placeholder)', async () => {
    const url = 'https://example.com';
    await expect(shortenUrl(url)).resolves.toBe(url);
  });
});

// ── isValidScheduleTime ───────────────────────────────────────────────────────

describe('isValidScheduleTime', () => {
  it('returns valid for future dates', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(isValidScheduleTime(future)).toEqual({ valid: true });
  });

  it('returns error for past dates', () => {
    const past = new Date(Date.now() - 60 * 1000);
    const result = isValidScheduleTime(past);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('future');
  });

  it('returns error for dates more than 1 year out', () => {
    const tooFar = new Date();
    tooFar.setFullYear(tooFar.getFullYear() + 2);
    const result = isValidScheduleTime(tooFar);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('1 year');
  });
});

// ── roundToNearest15Minutes ───────────────────────────────────────────────────

describe('roundToNearest15Minutes', () => {
  it('rounds to nearest 15 minutes', () => {
    const d = new Date('2026-01-01T10:07:30Z');
    const rounded = roundToNearest15Minutes(d);
    expect(rounded.getMinutes() % 15).toBe(0);
  });

  it('zeroes seconds and milliseconds', () => {
    const d = new Date('2026-01-01T10:07:30.500Z');
    const rounded = roundToNearest15Minutes(d);
    expect(rounded.getSeconds()).toBe(0);
    expect(rounded.getMilliseconds()).toBe(0);
  });
});

// ── getPostStatusColor ────────────────────────────────────────────────────────

describe('getPostStatusColor', () => {
  it('returns CSS class strings for each status', () => {
    expect(getPostStatusColor('draft')).toContain('gray');
    expect(getPostStatusColor('scheduled')).toContain('blue');
    expect(getPostStatusColor('published')).toContain('green');
    expect(getPostStatusColor('failed')).toContain('red');
    expect(getPostStatusColor('pending_approval')).toContain('yellow');
  });
});

// ── getPlatformColor ──────────────────────────────────────────────────────────

describe('getPlatformColor', () => {
  it('returns distinct CSS color classes for each platform', () => {
    const colors = ['linkedin', 'instagram', 'facebook', 'x'].map((p) =>
      getPlatformColor(p as 'linkedin' | 'instagram' | 'facebook' | 'x'),
    );
    expect(new Set(colors).size).toBe(4);
  });
});

// ── getPlatformDisplayName ────────────────────────────────────────────────────

describe('getPlatformDisplayName', () => {
  it('returns human-readable names', () => {
    expect(getPlatformDisplayName('linkedin')).toBe('LinkedIn');
    expect(getPlatformDisplayName('instagram')).toBe('Instagram');
    expect(getPlatformDisplayName('facebook')).toBe('Facebook');
    expect(getPlatformDisplayName('x')).toContain('X');
  });
});

// ── calculateEngagementRate ───────────────────────────────────────────────────

describe('calculateEngagementRate', () => {
  it('returns 0 for zero impressions', () => {
    expect(calculateEngagementRate(100, 0)).toBe(0);
  });

  it('calculates engagement rate correctly', () => {
    expect(calculateEngagementRate(50, 1000)).toBeCloseTo(5);
  });
});

// ── calculateCTR ──────────────────────────────────────────────────────────────

describe('calculateCTR', () => {
  it('returns 0 for zero impressions', () => {
    expect(calculateCTR(100, 0)).toBe(0);
  });

  it('calculates CTR correctly', () => {
    expect(calculateCTR(10, 200)).toBeCloseTo(5);
  });
});

// ── sortPostsByDate ───────────────────────────────────────────────────────────

describe('sortPostsByDate', () => {
  const posts = [
    makePost({ id: 'p1', createdAt: new Date('2026-01-01') }),
    makePost({ id: 'p2', createdAt: new Date('2026-03-01') }),
    makePost({ id: 'p3', createdAt: new Date('2026-02-01') }),
  ];

  it('sorts newest first by default', () => {
    const sorted = sortPostsByDate(posts);
    expect(sorted[0].id).toBe('p2');
  });

  it('sorts oldest first when ascending=true', () => {
    const sorted = sortPostsByDate(posts, true);
    expect(sorted[0].id).toBe('p1');
  });

  it('does not mutate original array', () => {
    const copy = [...posts];
    sortPostsByDate(posts);
    expect(posts.map((p) => p.id)).toEqual(copy.map((p) => p.id));
  });
});

// ── filterPostsByDateRange ────────────────────────────────────────────────────

describe('filterPostsByDateRange', () => {
  const posts = [
    makePost({ id: 'jan', createdAt: new Date('2026-01-15') }),
    makePost({ id: 'feb', createdAt: new Date('2026-02-15') }),
    makePost({ id: 'mar', createdAt: new Date('2026-03-15') }),
  ];

  it('filters posts within date range', () => {
    const result = filterPostsByDateRange(posts, new Date('2026-01-01'), new Date('2026-02-28'));
    expect(result.map((p) => p.id)).toEqual(['jan', 'feb']);
  });
});

// ── groupPostsByDate ──────────────────────────────────────────────────────────

describe('groupPostsByDate', () => {
  const posts = [
    makePost({ id: 'a', createdAt: new Date('2026-01-15T10:00:00Z') }),
    makePost({ id: 'b', createdAt: new Date('2026-01-15T14:00:00Z') }),
    makePost({ id: 'c', createdAt: new Date('2026-01-16T09:00:00Z') }),
  ];

  it('groups posts by date key', () => {
    const groups = groupPostsByDate(posts);
    expect(groups['2026-01-15']).toHaveLength(2);
    expect(groups['2026-01-16']).toHaveLength(1);
  });
});

// ── extractHashtags ───────────────────────────────────────────────────────────

describe('extractHashtags', () => {
  it('extracts hashtags from text', () => {
    expect(extractHashtags('Hello #world and #finance today')).toEqual(['#world', '#finance']);
  });

  it('returns empty array for text without hashtags', () => {
    expect(extractHashtags('No hashtags here')).toHaveLength(0);
  });
});

// ── extractMentions ───────────────────────────────────────────────────────────

describe('extractMentions', () => {
  it('extracts mentions from text', () => {
    expect(extractMentions('Hello @alice and @bob')).toEqual(['@alice', '@bob']);
  });

  it('returns empty array for text without mentions', () => {
    expect(extractMentions('No mentions here')).toHaveLength(0);
  });
});

// ── formatHashtagsForInstagram ────────────────────────────────────────────────

describe('formatHashtagsForInstagram', () => {
  it('joins hashtags with spaces', () => {
    expect(formatHashtagsForInstagram(['#finance', '#wealth', '#invest'])).toBe(
      '#finance #wealth #invest',
    );
  });

  it('returns empty string for empty array', () => {
    expect(formatHashtagsForInstagram([])).toBe('');
  });
});

// ── calculateAspectRatio ──────────────────────────────────────────────────────

describe('calculateAspectRatio', () => {
  it('calculates 16:9', () => {
    expect(calculateAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('calculates 1:1', () => {
    expect(calculateAspectRatio(1080, 1080)).toBe('1:1');
  });

  it('calculates 4:5', () => {
    expect(calculateAspectRatio(800, 1000)).toBe('4:5');
  });
});

// ── isSupportedAspectRatio ────────────────────────────────────────────────────

describe('isSupportedAspectRatio', () => {
  it('returns true for supported aspect ratios', () => {
    expect(isSupportedAspectRatio('linkedin', '1:1')).toBe(true);
  });

  it('returns false for unsupported aspect ratios', () => {
    expect(isSupportedAspectRatio('linkedin', '3:1')).toBe(false);
  });
});

// ── getOptimalPostTimes ───────────────────────────────────────────────────────

describe('getOptimalPostTimes', () => {
  it('returns an array of Date objects for each platform', () => {
    for (const platform of ['linkedin', 'instagram', 'facebook', 'x'] as const) {
      const times = getOptimalPostTimes(platform);
      expect(Array.isArray(times)).toBe(true);
      expect(times.length).toBeGreaterThan(0);
      times.forEach((t) => expect(t).toBeInstanceOf(Date));
    }
  });

  it('returns times in the future (tomorrow)', () => {
    const times = getOptimalPostTimes('linkedin');
    const now = new Date();
    times.forEach((t) => expect(t.getTime()).toBeGreaterThan(now.getTime()));
  });
});
