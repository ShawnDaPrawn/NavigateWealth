/**
 * ArticleEditor — the two dialogs the existing test does not reach.
 * ================================================================
 *
 * The publish-confirmation dialog (259 lines, closing over 21 values) and the
 * schedule dialog are the regions a decomposition carves out of the editor's
 * ~800-line return. Each opens on a state flag a toolbar button sets, and a
 * dialog wired to the wrong flag never opens while everything else looks fine.
 *
 * Written and made green BEFORE the extraction, then mutation-checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils';

const formStub = {
  formData: {
    title: 'A Title',
    slug: 'a-title',
    excerpt: 'An excerpt',
    body: '<p>Body</p>',
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
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { ArticleEditor } from '../ArticleEditor';

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the publish confirmation dialog', () => {
  it('is absent until Publish Now is clicked', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    expect(screen.queryByText(/notify newsletter subscribers/i)).toBeNull();
  });

  it('opens on Publish Now, carrying the notify-subscribers choice', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    fireEvent.click(screen.getByRole('button', { name: /publish now/i }));

    // The dialog is the only place this toggle lives.
    expect(screen.getAllByText(/notify newsletter subscribers/i).length).toBeGreaterThan(0);
  });
});

describe('the schedule dialog', () => {
  it('is absent until Schedule is clicked', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    expect(screen.queryByText(/scheduled publish date/i)).toBeNull();
  });

  it('opens on Schedule with its date input', () => {
    render(<ArticleEditor onBack={noop} onSaved={noop} />);

    const schedule = screen
      .getAllByRole('button')
      .find((b) => /schedule/i.test(b.textContent ?? ''));
    expect(schedule, 'no Schedule button in the toolbar').toBeTruthy();
    fireEvent.click(schedule!);

    const dateInput = document.querySelector('input[type="datetime-local"], input[type="date"]');
    expect(dateInput, 'schedule dialog did not open with a date field').toBeTruthy();
  });
});
