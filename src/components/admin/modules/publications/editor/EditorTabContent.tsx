/**
 * The editor tab: basic info, images, publishing options and press-release
 * sidebar.
 *
 * Split out of `ArticleEditor.tsx` (1,422 lines). Renders nothing unless the
 * editor tab is active — the condition moved in with the markup.
 */
import type { Dispatch, SetStateAction } from 'react';
import { type Category } from '../types';
import { Button } from '../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../ui/card';
import { ImageUploader } from '../ImageUploader';
import { RichTextEditor } from '../RichTextEditor';
import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
  NumberStepperField,
  StatusBadge,
} from '../components';
import { formatDate } from '../utils';
import { type Article, type ArticleFormData } from '../types';
import { VALIDATION_RULES, PRESS_CATEGORY_OPTIONS } from '../constants';

interface EditorTabContentProps {
  article: Article | undefined;
  activeTab: 'editor' | 'preview' | 'seo';
  autoSlug: boolean;
  categories: Category[];
  formData: ArticleFormData;
  setAutoSlug: Dispatch<SetStateAction<boolean>>;
  setIsHeroImageUploading: Dispatch<SetStateAction<boolean>>;
  setIsThumbnailUploading: Dispatch<SetStateAction<boolean>>;
  updateField: <K extends keyof ArticleFormData>(field: K, value: ArticleFormData[K]) => void;
}

export function EditorTabContent({
  article,
  activeTab,
  autoSlug,
  categories,
  formData,
  setAutoSlug,
  setIsHeroImageUploading,
  setIsThumbnailUploading,
  updateField,
}: EditorTabContentProps) {
  if (activeTab !== 'editor') return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField
              label="Title"
              name="title"
              value={formData.title}
              onChange={(value) => updateField('title', value)}
              placeholder="Enter article title"
              required
              maxLength={VALIDATION_RULES.title.maxLength}
            />

            <TextField
              label="Subtitle"
              name="subtitle"
              value={formData.subtitle || ''}
              onChange={(value) => updateField('subtitle', value)}
              placeholder="Optional subtitle"
              maxLength={VALIDATION_RULES.subtitle.maxLength}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => {
                    updateField('slug', e.target.value);
                    setAutoSlug(false);
                  }}
                  placeholder="article-url-slug"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoSlug(true)}
                  disabled={autoSlug}
                >
                  Auto
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">URL: /resources/{formData.slug}</p>
            </div>

            <TextareaField
              label="Excerpt"
              name="excerpt"
              value={formData.excerpt}
              onChange={(value) => updateField('excerpt', value)}
              placeholder="Brief summary (160-250 characters recommended)"
              rows={3}
              required
              maxLength={VALIDATION_RULES.excerpt.maxLength}
              showCharCount
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Article Body <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={formData.body ?? ''}
                onChange={(value) => updateField('body', value)}
                placeholder='Start writing, or type "/" for commands…'
                articleTitle={formData.title}
                articleExcerpt={formData.excerpt}
                articleCategory={categories.find((c) => c.id === formData.category_id)?.name}
              />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
            <CardDescription>Upload images or provide URLs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageUploader
              label="Hero Image"
              value={formData.feature_image_url || ''}
              onChange={(value) => updateField('feature_image_url', value)}
              description="Main image displayed at the top of the article (1200x630px recommended)"
              onUploadStateChange={setIsHeroImageUploading}
            />

            <ImageUploader
              label="Thumbnail Image"
              value={formData.thumbnail_image_url || ''}
              onChange={(value) => updateField('thumbnail_image_url', value)}
              description="Smaller image for lists and cards (400x300px recommended)"
              onUploadStateChange={setIsThumbnailUploading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Publishing Options */}
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SelectField
              label="Category"
              name="category_id"
              value={formData.category_id}
              onChange={(value) => updateField('category_id', value)}
              options={categories
                .filter((cat) => cat.id)
                .map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                }))}
              required
            />

            <TextField
              label="Author Name"
              name="author_name"
              value={formData.author_name || 'Navigate Wealth Editorial Team'}
              onChange={(value) => updateField('author_name', value)}
              placeholder="Author name"
            />

            <NumberStepperField
              label="Reading Time (minutes)"
              name="reading_time_minutes"
              value={formData.reading_time_minutes ?? 5}
              onChange={(value) => updateField('reading_time_minutes', value)}
              min={VALIDATION_RULES.readingTime.min}
              max={VALIDATION_RULES.readingTime.max}
              suffix="min"
            />

            <CheckboxField
              label="Featured Article"
              name="is_featured"
              checked={formData.is_featured}
              onChange={(checked) => updateField('is_featured', checked)}
              description="Display prominently on the homepage"
            />
          </CardContent>
        </Card>

        {/* Press Release */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Press Page</CardTitle>
            <CardDescription className="text-xs">
              Optionally feature this article on the public Press page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SelectField
              label="Press Category"
              name="press_category"
              value={formData.press_category || '__none__'}
              onChange={(value) =>
                updateField(
                  'press_category',
                  (value === '__none__' ? null : value) as ArticleFormData['press_category'],
                )
              }
              options={[
                { value: '__none__', label: 'None (not a press release)' },
                ...PRESS_CATEGORY_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                })),
              ]}
            />
            {formData.press_category && (
              <p className="text-xs text-purple-600">
                This article will appear on the Press page under the "
                {PRESS_CATEGORY_OPTIONS.find((o) => o.value === formData.press_category)?.label}"
                tab when published.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status Info */}
        {article && (
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Status:</span>
                <StatusBadge status={article.status} />
              </div>
              {article.published_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Published:</span>
                  <span className="text-sm">{formatDate(article.published_at)}</span>
                </div>
              )}
              {article.scheduled_for && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Scheduled:</span>
                  <span className="text-sm">{formatDate(article.scheduled_for)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Updated:</span>
                <span className="text-sm">{formatDate(article.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
