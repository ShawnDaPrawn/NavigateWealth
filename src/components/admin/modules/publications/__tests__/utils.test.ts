import { describe, it, expect } from 'vitest';
import type { Article, CreateArticleInput } from '../types';
import {
  generateSlug,
  isSlugAvailable,
  generateUniqueSlug,
  canTransitionStatus,
  getStatusColor,
  getStatusLabel,
  isPublished,
  isScheduledForFuture,
  shouldAutoPublish,
  getArticleImageUrl,
  filterByStatus,
  filterByCategory,
  filterByType,
  searchArticles,
  getFeaturedArticles,
  sortByDate,
  sortByTitle,
  sortByFeatured,
  validateArticle,
  validateCategory,
  validateContentType,
  formatPublishDate,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  truncateText,
  groupByStatus,
  groupByCategory,
} from '../utils';

const makeArticle = (overrides: Partial<Article> = {}): Article => ({
  id: 'a1',
  title: 'Test Article',
  slug: 'test-article',
  excerpt: 'Test excerpt',
  category_id: 'cat1',
  type_id: 'type1',
  status: 'draft',
  is_featured: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── generateSlug ─────────────────────────────────────────────────────────────

describe('generateSlug', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(generateSlug('My Article Title')).toBe('my-article-title');
  });

  it('removes special characters', () => {
    expect(generateSlug('Hello, World!')).toBe('hello-world');
    expect(generateSlug("It's a Test")).toBe('its-a-test');
  });

  it('strips leading/trailing hyphens', () => {
    expect(generateSlug('  Hello World  ')).toBe('hello-world');
  });

  it('collapses multiple spaces/hyphens', () => {
    expect(generateSlug('Hello   World')).toBe('hello-world');
    expect(generateSlug('Hello--World')).toBe('hello-world');
  });

  it('handles numbers in title', () => {
    expect(generateSlug('Financial Planning 101')).toBe('financial-planning-101');
  });
});

// ── isSlugAvailable ───────────────────────────────────────────────────────────

describe('isSlugAvailable', () => {
  const articles = [makeArticle({ id: 'a1', slug: 'existing-slug' })];

  it('returns true when slug does not exist', () => {
    expect(isSlugAvailable('new-slug', articles)).toBe(true);
  });

  it('returns false when slug already taken', () => {
    expect(isSlugAvailable('existing-slug', articles)).toBe(false);
  });

  it('returns true when slug belongs to excluded article', () => {
    expect(isSlugAvailable('existing-slug', articles, 'a1')).toBe(true);
  });
});

// ── generateUniqueSlug ────────────────────────────────────────────────────────

describe('generateUniqueSlug', () => {
  it('returns base slug when available', () => {
    expect(generateUniqueSlug('new-slug', [])).toBe('new-slug');
  });

  it('appends counter when slug is taken', () => {
    const articles = [makeArticle({ slug: 'my-article' })];
    expect(generateUniqueSlug('my-article', articles)).toBe('my-article-2');
  });

  it('increments counter until available', () => {
    const articles = [
      makeArticle({ id: 'a1', slug: 'my-article' }),
      makeArticle({ id: 'a2', slug: 'my-article-2' }),
    ];
    expect(generateUniqueSlug('my-article', articles)).toBe('my-article-3');
  });
});

// ── canTransitionStatus ───────────────────────────────────────────────────────

describe('canTransitionStatus', () => {
  it('allows draft → published', () => {
    expect(canTransitionStatus('draft', 'published')).toBe(true);
  });

  it('allows draft → in_review', () => {
    expect(canTransitionStatus('draft', 'in_review')).toBe(true);
  });

  it('allows published → archived', () => {
    expect(canTransitionStatus('published', 'archived')).toBe(true);
  });

  it('disallows archived → published directly', () => {
    expect(canTransitionStatus('archived', 'published')).toBe(false);
  });

  it('allows archived → draft', () => {
    expect(canTransitionStatus('archived', 'draft')).toBe(true);
  });

  it('allows in_review → scheduled', () => {
    expect(canTransitionStatus('in_review', 'scheduled')).toBe(true);
  });

  it('disallows published → draft', () => {
    expect(canTransitionStatus('published', 'draft')).toBe(false);
  });
});

// ── getStatusColor ────────────────────────────────────────────────────────────

describe('getStatusColor', () => {
  it('returns green for published', () => {
    expect(getStatusColor('published')).toContain('green');
  });

  it('returns gray for draft', () => {
    expect(getStatusColor('draft')).toContain('gray');
  });

  it('returns yellow for in_review', () => {
    expect(getStatusColor('in_review')).toContain('yellow');
  });

  it('returns blue for scheduled', () => {
    expect(getStatusColor('scheduled')).toContain('blue');
  });

  it('returns red for archived', () => {
    expect(getStatusColor('archived')).toContain('red');
  });
});

// ── getStatusLabel ────────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it('returns human-readable labels', () => {
    expect(getStatusLabel('draft')).toBe('Draft');
    expect(getStatusLabel('in_review')).toBe('In Review');
    expect(getStatusLabel('scheduled')).toBe('Scheduled');
    expect(getStatusLabel('published')).toBe('Published');
    expect(getStatusLabel('archived')).toBe('Archived');
  });
});

// ── isPublished ───────────────────────────────────────────────────────────────

describe('isPublished', () => {
  it('returns true for published article with published_at', () => {
    expect(isPublished(makeArticle({ status: 'published', published_at: '2026-01-01' }))).toBe(
      true,
    );
  });

  it('returns false for draft', () => {
    expect(isPublished(makeArticle({ status: 'draft' }))).toBe(false);
  });

  it('returns false for published but missing published_at', () => {
    expect(isPublished(makeArticle({ status: 'published', published_at: null }))).toBe(false);
  });
});

// ── isScheduledForFuture ──────────────────────────────────────────────────────

describe('isScheduledForFuture', () => {
  it('returns true for scheduled article with future date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isScheduledForFuture(makeArticle({ status: 'scheduled', scheduled_for: future }))).toBe(
      true,
    );
  });

  it('returns false for scheduled article with past date', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isScheduledForFuture(makeArticle({ status: 'scheduled', scheduled_for: past }))).toBe(
      false,
    );
  });

  it('returns false for non-scheduled status', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isScheduledForFuture(makeArticle({ status: 'draft', scheduled_for: future }))).toBe(
      false,
    );
  });

  it('returns false when scheduled_for is null', () => {
    expect(isScheduledForFuture(makeArticle({ status: 'scheduled', scheduled_for: null }))).toBe(
      false,
    );
  });
});

// ── shouldAutoPublish ─────────────────────────────────────────────────────────

describe('shouldAutoPublish', () => {
  it('returns true when scheduled date has passed', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(shouldAutoPublish(makeArticle({ status: 'scheduled', scheduled_for: past }))).toBe(true);
  });

  it('returns false when scheduled date is in future', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(shouldAutoPublish(makeArticle({ status: 'scheduled', scheduled_for: future }))).toBe(
      false,
    );
  });

  it('returns false for non-scheduled status', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(shouldAutoPublish(makeArticle({ status: 'draft', scheduled_for: past }))).toBe(false);
  });
});

// ── getArticleImageUrl ────────────────────────────────────────────────────────

describe('getArticleImageUrl', () => {
  it('returns null for null/undefined article', () => {
    expect(getArticleImageUrl(null)).toBeNull();
    expect(getArticleImageUrl(undefined)).toBeNull();
  });

  it('returns hero_image_url when available', () => {
    const article = makeArticle({ hero_image_url: 'https://example.com/hero.jpg' });
    expect(getArticleImageUrl(article)).toBe('https://example.com/hero.jpg');
  });

  it('falls back through featured image fields', () => {
    const article = makeArticle({ featured_image: 'https://example.com/featured.jpg' });
    expect(getArticleImageUrl(article)).toBe('https://example.com/featured.jpg');
  });

  it('returns null when no image fields are set', () => {
    expect(getArticleImageUrl(makeArticle())).toBeNull();
  });
});

// ── filterByStatus ────────────────────────────────────────────────────────────

describe('filterByStatus', () => {
  const articles = [
    makeArticle({ status: 'draft' }),
    makeArticle({ status: 'published' }),
    makeArticle({ status: 'archived' }),
  ];

  it('returns all when status is all', () => {
    expect(filterByStatus(articles, 'all')).toHaveLength(3);
  });

  it('filters to matching status', () => {
    expect(filterByStatus(articles, 'draft')).toHaveLength(1);
    expect(filterByStatus(articles, 'published')).toHaveLength(1);
  });
});

// ── filterByCategory ──────────────────────────────────────────────────────────

describe('filterByCategory', () => {
  const articles = [makeArticle({ category_id: 'cat1' }), makeArticle({ category_id: 'cat2' })];

  it('returns all when categoryId is all', () => {
    expect(filterByCategory(articles, 'all')).toHaveLength(2);
  });

  it('filters by category_id', () => {
    expect(filterByCategory(articles, 'cat1')).toHaveLength(1);
  });
});

// ── filterByType ──────────────────────────────────────────────────────────────

describe('filterByType', () => {
  const articles = [makeArticle({ type_id: 'type1' }), makeArticle({ type_id: 'type2' })];

  it('returns all when typeId is all', () => {
    expect(filterByType(articles, 'all')).toHaveLength(2);
  });

  it('filters by type_id', () => {
    expect(filterByType(articles, 'type1')).toHaveLength(1);
  });
});

// ── searchArticles ────────────────────────────────────────────────────────────

describe('searchArticles', () => {
  const articles = [
    makeArticle({ title: 'Financial Planning Guide', excerpt: 'About finances' }),
    makeArticle({ title: 'Retirement Tips', excerpt: 'Plan for retirement' }),
    makeArticle({
      title: 'Investment Basics',
      excerpt: 'Learn to invest',
      subtitle: 'For Beginners',
    }),
  ];

  it('returns all when query is empty', () => {
    expect(searchArticles(articles, '')).toHaveLength(3);
  });

  it('searches title case-insensitively', () => {
    expect(searchArticles(articles, 'financial')).toHaveLength(1);
    expect(searchArticles(articles, 'FINANCIAL')).toHaveLength(1);
  });

  it('searches excerpt', () => {
    expect(searchArticles(articles, 'plan')).toHaveLength(2); // title + excerpt across two articles
  });

  it('searches subtitle', () => {
    expect(searchArticles(articles, 'beginners')).toHaveLength(1);
  });
});

// ── getFeaturedArticles ────────────────────────────────────────────────────────

describe('getFeaturedArticles', () => {
  const articles = [
    makeArticle({ is_featured: true }),
    makeArticle({ is_featured: false }),
    makeArticle({ is_featured: true }),
  ];

  it('returns only featured articles', () => {
    expect(getFeaturedArticles(articles)).toHaveLength(2);
  });
});

// ── sortByDate ────────────────────────────────────────────────────────────────

describe('sortByDate', () => {
  const articles = [
    makeArticle({ id: 'a1', created_at: '2026-01-01' }),
    makeArticle({ id: 'a2', created_at: '2026-03-01' }),
    makeArticle({ id: 'a3', created_at: '2026-02-01' }),
  ];

  it('sorts descending by default', () => {
    const sorted = sortByDate(articles, 'created_at');
    expect(sorted[0].id).toBe('a2');
    expect(sorted[2].id).toBe('a1');
  });

  it('sorts ascending when specified', () => {
    const sorted = sortByDate(articles, 'created_at', 'asc');
    expect(sorted[0].id).toBe('a1');
    expect(sorted[2].id).toBe('a2');
  });

  it('does not mutate original array', () => {
    const copy = [...articles];
    sortByDate(articles, 'created_at');
    expect(articles).toEqual(copy);
  });
});

// ── sortByTitle ────────────────────────────────────────────────────────────────

describe('sortByTitle', () => {
  const articles = [
    makeArticle({ id: 'a1', title: 'Zebra' }),
    makeArticle({ id: 'a2', title: 'Apple' }),
    makeArticle({ id: 'a3', title: 'Mango' }),
  ];

  it('sorts ascending by default', () => {
    const sorted = sortByTitle(articles);
    expect(sorted[0].id).toBe('a2');
    expect(sorted[2].id).toBe('a1');
  });

  it('sorts descending when specified', () => {
    const sorted = sortByTitle(articles, 'desc');
    expect(sorted[0].id).toBe('a1');
  });
});

// ── sortByFeatured ────────────────────────────────────────────────────────────

describe('sortByFeatured', () => {
  it('puts featured articles first', () => {
    const articles = [
      makeArticle({ id: 'regular', is_featured: false }),
      makeArticle({ id: 'featured', is_featured: true }),
    ];
    const sorted = sortByFeatured(articles);
    expect(sorted[0].id).toBe('featured');
  });
});

// ── validateArticle ────────────────────────────────────────────────────────────

describe('validateArticle', () => {
  const valid: CreateArticleInput = {
    title: 'Test Article',
    excerpt: 'A good excerpt',
    category_id: 'cat1',
    type_id: 'type1',
    status: 'draft',
    is_featured: false,
  };

  it('returns valid for complete input', () => {
    expect(validateArticle(valid).valid).toBe(true);
  });

  it('requires title', () => {
    const result = validateArticle({ ...valid, title: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.title).toBeDefined();
  });

  it('rejects title over 200 chars', () => {
    const result = validateArticle({ ...valid, title: 'a'.repeat(201) });
    expect(result.errors.title).toContain('200');
  });

  it('requires excerpt', () => {
    const result = validateArticle({ ...valid, excerpt: '' });
    expect(result.errors.excerpt).toBeDefined();
  });

  it('rejects excerpt over 500 chars', () => {
    const result = validateArticle({ ...valid, excerpt: 'a'.repeat(501) });
    expect(result.errors.excerpt).toContain('500');
  });

  it('requires category_id', () => {
    const result = validateArticle({ ...valid, category_id: '' });
    expect(result.errors.category_id).toBeDefined();
  });

  it('requires type_id', () => {
    const result = validateArticle({ ...valid, type_id: '' });
    expect(result.errors.type_id).toBeDefined();
  });

  it('requires scheduled_for when status is scheduled', () => {
    const result = validateArticle({ ...valid, status: 'scheduled' });
    expect(result.errors.scheduled_for).toBeDefined();
  });

  it('accepts scheduled status with scheduled_for set', () => {
    const result = validateArticle({ ...valid, status: 'scheduled', scheduled_for: '2027-01-01' });
    expect(result.valid).toBe(true);
  });
});

// ── validateCategory ──────────────────────────────────────────────────────────

describe('validateCategory', () => {
  it('returns valid for valid input', () => {
    expect(validateCategory({ name: 'Finance' }).valid).toBe(true);
  });

  it('requires name', () => {
    const result = validateCategory({ name: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects name over 100 chars', () => {
    const result = validateCategory({ name: 'a'.repeat(101) });
    expect(result.errors.name).toBeDefined();
  });

  it('rejects description over 500 chars', () => {
    const result = validateCategory({ name: 'Valid', description: 'a'.repeat(501) });
    expect(result.errors.description).toBeDefined();
  });
});

// ── validateContentType ───────────────────────────────────────────────────────

describe('validateContentType', () => {
  it('returns valid for valid input', () => {
    expect(validateContentType({ name: 'Article' }).valid).toBe(true);
  });

  it('requires name', () => {
    expect(validateContentType({ name: '' }).valid).toBe(false);
  });
});

// ── formatPublishDate ─────────────────────────────────────────────────────────

describe('formatPublishDate', () => {
  it('formats a date string', () => {
    const result = formatPublishDate('2026-01-05');
    expect(result).toMatch(/Jan/i);
    expect(result).toMatch(/2026/);
  });
});

// ── formatDate / formatDateTime ───────────────────────────────────────────────

describe('formatDate', () => {
  it('accepts string', () => {
    expect(formatDate('2026-03-15')).toMatch(/Mar/i);
  });

  it('accepts Date object', () => {
    expect(formatDate(new Date('2026-06-01'))).toMatch(/2026/);
  });
});

describe('formatDateTime', () => {
  it('includes time part', () => {
    const result = formatDateTime('2026-01-05T14:30:00');
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

// ── formatRelativeTime ────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "Just now" for very recent', () => {
    const recent = new Date(Date.now() - 5000).toISOString();
    expect(formatRelativeTime(recent)).toBe('Just now');
  });

  it('returns minutes ago', () => {
    const mins = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(formatRelativeTime(mins)).toMatch(/min/i);
  });

  it('returns hours ago', () => {
    const hours = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(hours)).toMatch(/hour/i);
  });

  it('returns days ago', () => {
    const days = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(days)).toMatch(/day/i);
  });

  it('returns formatted date for old content', () => {
    expect(formatRelativeTime('2020-01-01')).toMatch(/2020/);
  });
});

// ── truncateText ──────────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns text unchanged when within limit', () => {
    expect(truncateText('Hello', 100)).toBe('Hello');
  });

  it('truncates with ellipsis', () => {
    expect(truncateText('Hello World', 8)).toBe('Hello...');
  });

  it('uses default maxLength of 100', () => {
    const long = 'a'.repeat(105);
    expect(truncateText(long)).toHaveLength(100);
  });
});

// ── groupByStatus ─────────────────────────────────────────────────────────────

describe('groupByStatus', () => {
  it('groups articles by status', () => {
    const articles = [
      makeArticle({ status: 'draft' }),
      makeArticle({ status: 'published' }),
      makeArticle({ status: 'draft' }),
    ];
    const result = groupByStatus(articles);
    expect(result.draft).toHaveLength(2);
    expect(result.published).toHaveLength(1);
    expect(result.archived).toHaveLength(0);
  });
});

// ── groupByCategory ───────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  it('groups articles by category_id', () => {
    const articles = [
      makeArticle({ category_id: 'cat1' }),
      makeArticle({ category_id: 'cat2' }),
      makeArticle({ category_id: 'cat1' }),
    ];
    const result = groupByCategory(articles);
    expect(result['cat1']).toHaveLength(2);
    expect(result['cat2']).toHaveLength(1);
  });
});
