/**
 * Publications Feature - ArticleEditor Component (REFACTORED)
 *
 * Complete article creation and editing interface with rich text editor,
 * image upload, scheduling, and publishing controls.
 * Now uses the new hooks, services, and shared components.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import {
  ChevronLeft,
  MoreHorizontal,
  Send,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  History,
} from 'lucide-react';
import { VersionHistory } from './components/VersionHistory';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Tabs } from '../../../ui/tabs';
import { NavTabsList, NavTabsTrigger, PageHeader, useUrlState } from '../../layout/page';

/** "2 min ago" / "3 h ago" / a date — for the header's "Saved …" line. */
function formatSavedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Import from refactored modules
import { PublicationsAPI } from './api';
import type {
  ArticleNotificationCampaign,
  ArticleNotificationJob,
  CreateArticleInput,
} from './types';
import type { ContentTemplate, GenerateArticleResult } from './types';
import { useArticleForm, useCategories, useTypes, useArticleActions } from './hooks';

import {
  TextField,
  TextareaField,
  StatusBadge,
  ErrorList,
  LoadingState,
  ConfirmDialog,
  useConfirmDialog,
  ArticlePreview,
} from './components';

import { generateSlug } from './utils';

import { type Article, type ArticleFormData } from './types';

import { toast } from 'sonner';
import { PublishProgressDialog } from './editor/PublishProgressDialog';
import { ScheduleDialog } from './editor/ScheduleDialog';
import { EditorTabContent } from './editor/EditorTabContent';

const EDITOR_VIEWS = ['editor', 'preview', 'seo'] as const;
type EditorView = (typeof EDITOR_VIEWS)[number];

interface ArticleEditorProps {
  article?: Article | null;
  initialTemplate?: ContentTemplate | null;
  aiGeneratedResult?: (GenerateArticleResult & { categoryId?: string }) | null;
  onBack: () => void;
  onSaved: () => void;
}

export function ArticleEditor({
  article,
  initialTemplate,
  aiGeneratedResult,
  onBack,
  onSaved,
}: ArticleEditorProps) {
  const isEditMode = !!article;

  // Form management with auto-save
  const { formData, errors, isDirty, isSaving, updateField, updateMultipleFields, save, validate } =
    useArticleForm({
      article: article || null,
      autoSave: true,
      onSuccess: (_savedArticle) => {
        // For published articles being updated: stay in the editor so the user
        // can continue making changes without being navigated back to the list.
        // The article remains published — the URL/slug is unchanged.
        if (isEditMode && article?.status === 'published') {
          toast.success('Article updated — changes are now live on the website');
          setSuccessMessage('Article updated successfully. Changes are live.');
          // Do NOT call onSaved() — we intentionally stay in the editor.
        } else {
          setSuccessMessage(
            isEditMode ? 'Article updated successfully' : 'Article created successfully',
          );
          onSaved();
        }
      },
      onError: (error) => {
        setError(error);
      },
    });

  // Data fetching
  const { categories, isLoading: categoriesLoading } = useCategories({ activeOnly: true });
  const { types } = useTypes({ activeOnly: true });

  // Article actions
  const { handleSchedule, isProcessing } = useArticleActions({
    onSuccess: (message) => {
      setSuccessMessage(message);
      onSaved();
    },
    onError: (error) => {
      setError(error);
    },
  });

  // UI state
  // Editor | Preview | SEO & meta, and the version-history page, live in the address.
  const [activeTab, setActiveTab] = useUrlState<EditorView>('editorTab', 'editor', EDITOR_VIEWS);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [publishJob, setPublishJob] = useState<ArticleNotificationJob | null>(null);
  const [publishCampaign, setPublishCampaign] = useState<ArticleNotificationCampaign | null>(null);
  const [isPublishingNow, setIsPublishingNow] = useState(false);
  const [publishActivityStep, setPublishActivityStep] = useState<
    'preparing' | 'saving' | 'publishing' | 'queueing'
  >('preparing');
  const [isHeroImageUploading, setIsHeroImageUploading] = useState(false);
  const [isThumbnailUploading, setIsThumbnailUploading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!isEditMode);
  const [scheduledDate, setScheduledDate] = useState('');

  // Notification toggle for publish
  const [notifySubscribers, setNotifySubscribers] = useState(true);

  // Notification toggle for scheduled publish
  const [notifyOnScheduledPublish, setNotifyOnScheduledPublish] = useState(true);

  // Version history
  const [historyParam, setHistoryParam] = useUrlState<'' | 'history'>('editorPage', '', [
    '',
    'history',
  ]);
  const showVersionHistory = historyParam === 'history';
  const setShowVersionHistory = (open: boolean) => setHistoryParam(open ? 'history' : '');

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
      setHistoryParam('');
      toast.success('Version restored — editor updated with restored content');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to refetch restored article';
      setError(msg);
      console.error('Version restore refetch error:', err);
    }
  }, [article?.id, updateMultipleFields, setHistoryParam]);

  // Auto-generate slug from title
  useEffect(() => {
    if (autoSlug && formData.title) {
      updateField('slug', generateSlug(formData.title));
    }
  }, [formData.title, autoSlug, updateField]);

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
      const insightsType = types.find((t) => t.name === 'Insights & Education');
      if (insightsType) {
        updateField('type_id', insightsType.id);
      }
    }
  }, [isEditMode, types, formData.type_id, updateField]);

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

  const imageUploadInProgress = isHeroImageUploading || isThumbnailUploading;

  const handleSave = async () => {
    setError(null);

    if (imageUploadInProgress) {
      setError('Please wait for image uploads to finish before saving.');
      return;
    }

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
    if (imageUploadInProgress) {
      setError('Please wait for image uploads to finish before publishing.');
      return;
    }
    if (!validate()) {
      setError('Please fix validation errors before publishing');
      return;
    }
    setPublishJob(null);
    setPublishCampaign(null);
    setShowPublishDialog(true);
  };

  const publishCampaignInFlight = Boolean(
    publishCampaign &&
    (publishCampaign.status === 'queued' || publishCampaign.status === 'processing'),
  );
  const publishJobInFlight = Boolean(
    !publishCampaign &&
    publishJob &&
    (publishJob.status === 'queued' || publishJob.status === 'processing'),
  );
  const publishInFlight = publishCampaignInFlight || publishJobInFlight;
  const publishDialogBusy = isProcessing || isPublishingNow || publishInFlight;

  // Escape key handler for the custom publish dialog
  useEffect(() => {
    if (!showPublishDialog || publishDialogBusy) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPublishDialog(false);
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [showPublishDialog, publishDialogBusy]);

  useEffect(() => {
    if (!publishCampaign?.id || !showPublishDialog) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollCampaign = async () => {
      try {
        const latestCampaign = await PublicationsAPI.Articles.getNotificationCampaign(
          publishCampaign.id,
        );
        if (cancelled) return;

        setPublishCampaign(latestCampaign);

        if (latestCampaign.status === 'queued' || latestCampaign.status === 'processing') {
          timeoutId = setTimeout(pollCampaign, 2000);
        }
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : 'Failed to refresh publish notification progress';
        setError(message);
        timeoutId = setTimeout(pollCampaign, 4000);
      }
    };

    void pollCampaign();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [publishCampaign?.id, publishCampaign?.status, showPublishDialog]);

  useEffect(() => {
    if (publishCampaign?.id || !publishJob?.id || !showPublishDialog) return;

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

        const message =
          err instanceof Error ? err.message : 'Failed to refresh publish notification progress';
        setError(message);
        timeoutId = setTimeout(pollJob, 4000);
      }
    };

    void pollJob();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [publishCampaign?.id, publishJob?.id, publishJob?.status, showPublishDialog]);

  const closePublishDialog = useCallback(
    (navigateBack: boolean) => {
      setShowPublishDialog(false);
      setPublishJob(null);
      setPublishCampaign(null);
      setIsPublishingNow(false);
      setPublishActivityStep('preparing');

      if (navigateBack) {
        onSaved();
      }
    },
    [onSaved],
  );

  const handlePublishConfirm = async () => {
    setError(null);
    setIsPublishingNow(true);
    setPublishActivityStep('preparing');
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
        setPublishActivityStep('saving');
        // For new articles: create via API directly, then publish.
        // We bypass handleCreate from useArticleActions because its onSuccess
        // calls onSaved() which navigates away before handlePublish can run.
        const newArticle = await PublicationsAPI.Articles.createArticle(serverPayload);
        if (newArticle?.id) {
          setPublishActivityStep('publishing');
          const publishResult = await PublicationsAPI.Articles.publishArticle(newArticle.id, {
            notify_subscribers: notifySubscribers,
          });

          if (publishResult.notificationCampaign) {
            setPublishActivityStep('queueing');
            setPublishCampaign(publishResult.notificationCampaign);
            setPublishJob(publishResult.notificationJob);

            if (publishResult.notificationCampaign.status === 'queue_failed') {
              setSuccessMessage('Article published, but newsletter delivery could not be queued.');
              setError(
                publishResult.notificationError ||
                  publishResult.notificationCampaign.lastError ||
                  'Newsletter delivery could not be queued.',
              );
            } else if (publishResult.notificationCampaign.status === 'no_recipients') {
              setSuccessMessage(
                'Article published. No newsletter recipients were eligible for this send.',
              );
            } else {
              setSuccessMessage('Article published. Newsletter delivery has been queued.');
            }
          } else if (publishResult.notificationJob) {
            setPublishActivityStep('queueing');
            setSuccessMessage('Article published. Newsletter delivery has been queued.');
            setPublishJob(publishResult.notificationJob);
          } else if (publishResult.notificationError) {
            setPublishActivityStep('queueing');
            setSuccessMessage('Article published, but newsletter delivery could not be queued.');
            setError(publishResult.notificationError);
          } else {
            setSuccessMessage('Article created and published successfully');
            closePublishDialog(true);
          }
        }
      } else if (article?.id) {
        // For existing articles: save any pending changes first, then publish.
        if (isDirty) {
          setPublishActivityStep('saving');
          await PublicationsAPI.Articles.updateArticle({ id: article.id, ...serverPayload });
        }
        setPublishActivityStep('publishing');
        const publishResult = await PublicationsAPI.Articles.publishArticle(article.id, {
          notify_subscribers: notifySubscribers,
        });

        if (publishResult.notificationCampaign) {
          setPublishActivityStep('queueing');
          setPublishCampaign(publishResult.notificationCampaign);
          setPublishJob(publishResult.notificationJob);

          if (publishResult.notificationCampaign.status === 'queue_failed') {
            setSuccessMessage('Article published, but newsletter delivery could not be queued.');
            setError(
              publishResult.notificationError ||
                publishResult.notificationCampaign.lastError ||
                'Newsletter delivery could not be queued.',
            );
          } else if (publishResult.notificationCampaign.status === 'no_recipients') {
            setSuccessMessage(
              'Article published. No newsletter recipients were eligible for this send.',
            );
          } else {
            setSuccessMessage('Article published. Newsletter delivery has been queued.');
          }
        } else if (publishResult.notificationJob) {
          setPublishActivityStep('queueing');
          setSuccessMessage('Article published. Newsletter delivery has been queued.');
          setPublishJob(publishResult.notificationJob);
        } else if (publishResult.notificationError) {
          setPublishActivityStep('queueing');
          setSuccessMessage('Article published, but newsletter delivery could not be queued.');
          setError(publishResult.notificationError);
        } else {
          setSuccessMessage('Article published successfully');
          closePublishDialog(true);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish article';
      setError(msg);
      console.error('Publish error:', err);
    } finally {
      setIsPublishingNow(false);
    }
  };

  const handleScheduleClick = () => {
    if (imageUploadInProgress) {
      setError('Please wait for image uploads to finish before scheduling.');
      return;
    }
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
        onConfirm: onBack,
      });
    } else {
      onBack();
    }
  };

  const activePublishStatus = publishCampaign?.status ?? publishJob?.status ?? null;
  const activePublishRecipientCount =
    publishCampaign?.intendedRecipientCount ?? publishJob?.recipientCount ?? 0;
  const activePublishPendingCount = publishCampaign
    ? publishCampaign.pendingCount +
      publishCampaign.sendingCount +
      publishCampaign.failedRetryableCount
    : (publishJob?.pendingCount ?? 0);
  const activePublishSentCount = publishCampaign?.sentCount ?? publishJob?.sentCount ?? 0;
  const activePublishFailedCount = publishCampaign
    ? publishCampaign.failedTerminalCount
    : (publishJob?.failedCount ?? 0);
  const activePublishProcessedCount =
    publishCampaign?.processedCount ?? publishJob?.processedCount ?? 0;
  const activePublishProgressPercent =
    publishCampaign?.progressPercent ?? publishJob?.progressPercent ?? 0;
  const activePublishLastError = publishCampaign?.lastError ?? publishJob?.lastError ?? null;

  if (categoriesLoading) {
    return <LoadingState message="Loading editor..." />;
  }

  const saveLabel = isSaving
    ? 'Saving…'
    : imageUploadInProgress
      ? 'Uploading image…'
      : article?.status === 'published'
        ? 'Update article'
        : 'Save draft';
  const busy = isProcessing || isSaving || imageUploadInProgress;
  const articleTitle = formData.title?.trim() || article?.title || 'Untitled article';

  if (showVersionHistory && article?.id) {
    return (
      <VersionHistory
        articleId={article.id}
        articleTitle={articleTitle}
        isOpen
        onClose={() => setShowVersionHistory(false)}
        onRestore={handleVersionRestore}
        currentBody={formData.body}
      />
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleBackClick}
        className="inline-flex w-fit items-center gap-1 rounded text-sm text-nw-text-2 hover:text-nw-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nw-violet/60"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to articles
      </button>
      <PageHeader
        title={isEditMode ? 'Edit article' : 'New article'}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {article ? <StatusBadge status={article.status} /> : null}
            {isSaving ? (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Saving…
              </span>
            ) : isDirty ? (
              <span className="text-xs text-orange-600">· Unsaved changes</span>
            ) : article?.updated_at ? (
              <span className="text-xs">· Saved {formatSavedAt(article.updated_at)}</span>
            ) : null}
          </span>
        }
        actions={
          <>
            {isEditMode && article?.id && (
              <Button variant="outline" onClick={() => setShowVersionHistory(true)}>
                <History className="h-4 w-4" aria-hidden="true" />
                History
              </Button>
            )}
            {article?.status !== 'published' ? (
              <>
                <Button variant="outline" onClick={handleSave} disabled={busy || !isDirty}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  {saveLabel}
                </Button>
                <Button onClick={handlePublishClick} disabled={busy}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {imageUploadInProgress ? 'Uploading image…' : 'Publish…'}
                </Button>
              </>
            ) : (
              <Button onClick={handleSave} disabled={busy || !isDirty}>
                <Save className="h-4 w-4" aria-hidden="true" />
                {saveLabel}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More article actions">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleScheduleClick} disabled={busy}>
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  Schedule…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

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
      {errors.length > 0 && <ErrorList errors={errors} title="Please fix the following errors:" />}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EditorView)}>
        <NavTabsList aria-label="Article">
          <NavTabsTrigger value="editor">Editor</NavTabsTrigger>
          <NavTabsTrigger value="preview">Preview</NavTabsTrigger>
          <NavTabsTrigger value="seo">SEO &amp; meta</NavTabsTrigger>
        </NavTabsList>
      </Tabs>

      {/* Editor Tab */}
      <EditorTabContent
        article={article ?? undefined}
        activeTab={activeTab}
        autoSlug={autoSlug}
        categories={categories}
        formData={formData}
        setAutoSlug={setAutoSlug}
        setIsHeroImageUploading={setIsHeroImageUploading}
        setIsThumbnailUploading={setIsThumbnailUploading}
        updateField={updateField}
      />

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <ArticlePreview
          article={
            {
              ...formData,
              id: article?.id || 'preview',
              created_at: article?.created_at || new Date().toISOString(),
              updated_at: article?.updated_at || new Date().toISOString(),
              view_count: article?.view_count || 0,
            } as unknown as React.ComponentProps<typeof ArticlePreview>['article']
          }
          categories={categories}
          types={types}
          onClose={() => setActiveTab('editor')}
        />
      )}

      {/* SEO Tab */}
      {activeTab === 'seo' && (
        <Card>
          <CardHeader>
            <CardTitle>SEO &amp; meta tags</CardTitle>
            <CardDescription>Optimize your article for search engines</CardDescription>
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

      <PublishProgressDialog
        activePublishFailedCount={activePublishFailedCount}
        activePublishLastError={activePublishLastError}
        activePublishPendingCount={activePublishPendingCount}
        activePublishProcessedCount={activePublishProcessedCount}
        activePublishProgressPercent={activePublishProgressPercent}
        activePublishRecipientCount={activePublishRecipientCount}
        activePublishSentCount={activePublishSentCount}
        activePublishStatus={activePublishStatus}
        closePublishDialog={closePublishDialog}
        handlePublishConfirm={handlePublishConfirm}
        isEditMode={isEditMode}
        isPublishingNow={isPublishingNow}
        notifySubscribers={notifySubscribers}
        publishActivityStep={publishActivityStep}
        publishCampaign={publishCampaign}
        publishDialogBusy={publishDialogBusy}
        publishInFlight={publishInFlight}
        publishJob={publishJob}
        setNotifySubscribers={setNotifySubscribers}
        showPublishDialog={showPublishDialog}
      />

      <ScheduleDialog
        handleScheduleConfirm={handleScheduleConfirm}
        isProcessing={isProcessing}
        notifyOnScheduledPublish={notifyOnScheduledPublish}
        scheduledDate={scheduledDate}
        setNotifyOnScheduledPublish={setNotifyOnScheduledPublish}
        setScheduledDate={setScheduledDate}
        setShowScheduleDialog={setShowScheduleDialog}
        showScheduleDialog={showScheduleDialog}
      />

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
    </div>
  );
}
