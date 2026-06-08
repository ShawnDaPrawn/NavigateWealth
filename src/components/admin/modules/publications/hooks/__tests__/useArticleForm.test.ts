/**
 * Tests for useArticleForm hook
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useArticleForm } from '../useArticleForm';
import type { Article, ArticleFormData } from '../../types';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
const mockCreateArticle = vi.fn();
const mockUpdateArticle = vi.fn();
const mockGenerateSlug = vi.fn();
const mockCalculateReadingTime = vi.fn();
const mockValidateArticleForm = vi.fn();

vi.mock('../../api', () => ({
  PublicationsAPI: {
    Articles: {
      createArticle: (...args: unknown[]) => mockCreateArticle(...args),
      updateArticle: (...args: unknown[]) => mockUpdateArticle(...args),
    },
  },
}));

vi.mock('../../utils', () => ({
  generateSlug: (...args: unknown[]) => mockGenerateSlug(...args),
  calculateReadingTime: (...args: unknown[]) => mockCalculateReadingTime(...args),
  validateArticleForm: (...args: unknown[]) => mockValidateArticleForm(...args),
}));

vi.mock('../../constants', () => ({
  DEFAULT_ARTICLE: {
    title: '',
    subtitle: '',
    slug: '',
    excerpt: '',
    body: '',
    category_id: '',
    type_id: '',
    feature_image_url: '',
    thumbnail_image_url: '',
    author_name: '',
    reading_time_minutes: 5,
    tags: [],
    status: 'draft' as const,
    is_featured: false,
    scheduled_publish_at: '',
    meta_title: '',
    meta_description: '',
    canonical_url: '',
    press_category: null,
  },
  EDITOR_CONFIG: {
    autoSaveInterval: 30_000,
    minAutoSaveLength: 20,
    maxImageSize: 5 * 1024 * 1024,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_FORM: ArticleFormData = {
  title: '',
  subtitle: '',
  slug: '',
  excerpt: '',
  body: '',
  category_id: '',
  type_id: '',
  feature_image_url: '',
  thumbnail_image_url: '',
  author_name: '',
  reading_time_minutes: 5,
  tags: [],
  status: 'draft',
  is_featured: false,
  scheduled_publish_at: '',
  meta_title: '',
  meta_description: '',
  canonical_url: '',
  press_category: null,
};

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'art-1',
    title: 'Existing Article',
    slug: 'existing-article',
    excerpt: 'Existing article excerpt that is long enough',
    body: 'Existing body content that is long enough for validation purposes',
    category_id: 'cat-1',
    type_id: 'type-1',
    status: 'published',
    is_featured: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useArticleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default validate to return no errors (valid)
    mockValidateArticleForm.mockReturnValue([]);
  });

  // ── Initial state (new article) ───────────────────────────────────────────

  it('initialises with DEFAULT_ARTICLE when no article prop is given', () => {
    const { result } = renderHook(() => useArticleForm());

    expect(result.current.formData).toEqual(DEFAULT_FORM);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.errors).toEqual([]);
  });

  it('initialises with the provided article data when article prop is given', () => {
    const article = makeArticle({ title: 'My Article', slug: 'my-article', subtitle: 'Sub' });
    const { result } = renderHook(() => useArticleForm({ article }));

    expect(result.current.formData.title).toBe('My Article');
    expect(result.current.formData.slug).toBe('my-article');
    expect(result.current.formData.subtitle).toBe('Sub');
    expect(result.current.formData.status).toBe('published');
    expect(result.current.formData.is_featured).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  // ── updateField ───────────────────────────────────────────────────────────

  it('updateField updates a single field', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateField('title', 'New Title');
    });

    expect(result.current.formData.title).toBe('New Title');
  });

  it('updateField sets isDirty to true after a field changes', async () => {
    const { result } = renderHook(() => useArticleForm());

    expect(result.current.isDirty).toBe(false);

    await act(async () => {
      result.current.updateField('title', 'Changed Title');
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('updateField does not mutate other fields', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateField('title', 'Only Title Changed');
    });

    expect(result.current.formData.slug).toBe('');
    expect(result.current.formData.excerpt).toBe('');
    expect(result.current.formData.status).toBe('draft');
  });

  // ── updateMultipleFields ──────────────────────────────────────────────────

  it('updateMultipleFields updates multiple fields at once', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateMultipleFields({
        title: 'Batch Title',
        slug: 'batch-slug',
        excerpt: 'Batch excerpt',
      });
    });

    expect(result.current.formData.title).toBe('Batch Title');
    expect(result.current.formData.slug).toBe('batch-slug');
    expect(result.current.formData.excerpt).toBe('Batch excerpt');
  });

  it('updateMultipleFields sets isDirty to true', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateMultipleFields({ title: 'Changed' });
    });

    expect(result.current.isDirty).toBe(true);
  });

  // ── generateSlugFromTitle ─────────────────────────────────────────────────

  it('generateSlugFromTitle calls generateSlug with the current title and updates the slug field', async () => {
    mockGenerateSlug.mockReturnValueOnce('generated-slug');

    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateField('title', 'My Article Title');
    });

    await act(async () => {
      result.current.generateSlugFromTitle();
    });

    expect(mockGenerateSlug).toHaveBeenCalledWith('My Article Title');
    expect(result.current.formData.slug).toBe('generated-slug');
  });

  it('generateSlugFromTitle is a no-op when title is empty', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.generateSlugFromTitle();
    });

    expect(mockGenerateSlug).not.toHaveBeenCalled();
    expect(result.current.formData.slug).toBe('');
  });

  // ── calculateReadingTimeFromBody ──────────────────────────────────────────

  it('calculateReadingTimeFromBody calls calculateReadingTime with body and updates reading_time_minutes', async () => {
    mockCalculateReadingTime.mockReturnValueOnce(3);

    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.updateField('body', 'Some article body content here');
    });

    await act(async () => {
      result.current.calculateReadingTimeFromBody();
    });

    expect(mockCalculateReadingTime).toHaveBeenCalledWith('Some article body content here');
    expect(result.current.formData.reading_time_minutes).toBe(3);
  });

  it('calculateReadingTimeFromBody is a no-op when body is empty', async () => {
    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.calculateReadingTimeFromBody();
    });

    expect(mockCalculateReadingTime).not.toHaveBeenCalled();
  });

  // ── validate ──────────────────────────────────────────────────────────────

  it('validate returns true and clears errors when form is valid', async () => {
    mockValidateArticleForm.mockReturnValueOnce([]);

    const { result } = renderHook(() => useArticleForm());

    let valid: boolean | undefined;
    await act(async () => {
      valid = result.current.validate();
    });

    expect(valid).toBe(true);
    expect(result.current.errors).toEqual([]);
  });

  it('validate returns false and sets errors when form is invalid', async () => {
    mockValidateArticleForm.mockReturnValueOnce(['Title is required', 'Slug is required']);

    const { result } = renderHook(() => useArticleForm());

    let valid: boolean | undefined;
    await act(async () => {
      valid = result.current.validate();
    });

    expect(valid).toBe(false);
    expect(result.current.errors).toEqual(['Title is required', 'Slug is required']);
  });

  // ── save (create) ─────────────────────────────────────────────────────────

  it('save creates a new article when no existing article is provided', async () => {
    const savedArticle = makeArticle({ id: 'new-1' });
    mockValidateArticleForm.mockReturnValueOnce([]);
    mockCreateArticle.mockResolvedValueOnce(savedArticle);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleForm({ onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.save();
    });

    expect(mockCreateArticle).toHaveBeenCalled();
    expect(mockUpdateArticle).not.toHaveBeenCalled();
    expect(returned).toEqual(savedArticle);
    expect(onSuccess).toHaveBeenCalledWith(savedArticle);
    expect(result.current.isSaving).toBe(false);
  });

  it('save updates an existing article when article with id is provided', async () => {
    const existingArticle = makeArticle({ id: 'art-1' });
    const updatedArticle = makeArticle({ id: 'art-1', title: 'Updated' });
    mockValidateArticleForm.mockReturnValueOnce([]);
    mockUpdateArticle.mockResolvedValueOnce(updatedArticle);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useArticleForm({ article: existingArticle, onSuccess }));

    let returned: Article | null = null;
    await act(async () => {
      returned = await result.current.save();
    });

    expect(mockUpdateArticle).toHaveBeenCalledWith(expect.objectContaining({ id: 'art-1' }));
    expect(mockCreateArticle).not.toHaveBeenCalled();
    expect(returned).toEqual(updatedArticle);
    expect(onSuccess).toHaveBeenCalledWith(updatedArticle);
  });

  it('save returns null and calls onError when validation fails', async () => {
    mockValidateArticleForm.mockReturnValueOnce(['Title is required']);
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleForm({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.save();
    });

    expect(returned).toBeNull();
    expect(mockCreateArticle).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Please fix validation errors before saving');
  });

  it('save returns null and calls onError when API call fails', async () => {
    mockValidateArticleForm.mockReturnValueOnce([]);
    mockCreateArticle.mockRejectedValueOnce(new Error('Server error'));
    const onError = vi.fn();

    const { result } = renderHook(() => useArticleForm({ onError }));

    let returned: Article | null | undefined;
    await act(async () => {
      returned = await result.current.save();
    });

    expect(returned).toBeNull();
    expect(onError).toHaveBeenCalledWith('Server error');
    expect(result.current.errors).toEqual(['Server error']);
    expect(result.current.isSaving).toBe(false);
  });

  it('save resets isDirty to false after successful save', async () => {
    const savedArticle = makeArticle();
    mockValidateArticleForm.mockReturnValue([]);
    mockCreateArticle.mockResolvedValueOnce(savedArticle);

    const { result } = renderHook(() => useArticleForm());

    // Make the form dirty first
    await act(async () => {
      result.current.updateField('title', 'Some Title');
    });
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(result.current.isDirty).toBe(false);
  });

  it('isSaving is true while save is in flight', async () => {
    let resolveSave!: (value: Article) => void;
    const pendingPromise = new Promise<Article>((res) => {
      resolveSave = res;
    });
    mockValidateArticleForm.mockReturnValueOnce([]);
    mockCreateArticle.mockReturnValueOnce(pendingPromise);

    const { result } = renderHook(() => useArticleForm());

    let savePromise: Promise<Article | null>;
    act(() => {
      savePromise = result.current.save();
    });

    expect(result.current.isSaving).toBe(true);

    await act(async () => {
      resolveSave(makeArticle());
      await savePromise!;
    });

    expect(result.current.isSaving).toBe(false);
  });

  // ── reset ─────────────────────────────────────────────────────────────────

  it('reset restores formData to DEFAULT_ARTICLE when no article prop is given', async () => {
    const { result } = renderHook(() => useArticleForm());

    // Dirty the form
    await act(async () => {
      result.current.updateField('title', 'Changed Title');
      result.current.updateField('slug', 'changed-slug');
    });

    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.slug).toBe('');
    expect(result.current.errors).toEqual([]);
  });

  it('reset restores formData to original article values when article prop is given', async () => {
    const article = makeArticle({ title: 'Original', slug: 'original' });
    const { result } = renderHook(() => useArticleForm({ article }));

    await act(async () => {
      result.current.updateField('title', 'Changed Title');
    });

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.formData.title).toBe('Original');
    expect(result.current.formData.slug).toBe('original');
    expect(result.current.errors).toEqual([]);
  });

  it('reset clears validation errors', async () => {
    mockValidateArticleForm.mockReturnValueOnce(['Error 1', 'Error 2']);

    const { result } = renderHook(() => useArticleForm());

    await act(async () => {
      result.current.validate();
    });

    expect(result.current.errors).toHaveLength(2);

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.errors).toEqual([]);
  });
});
