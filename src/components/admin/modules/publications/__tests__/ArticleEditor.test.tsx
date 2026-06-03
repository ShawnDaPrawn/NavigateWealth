/**
 * ArticleEditor — Render / Characterization Test (Phase 4)
 * =========================================================
 *
 * Locks the loading-gate bypass and the always-visible "New Article" / "Edit
 * Article" heading for this 1,434-line Phase 6 decomposition target.
 *
 * Publications hooks, RichTextEditor (TipTap), ImageUploader, and VersionHistory
 * are mocked to avoid canvas / ProseMirror issues in jsdom.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils';

const formStub = {
  formData: {
    title: '',
    slug: '',
    excerpt: '',
    body: '',
    status: 'draft',
    categoryId: null,
    typeId: null,
    featuredImage: null,
    thumbnailImage: null,
    tags: [],
    isPressRelease: false,
    scheduledPublishAt: null,
  },
  isDirty: false,
  isSaving: false,
  errors: {},
  updateField: vi.fn(),
  updateMultipleFields: vi.fn(),
  generateSlugFromTitle: vi.fn(),
  calculateReadingTimeFromBody: vi.fn(),
  save: vi.fn(),
  validate: vi.fn().mockReturnValue(true),
  reset: vi.fn(),
};

vi.mock('@/components/admin/modules/publications/hooks', () => ({
  useArticleForm: () => formStub,
  useCategories: () => ({ categories: [], isLoading: false }),
  useTypes: () => ({ types: [] }),
  useArticleActions: () => ({
    handleCreate: vi.fn(),
    handleUpdate: vi.fn(),
    handleSchedule: vi.fn(),
    isProcessing: false,
  }),
}));

vi.mock('@/components/admin/modules/publications/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));

vi.mock('@/components/admin/modules/publications/ImageUploader', () => ({
  ImageUploader: () => null,
}));

vi.mock('@/components/admin/modules/publications/components/VersionHistory', () => ({
  VersionHistory: () => null,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { ArticleEditor } from '../ArticleEditor';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArticleEditor', () => {
  it('shows "New Article" heading when no article is provided', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    expect(screen.getByText('New Article')).toBeTruthy();
  });

  it('shows "Edit Article" heading when an article is provided', () => {
    render(
      <ArticleEditor
        article={{ id: 'a-1', status: 'draft' } as never}
        onBack={noop}
        onSaved={noop}
      />,
    );

    expect(screen.getByText('Edit Article')).toBeTruthy();
  });

  it('shows the Publish Now and Save Draft buttons', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    expect(screen.getByRole('button', { name: /publish now/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeTruthy();
  });
});
