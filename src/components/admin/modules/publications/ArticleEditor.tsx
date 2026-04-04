/**
 * Publications Feature - ArticleEditor Component (REFACTORED)
 * 
 * Complete article creation and editing interface with rich text editor,
 * image upload, scheduling, and publishing controls.
 * Now uses the new hooks, services, and shared components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Progress } from '../../../ui/progress';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  Mail,
  History,
} from 'lucide-react';
import { cn } from '../../../ui/utils';
import { ImageUploader } from './ImageUploader';
import { RichTextEditor } from './RichTextEditor';
import { VersionHistory } from './components/VersionHistory';

// Import from refactored modules
import { PublicationsAPI } from './api';
import type { ArticleNotificationJob, CreateArticleInput, UpdateArticleInput } from './types';
import type { ContentTemplate, GenerateArticleResult } from './types';
import {
  useArticleForm,
  useCategories,
  useTypes,
  useArticleActions,
} from './hooks';

import {
  TextField,
  TextareaField,
  SelectField,
  CheckboxField,
  DateTimeField,
  NumberStepperField,
  StatusBadge,
  ErrorList,
  LoadingState,
  ConfirmDialog,
  useConfirmDialog,
  ArticlePreview,
} from './components';

import {
  generateSlug,
  formatDate,
}
 from './utils';

import {
  type Article,
  type ArticleFormData,
} from './types';

import {
  VALIDATION_RULES,
  PRESS_CATEGORY_OPTIONS,
} from './constants';

import { toast } from 'sonner@2.0.3';

interface ArticleEditorProps {
  article?: Article | null;
  initialTemplate?: ContentTemplate | null;
  aiGeneratedResult?: (GenerateArticleResult & { categoryId?: string }) | null;
  onBack: () => void;
  onSaved: () => void;
}

export function ArticleEditor({ article, initialTemplate, aiGeneratedResult, onBack, onSaved }: ArticleEditorProps) {
  const isEditMode = !!article;

  // Form management with auto-save
  const {
    formData,
    errors,
    isDirty,
    isSaving,
    updateField,
    updateMultipleFields,
    generateSlugFromTitle,
    calculateReadingTimeFromBody,
    save,
    validate,
    reset
  } = useArticleForm({
    article: article || null,
    autoSave: true,
    onSuccess: (savedArticle) => {
      // For published articles being updated: stay in the editor so the user
      // can continue making changes without being navigated back to the list.
      // The article remains published — the URL/slug is unchanged.
      if (isEditMode && article?.status === 'published') {
        toast.success('Article updated — changes are now live on the website');
        setSuccessMessage('Article updated successfully. Changes are live.');
        // Do NOT call onSaved() — we intentionally stay in the editor.
      } else {
        setSuccessMessage(isEditMode ? 'Article updated successfully' : 'Article created successfully');
        onSaved();
      }
    },
    onError: (error) => {
      setError(error);
    }
  });

  // Data fetching
  const { categories, isLoading: categoriesLoading } = useCategories({ activeOnly: true });
  const { types } = useTypes({ activeOnly: true });

  // Article actions
  const {
    handleCreate,
    handleUpdate,
    handleSchedule,
    isProcessing
  } = useArticleActions({
    onSuccess: (message) => {
      setSuccessMessage(message);
      onSaved();
    },
    onError: (error) => {
      setError(error);
    }
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'seo'>('editor');
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishJob, setPublishJob] = useState<ArticleNotificationJob | null>(null);
  const [autoSlug, setAutoSlug] = useState(!isEditMode);
  const [scheduledDate, setScheduledDate] = useState('');

  // Notification toggle for publish
  const [notifySubscribers, setNotifySubscribers] = useState(true);

  // Notification toggle for scheduled publish
  const [notifyOnScheduledPublish, setNotifyOnScheduledPublish] = useState(true);

  // Version history
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Confirm dialog
  const confirmDialog = useConfirmDialog();

  // Version restore handler — refetches article data and resets form in-place
  const handleVersionRestore = useCallback(async () => {
    if (!article?.id) return;
    try {
      const restoredArticle = await PublicationsAPI.Articles.getArticle(article.id);
      // Map restored server data back to the form shape
      updateMultipleFields({
        title: restoredArticle.title,
        subtitle: restoredArticle.subtitle || '',
        slug: restoredArticle.slug,
        excerpt: restoredArticle.excerpt,
        body: restoredArticle.body || restoredArticle.content || '',
        category_id: restoredArticle.category_id,
        type_id: restoredArticle.type_id,
        feature_image_url: restoredArticle.hero_image_url || restoredArticle.featured_image || '',
        thumbnail_image_url: restoredArticle.thumbnail_image_url || '',
        author_name: restoredArticle.author_name || '',
        reading_time_minutes: restoredArticle.reading_time_minutes || 5,
        status: restoredArticle.status,
        is_featured: restoredArticle.is_featured,
        scheduled_publish_at: restoredArticle.scheduled_for || '',
        meta_title: restoredArticle.seo_title || '',
        meta_description: restoredArticle.meta_description || restoredArticle.seo_description || '',
      });
      setShowVersionHistory(false);
      toast.success('Version restored — editor updated with restored content');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refetch restored article';
      setError(msg);
      console.error('Version restore refetch error:', err);
    }
  }, [article?.id, updateMultipleFields]);

  // Auto-generate slug from title
  useEffect(() => {
    if (autoSlug && formData.title) {
      updateField('slug', generateSlug(formData.title));
    }
  }, [formData.title, autoSlug]);

  // Auto-clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Auto-select "Insights & Education" type for new articles
  useEffect(() => {
    if (!isEditMode && types.length > 0 && !formData.type_id) {
      const insightsType = types.find(t => t.name === 'Insights & Education');
      if (insightsType) {
        updateField('type_id', insightsType.id);
      }
    }
  }, [isEditMode, types, formData.type_id]);

  // Apply initial template if provided
  useEffect(() => {
    if (initialTemplate && !isEditMode) {
      const templateUpdates: Partial<ArticleFormData> = {
        body: initialTemplate.body || '',
      };
      // Pre-set category/type from template if provided
      if (initialTemplate.category_id) {
        templateUpdates.category_id = initialTemplate.category_id;
      }
      if (initialTemplate.type_id) {
        templateUpdates.type_id = initialTemplate.type_id;
      }
      updateMultipleFields(templateUpdates);
    }
  }, [initialTemplate, isEditMode, updateMultipleFields]);

  // Apply AI-generated result if provided
  useEffect(() => {
    if (aiGeneratedResult && !isEditMode) {
      const aiUpdates: Partial<ArticleFormData> = {
        title: aiGeneratedResult.title || '',
        excerpt: aiGeneratedResult.excerpt || '',
        slug: aiGeneratedResult.suggestedSlug || '',
        body: aiGeneratedResult.body || '',
        reading_time_minutes: aiGeneratedResult.readingTimeMinutes || 5,
        meta_description: aiGeneratedResult.suggestedMetaDescription || '',
      };
      if (aiGeneratedResult.categoryId) {
        aiUpdates.category_id = aiGeneratedResult.categoryId;
      }
      // Apply AI-suggested images (sourced out of Unsplash)
      if (aiGeneratedResult.suggestedHeroImageUrl) {
        aiUpdates.feature_image_url = aiGeneratedResult.suggestedHeroImageUrl;
      }
      if (aiGeneratedResult.suggestedThumbnailUrl) {
        aiUpdates.thumbnail_image_url = aiGeneratedResult.suggestedThumbnailUrl;
      }
      updateMultipleFields(aiUpdates);
      // Disable auto-slug since AI provided one
      setAutoSlug(false);
    }
  }, [aiGeneratedResult, isEditMode, updateMultipleFields]);

  const handleSave = async () => {
    setError(null);

    if (!validate()) {
      setError('Please fix validation errors before saving');
      return;
    }

    // Use the form hook's save() which correctly maps field names to server expectations
    const savedArticle = await save();
    if (savedArticle) {
      setSuccessMessage(isEditMode ? 'Article saved successfully' : 'Article created successfully');
    }
  };

  const handlePublishClick = () => {
    if (!validate()) {
      setError('Please fix validation errors before publishing');
      return;
    }
    setPublishJob(null);
    setShowPublishDialog(true);
  };

  const publishJobInFlight = Boolean(
    publishJob && (publishJob.status === 'queued' || publishJob.status === 'processing')
  );

  // Escape key handler for the custom publish dialog
  useEffect(() => {
    if (!showPublishDialog || isProcessing || publishJobInFlight) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPublishDialog(false);
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showPublishDialog, isProcessing, publishJobInFlight]);

  useEffect(() => {
    if (!publishJob?.id || !showPublishDialog) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollJob = async () => {
      try {
        const latestJob = await PublicationsAPI.Articles.getNotificationJob(publishJob.id);
        if (cancelled) return;

        setPublishJob(latestJob);

        if (latestJob.status === 'queued' || latestJob.status === 'processing') {
          timeoutId = setTimeout(pollJob, 2000);
        }
      } catch (err) {
        if (cancelled) return;

        const message = err instanceof Error ? err.message : 'Failed to refresh publish notification progress';
        setError(message);
        timeoutId = setTimeout(pollJob, 4000);
      }
    };

    void pollJob();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [publishJob?.id, publishJob?.status, showPublishDialog]);

  const closePublishDialog = useCallback((navigateBack: boolean) => {
    setShowPublishDialog(false);
    setPublishJob(null);

    if (navigateBack) {
      onSaved();
    }
  }, [onSaved]);

  const handlePublishConfirm = async () => {
    setError(null);
    try {
      // Build server-compatible payload from formData
      const serverPayload: CreateArticleInput = {
        title: formData.title,
        subtitle: formData.subtitle,
        slug: formData.slug,
        excerpt: formData.excerpt,
        body: formData.body,
        category_id: formData.category_id,
        type_id: formData.type_id,
        hero_image_url: formData.feature_image_url,
        thumbnail_image_url: formData.thumbnail_image_url,
        author_name: formData.author_name,
        reading_time_minutes: formData.reading_time_minutes,
        status: formData.status,
        is_featured: formData.is_featured,
        scheduled_for: formData.scheduled_publish_at,
        seo_title: formData.meta_title,
        seo_description: formData.meta_description,
        press_category: formData.press_category || null,
      };

      if (!article?.id && !isEditMode) {
        // For new articles: create via API directly, then publish.
        // We bypass handleCreate from useArticleActions because its onSuccess
        // calls onSaved() which navigates away before handlePublish can run.
        const newArticle = await PublicationsAPI.Articles.createArticle(serverPayload);
        if (newArticle?.id) {
          const publishResult = await PublicationsAPI.Articles.publishArticle(newArticle.id, {
            notify_subscribers: notifySubscribers,
          });

          if (publishResult.notificationJob) {
            setSuccessMessage('Article published. Newsletter delivery has been queued.');
            setPublishJob(publishResult.notificationJob);
          } else {
            setSuccessMessage('Article created and published successfully');
            closePublishDialog(true);
          }
        }
      } else if (article?.id) {
        // For existing articles: save any pending changes first, then publish.
        if (isDirty) {
          await PublicationsAPI.Articles.updateArticle({ id: article.id, ...serverPayload });
        }
        const publishResult = await PublicationsAPI.Articles.publishArticle(article.id, {
          notify_subscribers: notifySubscribers,
        });

        if (publishResult.notificationJob) {
          setSuccessMessage('Article published. Newsletter delivery has been queued.');
          setPublishJob(publishResult.notificationJob);
        } else {
          setSuccessMessage('Article published successfully');
          closePublishDialog(true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish article';
      setError(msg);
      console.error('Publish error:', err);
    }
  };

  const handleScheduleClick = () => {
    if (!validate()) {
      setError('Please fix validation errors before scheduling');
      return;
    }
    setShowScheduleDialog(true);
  };

  const handleScheduleConfirm = async () => {
    if (!scheduledDate) {
      setError('Please select a date and time');
      return;
    }

    setError(null);
    try {
      if (!article?.id && !isEditMode) {
        // Build server-compatible payload for new article creation
        const serverPayload: CreateArticleInput = {
          title: formData.title,
          subtitle: formData.subtitle,
          slug: formData.slug,
          excerpt: formData.excerpt,
          body: formData.body,
          category_id: formData.category_id,
          type_id: formData.type_id,
          hero_image_url: formData.feature_image_url,
          thumbnail_image_url: formData.thumbnail_image_url,
          author_name: formData.author_name,
          reading_time_minutes: formData.reading_time_minutes,
          status: formData.status,
          is_featured: formData.is_featured,
          seo_title: formData.meta_title,
          seo_description: formData.meta_description,
          press_category: formData.press_category || null,
        };
        // For new articles: create via API directly, then schedule.
        // Bypass handleCreate to avoid onSuccess navigating away prematurely.
        const newArticle = await PublicationsAPI.Articles.createArticle(serverPayload);
        if (newArticle?.id) {
          await handleSchedule(newArticle.id, scheduledDate, notifyOnScheduledPublish);
        }
      } else if (article?.id) {
        await handleSchedule(article.id, scheduledDate, notifyOnScheduledPublish);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule article';
      setError(msg);
      console.error('Schedule error:', err);
    }
    setShowScheduleDialog(false);
  };

  const handleBackClick = () => {
    if (isDirty) {
      confirmDialog.open({
        title: 'Unsaved Changes',
        description: 'You have unsaved changes. Are you sure you want to leave?',
        onConfirm: onBack
      });
    } else {
      onBack();
    }
  };

  if (categoriesLoading) {
    return <LoadingState message="Loading editor..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={handleBackClick}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isEditMode ? 'Edit Article' : 'New Article'}
            </h1>
            {article && (
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={article.status} />
                {isSaving && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </span>
                )}
                {isDirty && !isSaving && (
                  <span className="text-xs text-orange-600">Unsaved changes</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setActiveTab(activeTab === 'preview' ? 'editor' : 'preview')}
          >
            <Eye className="h-4 w-4 mr-2" />
            {activeTab === 'preview' ? 'Edit' : 'Preview'}
          </Button>
          {isEditMode && article?.id && (
            <Button
              variant="outline"
              onClick={() => setShowVersionHistory(true)}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleScheduleClick}
            disabled={isProcessing || isSaving}
          >
            <Clock className="h-4 w-4 mr-2" />
            Schedule
          </Button>
          {article?.status !== 'published' && (
            <Button
              onClick={handlePublishClick}
              disabled={isProcessing || isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Publish Now
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isProcessing || isSaving || !isDirty}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : article?.status === 'published' ? 'Update Article' : 'Save Draft'}
          </Button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage(null)}>
            <X className="h-4 w-4 text-green-600" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      )}

      {/* Validation Errors */}
      {errors.length > 0 && (
        <ErrorList errors={errors} title="Please fix the following errors:" />
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('editor')}
            className={cn(
              'px-4 py-2 border-b-2 font-medium transition-colors',
              activeTab === 'editor'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={cn(
              'px-4 py-2 border-b-2 font-medium transition-colors',
              activeTab === 'preview'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('seo')}
            className={cn(
              'px-4 py-2 border-b-2 font-medium transition-colors',
              activeTab === 'seo'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            SEO & Meta
          </button>
        </div>
      </div>

      {/* Editor Tab */}
      {activeTab === 'editor' && (
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
                  <p className="text-xs text-gray-500 mt-1">
                    URL: /resources/{formData.slug}
                  </p>
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
                    value={formData.body}
                    onChange={(value) => updateField('body', value)}
                    placeholder='Start writing, or type "/" for commands…'
                    articleTitle={formData.title}
                    articleExcerpt={formData.excerpt}
                    articleCategory={
                      categories.find(c => c.id === formData.category_id)?.name
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Images */}
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
                <CardDescription>
                  Upload images or provide URLs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ImageUploader
                  label="Hero Image"
                  value={formData.feature_image_url || ''}
                  onChange={(value) => updateField('feature_image_url', value)}
                  description="Main image displayed at the top of the article (1200x630px recommended)"
                />

                <ImageUploader
                  label="Thumbnail Image"
                  value={formData.thumbnail_image_url || ''}
                  onChange={(value) => updateField('thumbnail_image_url', value)}
                  description="Smaller image for lists and cards (400x300px recommended)"
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
                  options={categories.filter(cat => cat.id).map(cat => ({
                    value: cat.id,
                    label: cat.name
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
                  onChange={(value) => updateField('press_category', (value === '__none__' ? null : value) as ArticleFormData['press_category'])}
                  options={[
                    { value: '__none__', label: 'None (not a press release)' },
                    ...PRESS_CATEGORY_OPTIONS.map(opt => ({
                      value: opt.value,
                      label: opt.label
                    }))
                  ]}
                />
                {formData.press_category && (
                  <p className="text-xs text-purple-600">
                    This article will appear on the Press page under the "{PRESS_CATEGORY_OPTIONS.find(o => o.value === formData.press_category)?.label}" tab when published.
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
      )}

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <ArticlePreview
          article={{
            ...formData,
            id: article?.id || 'preview',
            created_at: article?.created_at || new Date().toISOString(),
            updated_at: article?.updated_at || new Date().toISOString(),
            view_count: article?.view_count || 0
          } as Article}
          categories={categories}
          onClose={() => setActiveTab('editor')}
        />
      )}

      {/* SEO Tab */}
      {activeTab === 'seo' && (
        <Card>
          <CardHeader>
            <CardTitle>SEO & Meta Tags</CardTitle>
            <CardDescription>
              Optimize your article for search engines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TextField
              label="SEO Title"
              name="meta_title"
              value={formData.meta_title || ''}
              onChange={(value) => updateField('meta_title', value)}
              placeholder="Leave blank to use article title"
              maxLength={60}
              description="Recommended: 50-60 characters"
            />

            <TextareaField
              label="SEO Description"
              name="meta_description"
              value={formData.meta_description || ''}
              onChange={(value) => updateField('meta_description', value)}
              placeholder="Leave blank to use excerpt"
              rows={3}
              maxLength={160}
              showCharCount
              description="Recommended: 150-160 characters"
            />

            <TextField
              label="Canonical URL"
              name="canonical_url"
              value={formData.canonical_url || ''}
              onChange={(value) => updateField('canonical_url', value)}
              placeholder="https://example.com/original-article"
              description="Optional: Use if this content was published elsewhere first"
            />
          </CardContent>
        </Card>
      )}

      {/* Publish Confirmation Dialog */}
      {showPublishDialog && (
        <div className="contents">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={!isProcessing && !publishJob ? () => closePublishDialog(false) : undefined}
            aria-hidden="true"
          />
          {/* Dialog */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-dialog-title"
            aria-describedby="publish-dialog-description"
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {!publishJob ? (
                <>
                  <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>

                  <h3 id="publish-dialog-title" className="text-xl mb-2 text-gray-900">
                    Publish Article
                  </h3>
                  <p id="publish-dialog-description" className="text-gray-600 mb-4">
                    Are you sure you want to publish this article? It will be immediately visible to all users.
                  </p>

                  <div className="bg-gray-50 rounded-lg p-3 mb-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifySubscribers}
                        onChange={(e) => setNotifySubscribers(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-purple-600" />
                          Notify newsletter subscribers
                        </span>
                        <span className="text-xs text-gray-500 block mt-0.5">
                          Send an email notification to all confirmed subscribers with a link to this article
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => closePublishDialog(false)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={handlePublishConfirm}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Publishing...' : 'Publish Now'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 id="publish-dialog-title" className="text-xl text-gray-900">
                        {publishJobInFlight ? 'Publishing And Sending' : 'Publish Delivery Summary'}
                      </h3>
                      <p id="publish-dialog-description" className="text-sm text-gray-600 mt-1">
                        {publishJobInFlight
                          ? 'The article is live and newsletter delivery is progressing in the queued sender.'
                          : 'The article is live and the queued newsletter delivery has finished its current run.'}
                      </p>
                    </div>
                    <Badge className={cn(
                      publishJob.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : publishJob.status === 'completed_with_failures'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-700'
                    )}>
                      {publishJob.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600">Newsletter progress</span>
                        <span className="font-medium text-gray-900">
                          {publishJob.processedCount} / {publishJob.recipientCount}
                        </span>
                      </div>
                      <Progress value={publishJob.progressPercent} className="h-2.5" indicatorClassName="bg-green-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                        <p className="text-gray-500">Recipients</p>
                        <p className="text-lg font-semibold text-gray-900">{publishJob.recipientCount}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                        <p className="text-gray-500">Pending</p>
                        <p className="text-lg font-semibold text-amber-700">{publishJob.pendingCount}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                        <p className="text-gray-500">Sent</p>
                        <p className="text-lg font-semibold text-green-700">{publishJob.sentCount}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                        <p className="text-gray-500">Failed</p>
                        <p className="text-lg font-semibold text-red-700">{publishJob.failedCount}</p>
                      </div>
                    </div>

                    {publishJob.lastError && publishJob.failedCount > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-900">Latest delivery issue</p>
                        <p className="text-xs text-amber-800 mt-1">{publishJob.lastError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 justify-end mt-6">
                    {publishJobInFlight ? (
                      <Button variant="outline" onClick={() => closePublishDialog(true)}>
                        Continue in Background
                      </Button>
                    ) : (
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => closePublishDialog(true)}
                      >
                        Done
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Schedule Publication</CardTitle>
              <CardDescription>
                Choose when this article should be published
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DateTimeField
                label="Publication Date & Time"
                name="scheduled_publish_at"
                value={scheduledDate}
                onChange={setScheduledDate}
                required
                min={new Date().toISOString().slice(0, 16)}
              />

              {/* Notification Toggle for Scheduled Publish */}
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnScheduledPublish}
                    onChange={(e) => setNotifyOnScheduledPublish(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-purple-600" />
                      Notify newsletter subscribers on publish
                    </span>
                    <span className="text-xs text-gray-500 block mt-0.5">
                      Automatically send an email notification to all confirmed subscribers when this article is published on the scheduled date
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleScheduleConfirm} disabled={isProcessing || !scheduledDate}>
                  <Clock className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Scheduling...' : 'Schedule'}
                </Button>
                <Button variant="outline" onClick={() => setShowScheduleDialog(false)} disabled={isProcessing}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unsaved Changes Dialog */}
      {confirmDialog.isOpen && confirmDialog.config && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={confirmDialog.close}
          onConfirm={confirmDialog.confirm}
          title={confirmDialog.config.title}
          description={confirmDialog.config.description}
          variant="warning"
        />
      )}

      {/* Version History */}
      {showVersionHistory && (
        <VersionHistory
          articleId={article?.id || ''}
          isOpen={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleVersionRestore}
          currentBody={formData.body}
        />
      )}
    </div>
  );
}
